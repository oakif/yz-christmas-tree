import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GUI } from 'dat.gui';
import { CONFIG } from './config.js';

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

// Shared configuration for all test objects
const testObjectConfig = {
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
};

function createTestParticle(explosionTarget) {
    const geometry = getGeometryForType(testObjectConfig.shape);

    const materialDef = {
        type: testObjectConfig.shape,
        color: parseInt(testObjectConfig.color.replace('#', ''), 16),
        emissive: parseInt(testObjectConfig.emissive.replace('#', ''), 16),
        emissiveIntensity: testObjectConfig.emissiveIntensity,
        materialType: testObjectConfig.materialType,
        materialOverrides: {
            transmission: testObjectConfig.transmission,
            thickness: testObjectConfig.thickness,
            roughness: testObjectConfig.roughness,
            metalness: testObjectConfig.metalness,
            clearcoat: testObjectConfig.clearcoat,
            clearcoatRoughness: testObjectConfig.clearcoatRoughness,
            ior: testObjectConfig.ior,
            envMapIntensity: testObjectConfig.envMapIntensity,
        }
    };

    materialCache.clear();
    const material = getMaterialFromDefinition(materialDef);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(testObjectConfig.scale);

    // Use the same tree position sampling as the original tree
    const pos = sampleTreePosition();
    mesh.position.copy(pos);

    // Same userData structure as tree particles
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
    return mesh;
}

function setTestObjectCount(count) {
    const currentCount = testParticles.length;

    // Pre-generate explosion targets for all particles
    const explosionCenter = CONFIG.explosionCenterMode === 'camera'
        ? new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z)
        : new THREE.Vector3(0, 0, 0);
    const explosionTargets = generateExplosionTargets(count, explosionCenter);

    if (count > currentCount) {
        // Add new particles
        for (let i = currentCount; i < count; i++) {
            const mesh = createTestParticle(explosionTargets[i]);
            testParticles.push(mesh);
        }
    } else if (count < currentCount) {
        // Remove excess particles
        for (let i = currentCount - 1; i >= count; i--) {
            const mesh = testParticles[i];
            treeGroup.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        }
        testParticles.length = count;
    }

    // Update explosion targets for all particles
    testParticles.forEach((mesh, index) => {
        mesh.userData.explosionTarget = explosionTargets[index];
    });
}

function rebuildAllTestParticles() {
    const count = testParticles.length;

    // Pre-generate explosion targets
    const explosionCenter = CONFIG.explosionCenterMode === 'camera'
        ? new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z)
        : new THREE.Vector3(0, 0, 0);
    const explosionTargets = generateExplosionTargets(count, explosionCenter);

    // Remove all existing particles
    testParticles.forEach(mesh => {
        treeGroup.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    });
    testParticles.length = 0;

    // Recreate all particles with new config
    for (let i = 0; i < count; i++) {
        const mesh = createTestParticle(explosionTargets[i]);
        testParticles.push(mesh);
    }
}

