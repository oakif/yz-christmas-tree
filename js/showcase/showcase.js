// Image loading, encryption, and 3D showcase box
import * as THREE from 'three';
import {
    deriveKeyFromPassword,
    decryptText,
    decryptImageToObjectURL,
    base64ToArrayBuffer,
} from './crypto.js';

// Module state
let showcaseBox = null;
let showcaseBoxTargetScale = 0;
let showcaseBoxTargetOpacity = 0;
let showcaseBoxShouldShow = false;
const textureLoader = new THREE.TextureLoader();

// Multi-image state
let showcaseTextures = [];
let showcaseCurrentIndex = 0;
let showcaseLastShownIndex = -1;
let showcaseImagesLoaded = false;

// Image set state
let availableImageSets = [];
let currentImageSet = null;
let decryptionKey = null;

// External references
let scene = null;
let CONFIG = null;

export function initShowcase(sceneRef, configRef) {
    scene = sceneRef;
    CONFIG = configRef;
}

export function getShowcaseState() {
    return {
        showcaseBox,
        showcaseBoxShouldShow,
        showcaseImagesLoaded,
        showcaseTextures,
        availableImageSets,
        currentImageSet,
    };
}

export function setShowcaseBoxShouldShow(value) {
    showcaseBoxShouldShow = value;
}

export function getAvailableImageSets() {
    return availableImageSets;
}

export function getCurrentImageSet() {
    return currentImageSet;
}

// Create rectangular vignette alpha map using canvas
function createVignetteAlphaMap(edgeSoftness) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Create image data for pixel-by-pixel control
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Normalize coordinates to 0-1 range
            const u = x / size;
            const v = y / size;

            // Distance from center (0 at center, 1 at edges)
            const centerDistX = Math.abs(u - 0.5) * 2.0;
            const centerDistY = Math.abs(v - 0.5) * 2.0;
            const maxDist = Math.max(centerDistX, centerDistY);

            // Apply smoothstep for vignette (handle edgeSoftness = 0)
            let vignette;
            if (edgeSoftness <= 0.001) {
                // No vignette - fully opaque
                vignette = 1.0;
            } else {
                const smoothstep = (edge0, edge1, x) => {
                    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
                    return t * t * (3 - 2 * t);
                };
                vignette = smoothstep(1.0, 1.0 - edgeSoftness, maxDist);
            }
            const gray = Math.floor(vignette * 255);

            // alphaMap uses grayscale value (not alpha channel)
            // white = opaque, black = transparent
            const index = (y * size + x) * 4;
            data[index] = gray;      // R
            data[index + 1] = gray;  // G
            data[index + 2] = gray;  // B
            data[index + 3] = 255;   // A (always opaque)
        }
    }

    ctx.putImageData(imageData, 0, 0);

    const vignetteTexture = new THREE.CanvasTexture(canvas);
    return vignetteTexture;
}

