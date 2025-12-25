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
    // --- TREE APPEARANCE ---
    treeHeight: 40,
    treeRadius: 18,
    treeYOffset: 3,        // Shift the entire tree up (+) or down (-)

    // --- OBJECTS ---
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

    // --- ANIMATION / PHYSICS ---
    animationSpeed: 0.12,      // Unified speed for explosion spread and return (0.01 = slow, 0.2 = fast)
    explosionForce: 120,       // Initial blast speed
    explosionFriction: 0.97,   // Air resistance
    idleFloatSpeed: 0.005,     // Wobble speed when idle
    idleFloatAmount: 0.02,     // How much it wobbles

    // --- PARALLAX ---
    parallaxStrengthX: 1.2,    // Mouse Y -> rotation X
    parallaxStrengthY: 2.0,    // Mouse X -> rotation Y
    parallaxSmoothing: 0.05,   // How smooth the parallax follows (lower = smoother)
    parallaxPositionStrengthX: 0.0, // Mouse X -> position movement strength (0 = disabled)
    parallaxPositionStrengthY: 0,   // Mouse Y -> position movement strength (0 = disabled)
    explodedParallaxStrength: 0, // Individual particle parallax when exploded

    // --- CAMERA / VIEW ---
    // Camera position (X, Y, Z) - adjust these for different viewing angles
    // For overhead view: increase Y (height), adjust Z (distance), keep X centered
    // Example: X=0, Y=25, Z=40 gives ~45° overhead angle
    cameraX: 0,
    cameraY: 25,
    cameraZ: 30,

    // --- TIMING ---
    holdDuration: 30000,        // Milliseconds before reforming

    // --- EXPLOSION DISTRIBUTION ---
    // When exploded, particles distribute in a hollow sphere (spherical shell)
    explosionInnerRadius: 30,   // Inner radius - prevents particles too close to camera
    explosionOuterRadius: 50,   // Outer radius - maximum distance from center
    explosionCenterMode: 'tree', // 'camera' or 'tree' - where the explosion sphere is centered
    explosionOffsetX: 0,        // X offset from the center point
    explosionOffsetY: -3,        // Y offset from the center point
    explosionOffsetZ: 0,        // Z offset from the center point

    // --- REWARD IMAGE ---
    rewardImage: "",
    imageDelay: 500,

    // --- INTERACTION ---
    reassembleOnClick: true,   // If true, clicking while exploded will reassemble immediately

    // --- BLOOM (GLOW EFFECT) ---
    bloomStrength: 0.35,       // Reduced slightly
    bloomRadius: 0.5,
    bloomThreshold: 0.2,       // Raised threshold so only bright things bloom

    // --- TONE MAPPING ---
    toneMappingExposure: 3.0,  // Higher = brighter scene (1.0-2.0 typical range)

    // --- LIGHTING SETUP ---
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

    // --- ENVIRONMENT MAP ---
    environmentMap: {
        topColor: 0x0a0a15,      // Sky gradient top color (dark)
        bottomColor: 0x1a1a2a,   // Sky gradient bottom color
        brightness: 1.0,         // Overall brightness multiplier for env map
    },

    // --- RENDERING QUALITY ---
    performanceMode: false,  // true = optimized fake glass, false = full refraction

    // --- MATERIAL DEFAULTS ---
    materialDefaults: {
        // For Physical materials (glass types)
        transmission: 0.75,        // Moderate transparency
        thickness: 0.5,            // Refraction thickness
        roughness: 0.15,           // Default roughness
        clearcoat: 0.0,            // NO clearcoat by default (prevents mirror effect)
        clearcoatRoughness: 0.0,
        ior: 1.5,                  // Glass IOR

        // For Standard materials (matte, satin, metallic)
        metalness: 0.2,

        // Environment map
        envMapIntensity: 1.0,
    },

    // --- MATERIAL TYPE PRESETS ---
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
};