// --- DAT.GUI FOR ALL CONFIG SETTINGS ---
const gui = new GUI();
document.body.appendChild(gui.domElement);
gui.domElement.style.position = 'absolute';
gui.domElement.style.top = '10px';
gui.domElement.style.right = '10px';
gui.domElement.style.zIndex = '10000';

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
    // Tree Geometry
    treeHeight: CONFIG.treeHeight,
    treeRadius: CONFIG.treeRadius,
    treeYOffset: CONFIG.treeYOffset,

    // Camera & View
    cameraX: CONFIG.cameraX,
    cameraY: CONFIG.cameraY,
    cameraZ: CONFIG.cameraZ,
    viewType: CONFIG.viewType,
    explodedViewType: CONFIG.explodedViewType,
    isometricZoom: CONFIG.isometricZoom,
    isometricAngle: CONFIG.isometricAngle,

    // Interaction
    reassembleOnClick: CONFIG.reassembleOnClick,
    resetMouseOnLeave: CONFIG.resetMouseOnLeave,

    // Animation & Physics - Idle
    idleFloatSpeed: CONFIG.idleFloatSpeed,
    idleFloatAmount: CONFIG.idleFloatAmount,

    // Animation & Physics - Explosion
    animationSpeed: CONFIG.animationSpeed,
    holdDuration: CONFIG.holdDuration,

    // Parallax - Idle/Returning
    parallaxStrengthX: CONFIG.parallaxStrengthX,
    parallaxStrengthY: CONFIG.parallaxStrengthY,
    parallaxSmoothing: CONFIG.parallaxSmoothing,
    parallaxPositionStrengthX: CONFIG.parallaxPositionStrengthX,
    parallaxPositionStrengthY: CONFIG.parallaxPositionStrengthY,

    // Parallax - Exploded
    explodedParallaxStrengthX: CONFIG.explodedParallaxStrengthX,
    explodedParallaxStrengthY: CONFIG.explodedParallaxStrengthY,
    explodedParallaxStrength: CONFIG.explodedParallaxStrength,

    // Explosion Distribution
    explosionInnerRadius: CONFIG.explosionInnerRadius,
    explosionOuterRadius: CONFIG.explosionOuterRadius,
    explosionCenterMode: CONFIG.explosionCenterMode,
    explosionOffsetX: CONFIG.explosionOffsetX,
    explosionOffsetY: CONFIG.explosionOffsetY,
    explosionOffsetZ: CONFIG.explosionOffsetZ,

    // Visual Effects - Bloom
    bloomStrength: CONFIG.bloomStrength,
    bloomRadius: CONFIG.bloomRadius,
    bloomThreshold: CONFIG.bloomThreshold,
    toneMappingExposure: CONFIG.toneMappingExposure,

    // Visual Effects - Environment Map
    envTopColor: hexToString(CONFIG.environmentMap.topColor),
    envBottomColor: hexToString(CONFIG.environmentMap.bottomColor),

    // Lighting - Ambient
    ambientColor: hexToString(CONFIG.lighting.ambient.color),
    ambientIntensity: CONFIG.lighting.ambient.intensity,

    // Lighting - Hemisphere
    hemiSkyColor: hexToString(CONFIG.lighting.hemisphere.skyColor),
    hemiGroundColor: hexToString(CONFIG.lighting.hemisphere.groundColor),
    hemiIntensity: CONFIG.lighting.hemisphere.intensity,

    // Lighting - Key Light
    keyLightColor: hexToString(CONFIG.lighting.keyLight.color),
    keyLightIntensity: CONFIG.lighting.keyLight.intensity,

    // Lighting - Fill Light
    fillLightColor: hexToString(CONFIG.lighting.fillLight.color),
    fillLightIntensity: CONFIG.lighting.fillLight.intensity,

    // Lighting - Rim Light
    rimLightColor: hexToString(CONFIG.lighting.rimLight.color),
    rimLightIntensity: CONFIG.lighting.rimLight.intensity,

    // Lighting - Overhead Light
    overheadLightColor: hexToString(CONFIG.lighting.overheadLight.color),
    overheadLightIntensity: CONFIG.lighting.overheadLight.intensity,

    // Lighting - Top Glow
    topGlowColor: hexToString(CONFIG.lighting.topGlow.color),
    topGlowIntensity: CONFIG.lighting.topGlow.intensity,
    topGlowRange: CONFIG.lighting.topGlow.range,

    // Reward Image
    imageDelay: CONFIG.imageDelay,

    // Performance
    performanceMode: CONFIG.performanceMode
};

// === TREE GEOMETRY ===
const treeFolder = gui.addFolder('Tree Geometry');
treeFolder.add(guiControls, 'treeHeight', 10, 100).name('Height');
treeFolder.add(guiControls, 'treeRadius', 5, 30).name('Radius');
treeFolder.add(guiControls, 'treeYOffset', -20, 20).name('Y Offset');

// === CAMERA & VIEW ===
const cameraFolder = gui.addFolder('Camera & View');
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

// === INTERACTION ===
const interactionFolder = gui.addFolder('Interaction');
interactionFolder.add(guiControls, 'reassembleOnClick').name('Reassemble on Click').onChange(val => {
    CONFIG.reassembleOnClick = val;
});
interactionFolder.add(guiControls, 'resetMouseOnLeave').name('Reset Mouse on Leave').onChange(val => {
    CONFIG.resetMouseOnLeave = val;
});

// === ANIMATION - IDLE ===
const idleAnimFolder = gui.addFolder('Animation - Idle');
idleAnimFolder.add(guiControls, 'idleFloatSpeed', 0, 0.01, 0.0001).name('Float Speed').onChange(val => {
    CONFIG.idleFloatSpeed = val;
});
idleAnimFolder.add(guiControls, 'idleFloatAmount', 0, 1, 0.01).name('Float Amount').onChange(val => {
    CONFIG.idleFloatAmount = val;
});

