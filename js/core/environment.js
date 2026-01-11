import * as THREE from 'three';

export function createEnvironmentMap(renderer, CONFIG) {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();

    const gradientShader = {
        uniforms: {
            topColor: { value: new THREE.Color(CONFIG.environmentMap.topColor) },
            bottomColor: { value: new THREE.Color(CONFIG.environmentMap.bottomColor) },
            offset: { value: 33 },
            exponent: { value: 0.6 },
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
        `,
    };

    const skyGeo = new THREE.SphereGeometry(100, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
        uniforms: gradientShader.uniforms,
        vertexShader: gradientShader.vertexShader,
        fragmentShader: gradientShader.fragmentShader,
        side: THREE.BackSide,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    envScene.add(sky);

    const envMap = pmremGenerator.fromScene(envScene).texture;
    pmremGenerator.dispose();

    return envMap;
}
