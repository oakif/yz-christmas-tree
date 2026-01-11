import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Core modules
import { state } from './state.js';
import {
    createScene,
    createPerspectiveCamera,
    createOrthographicCamera,
    createRenderer,
    updateCameraOnStateChange,
} from './core/scene.js';
import { createEnvironmentMap } from './core/environment.js';
import { createLighting } from './core/lighting.js';
import { createPostProcessing } from './core/postprocessing.js';

// Particle modules
import { initGeometries, getGeometryForType } from './particles/geometry.js';
import { sampleTreePosition, generateExplosionTargets } from './particles/distribution.js';
import { getMaterialFromDefinition, validateAndMergeObjectDef } from './particles/materials.js';
import {
    rebuildTreeParticles as rebuildTreeParticlesFn,
    rebuildAllTestParticles as rebuildAllTestParticlesFn,
    rebuildAllParticles as rebuildAllParticlesFn,
} from './particles/particles.js';

// UI modules
import { initFpsCounter, setFpsVisibility, updateFps } from './ui/fps.js';
import {
    initModals,
    updateImageSets,
    showSettingsModal,
    showPasswordPrompt,
} from './ui/modals.js';
import { createGUI } from './ui/gui.js';

// Showcase module
import {
    initShowcase,
    loadImageSetsManifest,
    switchImageSet,
    loadEncryptedImageSet,
    getShowcaseState,
    setShowcaseBoxShouldShow,
    getNextShowcaseImage,
    updateShowcaseBoxTexture,
    animateShowcaseBox,
    renderShowcase,
    getAvailableImageSets,
    getCurrentImageSet,
} from './showcase/showcase.js';

// Interaction modules
import {
    initMouseTracking,
    getMouse,
    getLastMouseMoveTime,
    updateParallaxTargets,
    applyParallaxToGroup,
} from './interaction/mouse.js';
import { initEvents, initResizeHandler } from './interaction/events.js';

// Animation module
import {
    initAnimation,
    getAnimationState,
    setAnimationState,
    updateCameraReference,
    startAnimationLoop,
} from './animation/animation.js';

// --- SETUP SCENE ---
const container = document.getElementById('canvas-container');
const scene = createScene();
const perspectiveCamera = createPerspectiveCamera(CONFIG);
const orthographicCamera = createOrthographicCamera(CONFIG);
let camera = CONFIG.viewType === 'isometric' ? orthographicCamera : perspectiveCamera;
const renderer = createRenderer(container, CONFIG);

// Populate state with scene objects
state.scene = scene;
state.perspectiveCamera = perspectiveCamera;
state.orthographicCamera = orthographicCamera;
state.camera = camera;
state.renderer = renderer;

// --- ENVIRONMENT MAP ---
let envMap = createEnvironmentMap(renderer, CONFIG);
scene.environment = envMap;
state.envMap = envMap;

// --- CAMERA SWITCHING ---
function updateCamera(newState) {
    updateCameraOnStateChange(newState, CONFIG, state);
    camera = state.camera;
    updateCameraReference(camera);
}

// --- GEOMETRY INITIALIZATION ---
initGeometries();

// --- CREATE PARTICLES ---
const particles = [];
const treeGroup = new THREE.Group();
scene.add(treeGroup);

// Pre-generate explosion targets
const totalParticleCount = CONFIG.objects.reduce((sum, obj) => sum + obj.count, 0);
const explosionCenter = CONFIG.explosionCenterMode === 'camera'
    ? new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z)
    : new THREE.Vector3(0, 0, 0);
const explosionTargets = generateExplosionTargets(totalParticleCount, explosionCenter, CONFIG);

let explosionTargetIndex = 0;

