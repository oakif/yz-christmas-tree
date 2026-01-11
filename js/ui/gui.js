// dat.GUI control panel setup
import { GUI } from 'dat.gui';
import { createDefaultTestConfig } from '../particles/particles.js';
import { createEnvironmentMap } from '../core/environment.js';

// Helper to convert hex number to hex string for dat.GUI
function hexToString(hex) {
    return '#' + hex.toString(16).padStart(6, '0');
}

// Helper to convert hex string to number
function stringToHex(str) {
    return parseInt(str.replace('#', ''), 16);
}

export function createGUI(CONFIG, context, callbacks) {
    const {
        perspectiveCamera,
        orthographicCamera,
        renderer,
        scene,
        renderPass,
        bloomPass,
        ambientLight,
        hemiLight,
        keyLight,
        fillLight,
        rimLight,
        overheadLight,
        topGlow,
        particles,
        testParticles,
        testObjectGroups,
        state,
    } = context;

    const {
        rebuildAllParticles,
        rebuildAllTestParticles,
        switchImageSet,
        loadImageSetsManifest,
        setFpsVisibility,
    } = callbacks;

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
        rebuildAllParticles();
    });
    treeGeometryFolder.add(guiControls, 'treeRadius', 5, 30).name('Radius').onChange(val => {
        CONFIG.treeRadius = val;
        rebuildAllParticles();
    });
    treeGeometryFolder.add(guiControls, 'treeYOffset', -20, 20).name('Y Offset').onChange(val => {
        CONFIG.treeYOffset = val;
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
        if (state.animationState !== 'EXPLODING') {
            state.camera = val === 'isometric' ? orthographicCamera : perspectiveCamera;
            renderPass.camera = state.camera;
        }
    });
    cameraFolder.add(guiControls, 'explodedViewType', ['perspective', 'isometric']).name('Exploded View').onChange(val => {
        CONFIG.explodedViewType = val;
        if (state.animationState === 'EXPLODING') {
            state.camera = val === 'isometric' ? orthographicCamera : perspectiveCamera;
            renderPass.camera = state.camera;
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
        const envMap = createEnvironmentMap(renderer, CONFIG);
        scene.environment = envMap;
        state.envMap = envMap;
    });
    envFolder.addColor(guiControls, 'envBottomColor').name('Sky Bottom').onChange(val => {
        CONFIG.environmentMap.bottomColor = stringToHex(val);
        const envMap = createEnvironmentMap(renderer, CONFIG);
        scene.environment = envMap;
        state.envMap = envMap;
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

    // Set initial FPS counter visibility based on config
    setFpsVisibility(CONFIG.showFPS);

    visibilityFolder.add(guiControls, 'showFPS')
        .name('Show FPS')
        .onChange(val => {
            CONFIG.showFPS = val;
            setFpsVisibility(val);
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

    loadImageSetsManifest().then(manifest => {
        if (!manifest || !manifest.sets || manifest.sets.length === 0) return;

        // Build options object: { "Display Name": "set_id" }
        const setOptions = {};
        manifest.sets.forEach(set => {
            setOptions[set.name] = set.id;
        });

        guiControls.imageSet = manifest.defaultSet || manifest.sets[0].id;

        showcaseFolder.add(guiControls, 'imageSet', setOptions)
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

    return { gui, guiControls };
}
