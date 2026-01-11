import * as THREE from 'three';

export function createLighting(scene, CONFIG) {
    const lights = {};

    lights.ambient = new THREE.AmbientLight(
        CONFIG.lighting.ambient.color,
        CONFIG.lighting.ambient.intensity,
    );
    scene.add(lights.ambient);

    lights.hemi = new THREE.HemisphereLight(
        CONFIG.lighting.hemisphere.skyColor,
        CONFIG.lighting.hemisphere.groundColor,
        CONFIG.lighting.hemisphere.intensity,
    );
    scene.add(lights.hemi);

    lights.key = new THREE.DirectionalLight(
        CONFIG.lighting.keyLight.color,
        CONFIG.lighting.keyLight.intensity,
    );
    lights.key.position.set(...CONFIG.lighting.keyLight.position);
    scene.add(lights.key);

    lights.fill = new THREE.DirectionalLight(
        CONFIG.lighting.fillLight.color,
        CONFIG.lighting.fillLight.intensity,
    );
    lights.fill.position.set(...CONFIG.lighting.fillLight.position);
    scene.add(lights.fill);

    lights.rim = new THREE.DirectionalLight(
        CONFIG.lighting.rimLight.color,
        CONFIG.lighting.rimLight.intensity,
    );
    lights.rim.position.set(...CONFIG.lighting.rimLight.position);
    scene.add(lights.rim);

    lights.overhead = new THREE.DirectionalLight(
        CONFIG.lighting.overheadLight.color,
        CONFIG.lighting.overheadLight.intensity,
    );
    lights.overhead.position.set(...CONFIG.lighting.overheadLight.position);
    scene.add(lights.overhead);

    lights.topGlow = new THREE.PointLight(
        CONFIG.lighting.topGlow.color,
        CONFIG.lighting.topGlow.intensity,
        CONFIG.lighting.topGlow.range,
    );
    lights.topGlow.position.set(0, CONFIG.treeHeight / 2 + 5, 0);
    scene.add(lights.topGlow);

    return lights;
}