// === ANIMATION - EXPLOSION ===
const explosionAnimFolder = gui.addFolder('Animation - Explosion');
explosionAnimFolder.add(guiControls, 'animationSpeed', 0.01, 0.5, 0.01).name('Speed').onChange(val => {
    CONFIG.animationSpeed = val;
});
explosionAnimFolder.add(guiControls, 'holdDuration', 1000, 60000, 1000).name('Hold Duration (ms)').onChange(val => {
    CONFIG.holdDuration = val;
});

// === PARALLAX - IDLE/RETURNING ===
const parallaxFolder = gui.addFolder('Parallax - Idle');
guiControls.parallaxEnabled = true;
parallaxFolder.add(guiControls, 'parallaxEnabled').name('Enabled');
parallaxFolder.add(guiControls, 'parallaxStrengthX', 0, 10, 0.1).name('Strength X').onChange(val => {
    CONFIG.parallaxStrengthX = val;
});
parallaxFolder.add(guiControls, 'parallaxStrengthY', 0, 10, 0.1).name('Strength Y').onChange(val => {
    CONFIG.parallaxStrengthY = val;
});
parallaxFolder.add(guiControls, 'parallaxSmoothing', 0.01, 0.2, 0.01).name('Smoothing').onChange(val => {
    CONFIG.parallaxSmoothing = val;
});
parallaxFolder.add(guiControls, 'parallaxPositionStrengthX', -5, 5, 0.1).name('Position X').onChange(val => {
    CONFIG.parallaxPositionStrengthX = val;
});
parallaxFolder.add(guiControls, 'parallaxPositionStrengthY', -5, 5, 0.1).name('Position Y').onChange(val => {
    CONFIG.parallaxPositionStrengthY = val;
});

// === PARALLAX - EXPLODED ===
const explodedParallaxFolder = gui.addFolder('Parallax - Exploded');
guiControls.explodedParallaxEnabled = true;
explodedParallaxFolder.add(guiControls, 'explodedParallaxEnabled').name('Enabled');
explodedParallaxFolder.add(guiControls, 'explodedParallaxStrengthX', 0, 10, 0.1).name('Strength X').onChange(val => {
    CONFIG.explodedParallaxStrengthX = val;
});
explodedParallaxFolder.add(guiControls, 'explodedParallaxStrengthY', 0, 10, 0.1).name('Strength Y').onChange(val => {
    CONFIG.explodedParallaxStrengthY = val;
});
explodedParallaxFolder.add(guiControls, 'explodedParallaxStrength', 0, 20, 0.5).name('Individual Strength').onChange(val => {
    CONFIG.explodedParallaxStrength = val;
});

// === EXPLOSION DISTRIBUTION ===
const explosionDistFolder = gui.addFolder('Explosion Distribution');
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

// === VISUAL EFFECTS - BLOOM ===
const bloomFolder = gui.addFolder('Visual Effects - Bloom');
bloomFolder.add(guiControls, 'bloomStrength', 0, 3, 0.01).name('Strength').onChange(val => {
    bloomPass.strength = val;
    CONFIG.bloomStrength = val;
});
bloomFolder.add(guiControls, 'bloomRadius', 0, 2, 0.01).name('Radius').onChange(val => {
    bloomPass.radius = val;
    CONFIG.bloomRadius = val;
});
bloomFolder.add(guiControls, 'bloomThreshold', 0, 1, 0.01).name('Threshold').onChange(val => {
    bloomPass.threshold = val;
    CONFIG.bloomThreshold = val;
});
bloomFolder.add(guiControls, 'toneMappingExposure', 0, 10, 0.1).name('Exposure').onChange(val => {
    renderer.toneMappingExposure = val;
    CONFIG.toneMappingExposure = val;
});

// === VISUAL EFFECTS - ENVIRONMENT ===
const envFolder = gui.addFolder('Visual Effects - Environment');
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

// === LIGHTING (CONSOLIDATED) ===
const lightingFolder = gui.addFolder('Lighting');

const ambientSubfolder = lightingFolder.addFolder('Ambient');
ambientSubfolder.addColor(guiControls, 'ambientColor').name('Color').onChange(val => {
    ambientLight.color.setHex(stringToHex(val));
    CONFIG.lighting.ambient.color = stringToHex(val);
});
ambientSubfolder.add(guiControls, 'ambientIntensity', 0, 5, 0.1).name('Intensity').onChange(val => {
    ambientLight.intensity = val;
    CONFIG.lighting.ambient.intensity = val;
});

