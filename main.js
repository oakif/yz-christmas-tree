import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GUI } from 'dat.gui';
import { CONFIG } from './config.js';
import {
    deriveKeyFromPassword,
    decryptText,
    decryptImageToObjectURL,
    base64ToArrayBuffer,
} from './crypto.js';

// --- SETUP SCENE ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050505, 0.015);

// Create perspective camera
const perspectiveCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
perspectiveCamera.position.x = CONFIG.cameraX;
perspectiveCamera.position.y = CONFIG.cameraY;
perspectiveCamera.position.z = CONFIG.cameraZ;
perspectiveCamera.lookAt(0, 0, 0);

// Create orthographic camera for isometric view
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = CONFIG.isometricZoom;
const orthographicCamera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1,
    1000
);
// Position at isometric angle, at similar distance from origin as perspective camera
const angleRad = CONFIG.isometricAngle * Math.PI / 180;
const perspectiveDistance = Math.sqrt(
    CONFIG.cameraX ** 2 + CONFIG.cameraY ** 2 + CONFIG.cameraZ ** 2
);
orthographicCamera.position.set(
    CONFIG.cameraX,
    perspectiveDistance * Math.sin(angleRad),
    perspectiveDistance * Math.cos(angleRad)
);
orthographicCamera.lookAt(0, 0, 0);

// Select active camera based on configuration
let camera = CONFIG.viewType === 'isometric' ? orthographicCamera : perspectiveCamera;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CONFIG.toneMappingExposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false; // Keep shadows off for performance
container.appendChild(renderer.domElement);

// --- ENVIRONMENT MAP FOR GLASS REFLECTIONS/REFRACTIONS ---
let envMap = null;