// Initialize showcase box with a texture
export function initializeShowcaseBox(texture) {
    const imgWidth = texture.image.width;
    const imgHeight = texture.image.height;

    // Calculate box dimensions based on max width/height constraints
    const maxW = CONFIG.showcase.box.maxWidth;
    const maxH = CONFIG.showcase.box.maxHeight;
    const scaleW = maxW / imgWidth;
    const scaleH = maxH / imgHeight;
    const scale = Math.min(scaleW, scaleH);
    const boxWidth = imgWidth * scale;
    const boxHeight = imgHeight * scale;
    const boxDepth = CONFIG.showcase.box.thickness;

    // Create box geometry
    const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);

    // Create materials array (6 faces: +x, -x, +y, -y, +z (front), -z (back))
    const sideMaterial = new THREE.MeshStandardMaterial({
        color: CONFIG.showcase.box.backColor,
        transparent: true,
        opacity: 0,
    });

    const vignetteAlphaMap = createVignetteAlphaMap(CONFIG.showcase.effects.edgeSoftness);

    // Ensure texture uses correct color space
    texture.colorSpace = THREE.SRGBColorSpace;

    const frontMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        alphaMap: vignetteAlphaMap,
        transparent: true,
        opacity: 0,
        toneMapped: false,  // Exclude from tone mapping - show true colors
    });
    const backMaterial = new THREE.MeshStandardMaterial({
        color: CONFIG.showcase.box.backColor,
        transparent: true,
        opacity: 0,
    });

    const materials = [
        sideMaterial.clone(),  // +x (right)
        sideMaterial.clone(),  // -x (left)
        sideMaterial.clone(),  // +y (top)
        sideMaterial.clone(),  // -y (bottom)
        frontMaterial,         // +z (front - image)
        backMaterial,          // -z (back)
    ];

    showcaseBox = new THREE.Mesh(geometry, materials);

    // Position at scene center (camera pivot point)
    showcaseBox.position.set(0, CONFIG.treeYOffset, 0);

    // Start with scale 0 (invisible)
    showcaseBox.scale.setScalar(0.001);

    // Store current rotation for parallax smoothing
    showcaseBox.userData = {
        currentRotationX: 0,
        currentRotationY: 0,
    };

    scene.add(showcaseBox);
}

// Get next showcase image based on display mode
export function getNextShowcaseImage() {
    if (showcaseTextures.length === 0) return null;

    let index;
    if (CONFIG.showcase.displayMode === 'random') {
        // Pick random index, avoiding the last shown image if possible
        if (showcaseTextures.length === 1) {
            index = 0;
        } else {
            do {
                index = Math.floor(Math.random() * showcaseTextures.length);
            } while (index === showcaseLastShownIndex);
        }
    } else {
        // Sequential mode
        index = showcaseCurrentIndex;
        showcaseCurrentIndex = (showcaseCurrentIndex + 1) % showcaseTextures.length;
    }

    showcaseLastShownIndex = index;
    return showcaseTextures[index];
}

// Update showcase box texture and resize
export function updateShowcaseBoxTexture(texture) {
    if (!showcaseBox || !texture) return;

    // Ensure texture uses correct color space
    texture.colorSpace = THREE.SRGBColorSpace;

    // Update the front face material (index 4 in materials array)
    const frontMaterial = showcaseBox.material[4];
    frontMaterial.map = texture;
    frontMaterial.needsUpdate = true;

    // Recalculate aspect ratio and resize box if needed
    const imgWidth = texture.image.width;
    const imgHeight = texture.image.height;

    const maxW = CONFIG.showcase.box.maxWidth;
    const maxH = CONFIG.showcase.box.maxHeight;
    const scaleW = maxW / imgWidth;
    const scaleH = maxH / imgHeight;
    const scale = Math.min(scaleW, scaleH);
    const boxWidth = imgWidth * scale;
    const boxHeight = imgHeight * scale;

    // Update geometry by replacing it
    const boxDepth = CONFIG.showcase.box.thickness;
    const newGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
    showcaseBox.geometry.dispose();
    showcaseBox.geometry = newGeometry;
}

// Load master manifest and initialize image sets
export async function loadImageSetsManifest() {
    const manifestPath = CONFIG.showcase.imageFolder + 'manifest.json';

    try {
        const response = await fetch(manifestPath);
        if (!response.ok) {
            console.warn('No image sets manifest found');
            return null;
        }

        const manifest = await response.json();
        availableImageSets = manifest.sets || [];

        if (availableImageSets.length === 0) {
            console.warn('No image sets found in manifest');
            return null;
        }

        return manifest;
    } catch (error) {
        console.warn('Could not load image sets manifest:', error.message);
        return null;
    }
}