const hemiSubfolder = lightingFolder.addFolder('Hemisphere');
hemiSubfolder.addColor(guiControls, 'hemiSkyColor').name('Sky Color').onChange(val => {
    hemiLight.color.setHex(stringToHex(val));
    CONFIG.lighting.hemisphere.skyColor = stringToHex(val);
});
hemiSubfolder.addColor(guiControls, 'hemiGroundColor').name('Ground Color').onChange(val => {
    hemiLight.groundColor.setHex(stringToHex(val));
    CONFIG.lighting.hemisphere.groundColor = stringToHex(val);
});
hemiSubfolder.add(guiControls, 'hemiIntensity', 0, 5, 0.1).name('Intensity').onChange(val => {
    hemiLight.intensity = val;
    CONFIG.lighting.hemisphere.intensity = val;
});

const keyLightSubfolder = lightingFolder.addFolder('Key Light');
keyLightSubfolder.addColor(guiControls, 'keyLightColor').name('Color').onChange(val => {
    keyLight.color.setHex(stringToHex(val));
    CONFIG.lighting.keyLight.color = stringToHex(val);
});
keyLightSubfolder.add(guiControls, 'keyLightIntensity', 0, 5, 0.1).name('Intensity').onChange(val => {
    keyLight.intensity = val;
    CONFIG.lighting.keyLight.intensity = val;
});

const fillLightSubfolder = lightingFolder.addFolder('Fill Light');
fillLightSubfolder.addColor(guiControls, 'fillLightColor').name('Color').onChange(val => {
    fillLight.color.setHex(stringToHex(val));
    CONFIG.lighting.fillLight.color = stringToHex(val);
});
fillLightSubfolder.add(guiControls, 'fillLightIntensity', 0, 5, 0.1).name('Intensity').onChange(val => {
    fillLight.intensity = val;
    CONFIG.lighting.fillLight.intensity = val;
});

const rimLightSubfolder = lightingFolder.addFolder('Rim Light');
rimLightSubfolder.addColor(guiControls, 'rimLightColor').name('Color').onChange(val => {
    rimLight.color.setHex(stringToHex(val));
    CONFIG.lighting.rimLight.color = stringToHex(val);
});
rimLightSubfolder.add(guiControls, 'rimLightIntensity', 0, 5, 0.1).name('Intensity').onChange(val => {
    rimLight.intensity = val;
    CONFIG.lighting.rimLight.intensity = val;
});

const overheadSubfolder = lightingFolder.addFolder('Overhead Light');
overheadSubfolder.addColor(guiControls, 'overheadLightColor').name('Color').onChange(val => {
    overheadLight.color.setHex(stringToHex(val));
    CONFIG.lighting.overheadLight.color = stringToHex(val);
});
overheadSubfolder.add(guiControls, 'overheadLightIntensity', 0, 5, 0.1).name('Intensity').onChange(val => {
    overheadLight.intensity = val;
    CONFIG.lighting.overheadLight.intensity = val;
});

const topGlowSubfolder = lightingFolder.addFolder('Top Glow');
topGlowSubfolder.addColor(guiControls, 'topGlowColor').name('Color').onChange(val => {
    topGlow.color.setHex(stringToHex(val));
    CONFIG.lighting.topGlow.color = stringToHex(val);
});
topGlowSubfolder.add(guiControls, 'topGlowIntensity', 0, 10, 0.1).name('Intensity').onChange(val => {
    topGlow.intensity = val;
    CONFIG.lighting.topGlow.intensity = val;
});
topGlowSubfolder.add(guiControls, 'topGlowRange', 0, 100, 1).name('Range').onChange(val => {
    topGlow.distance = val;
    CONFIG.lighting.topGlow.range = val;
});

// === REWARD IMAGE ===
const rewardFolder = gui.addFolder('Reward Image');
rewardFolder.add(guiControls, 'imageDelay', 0, 5000, 100).name('Delay (ms)').onChange(val => {
    CONFIG.imageDelay = val;
});

// === PERFORMANCE ===
const perfFolder = gui.addFolder('Performance');
perfFolder.add(guiControls, 'performanceMode').name('Performance Mode').onChange(val => {
    CONFIG.performanceMode = val;
});

// === VISIBILITY CONTROLS ===
const visibilityFolder = gui.addFolder('Visibility Controls');

guiControls.showTreeParticles = true;
visibilityFolder.add(guiControls, 'showTreeParticles')
    .name('Show Tree Particles')
    .onChange(val => {
        // Only show tree particles if enabled AND no test objects are active
        particles.forEach(p => {
            p.visible = val && guiControls.testObjectCount === 0;
        });
    });

