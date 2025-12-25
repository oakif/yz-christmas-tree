export const CONFIG = {
    // --- TREE APPEARANCE ---
    particleCount: 2000,
    treeHeight: 40,
    treeRadius: 18,
    treeYOffset: 3,        // Shift the entire tree up (+) or down (-)

    // --- OBJECT SIZES ---
    starScale: 1.2,        // Size multiplier for stars
    heartScale: 0.8,       // Size multiplier for hearts
    presentScale: 0.8,     // Size multiplier for presents/boxes
    snowflakeScale: 1.0,   // Size multiplier for snowflakes

    // --- COLORS ---
    colorPresents: [0xff3333, 0x33ff33, 0x3333ff],
    colorHearts: 0xff0055,
    colorStar: 0xfffea8,   // Very subtle warm white
    starEmissiveIntensity: 0.5, // How much stars glow (0 = no glow, 1 = full)

    // --- ANIMATION / PHYSICS ---
    animationSpeed: 0.12,      // Unified speed for explosion spread and return (0.01 = slow, 0.2 = fast)
    explosionForce: 120,       // Initial blast speed
    explosionFriction: 0.97,   // Air resistance
    idleFloatSpeed: 0.005,     // Wobble speed when idle
    idleFloatAmount: 0.02,     // How much it wobbles

    // --- PARALLAX ---
    parallaxStrengthX: 1.2,    // Mouse Y -> rotation X
    parallaxStrengthY: 1.5,    // Mouse X -> rotation Y
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
    holdDuration: 15000,        // Milliseconds before reforming

    // --- EXPLOSION DISTRIBUTION ---
    // When exploded, particles distribute in a hollow sphere (spherical shell)
    explosionInnerRadius: 30,   // Inner radius - prevents particles too close to camera
    explosionOuterRadius: 60,   // Outer radius - maximum distance from center
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
    bloomThreshold: 0.2        // Raised threshold so only bright things bloom
};