// Switch to a different image set
export async function switchImageSet(setId) {
    const set = availableImageSets.find(s => s.id === setId);
    if (!set) {
        console.warn(`Image set not found: ${setId}`);
        return;
    }

    // Clear current state
    currentImageSet = set;
    decryptionKey = null;
    showcaseTextures = [];
    showcaseImagesLoaded = false;
    showcaseCurrentIndex = 0;
    showcaseLastShownIndex = -1;

    if (set.encrypted) {
        // Return the set for external password prompt handling
        return { needsPassword: true, set };
    } else {
        await loadUnencryptedImageSet(set);
        return { needsPassword: false };
    }
}

// Load unencrypted image set
async function loadUnencryptedImageSet(set) {
    const folder = CONFIG.showcase.imageFolder + set.path;
    const manifestPath = folder + 'images.json';

    try {
        const response = await fetch(manifestPath);
        if (!response.ok) {
            console.warn(`Could not load images.json for set: ${set.id}`);
            return;
        }

        const images = await response.json();
        await loadImagesFromList(images, folder);
    } catch (error) {
        console.warn(`Error loading image set ${set.id}:`, error.message);
    }
}

// Load encrypted image set with password
export async function loadEncryptedImageSet(set, password) {
    const folder = CONFIG.showcase.imageFolder + set.path;
    const manifestPath = folder + 'manifest.json';

    const response = await fetch(manifestPath);
    const manifest = await response.json();

    // Derive key from password
    const salt = new Uint8Array(base64ToArrayBuffer(manifest.salt));
    decryptionKey = await deriveKeyFromPassword(password, salt);

    // Decrypt images list
    const imagesList = JSON.parse(
        await decryptText(manifest.images, manifest.iv, decryptionKey)
    );

    // Load encrypted images
    await loadEncryptedImages(imagesList, folder);
}

// Load images from a list of filenames
async function loadImagesFromList(images, folder) {
    if (!images || images.length === 0) {
        console.warn('No images in list');
        return;
    }

    console.log(`Loading ${images.length} images from ${folder}`);

    const loadPromises = images.map((filename, index) => {
        return new Promise((resolve) => {
            textureLoader.load(
                folder + filename,
                (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    showcaseTextures[index] = texture;
                    resolve(texture);
                },
                undefined,
                () => {
                    console.warn(`Failed to load: ${folder}${filename}`);
                    resolve(null);
                }
            );
        });
    });

    await Promise.all(loadPromises);
    finalizeImageLoad();
}

// Load encrypted images
async function loadEncryptedImages(imagesList, folder) {
    console.log(`Loading ${imagesList.length} encrypted images from ${folder}`);

    const loadPromises = imagesList.map(async (_, index) => {
        try {
            const response = await fetch(folder + index + '.enc');
            const encryptedData = await response.arrayBuffer();
            const objectURL = await decryptImageToObjectURL(encryptedData, decryptionKey);

            return new Promise((resolve) => {
                textureLoader.load(
                    objectURL,
                    (texture) => {
                        texture.colorSpace = THREE.SRGBColorSpace;
                        showcaseTextures[index] = texture;
                        URL.revokeObjectURL(objectURL);
                        resolve(texture);
                    },
                    undefined,
                    () => {
                        URL.revokeObjectURL(objectURL);
                        resolve(null);
                    }
                );
            });
        } catch (error) {
            console.warn(`Failed to decrypt image ${index}:`, error.message);
            return null;
        }
    });

    await Promise.all(loadPromises);
    finalizeImageLoad();
}

// Finalize image loading
function finalizeImageLoad() {
    showcaseTextures = showcaseTextures.filter(t => t !== null);

    if (showcaseTextures.length > 0) {
        showcaseImagesLoaded = true;
        console.log(`Successfully loaded ${showcaseTextures.length} images`);

        // Remove old showcase box before creating new one
        if (showcaseBox) {
            scene.remove(showcaseBox);
            showcaseBox.geometry.dispose();
            showcaseBox.material.forEach(mat => {
                if (mat.map) mat.map.dispose();
                if (mat.alphaMap) mat.alphaMap.dispose();
                mat.dispose();
            });
            showcaseBox = null;
        }

        initializeShowcaseBox(showcaseTextures[0]);
    }
}