guiControls.showFPS = false;
const fpsCounter = document.getElementById('fps-counter');
const fpsText = document.getElementById('fps-text');
const fpsCanvas = document.getElementById('fps-graph');
const fpsCtx = fpsCanvas.getContext('2d');

// Set canvas size
fpsCanvas.width = 200;
fpsCanvas.height = 60;

visibilityFolder.add(guiControls, 'showFPS')
    .name('Show FPS')
    .onChange(val => {
        if (val) {
            fpsCounter.classList.add('visible');
        } else {
            fpsCounter.classList.remove('visible');
        }
    });

visibilityFolder.open();

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

// Object count slider (0-5000, replaces tree when > 0)
guiControls.testObjectCount = 0;
testObjectsFolder.add(guiControls, 'testObjectCount', 0, 5000, 1)
    .name('Object Count')
    .onChange(val => {
        const count = Math.floor(val);
        setTestObjectCount(count);
        // Hide original tree particles when test objects are active
        particles.forEach(p => {
            p.visible = count === 0 && guiControls.showTreeParticles;
        });
    });

// Shape and material
testObjectsFolder.add(testObjectConfig, 'shape', ['star', 'heart', 'snowflake', 'present', 'sphere'])
    .name('Shape')
    .onChange(debouncedRebuildAll);
testObjectsFolder.add(testObjectConfig, 'materialType', ['matte', 'satin', 'metallic', 'glass', 'frostedGlass'])
    .name('Material Type')
    .onChange(debouncedRebuildAll);
testObjectsFolder.add(testObjectConfig, 'scale', 0.1, 10, 0.1)
    .name('Scale')
    .onChange(debouncedRebuildAll);

// Colors
testObjectsFolder.addColor(testObjectConfig, 'color')
    .name('Base Color')
    .onChange(debouncedRebuildAll);
testObjectsFolder.addColor(testObjectConfig, 'emissive')
    .name('Emissive Color')
    .onChange(debouncedRebuildAll);
testObjectsFolder.add(testObjectConfig, 'emissiveIntensity', 0, 2, 0.01)
    .name('Emissive Intensity')
    .onChange(debouncedRebuildAll);

// Physical properties
const testPhysicalFolder = testObjectsFolder.addFolder('Physical Properties');
testPhysicalFolder.add(testObjectConfig, 'transmission', 0, 1, 0.01)
    .name('Transmission')
    .onChange(debouncedRebuildAll);
testPhysicalFolder.add(testObjectConfig, 'thickness', 0, 50, 0.5)
    .name('Thickness')
    .onChange(debouncedRebuildAll);
testPhysicalFolder.add(testObjectConfig, 'roughness', 0, 1, 0.01)
    .name('Roughness')
    .onChange(debouncedRebuildAll);
testPhysicalFolder.add(testObjectConfig, 'metalness', 0, 1, 0.01)
    .name('Metalness')
    .onChange(debouncedRebuildAll);
testPhysicalFolder.add(testObjectConfig, 'clearcoat', 0, 1, 0.01)
    .name('Clearcoat')
    .onChange(debouncedRebuildAll);
testPhysicalFolder.add(testObjectConfig, 'clearcoatRoughness', 0, 1, 0.01)
    .name('Clearcoat Roughness')
    .onChange(debouncedRebuildAll);
testPhysicalFolder.add(testObjectConfig, 'ior', 1.0, 2.5, 0.01)
    .name('IOR')
    .onChange(debouncedRebuildAll);
testPhysicalFolder.add(testObjectConfig, 'envMapIntensity', 0, 5, 0.1)
    .name('Env Map Intensity')
    .onChange(debouncedRebuildAll);
testPhysicalFolder.open();

testObjectsFolder.open();

// --- MOUSE PARALLAX ---
const mouse = new THREE.Vector2(0, 0);
const targetRotation = new THREE.Vector2(0, 0);
const targetPosition = new THREE.Vector2(0, 0);

function updateMousePosition(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
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
    requestAnimationFrame(animate);

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
    const parallaxActive = isExploding ? guiControls.explodedParallaxEnabled : guiControls.parallaxEnabled;

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
            if (guiControls.explodedParallaxEnabled) {
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
            if (guiControls.explodedParallaxEnabled) {
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

    composer.render();
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

        // Hide image immediately
        if (CONFIG.rewardImage) {
            imgElement.classList.remove('visible');
        }

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