function createEnvironmentMap() {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();

    // Create gradient sky background
    const gradientShader = {
        uniforms: {
            topColor: { value: new THREE.Color(CONFIG.environmentMap.topColor) },
            bottomColor: { value: new THREE.Color(CONFIG.environmentMap.bottomColor) },
            offset: { value: 33 },
            exponent: { value: 0.6 }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `
    };

    const skyGeo = new THREE.SphereGeometry(100, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
        uniforms: gradientShader.uniforms,
        vertexShader: gradientShader.vertexShader,
        fragmentShader: gradientShader.fragmentShader,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    envScene.add(sky);

    envMap = pmremGenerator.fromScene(envScene).texture;
    pmremGenerator.dispose();
}

createEnvironmentMap();
scene.environment = envMap;

// --- CAMERA SWITCHING ---
function updateCamera(newState) {
    const targetViewType = (newState === 'EXPLODING')
        ? CONFIG.explodedViewType
        : CONFIG.viewType;

    const newCamera = targetViewType === 'isometric'
        ? orthographicCamera
        : perspectiveCamera;

    if (camera !== newCamera) {
        camera = newCamera;
        renderScene.camera = camera;
    }
}

// --- SETUP 3D SHOWCASE IMAGE BOX ---
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
function initializeShowcaseBox(texture) {
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
function getNextShowcaseImage() {
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
function updateShowcaseBoxTexture(texture) {
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
async function loadImageSetsManifest() {
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
async function switchImageSet(setId) {
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
        showPasswordPrompt(set);
    } else {
        await loadUnencryptedImageSet(set);
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
async function loadEncryptedImageSet(set, password) {
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
        initializeShowcaseBox(showcaseTextures[0]);
    }
}

// Settings modal state
let settingsAutoCloseTimer = null;
let settingsCountdown = 10;

function showSettingsModal(withCountdown = false) {
    const modal = document.getElementById('settings-modal');
    const select = document.getElementById('settings-image-set');
    const countdown = document.getElementById('settings-countdown');

    // Populate dropdown from availableImageSets
    select.innerHTML = '';
    availableImageSets.forEach(set => {
        const option = document.createElement('option');
        option.value = set.id;
        option.textContent = set.name;
        if (currentImageSet && currentImageSet.id === set.id) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    // Sync reassemble checkbox with current config
    document.getElementById('settings-reassemble').checked = CONFIG.reassembleOnClick;

    // Only start auto-close countdown on initial page load
    if (withCountdown) {
        settingsCountdown = 10;
        countdown.textContent = `Auto-closing in ${settingsCountdown}s...`;
        countdown.classList.remove('hidden');

        settingsAutoCloseTimer = setInterval(() => {
            settingsCountdown--;
            if (settingsCountdown <= 0) {
                hideSettingsModal();
            } else {
                countdown.textContent = `Auto-closing in ${settingsCountdown}s...`;
            }
        }, 1000);
    } else {
        countdown.classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

function hideSettingsModal() {
    const modal = document.getElementById('settings-modal');
    modal.classList.add('hidden');

    if (settingsAutoCloseTimer) {
        clearInterval(settingsAutoCloseTimer);
        settingsAutoCloseTimer = null;
    }
}

function cancelSettingsAutoClose() {
    if (settingsAutoCloseTimer) {
        clearInterval(settingsAutoCloseTimer);
        settingsAutoCloseTimer = null;
    }
    const countdown = document.getElementById('settings-countdown');
    countdown.classList.add('hidden');
}

// Password modal functions
function showPasswordPrompt(set) {
    const modal = document.getElementById('password-modal');
    const setNameEl = document.getElementById('password-set-name');
    const input = document.getElementById('password-input');
    const error = document.getElementById('password-error');

    setNameEl.textContent = `Enter password for "${set.name}"`;
    input.value = '';
    error.classList.add('hidden');
    modal.classList.remove('hidden');
    input.focus();
}

function hidePasswordPrompt() {
    const modal = document.getElementById('password-modal');
    modal.classList.add('hidden');
}

// Password modal event listeners
document.getElementById('password-submit').addEventListener('click', async () => {
    const input = document.getElementById('password-input');
    const error = document.getElementById('password-error');
    const password = input.value;

    try {
        await loadEncryptedImageSet(currentImageSet, password);
        hidePasswordPrompt();
    } catch (e) {
        error.classList.remove('hidden');
        console.warn('Decryption failed:', e);
    }
});

document.getElementById('password-cancel').addEventListener('click', () => {
    hidePasswordPrompt();
});

document.getElementById('password-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('password-submit').click();
    }
});

// Settings modal event listeners
document.getElementById('settings-icon').addEventListener('click', (e) => {
    e.stopPropagation();
    showSettingsModal();
});

document.getElementById('settings-close').addEventListener('click', () => {
    hideSettingsModal();
});

document.getElementById('settings-image-set').addEventListener('change', async (e) => {
    cancelSettingsAutoClose();
    await switchImageSet(e.target.value);
    // If encrypted set triggered password modal, hide settings
    // Otherwise close settings after selection
    if (!currentImageSet.encrypted) {
        hideSettingsModal();
    }
});

// Prevent clicks on settings modal from triggering tree explosion
document.getElementById('settings-modal').addEventListener('mousedown', (e) => {
    e.stopPropagation();
});

// Cancel auto-close on any interaction with settings modal
document.getElementById('settings-modal').addEventListener('click', () => {
    cancelSettingsAutoClose();
});

// Reassemble checkbox
document.getElementById('settings-reassemble').addEventListener('change', (e) => {
    CONFIG.reassembleOnClick = e.target.checked;
});

// Initialize image sets on startup
loadImageSetsManifest().then(manifest => {
    if (manifest && manifest.defaultSet) {
        switchImageSet(manifest.defaultSet);
    }
    // Show settings modal on page load (with auto-close countdown)
    if (availableImageSets.length > 0) {
        showSettingsModal(true);
    }
});

// --- POST PROCESSING ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.bloomStrength,
    CONFIG.bloomRadius,
    CONFIG.bloomThreshold
);

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- GEOMETRY GENERATORS ---

// Gift box with ribbon and bow
function createGiftBoxGeometry() {
    // Constants
    const boxSize = 0.5;
    const ribbonWidth = 0.08;
    const ribbonHeight = 0.02;
    const ribbonOverhang = 0.02;
    const ribbonOffset = ribbonHeight / 2;
    const loopRadius = 0.12;
    const tubeRadius = 0.025;
    const loopDistance = 0.08;
    const loopHeight = boxSize / 2 + ribbonHeight + 0.02;

    // Main box
    const boxGeom = new THREE.BoxGeometry(boxSize, boxSize, boxSize);

    // Helper: Create ribbon
    function createRibbon(width, height, depth, tx, ty, tz) {
        const ribbon = new THREE.BoxGeometry(width, height, depth);
        ribbon.translate(tx, ty, tz);
        return ribbon;
    }

    // Helper: Create bow loop (diagonal outward and upward at 45°)
    function createBowLoop(angleY) {
        const loop = new THREE.TorusGeometry(loopRadius, tubeRadius, 8, 12, Math.PI);
        loop.rotateZ(Math.PI / 2);      // Stand up
        loop.rotateX(-Math.PI / 4);     // Tilt outward 45°
        loop.rotateY(angleY);           // Point in diagonal direction
        const offsetX = Math.cos(angleY) * loopDistance;
        const offsetZ = Math.sin(angleY) * loopDistance;
        loop.translate(offsetX, loopHeight, offsetZ);
        return loop;
    }

    // Create 8 ribbons total
    const ribbons = [
        // Top face - 2 ribbons in cross pattern
        createRibbon(
            boxSize + ribbonOverhang, ribbonHeight, ribbonWidth,
            0, boxSize / 2 + ribbonOffset, 0
        ),
        createRibbon(
            ribbonWidth, ribbonHeight, boxSize + ribbonOverhang,
            0, boxSize / 2 + ribbonOffset, 0
        ),

        // Bottom face - 2 ribbons in cross pattern
        createRibbon(
            boxSize + ribbonOverhang, ribbonHeight, ribbonWidth,
            0, -(boxSize / 2 + ribbonOffset), 0
        ),
        createRibbon(
            ribbonWidth, ribbonHeight, boxSize + ribbonOverhang,
            0, -(boxSize / 2 + ribbonOffset), 0
        ),

        // Front face - 1 vertical ribbon
        createRibbon(
            ribbonWidth, boxSize + ribbonOverhang, ribbonHeight,
            0, 0, boxSize / 2 + ribbonOffset
        ),

        // Back face - 1 vertical ribbon
        createRibbon(
            ribbonWidth, boxSize + ribbonOverhang, ribbonHeight,
            0, 0, -(boxSize / 2 + ribbonOffset)
        ),

        // Right face - 1 vertical ribbon
        createRibbon(
            ribbonHeight, boxSize + ribbonOverhang, ribbonWidth,
            boxSize / 2 + ribbonOffset, 0, 0
        ),

        // Left face - 1 vertical ribbon
        createRibbon(
            ribbonHeight, boxSize + ribbonOverhang, ribbonWidth,
            -(boxSize / 2 + ribbonOffset), 0, 0
        ),
    ];

    // Create 4 bow loops pointing diagonally outward and upward
    const bowLoops = [
        createBowLoop(Math.PI / 4),         // 45° NE
        createBowLoop(3 * Math.PI / 4),     // 135° NW
        createBowLoop(5 * Math.PI / 4),     // 225° SW
        createBowLoop(7 * Math.PI / 4),     // 315° SE
    ];

    // Center knot
    const knot = new THREE.SphereGeometry(0.04, 8, 8);
    knot.translate(0, boxSize / 2 + ribbonHeight + 0.02, 0);

    // Merge all geometries
    return mergeGeometries([boxGeom, ...ribbons, ...bowLoops, knot]);
}
const geomGiftBox = createGiftBoxGeometry();

// Sphere (configurable via config.js)
function createSphereGeometry() {
    const radius = 0.5;
    const widthSegments = 32;
    const heightSegments = 32;
    return new THREE.SphereGeometry(radius, widthSegments, heightSegments);
}
const geomSphere = createSphereGeometry();

function createSnowflakeGeometry() {
    const shape = new THREE.Shape();
    const armLength = 0.5;
    const armWidth = 0.04;
    const branchLength = 0.18;
    const branchAngle = Math.PI / 4; // 45 degrees

    // Create 6 arms with branches
    for (let arm = 0; arm < 6; arm++) {
        const angle = (arm * Math.PI) / 3; // 60 degrees apart

        // Main arm
        const ax = Math.cos(angle) * armLength;
        const ay = Math.sin(angle) * armLength;

        // Draw main arm as thin rectangle
        const perpX = Math.cos(angle + Math.PI / 2) * armWidth;
        const perpY = Math.sin(angle + Math.PI / 2) * armWidth;

        if (arm === 0) {
            shape.moveTo(perpX, perpY);
        } else {
            shape.lineTo(perpX, perpY);
        }
        shape.lineTo(ax + perpX, ay + perpY);

        // First branch (at 60% of arm length)
        const b1x = Math.cos(angle) * armLength * 0.6;
        const b1y = Math.sin(angle) * armLength * 0.6;
        const branch1EndX = b1x + Math.cos(angle + branchAngle) * branchLength;
        const branch1EndY = b1y + Math.sin(angle + branchAngle) * branchLength;
        shape.lineTo(branch1EndX, branch1EndY);
        shape.lineTo(b1x + perpX * 0.5, b1y + perpY * 0.5);

        // Second branch (at 60% on other side)
        const branch2EndX = b1x + Math.cos(angle - branchAngle) * branchLength;
        const branch2EndY = b1y + Math.sin(angle - branchAngle) * branchLength;
        shape.lineTo(branch2EndX, branch2EndY);
        shape.lineTo(ax - perpX, ay - perpY);

        // Third branch (at 35% of arm length)
        const b2x = Math.cos(angle) * armLength * 0.35;
        const b2y = Math.sin(angle) * armLength * 0.35;
        const branch3EndX = b2x + Math.cos(angle + branchAngle) * branchLength * 0.7;
        const branch3EndY = b2y + Math.sin(angle + branchAngle) * branchLength * 0.7;
        shape.lineTo(branch3EndX, branch3EndY);
        shape.lineTo(b2x, b2y);

        const branch4EndX = b2x + Math.cos(angle - branchAngle) * branchLength * 0.7;
        const branch4EndY = b2y + Math.sin(angle - branchAngle) * branchLength * 0.7;
        shape.lineTo(branch4EndX, branch4EndY);

        shape.lineTo(-perpX, -perpY);
    }

    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, {
        depth: 0.02,
        bevelEnabled: false
    });
}
const geomSnowflake = createSnowflakeGeometry();

function createStarGeometry() {
    const shape = new THREE.Shape();
    const outerRadius = 0.5;
    const innerRadius = 0.25;
    const points = 5;
    for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
}
const geomStar = createStarGeometry();

function createHeartGeometry() {
    const x = 0, y = 0;
    const shape = new THREE.Shape();
    shape.moveTo(x + 0.25, y + 0.25);
    shape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.20, y, x, y);
    shape.bezierCurveTo(x - 0.30, y, x - 0.30, y + 0.35, x - 0.30, y + 0.35);
    shape.bezierCurveTo(x - 0.30, y + 0.55, x - 0.10, y + 0.77, x + 0.25, y + 0.95);
    shape.bezierCurveTo(x + 0.60, y + 0.77, x + 0.80, y + 0.55, x + 0.80, y + 0.35);
    shape.bezierCurveTo(x + 0.80, y + 0.35, x + 0.80, y, x + 0.50, y);
    shape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);
    // Smoother bevels to avoid sharp edge reflections
    return new THREE.ExtrudeGeometry(shape, {
        depth: 0.12,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 4
    });
}
const geomHeart = createHeartGeometry();

// --- OBJECT SYSTEM HELPERS ---
// Default values for optional object properties
const OBJECT_DEFAULTS = {
    scale: 1.0,
    color: 0xffffff,
    emissive: 0x000000,
    emissiveIntensity: 0.0,
    metalness: 0.5,              // Only used for non-configured materials
    roughness: 0.5,              // Only used for non-configured materials
    materialType: 'matte',       // Default material type
    materialOverrides: {}        // Material property overrides
};

// Material caching to prevent duplicate instances
const materialCache = new Map();

function validateAndMergeObjectDef(objectDef) {
    if (!objectDef.type) {
        throw new Error('Object definition must have a type');
    }
    if (objectDef.count === undefined || objectDef.count < 0) {
        throw new Error('Object definition must have a valid count');
    }
    return { ...OBJECT_DEFAULTS, ...objectDef };
}

function getGeometryForType(type) {
    const geometries = {
        'star': geomStar,
        'heart': geomHeart,
        'snowflake': geomSnowflake,
        'present': geomGiftBox,
        'sphere': geomSphere,
        'circle': geomStar  // circles use star geometry
    };

    if (!geometries[type]) {
        console.warn(`Unknown geometry type: ${type}, falling back to star`);
        return geometries['star'];
    }

    return geometries[type];
}

function getMaterialFromDefinition(def) {
    const useMaterialPreset = def.materialType !== null && def.materialType !== undefined;

    // Build cache key
    const cacheKeyBase = {
        color: def.color,
        emissive: def.emissive,
        emissiveIntensity: def.emissiveIntensity,
    };

    let key;
    if (useMaterialPreset) {
        const materialProps = {
            ...CONFIG.materialDefaults,
            ...(CONFIG.materialPresets[def.materialType] || {}),
            ...(def.materialOverrides || {})
        };
        key = JSON.stringify({
            ...cacheKeyBase,
            materialType: def.materialType,
            performanceMode: CONFIG.performanceMode,
            materialProps: materialProps
        });
    } else {
        // Legacy fallback for objects without materialType
        key = JSON.stringify({
            ...cacheKeyBase,
            metalness: def.metalness,
            roughness: def.roughness
        });
    }

    if (materialCache.has(key)) {
        return materialCache.get(key);
    }

    // Create new material
    let material;
    if (useMaterialPreset) {
        const materialProps = {
            ...CONFIG.materialDefaults,
            ...(CONFIG.materialPresets[def.materialType] || {}),
            ...(def.materialOverrides || {})
        };

        // Determine which material class to use
        const materialClass = materialProps.materialClass || 'Standard';

        if (materialClass === 'Physical') {
            // Use Physical material for glass types
            material = CONFIG.performanceMode
                ? createPerformanceMaterial(def, materialProps)
                : createPhysicalMaterial(def, materialProps);
        } else {
            // Use Standard material for matte, satin, metallic
            material = createStandardMaterial(def, materialProps);
        }
    } else {
        // Legacy fallback
        material = new THREE.MeshStandardMaterial({
            color: def.color,
            emissive: def.emissive,
            emissiveIntensity: def.emissiveIntensity,
            metalness: def.metalness,
            roughness: def.roughness,
            side: def.type === 'snowflake' ? THREE.DoubleSide : THREE.FrontSide
        });
    }

    materialCache.set(key, material);
    return material;
}

function createPhysicalMaterial(def, materialProps) {
    return new THREE.MeshPhysicalMaterial({
        color: def.color,
        emissive: def.emissive,
        emissiveIntensity: def.emissiveIntensity,

        // Material properties
        transmission: materialProps.transmission || 0,
        thickness: materialProps.thickness || 0,
        roughness: materialProps.roughness,
        metalness: materialProps.metalness || 0,
        clearcoat: materialProps.clearcoat || 0,
        clearcoatRoughness: materialProps.clearcoatRoughness || 0,
        ior: materialProps.ior || 1.5,

        envMap: envMap,
        envMapIntensity: materialProps.envMapIntensity || 1.0,

        side: def.type === 'snowflake' ? THREE.DoubleSide : THREE.FrontSide,
        transparent: materialProps.transmission > 0,
        opacity: 1.0,
    });
}

function createPerformanceMaterial(def, materialProps) {
    // Performance mode: Fake transparency with MeshStandardMaterial
    const opacity = materialProps.transmission > 0
        ? 0.4 + (1 - materialProps.transmission) * 0.6  // Map transmission to opacity
        : 1.0;

    return new THREE.MeshStandardMaterial({
        color: def.color,
        emissive: def.emissive,
        emissiveIntensity: def.emissiveIntensity,

        metalness: materialProps.metalness || 0.1,
        roughness: materialProps.roughness,
        envMap: envMap,
        envMapIntensity: materialProps.envMapIntensity || 1.0,

        transparent: materialProps.transmission > 0,
        opacity: opacity,

        side: def.type === 'snowflake' ? THREE.DoubleSide : THREE.FrontSide,
    });
}

function createStandardMaterial(def, materialProps) {
    return new THREE.MeshStandardMaterial({
        color: def.color,
        emissive: def.emissive,
        emissiveIntensity: def.emissiveIntensity,

        // Material properties
        roughness: materialProps.roughness,
        metalness: materialProps.metalness || 0,

        envMap: envMap,
        envMapIntensity: materialProps.envMapIntensity || 1.0,

        side: def.type === 'snowflake' ? THREE.DoubleSide : THREE.FrontSide,
        transparent: false,
    });
}

// --- DENSITY-CORRECTED PARTICLE DISTRIBUTION ---
// To distribute particles evenly on cone surface, we need to account for
// the fact that larger circumferences need more particles.
// The cumulative area up to height h on a cone is proportional to h^2
// So we sample height using sqrt of uniform random to get even surface density.

function sampleTreePosition() {
    // Sample height with density correction (more particles where circumference is larger)
    // For a cone: tip at top (y = treeHeight/2), base at bottom (y = -treeHeight/2)
    // radius = 0 at top, radius = treeRadius at bottom
    // To get uniform surface density, we use sqrt sampling biased toward bottom

    const u = Math.random();
    const heightFraction = Math.sqrt(u); // Biases toward larger values (bottom of tree)
    const height = heightFraction * CONFIG.treeHeight;

    // Radius increases with height (small at top h=0, large at bottom h=treeHeight)
    const radiusAtHeight = (height / CONFIG.treeHeight) * CONFIG.treeRadius;

    const theta = Math.random() * Math.PI * 2;
    // Push particles to the edge (hollow cone: 0.6 to 1.0 of radius)
    const r = radiusAtHeight * (0.6 + Math.random() * 0.4);

    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);
    const y = (CONFIG.treeHeight / 2) - height;

    return new THREE.Vector3(x, y, z);
}

// --- EXPLOSION TARGET POSITIONS (hollow sphere distribution) ---
function generateExplosionTargets(count, center) {
    const targets = [];
    const innerR = CONFIG.explosionInnerRadius;
    const outerR = CONFIG.explosionOuterRadius;

    // Apply offset to center
    const explosionCenter = new THREE.Vector3(
        center.x + CONFIG.explosionOffsetX,
        center.y + CONFIG.explosionOffsetY,
        center.z + CONFIG.explosionOffsetZ
    );

    for (let i = 0; i < count; i++) {
        // Uniform random point on spherical shell
        const theta = Math.random() * Math.PI * 2; // Azimuthal angle (0 to 2π)
        const phi = Math.acos(2 * Math.random() - 1); // Polar angle (uniform distribution)
        const r = innerR + Math.random() * (outerR - innerR); // Random radius in shell

        // Convert spherical to Cartesian coordinates (relative to center)
        const x = explosionCenter.x + r * Math.sin(phi) * Math.cos(theta);
        const y = explosionCenter.y + r * Math.sin(phi) * Math.sin(theta);
        const z = explosionCenter.z + r * Math.cos(phi);

        targets.push(new THREE.Vector3(x, y, z));
    }

    return targets;
}

// --- CREATE PARTICLES ---
const particles = [];
const treeGroup = new THREE.Group();
scene.add(treeGroup);

// Pre-generate explosion targets - calculate total count first
const totalParticleCount = CONFIG.objects.reduce((sum, obj) => sum + obj.count, 0);
const explosionCenter = CONFIG.explosionCenterMode === 'camera'
    ? new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z)
    : new THREE.Vector3(0, 0, 0);
const explosionTargets = generateExplosionTargets(totalParticleCount, explosionCenter);

let explosionTargetIndex = 0;

// Create particles from object definitions
CONFIG.objects.forEach(objectDef => {
    const fullDef = validateAndMergeObjectDef(objectDef);
    const geometry = getGeometryForType(fullDef.type);
    const material = getMaterialFromDefinition(fullDef);

    for (let i = 0; i < fullDef.count; i++) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.scale.setScalar(fullDef.scale);

        // Use density-corrected position
        const pos = sampleTreePosition();

        mesh.userData = {
            originalPos: pos.clone(),
            explosionTarget: explosionTargets[explosionTargetIndex++],
            velocity: new THREE.Vector3(0, 0, 0),
            rotSpeed: {
                x: (Math.random() - 0.5) * 0.02,
                y: (Math.random() - 0.5) * 0.02,
                z: (Math.random() - 0.5) * 0.02
            },
            individualParallaxShift: new THREE.Vector3(0, 0, 0),
            baseParallaxSensitivity: 0.5 + Math.random() * 1.0
        };

        mesh.position.copy(pos);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

        treeGroup.add(mesh);
        particles.push(mesh);
    }
});

// --- SOFT, EVEN LIGHTING ---
// All lighting parameters now come from CONFIG.lighting

const ambientLight = new THREE.AmbientLight(
    CONFIG.lighting.ambient.color,
    CONFIG.lighting.ambient.intensity
);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(
    CONFIG.lighting.hemisphere.skyColor,
    CONFIG.lighting.hemisphere.groundColor,
    CONFIG.lighting.hemisphere.intensity
);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(
    CONFIG.lighting.keyLight.color,
    CONFIG.lighting.keyLight.intensity
);
keyLight.position.set(...CONFIG.lighting.keyLight.position);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(
    CONFIG.lighting.fillLight.color,
    CONFIG.lighting.fillLight.intensity
);
fillLight.position.set(...CONFIG.lighting.fillLight.position);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(
    CONFIG.lighting.rimLight.color,
    CONFIG.lighting.rimLight.intensity
);
rimLight.position.set(...CONFIG.lighting.rimLight.position);
scene.add(rimLight);

const overheadLight = new THREE.DirectionalLight(
    CONFIG.lighting.overheadLight.color,
    CONFIG.lighting.overheadLight.intensity
);
overheadLight.position.set(...CONFIG.lighting.overheadLight.position);
scene.add(overheadLight);

const topGlow = new THREE.PointLight(
    CONFIG.lighting.topGlow.color,
    CONFIG.lighting.topGlow.intensity,
    CONFIG.lighting.topGlow.range
);
topGlow.position.set(0, CONFIG.treeHeight / 2 + 5, 0);
scene.add(topGlow);

// --- TEST MATERIAL SYSTEM ---
// Test objects that replace the tree, using the same distribution and animation logic
const testParticles = [];

// Array of test object groups (each group has its own config and particles)
const testObjectGroups = [];

function createDefaultTestConfig() {
    return {
        count: 0,
        shape: 'star',
        materialType: 'glass',
        scale: 1.0,
        color: '#ffffff',
        emissive: '#000000',
        emissiveIntensity: 0.0,
        transmission: 0.9,
        thickness: 10.0,
        roughness: 0.15,
        metalness: 0.0,
        clearcoat: 0.0,
        clearcoatRoughness: 0.0,
        ior: 1.5,
        envMapIntensity: 1.5,
        particles: []
    };
}

function createTestParticle(config, explosionTarget) {
    const geometry = getGeometryForType(config.shape);

    // Build material overrides - only include properties that are explicitly different from preset defaults
    const materialOverrides = {};

    // Only add override if the value differs from the default for this material type
    const preset = CONFIG.materialPresets[config.materialType] || {};

    if (config.transmission !== undefined && config.transmission !== (preset.transmission ?? CONFIG.materialDefaults.transmission)) {
        materialOverrides.transmission = config.transmission;
    }
    if (config.thickness !== undefined && config.thickness !== (preset.thickness ?? CONFIG.materialDefaults.thickness)) {
        materialOverrides.thickness = config.thickness;
    }
    if (config.roughness !== undefined && config.roughness !== (preset.roughness ?? CONFIG.materialDefaults.roughness)) {
        materialOverrides.roughness = config.roughness;
    }
    if (config.metalness !== undefined && config.metalness !== (preset.metalness ?? CONFIG.materialDefaults.metalness)) {
        materialOverrides.metalness = config.metalness;
    }
    if (config.clearcoat !== undefined && config.clearcoat !== (preset.clearcoat ?? CONFIG.materialDefaults.clearcoat)) {
        materialOverrides.clearcoat = config.clearcoat;
    }
    if (config.clearcoatRoughness !== undefined && config.clearcoatRoughness !== (preset.clearcoatRoughness ?? CONFIG.materialDefaults.clearcoatRoughness)) {
        materialOverrides.clearcoatRoughness = config.clearcoatRoughness;
    }
    if (config.ior !== undefined && config.ior !== (preset.ior ?? CONFIG.materialDefaults.ior)) {
        materialOverrides.ior = config.ior;
    }
    if (config.envMapIntensity !== undefined && config.envMapIntensity !== (preset.envMapIntensity ?? CONFIG.materialDefaults.envMapIntensity)) {
        materialOverrides.envMapIntensity = config.envMapIntensity;
    }

    const materialDef = {
        type: config.shape,
        color: parseInt(config.color.replace('#', ''), 16),
        emissive: parseInt(config.emissive.replace('#', ''), 16),
        emissiveIntensity: config.emissiveIntensity,
        materialType: config.materialType,
        materialOverrides: materialOverrides
    };

    const material = getMaterialFromDefinition(materialDef);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(config.scale);

    const pos = sampleTreePosition();
    mesh.position.copy(pos);

    mesh.userData = {
        originalPos: pos.clone(),
        explosionTarget: explosionTarget,
        velocity: new THREE.Vector3(0, 0, 0),
        rotSpeed: {
            x: (Math.random() - 0.5) * 0.02,
            y: (Math.random() - 0.5) * 0.02,
            z: (Math.random() - 0.5) * 0.02
        },
        individualParallaxShift: new THREE.Vector3(0, 0, 0),
        baseParallaxSensitivity: 0.5 + Math.random() * 1.0
    };

    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

    treeGroup.add(mesh);
    testParticles.push(mesh);
    return mesh;
}

function rebuildTreeParticles() {
    // Remove all existing tree particles
    particles.forEach(mesh => {
        treeGroup.remove(mesh);
        // Don't dispose shared geometries
        mesh.material.dispose();
    });
    particles.length = 0;

    // Calculate total particle count from CONFIG.objects
    const totalParticleCount = CONFIG.objects.reduce((sum, obj) => sum + obj.count, 0);
    const explosionCenter = CONFIG.explosionCenterMode === 'camera'
        ? new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z)
        : new THREE.Vector3(0, 0, 0);
    const explosionTargets = generateExplosionTargets(totalParticleCount, explosionCenter);

    let explosionTargetIndex = 0;

    // Recreate particles from object definitions
    CONFIG.objects.forEach(objectDef => {
        const fullDef = validateAndMergeObjectDef(objectDef);
        const geometry = getGeometryForType(fullDef.type);
        const material = getMaterialFromDefinition(fullDef);

        for (let i = 0; i < fullDef.count; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.scale.setScalar(fullDef.scale);

            const pos = sampleTreePosition();

            mesh.userData = {
                originalPos: pos.clone(),
                explosionTarget: explosionTargets[explosionTargetIndex++],
                velocity: new THREE.Vector3(0, 0, 0),
                rotSpeed: {
                    x: (Math.random() - 0.5) * 0.02,
                    y: (Math.random() - 0.5) * 0.02,
                    z: (Math.random() - 0.5) * 0.02
                },
                individualParallaxShift: new THREE.Vector3(0, 0, 0),
                baseParallaxSensitivity: 0.5 + Math.random() * 1.0
            };

            mesh.position.copy(pos);
            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

            treeGroup.add(mesh);
            particles.push(mesh);
        }
    });

    // Update visibility based on test objects
    const hasTestObjects = testObjectGroups.reduce((sum, g) => sum + g.count, 0) > 0;
    particles.forEach(p => {
        p.visible = CONFIG.showTreeParticles && !hasTestObjects;
    });
}

function rebuildAllTestParticles() {
    // Clear material cache before rebuilding
    materialCache.clear();

    // Remove all test particles
    testParticles.forEach(mesh => {
        treeGroup.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    });
    testParticles.length = 0;

    // Clear all group particles
    testObjectGroups.forEach(group => {
        group.particles = [];
    });

    // Calculate total particle count
    const totalCount = testObjectGroups.reduce((sum, group) => sum + group.count, 0);

    // Generate explosion targets for all particles
    const explosionCenter = CONFIG.explosionCenterMode === 'camera'
        ? new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z)
        : new THREE.Vector3(0, 0, 0);
    const explosionTargets = generateExplosionTargets(totalCount, explosionCenter);

    // Recreate all particles for all groups
    let targetIndex = 0;
    testObjectGroups.forEach(group => {
        for (let i = 0; i < group.count; i++) {
            const mesh = createTestParticle(group, explosionTargets[targetIndex++]);
            group.particles.push(mesh);
        }
    });

    // Update tree visibility
    const hasTestObjects = totalCount > 0;
    particles.forEach(p => {
        p.visible = !hasTestObjects && guiControls.showTreeParticles;
    });
}

function rebuildAllParticles() {
    materialCache.clear();
    rebuildTreeParticles();
    rebuildAllTestParticles();
}

// --- DAT.GUI FOR ALL CONFIG SETTINGS ---
const gui = new GUI();
document.body.appendChild(gui.domElement);
gui.domElement.style.position = 'absolute';
gui.domElement.style.top = '10px';
gui.domElement.style.right = '10px';
gui.domElement.style.zIndex = '10000';

// Show/hide GUI based on config setting
if (!CONFIG.showGUI) {
    gui.domElement.style.display = 'none';
}

// Helper to convert hex number to hex string for dat.GUI
function hexToString(hex) {
    return '#' + hex.toString(16).padStart(6, '0');
}

// Helper to convert hex string to number
function stringToHex(str) {
    return parseInt(str.replace('#', ''), 16);
}

// GUI controls object - uses hex strings for colors
const guiControls = {
    // === Scene Setup - Tree Geometry ===
    treeHeight: CONFIG.treeHeight,
    treeRadius: CONFIG.treeRadius,
    treeYOffset: CONFIG.treeYOffset,

    // === Scene Setup - Camera & View ===
    cameraX: CONFIG.cameraX,
    cameraY: CONFIG.cameraY,
    cameraZ: CONFIG.cameraZ,
    viewType: CONFIG.viewType,
    explodedViewType: CONFIG.explodedViewType,
    isometricZoom: CONFIG.isometricZoom,
    isometricAngle: CONFIG.isometricAngle,

    // === Interaction ===
    reassembleOnClick: CONFIG.reassembleOnClick,
    resetMouseOnLeave: CONFIG.resetMouseOnLeave,

    // === Animation & Effects - Idle Animation ===
    idleFloatSpeed: CONFIG.idleFloatSpeed,
    idleFloatAmount: CONFIG.idleFloatAmount,

    // === Animation & Effects - Explosion Animation ===
    animationSpeed: CONFIG.animationSpeed,
    holdDuration: CONFIG.holdDuration,

    // === Animation & Effects - Parallax Settings - Idle Parallax ===
    parallaxEnabled: CONFIG.parallaxEnabled,
    parallaxStrengthX: CONFIG.parallaxStrengthX,
    parallaxStrengthY: CONFIG.parallaxStrengthY,
    parallaxSmoothing: CONFIG.parallaxSmoothing,
    parallaxPositionStrengthX: CONFIG.parallaxPositionStrengthX,
    parallaxPositionStrengthY: CONFIG.parallaxPositionStrengthY,

    // === Animation & Effects - Parallax Settings - Exploded Parallax ===
    explodedParallaxEnabled: CONFIG.explodedParallaxEnabled,
    explodedParallaxStrengthX: CONFIG.explodedParallaxStrengthX,
    explodedParallaxStrengthY: CONFIG.explodedParallaxStrengthY,
    explodedParallaxStrength: CONFIG.explodedParallaxStrength,

    // === Animation & Effects - Explosion Distribution ===
    explosionInnerRadius: CONFIG.explosionInnerRadius,
    explosionOuterRadius: CONFIG.explosionOuterRadius,
    explosionCenterMode: CONFIG.explosionCenterMode,
    explosionOffsetX: CONFIG.explosionOffsetX,
    explosionOffsetY: CONFIG.explosionOffsetY,
    explosionOffsetZ: CONFIG.explosionOffsetZ,

    // === Rendering & Visuals - Post Processing ===
    bloomStrength: CONFIG.bloomStrength,
    bloomRadius: CONFIG.bloomRadius,
    bloomThreshold: CONFIG.bloomThreshold,
    toneMappingExposure: CONFIG.toneMappingExposure,

    // === Rendering & Visuals - Environment ===
    envTopColor: hexToString(CONFIG.environmentMap.topColor),
    envBottomColor: hexToString(CONFIG.environmentMap.bottomColor),

    // === Rendering & Visuals - Lighting - Ambient ===
    ambientColor: hexToString(CONFIG.lighting.ambient.color),
    ambientIntensity: CONFIG.lighting.ambient.intensity,

    // === Rendering & Visuals - Lighting - Hemisphere ===
    hemiSkyColor: hexToString(CONFIG.lighting.hemisphere.skyColor),
    hemiGroundColor: hexToString(CONFIG.lighting.hemisphere.groundColor),
    hemiIntensity: CONFIG.lighting.hemisphere.intensity,

    // === Rendering & Visuals - Lighting - Key Light ===
    keyLightColor: hexToString(CONFIG.lighting.keyLight.color),
    keyLightIntensity: CONFIG.lighting.keyLight.intensity,

    // === Rendering & Visuals - Lighting - Fill Light ===
    fillLightColor: hexToString(CONFIG.lighting.fillLight.color),
    fillLightIntensity: CONFIG.lighting.fillLight.intensity,

    // === Rendering & Visuals - Lighting - Rim Light ===
    rimLightColor: hexToString(CONFIG.lighting.rimLight.color),
    rimLightIntensity: CONFIG.lighting.rimLight.intensity,

    // === Rendering & Visuals - Lighting - Overhead Light ===
    overheadLightColor: hexToString(CONFIG.lighting.overheadLight.color),
    overheadLightIntensity: CONFIG.lighting.overheadLight.intensity,

    // === Rendering & Visuals - Lighting - Top Glow ===
    topGlowColor: hexToString(CONFIG.lighting.topGlow.color),
    topGlowIntensity: CONFIG.lighting.topGlow.intensity,
    topGlowRange: CONFIG.lighting.topGlow.range,

    // === UI & Performance - Visibility ===
    showTreeParticles: CONFIG.showTreeParticles,
    showFPS: CONFIG.showFPS,

    // === UI & Performance - Performance ===
    performanceMode: CONFIG.performanceMode,
    uncapFPS: CONFIG.uncapFPS,

    // === Showcase ===
    imageDelay: CONFIG.imageDelay,
    displayMode: CONFIG.showcase.displayMode,
};

// ========================================
// 1. SCENE SETUP
// ========================================
const sceneSetupFolder = gui.addFolder('Scene Setup');

// Tree Geometry
const treeGeometryFolder = sceneSetupFolder.addFolder('Tree Geometry');
treeGeometryFolder.add(guiControls, 'treeHeight', 10, 100).name('Height').onChange(val => {
    CONFIG.treeHeight = val;
    // Tree geometry changes require full particle regeneration
    rebuildAllParticles();
});
treeGeometryFolder.add(guiControls, 'treeRadius', 5, 30).name('Radius').onChange(val => {
    CONFIG.treeRadius = val;
    rebuildAllParticles();
});
treeGeometryFolder.add(guiControls, 'treeYOffset', -20, 20).name('Y Offset').onChange(val => {
    CONFIG.treeYOffset = val;
    // Y offset can be updated directly without regeneration
});

// Camera & View
const cameraFolder = sceneSetupFolder.addFolder('Camera & View');
cameraFolder.add(guiControls, 'cameraX', -50, 50).name('Camera X').onChange(val => {
    perspectiveCamera.position.x = val;
    CONFIG.cameraX = val;
});
cameraFolder.add(guiControls, 'cameraY', -50, 50).name('Camera Y').onChange(val => {
    perspectiveCamera.position.y = val;
    CONFIG.cameraY = val;
});
cameraFolder.add(guiControls, 'cameraZ', -50, 50).name('Camera Z').onChange(val => {
    perspectiveCamera.position.z = val;
    CONFIG.cameraZ = val;
});
cameraFolder.add(guiControls, 'viewType', ['perspective', 'isometric']).name('View Type').onChange(val => {
    CONFIG.viewType = val;
    if (state !== 'EXPLODING') {
        camera = val === 'isometric' ? orthographicCamera : perspectiveCamera;
        renderScene.camera = camera;
    }
});
cameraFolder.add(guiControls, 'explodedViewType', ['perspective', 'isometric']).name('Exploded View').onChange(val => {
    CONFIG.explodedViewType = val;
    if (state === 'EXPLODING') {
        camera = val === 'isometric' ? orthographicCamera : perspectiveCamera;
        renderScene.camera = camera;
    }
});
cameraFolder.add(guiControls, 'isometricZoom', 20, 150).name('Iso Zoom').onChange(val => {
    CONFIG.isometricZoom = val;
    const aspect = window.innerWidth / window.innerHeight;
    orthographicCamera.left = val * aspect / -2;
    orthographicCamera.right = val * aspect / 2;
    orthographicCamera.top = val / 2;
    orthographicCamera.bottom = val / -2;
    orthographicCamera.updateProjectionMatrix();
});
cameraFolder.add(guiControls, 'isometricAngle', 0, 90).name('Iso Angle').onChange(val => {
    CONFIG.isometricAngle = val;
    const angleRad = val * Math.PI / 180;
    const perspectiveDistance = Math.sqrt(
        CONFIG.cameraX ** 2 + CONFIG.cameraY ** 2 + CONFIG.cameraZ ** 2
    );
    orthographicCamera.position.set(
        CONFIG.cameraX,
        perspectiveDistance * Math.sin(angleRad),
        perspectiveDistance * Math.cos(angleRad)
    );
    orthographicCamera.lookAt(0, 0, 0);
});

// ========================================
// 2. INTERACTION
// ========================================
const interactionFolder = gui.addFolder('Interaction');
interactionFolder.add(guiControls, 'reassembleOnClick').name('Reassemble on Click').onChange(val => {
    CONFIG.reassembleOnClick = val;
});
interactionFolder.add(guiControls, 'resetMouseOnLeave').name('Reset Mouse on Leave').onChange(val => {
    CONFIG.resetMouseOnLeave = val;
});

// ========================================
// 3. ANIMATION & EFFECTS
// ========================================
const animationFolder = gui.addFolder('Animation & Effects');

// Idle Animation
const idleAnimFolder = animationFolder.addFolder('Idle Animation');
idleAnimFolder.add(guiControls, 'idleFloatSpeed', 0, 0.01, 0.0001).name('Float Speed').onChange(val => {
    CONFIG.idleFloatSpeed = val;
});
idleAnimFolder.add(guiControls, 'idleFloatAmount', 0, 1, 0.01).name('Float Amount').onChange(val => {
    CONFIG.idleFloatAmount = val;
});

// Explosion Animation
const explosionAnimFolder = animationFolder.addFolder('Explosion Animation');
explosionAnimFolder.add(guiControls, 'animationSpeed', 0.01, 0.5, 0.01).name('Speed').onChange(val => {
    CONFIG.animationSpeed = val;
});
explosionAnimFolder.add(guiControls, 'holdDuration', 1000, 60000, 1000).name('Hold Duration (ms)').onChange(val => {
    CONFIG.holdDuration = val;
});

// Parallax Settings
const parallaxSettingsFolder = animationFolder.addFolder('Parallax Settings');

// Idle Parallax (sub-subfolder)
const idleParallaxFolder = parallaxSettingsFolder.addFolder('Idle Parallax');
idleParallaxFolder.add(guiControls, 'parallaxEnabled').name('Enabled').onChange(val => {
    CONFIG.parallaxEnabled = val;
});
idleParallaxFolder.add(guiControls, 'parallaxStrengthX', 0, 10, 0.1).name('Strength X').onChange(val => {
    CONFIG.parallaxStrengthX = val;
});
idleParallaxFolder.add(guiControls, 'parallaxStrengthY', 0, 10, 0.1).name('Strength Y').onChange(val => {
    CONFIG.parallaxStrengthY = val;
});
idleParallaxFolder.add(guiControls, 'parallaxSmoothing', 0.01, 0.2, 0.01).name('Smoothing').onChange(val => {
    CONFIG.parallaxSmoothing = val;
});
idleParallaxFolder.add(guiControls, 'parallaxPositionStrengthX', -5, 5, 0.1).name('Position X').onChange(val => {
    CONFIG.parallaxPositionStrengthX = val;
});
idleParallaxFolder.add(guiControls, 'parallaxPositionStrengthY', -5, 5, 0.1).name('Position Y').onChange(val => {
    CONFIG.parallaxPositionStrengthY = val;
});

// Exploded Parallax (sub-subfolder)
const explodedParallaxFolder = parallaxSettingsFolder.addFolder('Exploded Parallax');
explodedParallaxFolder.add(guiControls, 'explodedParallaxEnabled').name('Enabled').onChange(val => {
    CONFIG.explodedParallaxEnabled = val;
});
explodedParallaxFolder.add(guiControls, 'explodedParallaxStrengthX', 0, 10, 0.1).name('Strength X').onChange(val => {
    CONFIG.explodedParallaxStrengthX = val;
});
explodedParallaxFolder.add(guiControls, 'explodedParallaxStrengthY', 0, 10, 0.1).name('Strength Y').onChange(val => {
    CONFIG.explodedParallaxStrengthY = val;
});
explodedParallaxFolder.add(guiControls, 'explodedParallaxStrength', 0, 20, 0.5).name('Individual Strength').onChange(val => {
    CONFIG.explodedParallaxStrength = val;
});

// Explosion Distribution
const explosionDistFolder = animationFolder.addFolder('Explosion Distribution');
explosionDistFolder.add(guiControls, 'explosionInnerRadius', 0, 100).name('Inner Radius').onChange(val => {
    CONFIG.explosionInnerRadius = val;
});
explosionDistFolder.add(guiControls, 'explosionOuterRadius', 0, 150).name('Outer Radius').onChange(val => {
    CONFIG.explosionOuterRadius = val;
});
explosionDistFolder.add(guiControls, 'explosionCenterMode', ['camera', 'tree']).name('Center Mode').onChange(val => {
    CONFIG.explosionCenterMode = val;
});
explosionDistFolder.add(guiControls, 'explosionOffsetX', -50, 50).name('Offset X').onChange(val => {
    CONFIG.explosionOffsetX = val;
});
explosionDistFolder.add(guiControls, 'explosionOffsetY', -50, 50).name('Offset Y').onChange(val => {
    CONFIG.explosionOffsetY = val;
});
explosionDistFolder.add(guiControls, 'explosionOffsetZ', -50, 50).name('Offset Z').onChange(val => {
    CONFIG.explosionOffsetZ = val;
});

// ========================================
// 4. RENDERING & VISUALS
// ========================================
const renderingFolder = gui.addFolder('Rendering & Visuals');

// Exposure (tone mapping)
renderingFolder.add(guiControls, 'toneMappingExposure', 0, 10, 0.1).name('Exposure').onChange(val => {
    renderer.toneMappingExposure = val;
    CONFIG.toneMappingExposure = val;
});

// Post Processing
const postProcessingFolder = renderingFolder.addFolder('Post Processing');

// Bloom controls
postProcessingFolder.add(guiControls, 'bloomStrength', 0, 3, 0.01).name('Bloom Strength').onChange(val => {
    bloomPass.strength = val;
    CONFIG.bloomStrength = val;
});
postProcessingFolder.add(guiControls, 'bloomRadius', 0, 2, 0.01).name('Bloom Radius').onChange(val => {
    bloomPass.radius = val;
    CONFIG.bloomRadius = val;
});
postProcessingFolder.add(guiControls, 'bloomThreshold', 0, 1, 0.01).name('Bloom Threshold').onChange(val => {
    bloomPass.threshold = val;
    CONFIG.bloomThreshold = val;
});

// Environment
const envFolder = renderingFolder.addFolder('Environment');
envFolder.addColor(guiControls, 'envTopColor').name('Sky Top').onChange(val => {
    CONFIG.environmentMap.topColor = stringToHex(val);
    createEnvironmentMap();
    scene.environment = envMap;
});
envFolder.addColor(guiControls, 'envBottomColor').name('Sky Bottom').onChange(val => {
    CONFIG.environmentMap.bottomColor = stringToHex(val);
    createEnvironmentMap();
    scene.environment = envMap;
});

// Lighting
const lightingFolder = renderingFolder.addFolder('Lighting');

// Ambient
lightingFolder.addColor(guiControls, 'ambientColor').name('Ambient Color').onChange(val => {
    ambientLight.color.setHex(stringToHex(val));
    CONFIG.lighting.ambient.color = stringToHex(val);
});
lightingFolder.add(guiControls, 'ambientIntensity', 0, 5, 0.1).name('Ambient Intensity').onChange(val => {
    ambientLight.intensity = val;
    CONFIG.lighting.ambient.intensity = val;
});

// Hemisphere
lightingFolder.addColor(guiControls, 'hemiSkyColor').name('Hemi Sky Color').onChange(val => {
    hemiLight.color.setHex(stringToHex(val));
    CONFIG.lighting.hemisphere.skyColor = stringToHex(val);
});
lightingFolder.addColor(guiControls, 'hemiGroundColor').name('Hemi Ground Color').onChange(val => {
    hemiLight.groundColor.setHex(stringToHex(val));
    CONFIG.lighting.hemisphere.groundColor = stringToHex(val);
});
lightingFolder.add(guiControls, 'hemiIntensity', 0, 5, 0.1).name('Hemi Intensity').onChange(val => {
    hemiLight.intensity = val;
    CONFIG.lighting.hemisphere.intensity = val;
});

// Key Light
lightingFolder.addColor(guiControls, 'keyLightColor').name('Key Light Color').onChange(val => {
    keyLight.color.setHex(stringToHex(val));
    CONFIG.lighting.keyLight.color = stringToHex(val);
});
lightingFolder.add(guiControls, 'keyLightIntensity', 0, 5, 0.1).name('Key Light Intensity').onChange(val => {
    keyLight.intensity = val;
    CONFIG.lighting.keyLight.intensity = val;
});

// Fill Light
lightingFolder.addColor(guiControls, 'fillLightColor').name('Fill Light Color').onChange(val => {
    fillLight.color.setHex(stringToHex(val));
    CONFIG.lighting.fillLight.color = stringToHex(val);
});
lightingFolder.add(guiControls, 'fillLightIntensity', 0, 5, 0.1).name('Fill Light Intensity').onChange(val => {
    fillLight.intensity = val;
    CONFIG.lighting.fillLight.intensity = val;
});

// Rim Light
lightingFolder.addColor(guiControls, 'rimLightColor').name('Rim Light Color').onChange(val => {
    rimLight.color.setHex(stringToHex(val));
    CONFIG.lighting.rimLight.color = stringToHex(val);
});
lightingFolder.add(guiControls, 'rimLightIntensity', 0, 5, 0.1).name('Rim Light Intensity').onChange(val => {
    rimLight.intensity = val;
    CONFIG.lighting.rimLight.intensity = val;
});

// Overhead Light
lightingFolder.addColor(guiControls, 'overheadLightColor').name('Overhead Color').onChange(val => {
    overheadLight.color.setHex(stringToHex(val));
    CONFIG.lighting.overheadLight.color = stringToHex(val);
});
lightingFolder.add(guiControls, 'overheadLightIntensity', 0, 5, 0.1).name('Overhead Intensity').onChange(val => {
    overheadLight.intensity = val;
    CONFIG.lighting.overheadLight.intensity = val;
});

// Top Glow
lightingFolder.addColor(guiControls, 'topGlowColor').name('Top Glow Color').onChange(val => {
    topGlow.color.setHex(stringToHex(val));
    CONFIG.lighting.topGlow.color = stringToHex(val);
});
lightingFolder.add(guiControls, 'topGlowIntensity', 0, 10, 0.1).name('Top Glow Intensity').onChange(val => {
    topGlow.intensity = val;
    CONFIG.lighting.topGlow.intensity = val;
});
lightingFolder.add(guiControls, 'topGlowRange', 0, 100, 1).name('Top Glow Range').onChange(val => {
    topGlow.distance = val;
    CONFIG.lighting.topGlow.range = val;
});

// ========================================
// 5. UI & PERFORMANCE
// ========================================
const uiPerfFolder = gui.addFolder('UI & Performance');

// Visibility
const visibilityFolder = uiPerfFolder.addFolder('Visibility');

// Set initial tree particles visibility based on config
const initialHasTestObjects = testObjectGroups.reduce((sum, g) => sum + g.count, 0) > 0;
particles.forEach(p => {
    p.visible = CONFIG.showTreeParticles && !initialHasTestObjects;
});

visibilityFolder.add(guiControls, 'showTreeParticles')
    .name('Show Tree Particles')
    .onChange(val => {
        CONFIG.showTreeParticles = val;
        // Only show tree particles if enabled AND no test objects are active
        const hasTestObjects = testObjectGroups.reduce((sum, g) => sum + g.count, 0) > 0;
        particles.forEach(p => {
            p.visible = val && !hasTestObjects;
        });
    });

const fpsCounter = document.getElementById('fps-counter');
const fpsText = document.getElementById('fps-text');
const fpsCanvas = document.getElementById('fps-graph');
const fpsCtx = fpsCanvas.getContext('2d');

// Set canvas size
fpsCanvas.width = 200;
fpsCanvas.height = 60;

// Set initial FPS counter visibility based on config
if (CONFIG.showFPS) {
    fpsCounter.classList.add('visible');
}

visibilityFolder.add(guiControls, 'showFPS')
    .name('Show FPS')
    .onChange(val => {
        CONFIG.showFPS = val;
        if (val) {
            fpsCounter.classList.add('visible');
        } else {
            fpsCounter.classList.remove('visible');
        }
    });

// Performance
const performanceFolder = uiPerfFolder.addFolder('Performance');
performanceFolder.add(guiControls, 'performanceMode').name('Performance Mode').onChange(val => {
    CONFIG.performanceMode = val;
});
performanceFolder.add(guiControls, 'uncapFPS')
    .name('Uncap FPS')
    .onChange(val => {
        CONFIG.uncapFPS = val;
    });

visibilityFolder.open();

// ========================================
// 6. SHOWCASE
// ========================================
const showcaseFolder = gui.addFolder('Showcase');

// Image set dropdown - populated after manifest loads
guiControls.imageSet = '';
let imageSetController = null;

loadImageSetsManifest().then(manifest => {
    if (!manifest || !manifest.sets || manifest.sets.length === 0) return;

    // Build options object: { "Display Name": "set_id" }
    const setOptions = {};
    manifest.sets.forEach(set => {
        setOptions[set.name] = set.id;
    });

    guiControls.imageSet = manifest.defaultSet || manifest.sets[0].id;

    imageSetController = showcaseFolder.add(guiControls, 'imageSet', setOptions)
        .name('Image Set')
        .onChange(async (setId) => {
            await switchImageSet(setId);
        });
});

showcaseFolder.add(guiControls, 'imageDelay', 0, 5000, 100).name('Delay (ms)').onChange(val => {
    CONFIG.showcase.delay = val;
});
showcaseFolder.add(guiControls, 'displayMode', ['sequential', 'random']).name('Display Mode').onChange(val => {
    CONFIG.showcase.displayMode = val;
});

// === TEST OBJECTS (DEBUG) ===
const testObjectsFolder = gui.addFolder('Test Objects (Debug)');

// Debounced rebuild function for all test objects
let rebuildTimeout = null;
function debouncedRebuildAll() {
    if (rebuildTimeout) {
        clearTimeout(rebuildTimeout);
    }
    rebuildTimeout = setTimeout(() => {
        rebuildAllTestParticles();
    }, 500);
}

// Add new object group button
guiControls.addObjectGroup = function() {
    const newGroup = createDefaultTestConfig();
    testObjectGroups.push(newGroup);
    createGroupGUI(newGroup, testObjectGroups.length - 1);
    testObjectsFolder.open();
};
testObjectsFolder.add(guiControls, 'addObjectGroup').name('➕ Add Object Group');

// Create GUI for an object group
function createGroupGUI(group, index) {
    const groupFolder = testObjectsFolder.addFolder(`Group ${index + 1}`);

    // Count
    groupFolder.add(group, 'count', 0, 5000, 1)
        .name('Count')
        .onChange(debouncedRebuildAll);

    // Shape and material
    groupFolder.add(group, 'shape', ['star', 'heart', 'snowflake', 'present', 'sphere'])
        .name('Shape')
        .onChange(debouncedRebuildAll);

    // Physical properties folder (created before materialType so we can reference it)
    const physicalFolder = groupFolder.addFolder('Physical Properties');
    const transmissionCtrl = physicalFolder.add(group, 'transmission', 0, 1, 0.01)
        .name('Transmission')
        .onChange(debouncedRebuildAll);
    const thicknessCtrl = physicalFolder.add(group, 'thickness', 0, 50, 0.5)
        .name('Thickness')
        .onChange(debouncedRebuildAll);
    const roughnessCtrl = physicalFolder.add(group, 'roughness', 0, 1, 0.01)
        .name('Roughness')
        .onChange(debouncedRebuildAll);
    const metalnessCtrl = physicalFolder.add(group, 'metalness', 0, 1, 0.01)
        .name('Metalness')
        .onChange(debouncedRebuildAll);
    const clearcoatCtrl = physicalFolder.add(group, 'clearcoat', 0, 1, 0.01)
        .name('Clearcoat')
        .onChange(debouncedRebuildAll);
    const clearcoatRoughnessCtrl = physicalFolder.add(group, 'clearcoatRoughness', 0, 1, 0.01)
        .name('Clearcoat Roughness')
        .onChange(debouncedRebuildAll);
    const iorCtrl = physicalFolder.add(group, 'ior', 1.0, 2.5, 0.01)
        .name('IOR')
        .onChange(debouncedRebuildAll);
    const envMapIntensityCtrl = physicalFolder.add(group, 'envMapIntensity', 0, 5, 0.1)
        .name('Env Map Intensity')
        .onChange(debouncedRebuildAll);

    groupFolder.add(group, 'materialType', ['matte', 'satin', 'metallic', 'glass', 'frostedGlass'])
        .name('Material Type')
        .onChange(val => {
            // Reset material properties to new preset defaults
            const preset = CONFIG.materialPresets[val] || {};
            group.transmission = preset.transmission ?? CONFIG.materialDefaults.transmission;
            group.thickness = preset.thickness ?? CONFIG.materialDefaults.thickness;
            group.roughness = preset.roughness ?? CONFIG.materialDefaults.roughness;
            group.metalness = preset.metalness ?? CONFIG.materialDefaults.metalness;
            group.clearcoat = preset.clearcoat ?? CONFIG.materialDefaults.clearcoat;
            group.clearcoatRoughness = preset.clearcoatRoughness ?? CONFIG.materialDefaults.clearcoatRoughness;
            group.ior = preset.ior ?? CONFIG.materialDefaults.ior;
            group.envMapIntensity = preset.envMapIntensity ?? CONFIG.materialDefaults.envMapIntensity;

            // Update GUI controllers to reflect new values
            transmissionCtrl.updateDisplay();
            thicknessCtrl.updateDisplay();
            roughnessCtrl.updateDisplay();
            metalnessCtrl.updateDisplay();
            clearcoatCtrl.updateDisplay();
            clearcoatRoughnessCtrl.updateDisplay();
            iorCtrl.updateDisplay();
            envMapIntensityCtrl.updateDisplay();

            debouncedRebuildAll();
        });
    groupFolder.add(group, 'scale', 0.1, 10, 0.1)
        .name('Scale')
        .onChange(debouncedRebuildAll);

    // Colors
    groupFolder.addColor(group, 'color')
        .name('Base Color')
        .onChange(debouncedRebuildAll);

    // Advanced settings (collapsed by default)
    const advancedFolder = groupFolder.addFolder('Advanced');
    advancedFolder.addColor(group, 'emissive')
        .name('Emissive Color')
        .onChange(debouncedRebuildAll);
    advancedFolder.add(group, 'emissiveIntensity', 0, 2, 0.01)
        .name('Emissive Intensity')
        .onChange(debouncedRebuildAll);

    // Remove button
    group.removeGroup = function() {
        const idx = testObjectGroups.indexOf(group);
        if (idx !== -1) {
            testObjectGroups.splice(idx, 1);
            gui.removeFolder(groupFolder);
            debouncedRebuildAll();
        }
    };
    groupFolder.add(group, 'removeGroup').name('🗑️ Remove Group');

    groupFolder.open();
}

testObjectsFolder.open();

// --- MOUSE PARALLAX ---
const mouse = new THREE.Vector2(0, 0);
const prevMouse = new THREE.Vector2(0, 0);
const mouseVelocity = new THREE.Vector2(0, 0);
const targetRotation = new THREE.Vector2(0, 0);
const targetPosition = new THREE.Vector2(0, 0);
let lastMouseMoveTime = 0;

function updateMousePosition(event) {
    prevMouse.copy(mouse);
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    mouseVelocity.x = mouse.x - prevMouse.x;
    mouseVelocity.y = mouse.y - prevMouse.y;
    lastMouseMoveTime = performance.now();
}

function resetMousePosition() {
    if (CONFIG.resetMouseOnLeave) {
        mouse.x = 0;
        mouse.y = 0;
    }
}

// Reset mouse tracking on visibility changes
function onVisibilityChange() {
    if (document.hidden) {
        resetMousePosition();
    }
}

// Track mouse using multiple event types for reliability
// Using document-level listeners to work even without focus
document.addEventListener('mousemove', updateMousePosition, { passive: true });
document.addEventListener('pointermove', updateMousePosition, { passive: true });

// Reset when mouse leaves the document/window
document.addEventListener('mouseleave', resetMousePosition);
document.addEventListener('mouseout', (event) => {
    // Only reset if actually leaving the document (not just moving between elements)
    if (event.relatedTarget === null || event.relatedTarget.nodeName === 'HTML') {
        resetMousePosition();
    }
});
window.addEventListener('pointerleave', resetMousePosition);

// Handle visibility changes
document.addEventListener('visibilitychange', onVisibilityChange);

// When mouse enters, immediately start tracking
document.addEventListener('mouseenter', (event) => {
    updateMousePosition(event);
});

// Backup listeners to ensure mouse position updates after clicks
document.addEventListener('mouseup', updateMousePosition, { passive: true });
document.addEventListener('click', updateMousePosition, { passive: true });
document.addEventListener('mousedown', updateMousePosition, { passive: true });

// Edge-specific fix: release pointer capture which can block mousemove events
window.addEventListener('pointerdown', (event) => {
    // Update position on pointer down
    updateMousePosition(event);
    // Release any implicit pointer capture that Edge might set
    if (event.target.releasePointerCapture) {
        try {
            event.target.releasePointerCapture(event.pointerId);
        } catch (e) {
            // Ignore - pointer might not be captured
        }
    }
}, { passive: true });

// --- ANIMATION LOOP ---
let state = "IDLE";

// FPS tracking
let lastTime = performance.now();
let frameCount = 0;
let fps = 0;
const fpsHistory = [];
const maxFpsHistory = 100;

function animate() {
    if (CONFIG.uncapFPS) {
        setTimeout(animate, 0);
    } else {
        requestAnimationFrame(animate);
    }

    const time = Date.now();

    // Calculate FPS
    frameCount++;
    const currentTime = performance.now();
    const elapsed = currentTime - lastTime;

    if (elapsed >= 1000) {
        fps = Math.round((frameCount * 1000) / elapsed);
        fpsText.textContent = `FPS: ${fps}`;

        // Update FPS history
        fpsHistory.push(fps);
        if (fpsHistory.length > maxFpsHistory) {
            fpsHistory.shift();
        }

        // Draw FPS graph
        if (guiControls.showFPS) {
            const maxFps = Math.max(60, Math.max(...fpsHistory, 120));
            const graphWidth = fpsCanvas.width;
            const graphHeight = fpsCanvas.height;

            // Clear canvas
            fpsCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            fpsCtx.fillRect(0, 0, graphWidth, graphHeight);

            // Draw grid lines
            fpsCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            fpsCtx.lineWidth = 1;

            // 60 FPS line
            const y60 = graphHeight - (60 / maxFps) * graphHeight;
            fpsCtx.beginPath();
            fpsCtx.moveTo(0, y60);
            fpsCtx.lineTo(graphWidth, y60);
            fpsCtx.stroke();

            // Draw FPS line
            fpsCtx.strokeStyle = fps < 60 ? '#ff6666' : '#66ff66';
            fpsCtx.lineWidth = 2;
            fpsCtx.beginPath();

            for (let i = 0; i < fpsHistory.length; i++) {
                const x = (i / (maxFpsHistory - 1)) * graphWidth;
                const y = graphHeight - (fpsHistory[i] / maxFps) * graphHeight;

                if (i === 0) {
                    fpsCtx.moveTo(x, y);
                } else {
                    fpsCtx.lineTo(x, y);
                }
            }

            fpsCtx.stroke();

            // Draw labels
            fpsCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            fpsCtx.font = '10px monospace';
            fpsCtx.fillText(`${maxFps}`, 2, 10);
            fpsCtx.fillText('0', 2, graphHeight - 2);
            fpsCtx.fillText('60', 2, y60 - 2);
        }

        frameCount = 0;
        lastTime = currentTime;
    }

    // Parallax rotation and position of the tree group
    // Use different strengths for exploded vs idle/returning states
    const isExploding = state === "EXPLODING";
    const parallaxActive = isExploding ? CONFIG.explodedParallaxEnabled : CONFIG.parallaxEnabled;

    if (parallaxActive) {
        const parallaxX = isExploding ? CONFIG.explodedParallaxStrengthX : CONFIG.parallaxStrengthX;
        const parallaxY = isExploding ? CONFIG.explodedParallaxStrengthY : CONFIG.parallaxStrengthY;
        targetRotation.x = mouse.y * parallaxX;
        targetRotation.y = mouse.x * parallaxY;
        targetPosition.x = mouse.x * CONFIG.parallaxPositionStrengthX;
        targetPosition.y = mouse.y * CONFIG.parallaxPositionStrengthY;
    } else {
        targetRotation.x = 0;
        targetRotation.y = 0;
        targetPosition.x = 0;
        targetPosition.y = 0;
    }

    treeGroup.rotation.x += (targetRotation.x - treeGroup.rotation.x) * CONFIG.parallaxSmoothing;
    treeGroup.rotation.y += (targetRotation.y - treeGroup.rotation.y) * CONFIG.parallaxSmoothing;
    treeGroup.position.x += (targetPosition.x - treeGroup.position.x) * CONFIG.parallaxSmoothing;
    treeGroup.position.y += (targetPosition.y + CONFIG.treeYOffset - treeGroup.position.y) * CONFIG.parallaxSmoothing;

    // --- SHOWCASE BOX ANIMATION ---
    if (showcaseBox) {
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

    // Particle Logic - applies to both tree particles and test particles
    let allReturned = true;

    // Animate tree particles
    particles.forEach((p, index) => {
        // Constant gentle rotation for all states
        p.rotation.x += p.userData.rotSpeed.x;
        p.rotation.y += p.userData.rotSpeed.y;
        p.rotation.z += p.userData.rotSpeed.z;

        if (state === "IDLE") {
            // Gentle floating motion
            const floatOffset = Math.sin(time * CONFIG.idleFloatSpeed + index * 0.1) * CONFIG.idleFloatAmount;
            p.position.y = p.userData.originalPos.y + floatOffset;
            p.position.x = p.userData.originalPos.x;
            p.position.z = p.userData.originalPos.z;
        }
        else if (state === "EXPLODING") {
            // Calculate parallax offset based on mouse position (if enabled)
            if (CONFIG.explodedParallaxEnabled) {
                const parallaxX = mouse.x * CONFIG.explodedParallaxStrength * p.userData.baseParallaxSensitivity;
                const parallaxY = mouse.y * CONFIG.explodedParallaxStrength * p.userData.baseParallaxSensitivity;
                p.userData.individualParallaxShift.x += (parallaxX - p.userData.individualParallaxShift.x) * 0.08;
                p.userData.individualParallaxShift.y += (parallaxY - p.userData.individualParallaxShift.y) * 0.08;
            } else {
                p.userData.individualParallaxShift.x *= 0.95;
                p.userData.individualParallaxShift.y *= 0.95;
            }

            // Calculate target position with parallax applied
            const targetX = p.userData.explosionTarget.x + p.userData.individualParallaxShift.x;
            const targetY = p.userData.explosionTarget.y + p.userData.individualParallaxShift.y;
            const targetZ = p.userData.explosionTarget.z;

            // Lerp toward parallax-adjusted target
            p.position.x += (targetX - p.position.x) * CONFIG.animationSpeed;
            p.position.y += (targetY - p.position.y) * CONFIG.animationSpeed;
            p.position.z += (targetZ - p.position.z) * CONFIG.animationSpeed;

            // Add subtle floating motion on top
            const floatOffset = Math.sin(time * CONFIG.idleFloatSpeed * 2 + index * 0.1) * CONFIG.idleFloatAmount;
            p.position.x += Math.sin(time * 0.001 + index) * 0.01;
            p.position.y += floatOffset;
            p.position.z += Math.cos(time * 0.001 + index) * 0.01;

            // Faster rotation when exploding
            p.rotation.x += 0.02;
            p.rotation.y += 0.01;
        }
        else if (state === "RETURNING") {
            // Return to original tree position using same animation speed
            p.position.lerp(p.userData.originalPos, CONFIG.animationSpeed);

            // Fade out parallax shift
            p.userData.individualParallaxShift.multiplyScalar(0.95);

            // Check if this particle has returned close enough to its original position
            const dist = p.position.distanceTo(p.userData.originalPos);
            if (dist > 0.1) {
                allReturned = false;
            }
        }
    });

    // Animate test particles (same logic as tree particles)
    testParticles.forEach((p, index) => {
        // Constant gentle rotation for all states
        p.rotation.x += p.userData.rotSpeed.x;
        p.rotation.y += p.userData.rotSpeed.y;
        p.rotation.z += p.userData.rotSpeed.z;

        if (state === "IDLE") {
            // Gentle floating motion
            const floatOffset = Math.sin(time * CONFIG.idleFloatSpeed + index * 0.1) * CONFIG.idleFloatAmount;
            p.position.y = p.userData.originalPos.y + floatOffset;
            p.position.x = p.userData.originalPos.x;
            p.position.z = p.userData.originalPos.z;
        }
        else if (state === "EXPLODING") {
            // Calculate parallax offset based on mouse position (if enabled)
            if (CONFIG.explodedParallaxEnabled) {
                const parallaxX = mouse.x * CONFIG.explodedParallaxStrength * p.userData.baseParallaxSensitivity;
                const parallaxY = mouse.y * CONFIG.explodedParallaxStrength * p.userData.baseParallaxSensitivity;
                p.userData.individualParallaxShift.x += (parallaxX - p.userData.individualParallaxShift.x) * 0.08;
                p.userData.individualParallaxShift.y += (parallaxY - p.userData.individualParallaxShift.y) * 0.08;
            } else {
                p.userData.individualParallaxShift.x *= 0.95;
                p.userData.individualParallaxShift.y *= 0.95;
            }

            // Calculate target position with parallax applied
            const targetX = p.userData.explosionTarget.x + p.userData.individualParallaxShift.x;
            const targetY = p.userData.explosionTarget.y + p.userData.individualParallaxShift.y;
            const targetZ = p.userData.explosionTarget.z;

            // Lerp toward parallax-adjusted target
            p.position.x += (targetX - p.position.x) * CONFIG.animationSpeed;
            p.position.y += (targetY - p.position.y) * CONFIG.animationSpeed;
            p.position.z += (targetZ - p.position.z) * CONFIG.animationSpeed;

            // Add subtle floating motion on top
            const floatOffset = Math.sin(time * CONFIG.idleFloatSpeed * 2 + index * 0.1) * CONFIG.idleFloatAmount;
            p.position.x += Math.sin(time * 0.001 + index) * 0.01;
            p.position.y += floatOffset;
            p.position.z += Math.cos(time * 0.001 + index) * 0.01;

            // Faster rotation when exploding
            p.rotation.x += 0.02;
            p.rotation.y += 0.01;
        }
        else if (state === "RETURNING") {
            // Return to original tree position using same animation speed
            p.position.lerp(p.userData.originalPos, CONFIG.animationSpeed);

            // Fade out parallax shift
            p.userData.individualParallaxShift.multiplyScalar(0.95);

            // Check if this particle has returned close enough to its original position
            const dist = p.position.distanceTo(p.userData.originalPos);
            if (dist > 0.1) {
                allReturned = false;
            }
        }
    });

    // Transition to IDLE when all particles have returned
    if (state === "RETURNING" && allReturned) {
        state = "IDLE";
        updateCamera(state);
    }

    // When showcase is visible, skip bloom for correct depth and colors
    if (showcaseBox && showcaseBoxShouldShow) {
        showcaseBox.visible = true;
        renderer.render(scene, camera);
    } else {
        if (showcaseBox) showcaseBox.visible = false;
        composer.render();
    }
}
animate();

// --- INTERACTION ---
let returnTimer = null;

function triggerExplosion(event) {
    // Ignore clicks on dat.GUI elements
    const target = event.target;
    if (target.closest('.dg')) {
        return; // Click was on GUI, ignore it
    }

    // Only prevent default on touch events to avoid scroll/zoom
    // Don't prevent on mouse events as it breaks mousemove tracking
    if (event.type === 'touchstart') {
        event.preventDefault();
    }

    // If already exploding and reassembleOnClick is enabled, start returning immediately
    if (state === "EXPLODING" && CONFIG.reassembleOnClick) {
        // Clear any pending timers
        if (returnTimer) {
            clearTimeout(returnTimer);
            returnTimer = null;
        }

        // Reset showcase box visibility flag
        showcaseBoxShouldShow = false;

        state = "RETURNING";
        updateCamera(state);
        // Don't set a timer here - we'll transition to IDLE based on position convergence
        return;
    }

    // Allow exploding from IDLE or RETURNING state (can re-explode while returning)
    if (state !== "IDLE" && state !== "RETURNING") return;

    // Clear any pending timers from previous explosion
    if (returnTimer) {
        clearTimeout(returnTimer);
        returnTimer = null;
    }

    state = "EXPLODING";
    updateCamera(state);

    // Reset individual parallax shifts
    particles.forEach(p => {
        p.userData.individualParallaxShift.set(0, 0, 0);
    });

    // Cycle to next showcase image and show box after delay
    if (showcaseImagesLoaded && showcaseTextures.length > 0) {
        // Get next image for this explosion
        const nextTexture = getNextShowcaseImage();
        updateShowcaseBoxTexture(nextTexture);

        setTimeout(() => {
            if (state === "EXPLODING") {
                showcaseBoxShouldShow = true;
            }
        }, CONFIG.imageDelay);
    }

    returnTimer = setTimeout(() => {
        showcaseBoxShouldShow = false;
        state = "RETURNING";
        updateCamera(state);
        // IDLE transition now happens automatically based on particle convergence
        returnTimer = null;
    }, CONFIG.holdDuration);
}

window.addEventListener('mousedown', triggerExplosion);
window.addEventListener('touchstart', triggerExplosion, { passive: false });

window.addEventListener('resize', () => {
    const newAspect = window.innerWidth / window.innerHeight;

    // Update perspective camera
    perspectiveCamera.aspect = newAspect;
    perspectiveCamera.updateProjectionMatrix();

    // Update orthographic camera
    const frustumSize = CONFIG.isometricZoom;
    orthographicCamera.left = frustumSize * newAspect / -2;
    orthographicCamera.right = frustumSize * newAspect / 2;
    orthographicCamera.top = frustumSize / 2;
    orthographicCamera.bottom = frustumSize / -2;
    orthographicCamera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});
