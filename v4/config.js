/**
 * Christmas Tree Configuration
 *
 * STRUCTURE:
 * This configuration uses semantic grouping for better organization.
 * Settings are organized into: Scene Setup, Interaction, Animation & Effects,
 * Rendering & Visuals, UI & Performance, and Reward Image.
 *
 * OBJECTS:
 * Define particles using the objects array. Each object creates a set of particles.
 *
 * Required properties:
 *   - type: 'star' | 'heart' | 'snowflake' | 'present' | 'sphere'
 *   - count: number of particles to create
 *
 * Optional properties (with defaults):
 *   - scale: 1.0 (size multiplier)
 *   - color: 0xffffff (base color)
 *   - emissive: 0x000000 (glow color)
 *   - emissiveIntensity: 0.0 (glow strength, affects bloom)
 *   - materialType: 'matte' | 'satin' | 'metallic' | 'glass' | 'frostedGlass'
 *   - materialOverrides: {} (override specific material properties)
 *
 * MATERIAL TYPES:
 *   - matte: Non-reflective, diffuse surface
 *   - satin: Soft, diffused reflections
 *   - metallic: Mirror-like specular reflections
 *   - glass: Transparent with refraction (clear glass)
 *   - frostedGlass: Transparent but blurred/diffused
 *
 * TIP: To create multiple variants (e.g., different colored presents),
 * create separate object definitions.
 *
 * BACKWARD COMPATIBILITY:
 * All properties can be accessed using flat notation (e.g., CONFIG.treeHeight)
 * or nested notation (e.g., CONFIG.sceneSetup.treeGeometry.height).
 * Both work identically via getter/setter properties.
 */
