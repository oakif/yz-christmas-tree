import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';

// --- SETUP SCENE ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050505, 0.015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.x = CONFIG.cameraX;
camera.position.y = CONFIG.cameraY;
camera.position.z = CONFIG.cameraZ;
camera.lookAt(0, 0, 0); // Point camera at tree center

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false; // Keep shadows off for performance
container.appendChild(renderer.domElement);

// --- SETUP IMAGE ---
const imgElement = document.getElementById('reward-image');
if (CONFIG.rewardImage) {
    imgElement.src = CONFIG.rewardImage;
    imgElement.style.display = "block";
}

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
    const boxSize = 0.5;
    const ribbonWidth = 0.08;
    const ribbonHeight = 0.02;

    // Main box
    const boxGeom = new THREE.BoxGeometry(boxSize, boxSize, boxSize);

    // Ribbon across top (X direction)
    const ribbonX = new THREE.BoxGeometry(boxSize + 0.02, ribbonHeight, ribbonWidth);
    ribbonX.translate(0, boxSize / 2 + ribbonHeight / 2, 0);

    // Ribbon across top (Z direction)
    const ribbonZ = new THREE.BoxGeometry(ribbonWidth, ribbonHeight, boxSize + 0.02);
    ribbonZ.translate(0, boxSize / 2 + ribbonHeight / 2, 0);

    // Bow loops (two torus segments)
    const loopRadius = 0.12;
    const tubeRadius = 0.025;
    const bowLoop1 = new THREE.TorusGeometry(loopRadius, tubeRadius, 8, 12, Math.PI);
    bowLoop1.rotateX(Math.PI / 2);
    bowLoop1.rotateZ(Math.PI / 4);
    bowLoop1.translate(0.06, boxSize / 2 + ribbonHeight + loopRadius * 0.6, 0.06);

    const bowLoop2 = new THREE.TorusGeometry(loopRadius, tubeRadius, 8, 12, Math.PI);
    bowLoop2.rotateX(Math.PI / 2);
    bowLoop2.rotateZ(-Math.PI / 4 + Math.PI);
    bowLoop2.translate(-0.06, boxSize / 2 + ribbonHeight + loopRadius * 0.6, -0.06);

    // Center knot
    const knot = new THREE.SphereGeometry(0.04, 8, 8);
    knot.translate(0, boxSize / 2 + ribbonHeight + 0.02, 0);

    // Merge all geometries
    return mergeGeometries([boxGeom, ribbonX, ribbonZ, bowLoop1, bowLoop2, knot]);
}
const geomGiftBox = createGiftBoxGeometry();

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

// --- IMPROVED MATERIALS ---
// Star material - subtle glow, not overly bright
const starMaterial = new THREE.MeshStandardMaterial({
    color: CONFIG.colorStar,
    emissive: CONFIG.colorStar,
    emissiveIntensity: CONFIG.starEmissiveIntensity,
    metalness: 0.3,
    roughness: 0.4
});

// Heart material - smooth glossy red (reduced metalness for softer reflections)
const heartMaterial = new THREE.MeshStandardMaterial({
    color: CONFIG.colorHearts,
    emissive: 0x220011,
    emissiveIntensity: 0.15,
    metalness: 0.0,
    roughness: 0.35
});

// Snowflake material - icy crystalline white
const snowflakeMaterial = new THREE.MeshStandardMaterial({
    color: 0xf0f8ff,
    emissive: 0x88aacc,
    emissiveIntensity: 0.15,
    metalness: 0.1,
    roughness: 0.3,
    side: THREE.DoubleSide // Visible from both sides since snowflakes are thin
});

// Present materials - varied glossy colors
function createPresentMaterial(color) {
    return new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.05,
        metalness: 0.2,
        roughness: 0.4
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

// Pre-generate explosion targets
// Determine explosion center based on mode
const explosionCenter = CONFIG.explosionCenterMode === 'camera'
    ? new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z)
    : new THREE.Vector3(0, 0, 0); // Tree center at origin

const explosionTargets = generateExplosionTargets(CONFIG.particleCount, explosionCenter);

