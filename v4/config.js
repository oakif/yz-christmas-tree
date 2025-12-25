/**
 * Christmas Tree Configuration
 *
 * OBJECTS:
 * Define particles using the objects array. Each object creates a set of particles.
 *
 * Required properties:
 *   - type: 'star' | 'heart' | 'snowflake' | 'present'
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
 */
export const CONFIG = {
    // ========================================
    // TREE GEOMETRY
    // ========================================
    treeHeight: 40,
    treeRadius: 14,
    treeYOffset: 3,        // Shift the entire tree up (+) or down (-)

    // ========================================
    // PARTICLES / OBJECTS
    // ========================================
    objects: [
        {
            type: 'star',
            count: 400,
            scale: 1.0,
            color: 0xfffee8,
            // emissive: 0xfffea8,
            // emissiveIntensity: 0.3,
            materialType: 'glass',
        },
        {
            type: 'heart',
            count: 600,
            scale: 0.8,
            color: 0xff0055,
            emissive: 0x220011,
            emissiveIntensity: 0.3,
            materialType: 'frostedGlass',
            materialOverrides: {
                transmission: 0.8,
            }
        },
        // {
        //     type: 'snowflake',
        //     count: 1200,
        //     scale: 1.0,
        //     color: 0xf0f8ff,
        //     emissive: 0x88aacc,
        //     emissiveIntensity: 0.15,
        //     metalness: 0.1,
        //     roughness: 0.3
        // },
        {
            type: 'present',
            count: 133,
            scale: 1.0,
            color: 0xff3333,
            // emissive: 0xff3333,
            // emissiveIntensity: 0.05,
            materialType: 'satin',
        },
        {
            type: 'present',
            count: 133,
            scale: 1.0,
            color: 0xbaa6dff,
            // emissive: 0x33ff33,
            // emissiveIntensity: 0.05,
            materialType: 'satin',
        },
        // {
        //     type: 'present',
        //     count: 134,
        //     scale: 1.0,
        //     color: 0x3333ff,
        //     emissive: 0x3333ff,
        //     emissiveIntensity: 0.05,
        //     materialType: 'satin',
        // }
    ],

    // ========================================
    // CAMERA & VIEW
    // ========================================
    // Camera position (X, Y, Z) - adjust for different viewing angles
    // For overhead view: increase Y (height), adjust Z (distance), keep X centered
    // Example: X=0, Y=25, Z=40 gives ~45° overhead angle
    cameraX: 0,
    cameraY: 25,
    cameraZ: 30,

    // View type for different states
    viewType: 'isometric',           // Idle/returning: 'perspective' or 'isometric'
    explodedViewType: 'perspective', // Exploded state: 'perspective' or 'isometric'

    // Isometric view configuration
    isometricZoom: 60,        // Zoom level (higher = closer)
    isometricAngle: 35.26,    // Viewing angle in degrees (standard isometric is 35.26°)

    // ========================================
    // INTERACTION
    // ========================================
    reassembleOnClick: true,  // Click while exploded to reassemble immediately
    resetMouseOnLeave: false, // Reset parallax to center when mouse leaves screen

    // ========================================
    // ANIMATION & PHYSICS
    // ========================================
    // Idle animation
    idleFloatSpeed: 0.005,    // Wobble speed when idle
    idleFloatAmount: 0.02,    // Wobble magnitude

    // Explosion physics
    animationSpeed: 0.12,     // Speed for explosion spread and return (0.01 = slow, 0.2 = fast)
    holdDuration: 30000,      // Milliseconds before reforming

    // Parallax effect (idle/returning state)
    parallaxStrengthX: 1.5,           // Mouse Y -> rotation X
    parallaxStrengthY: 4.0,           // Mouse X -> rotation Y
    parallaxSmoothing: 0.05,          // Smoothness (lower = smoother)
    parallaxPositionStrengthX: 0.0,   // Mouse X -> position movement (0 = disabled)
    parallaxPositionStrengthY: 0,     // Mouse Y -> position movement (0 = disabled)

    // Parallax effect (exploded state)
    explodedParallaxStrengthX: 1.2,   // Mouse Y -> rotation X when exploded
    explodedParallaxStrengthY: 1.2,   // Mouse X -> rotation Y when exploded
    explodedParallaxStrength: 0,      // Individual particle parallax when exploded

    // ========================================
    // EXPLOSION DISTRIBUTION
    // ========================================
    // Particles distribute in a hollow sphere (spherical shell)
    explosionInnerRadius: 30,    // Inner radius (prevents particles too close to camera)
    explosionOuterRadius: 50,    // Outer radius (maximum distance from center)
    explosionCenterMode: 'tree', // Center point: 'camera' or 'tree'
    explosionOffsetX: 0,         // X offset from center point
    explosionOffsetY: -3,        // Y offset from center point
    explosionOffsetZ: 0,         // Z offset from center point

    // ========================================
    // VISUAL EFFECTS
    // ========================================
    // Post-processing bloom
    bloomStrength: 0.35,       // Intensity of glow effect
    bloomRadius: 0.5,          // Size of glow
    bloomThreshold: 0.2,       // Brightness threshold to glow

    // Tone mapping (exposure/brightness)
    toneMappingExposure: 4.0,  // Higher = brighter scene (1.0-2.0 typical range)

    // Environment map (sky)
    environmentMap: {
        topColor: 0x0a0a15,      // Sky gradient top color (dark)
        bottomColor: 0x1a1a2a,   // Sky gradient bottom color
        brightness: 1.0,         // Overall brightness multiplier
    },

    // ========================================
    // LIGHTING
    // ========================================
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

    // ========================================
    // MATERIALS
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
    // REWARD IMAGE
    // ========================================
    rewardImage: '',       // Path to image displayed on explosion (empty = disabled)
    imageDelay: 500,       // Milliseconds before showing image after explosion

    // ========================================
    // RENDERING & PERFORMANCE
    // ========================================
    performanceMode: false,  // true = optimized fake glass, false = full physical refraction
};