export const CONFIG = {
    // ========================================
    // 1. SCENE SETUP
    // ========================================
    sceneSetup: {
        treeGeometry: {
            height: 40,
            radius: 14,
            yOffset: 3,        // Shift the entire tree up (+) or down (-)
        },
        camera: {
            position: {
                x: 0,
                y: 25,
                z: 30,
            },
            viewType: 'isometric',           // Idle/returning: 'perspective' or 'isometric'
            explodedViewType: 'perspective', // Exploded state: 'perspective' or 'isometric'
            isometric: {
                zoom: 60,        // Zoom level (higher = closer)
                angle: 35.26,    // Viewing angle in degrees (standard isometric is 35.26°)
            },
        },
    },

    // ========================================
    // 2. INTERACTION
    // ========================================
    interaction: {
        reassembleOnClick: true,  // Click while exploded to reassemble immediately
        resetMouseOnLeave: false, // Reset parallax to center when mouse leaves screen
    },

    // ========================================
    // 3. ANIMATION & EFFECTS
    // ========================================
    animation: {
        idle: {
            floatSpeed: 0.003,    // Wobble speed when idle
            floatAmount: 0.05,    // Wobble magnitude
        },
        explosion: {
            speed: 0.12,          // Speed for explosion spread and return (0.01 = slow, 0.2 = fast)
            holdDuration: 30000,  // Milliseconds before reforming
        },
        parallax: {
            idle: {
                enabled: true,                // Enable/disable idle parallax
                strengthX: 1.5,               // Mouse Y -> rotation X
                strengthY: 4.0,               // Mouse X -> rotation Y
                smoothing: 0.05,              // Smoothness (lower = smoother)
                positionStrengthX: 0.0,       // Mouse X -> position movement (0 = disabled)
                positionStrengthY: 0,         // Mouse Y -> position movement (0 = disabled)
            },
            exploded: {
                enabled: true,                // Enable/disable exploded parallax
                strengthX: 1.2,               // Mouse Y -> rotation X when exploded
                strengthY: 1.2,               // Mouse X -> rotation Y when exploded
                individualStrength: 0,        // Individual particle parallax when exploded
            },
        },
        explosionDistribution: {
            innerRadius: 30,         // Inner radius (prevents particles too close to camera)
            outerRadius: 50,         // Outer radius (maximum distance from center)
            centerMode: 'tree',      // Center point: 'camera' or 'tree'
            offset: {
                x: 0,                // X offset from center point
                y: -3,               // Y offset from center point
                z: 0,                // Z offset from center point
            },
        },
    },

    // ========================================
    // 4. RENDERING & VISUALS
    // ========================================
    rendering: {
        postProcessing: {
            bloom: {
                strength: 0.35,       // Intensity of glow effect
                radius: 0.5,          // Size of glow
                threshold: 0.2,       // Brightness threshold to glow
            },
            toneMappingExposure: 4.0,  // Higher = brighter scene (1.0-2.0 typical range)
        },
        environment: {
            topColor: 0x0a0a15,      // Sky gradient top color (dark)
            bottomColor: 0x1a1a2a,   // Sky gradient bottom color
            brightness: 1.0,         // Overall brightness multiplier
        },
        lighting: {
            ambient: {
                color: 0x404050,   // Cool gray tone
                intensity: 1.6,    // Base illumination brightness
            },
            hemisphere: {
                skyColor: 0x5577bb,    // Sky color (top hemisphere)
                groundColor: 0x554433, // Ground color (bottom hemisphere)
                intensity: 1.0,        // Brightness of hemisphere light
            },
            keyLight: {
                color: 0xffeedd,   // Warm directional light
                intensity: 0.4,    // Main light strength
                position: [20, 30, 25],  // [x, y, z]
            },
            fillLight: {
                color: 0xccddff,   // Cool fill light
                intensity: 1.5,    // Fill light strength
                position: [-15, 10, -10],
            },
            rimLight: {
                color: 0xffffff,   // White rim/back light
                intensity: 0.2,    // Subtle edge definition
                position: [0, -5, -25],
            },
            overheadLight: {
                color: 0xffffff,   // White overhead light (like sun from above)
                intensity: 0.6,    // Soft key light from above
                position: [0, 50, 0],
            },
            topGlow: {
                color: 0xffffee,   // Warm glow at tree top
                intensity: 0.8,    // Point light strength
                range: 30,         // Maximum distance this light reaches
            },
        },
    },

    // ========================================
    // 5. UI & PERFORMANCE
    // ========================================
    ui: {
        visibility: {
            showTreeParticles: true,  // Show/hide tree particles
            showFPS: false,            // Show FPS counter
        },
        performance: {
            performanceMode: false,  // true = optimized fake glass, false = full physical refraction
            uncapFPS: false,         // true = uncapped FPS, false = vsync-capped
        },
    },

    // ========================================
    // 6. REWARD IMAGE
    // ========================================
    reward: {
        image: '',       // Path to image displayed on explosion (empty = disabled)
        delay: 500,      // Milliseconds before showing image after explosion
    },

    // ========================================
    // PARTICLES / OBJECTS
    // ========================================
    objects: [
        {
            type: 'star',
            count: 400,
            scale: 1.0,
            color: 0xfffee8,
            materialType: 'glass',
        },
        {
            type: 'heart',
            count: 800,
            scale: 0.8,
            color: 0xff0055,
            emissive: 0x220011,
            emissiveIntensity: 0.3,
            materialType: 'frostedGlass',
            materialOverrides: {
                transmission: 0.8,
            }
        },
        {
            type: 'present',
            count: 200,
            scale: 1.0,
            color: 0x036d49,
            materialType: 'satin',
        },
        {
            type: 'present',
            count: 200,
            scale: 1.0,
            color: 0xbaa6dff,
            materialType: 'satin',
        },
    ],

    // ========================================
    // MATERIAL SYSTEM
    // ========================================
    // Material defaults used by all materials
    materialDefaults: {
        // Physical materials (glass types)
        transmission: 0.75,        // Transparency level
        thickness: 0.5,            // Refraction thickness
        roughness: 0.15,           // Surface roughness
        clearcoat: 0.0,            // NO clearcoat by default (prevents mirror effect)
        clearcoatRoughness: 0.0,
        ior: 1.5,                  // Refractive index (glass)

        // Standard materials (matte, satin, metallic)
        metalness: 0.2,

        // Environment map reflections
        envMapIntensity: 1.0,
    },

    // Material type presets (use in particle definitions)
    materialPresets: {
        matte: {
            // Non-reflective, diffuse surface
            materialClass: 'Standard',
            roughness: 0.9,
            metalness: 0.0,
            transmission: 0.0,
            clearcoat: 0.0,
        },

        satin: {
            // Soft, diffused reflections (like silk or satin fabric)
            materialClass: 'Standard',
            roughness: 0.4,
            metalness: 0.2,
            transmission: 0.0,
            clearcoat: 0.3,
            clearcoatRoughness: 0.5,
        },

        metallic: {
            // Specular, mirror-like reflections
            materialClass: 'Standard',
            roughness: 0.1,
            metalness: 0.95,
            transmission: 0.0,
            clearcoat: 0.0,
        },

        glass: {
            // Transparent with refraction, NOT overly shiny
            materialClass: 'Physical',
            roughness: 0.15,
            metalness: 0.0,
            transmission: 0.75,
            thickness: 0.5,
            clearcoat: 0.0,
            clearcoatRoughness: 0.0,
            ior: 1.5,
        },

        frostedGlass: {
            // Transparent but heavily blurred/diffused
            materialClass: 'Physical',
            roughness: 0.6,
            metalness: 0.0,
            transmission: 0.7,
            thickness: 0.5,
            clearcoat: 0.0,
            clearcoatRoughness: 0.0,
            ior: 1.5,
        },
    },

    // ========================================
    // BACKWARD COMPATIBILITY PROPERTIES
    // ========================================
    // These getters/setters allow existing code to use flat notation (CONFIG.treeHeight)
    // while the actual values are stored in the nested structure above.

    // Scene Setup - Tree Geometry
    get treeHeight() { return this.sceneSetup.treeGeometry.height; },
    set treeHeight(v) { this.sceneSetup.treeGeometry.height = v; },

    get treeRadius() { return this.sceneSetup.treeGeometry.radius; },
    set treeRadius(v) { this.sceneSetup.treeGeometry.radius = v; },

    get treeYOffset() { return this.sceneSetup.treeGeometry.yOffset; },
    set treeYOffset(v) { this.sceneSetup.treeGeometry.yOffset = v; },

    // Scene Setup - Camera Position
    get cameraX() { return this.sceneSetup.camera.position.x; },
    set cameraX(v) { this.sceneSetup.camera.position.x = v; },

    get cameraY() { return this.sceneSetup.camera.position.y; },
    set cameraY(v) { this.sceneSetup.camera.position.y = v; },

    get cameraZ() { return this.sceneSetup.camera.position.z; },
    set cameraZ(v) { this.sceneSetup.camera.position.z = v; },

    // Scene Setup - View Settings
    get viewType() { return this.sceneSetup.camera.viewType; },
    set viewType(v) { this.sceneSetup.camera.viewType = v; },

    get explodedViewType() { return this.sceneSetup.camera.explodedViewType; },
    set explodedViewType(v) { this.sceneSetup.camera.explodedViewType = v; },

    get isometricZoom() { return this.sceneSetup.camera.isometric.zoom; },
    set isometricZoom(v) { this.sceneSetup.camera.isometric.zoom = v; },

    get isometricAngle() { return this.sceneSetup.camera.isometric.angle; },
    set isometricAngle(v) { this.sceneSetup.camera.isometric.angle = v; },

    // Interaction
    get reassembleOnClick() { return this.interaction.reassembleOnClick; },
    set reassembleOnClick(v) { this.interaction.reassembleOnClick = v; },

    get resetMouseOnLeave() { return this.interaction.resetMouseOnLeave; },
    set resetMouseOnLeave(v) { this.interaction.resetMouseOnLeave = v; },

    // Animation - Idle
    get idleFloatSpeed() { return this.animation.idle.floatSpeed; },
    set idleFloatSpeed(v) { this.animation.idle.floatSpeed = v; },

    get idleFloatAmount() { return this.animation.idle.floatAmount; },
    set idleFloatAmount(v) { this.animation.idle.floatAmount = v; },

    // Animation - Explosion
    get animationSpeed() { return this.animation.explosion.speed; },
    set animationSpeed(v) { this.animation.explosion.speed = v; },

    get holdDuration() { return this.animation.explosion.holdDuration; },
    set holdDuration(v) { this.animation.explosion.holdDuration = v; },

    // Animation - Parallax Idle
    get parallaxEnabled() { return this.animation.parallax.idle.enabled; },
    set parallaxEnabled(v) { this.animation.parallax.idle.enabled = v; },

    get parallaxStrengthX() { return this.animation.parallax.idle.strengthX; },
    set parallaxStrengthX(v) { this.animation.parallax.idle.strengthX = v; },

    get parallaxStrengthY() { return this.animation.parallax.idle.strengthY; },
    set parallaxStrengthY(v) { this.animation.parallax.idle.strengthY = v; },

    get parallaxSmoothing() { return this.animation.parallax.idle.smoothing; },
    set parallaxSmoothing(v) { this.animation.parallax.idle.smoothing = v; },

    get parallaxPositionStrengthX() { return this.animation.parallax.idle.positionStrengthX; },
    set parallaxPositionStrengthX(v) { this.animation.parallax.idle.positionStrengthX = v; },

    get parallaxPositionStrengthY() { return this.animation.parallax.idle.positionStrengthY; },
    set parallaxPositionStrengthY(v) { this.animation.parallax.idle.positionStrengthY = v; },

    // Animation - Parallax Exploded
    get explodedParallaxEnabled() { return this.animation.parallax.exploded.enabled; },
    set explodedParallaxEnabled(v) { this.animation.parallax.exploded.enabled = v; },

    get explodedParallaxStrengthX() { return this.animation.parallax.exploded.strengthX; },
    set explodedParallaxStrengthX(v) { this.animation.parallax.exploded.strengthX = v; },

    get explodedParallaxStrengthY() { return this.animation.parallax.exploded.strengthY; },
    set explodedParallaxStrengthY(v) { this.animation.parallax.exploded.strengthY = v; },

    get explodedParallaxStrength() { return this.animation.parallax.exploded.individualStrength; },
    set explodedParallaxStrength(v) { this.animation.parallax.exploded.individualStrength = v; },

    // Animation - Explosion Distribution
    get explosionInnerRadius() { return this.animation.explosionDistribution.innerRadius; },
    set explosionInnerRadius(v) { this.animation.explosionDistribution.innerRadius = v; },

    get explosionOuterRadius() { return this.animation.explosionDistribution.outerRadius; },
    set explosionOuterRadius(v) { this.animation.explosionDistribution.outerRadius = v; },

    get explosionCenterMode() { return this.animation.explosionDistribution.centerMode; },
    set explosionCenterMode(v) { this.animation.explosionDistribution.centerMode = v; },

    get explosionOffsetX() { return this.animation.explosionDistribution.offset.x; },
    set explosionOffsetX(v) { this.animation.explosionDistribution.offset.x = v; },

    get explosionOffsetY() { return this.animation.explosionDistribution.offset.y; },
    set explosionOffsetY(v) { this.animation.explosionDistribution.offset.y = v; },

    get explosionOffsetZ() { return this.animation.explosionDistribution.offset.z; },
    set explosionOffsetZ(v) { this.animation.explosionDistribution.offset.z = v; },

    // Rendering - Post Processing
    get bloomStrength() { return this.rendering.postProcessing.bloom.strength; },
    set bloomStrength(v) { this.rendering.postProcessing.bloom.strength = v; },

    get bloomRadius() { return this.rendering.postProcessing.bloom.radius; },
    set bloomRadius(v) { this.rendering.postProcessing.bloom.radius = v; },

    get bloomThreshold() { return this.rendering.postProcessing.bloom.threshold; },
    set bloomThreshold(v) { this.rendering.postProcessing.bloom.threshold = v; },

    get toneMappingExposure() { return this.rendering.postProcessing.toneMappingExposure; },
    set toneMappingExposure(v) { this.rendering.postProcessing.toneMappingExposure = v; },

    // Rendering - Environment (return object reference for nested access)
    get environmentMap() { return this.rendering.environment; },

    // Rendering - Lighting (return object reference for nested access)
    get lighting() { return this.rendering.lighting; },

    // UI & Performance - Visibility
    get showTreeParticles() { return this.ui.visibility.showTreeParticles; },
    set showTreeParticles(v) { this.ui.visibility.showTreeParticles = v; },

    get showFPS() { return this.ui.visibility.showFPS; },
    set showFPS(v) { this.ui.visibility.showFPS = v; },

    // UI & Performance - Performance
    get performanceMode() { return this.ui.performance.performanceMode; },
    set performanceMode(v) { this.ui.performance.performanceMode = v; },

    get uncapFPS() { return this.ui.performance.uncapFPS; },
    set uncapFPS(v) { this.ui.performance.uncapFPS = v; },

    // Reward Image
    get rewardImage() { return this.reward.image; },
    set rewardImage(v) { this.reward.image = v; },

    get imageDelay() { return this.reward.delay; },
    set imageDelay(v) { this.reward.delay = v; },
};