for (let i = 0; i < CONFIG.particleCount; i++) {
    let mesh;
    const rand = Math.random();

    if (rand > 0.90) { // Star (10%)
        mesh = new THREE.Mesh(geomStar, starMaterial);
        mesh.scale.setScalar(CONFIG.starScale);
    }
    else if (rand > 0.80) { // Heart (10%)
        mesh = new THREE.Mesh(geomHeart, heartMaterial);
        mesh.scale.setScalar(CONFIG.heartScale);
        mesh.rotation.z = Math.PI;
    }
    else if (rand > 0.60) { // Presents (20%)
        const c = CONFIG.colorPresents[Math.floor(Math.random() * CONFIG.colorPresents.length)];
        mesh = new THREE.Mesh(geomGiftBox, createPresentMaterial(c));
        mesh.scale.setScalar(CONFIG.presentScale);
    }
    else { // Snowflakes (60%)
        mesh = new THREE.Mesh(geomSnowflake, snowflakeMaterial);
        mesh.scale.setScalar(CONFIG.snowflakeScale);
    }

    // Use density-corrected position
    const pos = sampleTreePosition();

    mesh.userData = {
        originalPos: pos.clone(),
        explosionTarget: explosionTargets[i],
        velocity: new THREE.Vector3(0, 0, 0),
        rotSpeed: {
            x: (Math.random() - 0.5) * 0.02,
            y: (Math.random() - 0.5) * 0.02,
            z: (Math.random() - 0.5) * 0.02
        },
        individualParallaxShift: new THREE.Vector3(0, 0, 0),
        baseParallaxSensitivity: 0.5 + Math.random() * 1.0 // Each particle responds slightly differently
    };

    mesh.position.copy(pos);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

    treeGroup.add(mesh);
    particles.push(mesh);
}

// --- IMPROVED LIGHTING ---
// Darker ambient for more contrast
const ambientLight = new THREE.AmbientLight(0x202030, 0.4);
scene.add(ambientLight);

// Hemisphere light - cool sky, warm ground for depth
const hemiLight = new THREE.HemisphereLight(0x4466aa, 0x443322, 0.5);
scene.add(hemiLight);

// Key light - warm, bright, from upper right
const keyLight = new THREE.DirectionalLight(0xffeedd, 1.8);
keyLight.position.set(20, 30, 25);
scene.add(keyLight);

// Fill light - cool, softer, from left
const fillLight = new THREE.DirectionalLight(0xaaccff, 0.6);
fillLight.position.set(-15, 10, -10);
scene.add(fillLight);

// Rim/back light - creates edge definition
const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
rimLight.position.set(0, -5, -25);
scene.add(rimLight);

// Add subtle point light at tree top for star glow effect
const topGlow = new THREE.PointLight(0xffffee, 0.8, 30);
topGlow.position.set(0, CONFIG.treeHeight / 2 + 5, 0);
scene.add(topGlow);

// --- MOUSE PARALLAX ---
const mouse = new THREE.Vector2(0, 0);
const targetRotation = new THREE.Vector2(0, 0);
const targetPosition = new THREE.Vector2(0, 0);

function updateMousePosition(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function resetMousePosition() {
    mouse.x = 0;
    mouse.y = 0;
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

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now();

    // Parallax rotation and position of the tree group (always active)
    targetRotation.x = mouse.y * CONFIG.parallaxStrengthX;
    targetRotation.y = mouse.x * CONFIG.parallaxStrengthY;
    targetPosition.x = mouse.x * CONFIG.parallaxPositionStrengthX;
    targetPosition.y = mouse.y * CONFIG.parallaxPositionStrengthY;

    treeGroup.rotation.x += (targetRotation.x - treeGroup.rotation.x) * CONFIG.parallaxSmoothing;
    treeGroup.rotation.y += (targetRotation.y - treeGroup.rotation.y) * CONFIG.parallaxSmoothing;
    treeGroup.position.x += (targetPosition.x - treeGroup.position.x) * CONFIG.parallaxSmoothing;
    treeGroup.position.y += (targetPosition.y + CONFIG.treeYOffset - treeGroup.position.y) * CONFIG.parallaxSmoothing;

    // Particle Logic
    let allReturned = true;
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
            // Calculate parallax offset based on mouse position
            const parallaxX = mouse.x * CONFIG.explodedParallaxStrength * p.userData.baseParallaxSensitivity;
            const parallaxY = mouse.y * CONFIG.explodedParallaxStrength * p.userData.baseParallaxSensitivity;

            // Smoothly interpolate toward target parallax shift
            p.userData.individualParallaxShift.x += (parallaxX - p.userData.individualParallaxShift.x) * 0.08;
            p.userData.individualParallaxShift.y += (parallaxY - p.userData.individualParallaxShift.y) * 0.08;

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
    }

    composer.render();
}
animate();

// --- INTERACTION ---
let returnTimer = null;

function triggerExplosion(event) {
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

        // Hide image immediately
        if (CONFIG.rewardImage) {
            imgElement.classList.remove('visible');
        }

        state = "RETURNING";
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

    // Reset individual parallax shifts
    particles.forEach(p => {
        p.userData.individualParallaxShift.set(0, 0, 0);
    });

    if (CONFIG.rewardImage) {
        setTimeout(() => {
            imgElement.classList.add('visible');
        }, CONFIG.imageDelay);
    }

    returnTimer = setTimeout(() => {
        if (CONFIG.rewardImage) {
            imgElement.classList.remove('visible');
        }
        state = "RETURNING";
        // IDLE transition now happens automatically based on particle convergence
        returnTimer = null;
    }, CONFIG.holdDuration);
}

window.addEventListener('mousedown', triggerExplosion);
window.addEventListener('touchstart', triggerExplosion, { passive: false });

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});