// Create particles from object definitions
CONFIG.objects.forEach(objectDef => {
    const fullDef = validateAndMergeObjectDef(objectDef);
    const geometry = getGeometryForType(fullDef.type);
    const material = getMaterialFromDefinition(fullDef, CONFIG, envMap);

    for (let i = 0; i < fullDef.count; i++) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.scale.setScalar(fullDef.scale);

        const pos = sampleTreePosition(CONFIG);

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

// --- LIGHTING ---
const lights = createLighting(scene, CONFIG);
state.lights = lights;

// --- POST PROCESSING ---
const { composer, renderPass, bloomPass } = createPostProcessing(renderer, scene, camera, CONFIG);
state.composer = composer;
state.renderPass = renderPass;
state.bloomPass = bloomPass;

// --- TEST PARTICLES ---
const testParticles = [];
const testObjectGroups = [];

// Wrapper functions for particle rebuilding
function rebuildTreeParticles() {
    rebuildTreeParticlesFn(particles, treeGroup, testObjectGroups, camera, CONFIG, envMap, guiControls);
}

function rebuildAllTestParticles() {
    rebuildAllTestParticlesFn(testParticles, testObjectGroups, particles, treeGroup, camera, CONFIG, envMap, guiControls);
}

function rebuildAllParticles() {
    rebuildAllParticlesFn(particles, testParticles, testObjectGroups, treeGroup, camera, CONFIG, envMap, guiControls);
}

// --- INITIALIZE UI ---
initFpsCounter();
setFpsVisibility(CONFIG.showFPS);

// --- INITIALIZE SHOWCASE ---
initShowcase(scene, CONFIG);

// Async wrapper for switchImageSet that handles password prompts
async function handleSwitchImageSet(setId) {
    const result = await switchImageSet(setId);
    if (result && result.needsPassword) {
        showPasswordPrompt(result.set);
    }
}

// --- INITIALIZE MODALS ---
initModals(CONFIG, getAvailableImageSets(), {
    switchImageSet: handleSwitchImageSet,
    loadEncryptedImageSet: loadEncryptedImageSet,
    getCurrentImageSet: getCurrentImageSet,
});

// Initialize image sets on startup
loadImageSetsManifest().then(manifest => {
    if (manifest) {
        updateImageSets(manifest.sets || [], getCurrentImageSet());
        if (manifest.defaultSet) {
            handleSwitchImageSet(manifest.defaultSet);
        }
        // Show settings modal on page load (with auto-close countdown)
        if (getAvailableImageSets().length > 0) {
            showSettingsModal(true);
        }
    }
});

// --- INITIALIZE MOUSE TRACKING ---
initMouseTracking(CONFIG);

// --- INITIALIZE EVENTS ---
initEvents(CONFIG, {
    onExplosion: () => {
        // Reset individual parallax shifts
        particles.forEach(p => {
            p.userData.individualParallaxShift.set(0, 0, 0);
        });

        // Cycle to next showcase image and show box after delay
        const showcaseState = getShowcaseState();
        if (showcaseState.showcaseImagesLoaded && showcaseState.showcaseTextures.length > 0) {
            const nextTexture = getNextShowcaseImage();
            updateShowcaseBoxTexture(nextTexture);

            setTimeout(() => {
                if (getAnimationState() === "EXPLODING") {
                    setShowcaseBoxShouldShow(true);
                }
            }, CONFIG.imageDelay);
        }

        updateCamera("EXPLODING");
    },
    onReturn: () => {
        setShowcaseBoxShouldShow(false);
        updateCamera("RETURNING");
    },
    getAnimationState: getAnimationState,
    setAnimationState: (newState) => {
        setAnimationState(newState);
        updateCamera(newState);
    },
});

initResizeHandler({
    perspectiveCamera,
    orthographicCamera,
    renderer,
    composer,
});

// --- CREATE GUI ---
// Forward declaration for guiControls (used by rebuild functions)
let guiControls = {};

const guiResult = createGUI(CONFIG, {
    perspectiveCamera,
    orthographicCamera,
    renderer,
    scene,
    renderPass,
    bloomPass,
    ambientLight: lights.ambient,
    hemiLight: lights.hemi,
    keyLight: lights.key,
    fillLight: lights.fill,
    rimLight: lights.rim,
    overheadLight: lights.overhead,
    topGlow: lights.topGlow,
    particles,
    testParticles,
    testObjectGroups,
    state: {
        get animationState() { return getAnimationState(); },
        get camera() { return camera; },
        set camera(c) { camera = c; state.camera = c; },
        get envMap() { return envMap; },
        set envMap(e) { envMap = e; state.envMap = e; },
    },
}, {
    rebuildAllParticles,
    rebuildAllTestParticles,
    switchImageSet: handleSwitchImageSet,
    loadImageSetsManifest,
    setFpsVisibility,
});

guiControls = guiResult.guiControls;

// --- INITIALIZE ANIMATION ---
initAnimation(CONFIG, {
    particles,
    testParticles,
    treeGroup,
    camera,
    renderer,
    composer,
    scene,
}, {
    updateFps,
    updateParallaxTargets,
    applyParallaxToGroup,
    animateShowcaseBox,
    renderShowcase,
    getMouse,
    getLastMouseMoveTime,
    updateCamera,
});

// --- START ANIMATION LOOP ---
startAnimationLoop();