// Animate showcase box (called from animation loop)
export function animateShowcaseBox(camera, mouse, lastMouseMoveTime) {
    if (!showcaseBox) return;

    // Only visible when flag is set (after delay in EXPLODING state)
    if (showcaseBoxShouldShow) {
        showcaseBoxTargetScale = 1;
        showcaseBoxTargetOpacity = 1;
    } else {
        showcaseBoxTargetScale = 0;
        showcaseBoxTargetOpacity = 0;
    }

    // Animate scale (smooth interpolation) - tied to explosion speed
    const currentScale = showcaseBox.scale.x;
    const newScale = currentScale + (showcaseBoxTargetScale - currentScale) * CONFIG.animation.explosion.speed;
    showcaseBox.scale.setScalar(Math.max(0.001, newScale)); // Avoid zero scale

    // Animate opacity for all materials
    showcaseBox.material.forEach(mat => {
        mat.opacity += (showcaseBoxTargetOpacity - mat.opacity) * CONFIG.showcase.animation.fadeSpeed;
    });

    // --- PARALLAX ROTATION (billboard with delayed offset) ---
    const parallaxStrength = CONFIG.showcase.parallax.rotationStrength;
    const returnSpeed = CONFIG.showcase.parallax.smoothing;

    // Initialize parallax target if not exists
    if (showcaseBox.userData.parallaxTargetX === undefined) {
        showcaseBox.userData.parallaxTargetX = 0;
        showcaseBox.userData.parallaxTargetY = 0;
    }

    // Mouse position sets the target rotation
    const mouseTargetX = mouse.y * parallaxStrength;
    const mouseTargetY = -mouse.x * parallaxStrength;

    // Initialize smoothed mouse influence if not exists
    if (showcaseBox.userData.mouseInfluence === undefined) {
        showcaseBox.userData.mouseInfluence = 0;
    }

    // Determine if mouse is currently moving
    const timeSinceMove = performance.now() - lastMouseMoveTime;
    const isMouseMoving = timeSinceMove < 100;

    // Smoothly transition mouseInfluence (no jerks)
    const targetInfluence = isMouseMoving ? 1 : 0;
    const influenceSpeed = isMouseMoving ? 0.15 : 0.03; // Fast ramp up, slow fade out
    showcaseBox.userData.mouseInfluence += (targetInfluence - showcaseBox.userData.mouseInfluence) * influenceSpeed;

    // Blend between center (0,0) and mouse position based on smoothed influence
    showcaseBox.userData.parallaxTargetX = mouseTargetX * showcaseBox.userData.mouseInfluence;
    showcaseBox.userData.parallaxTargetY = mouseTargetY * showcaseBox.userData.mouseInfluence;

    // Smoothly interpolate current rotation toward target
    showcaseBox.userData.currentRotationX += (showcaseBox.userData.parallaxTargetX - showcaseBox.userData.currentRotationX) * returnSpeed;
    showcaseBox.userData.currentRotationY += (showcaseBox.userData.parallaxTargetY - showcaseBox.userData.currentRotationY) * returnSpeed;

    // Make box face camera (billboard), then apply parallax offset
    showcaseBox.lookAt(camera.position);

    // Add the parallax rotation offset
    showcaseBox.rotation.x += showcaseBox.userData.currentRotationX;
    showcaseBox.rotation.y += showcaseBox.userData.currentRotationY;

    // Keep position fixed at center
    showcaseBox.position.set(0, CONFIG.treeYOffset, 0);
}

// Render showcase (returns whether showcase was rendered)
export function renderShowcase(renderer, scene, camera, composer) {
    // When showcase is visible, skip bloom for correct depth and colors
    if (showcaseBox && showcaseBoxShouldShow) {
        showcaseBox.visible = true;
        renderer.render(scene, camera);
        return true;
    } else {
        if (showcaseBox) showcaseBox.visible = false;
        composer.render();
        return false;
    }
}
