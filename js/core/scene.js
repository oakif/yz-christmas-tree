import * as THREE from 'three';

export function createScene() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.015);
    return scene;
}

export function createPerspectiveCamera(CONFIG) {
    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000,
    );
    camera.position.x = CONFIG.cameraX;
    camera.position.y = CONFIG.cameraY;
    camera.position.z = CONFIG.cameraZ;
    camera.lookAt(0, 0, 0);
    return camera;
}

export function createOrthographicCamera(CONFIG) {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = CONFIG.isometricZoom;
    const camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        frustumSize / -2,
        0.1,
        1000,
    );

    const angleRad = CONFIG.isometricAngle * Math.PI / 180;
    const perspectiveDistance = Math.sqrt(
        CONFIG.cameraX ** 2 + CONFIG.cameraY ** 2 + CONFIG.cameraZ ** 2,
    );
    camera.position.set(
        CONFIG.cameraX,
        perspectiveDistance * Math.sin(angleRad),
        perspectiveDistance * Math.cos(angleRad),
    );
    camera.lookAt(0, 0, 0);
    return camera;
}

export function createRenderer(container, CONFIG) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = CONFIG.toneMappingExposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);
    return renderer;
}

export function updateCameraOnStateChange(newState, CONFIG, state) {
    const targetViewType = (newState === 'EXPLODING')
        ? CONFIG.explodedViewType
        : CONFIG.viewType;

    const newCamera = targetViewType === 'isometric'
        ? state.orthographicCamera
        : state.perspectiveCamera;

    if (state.camera !== newCamera) {
        state.camera = newCamera;
        if (state.renderPass) {
            state.renderPass.camera = state.camera;
        }
    }
}

export function updateOrthographicCameraZoom(camera, CONFIG) {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = CONFIG.isometricZoom;
    camera.left = frustumSize * aspect / -2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    camera.updateProjectionMatrix();
}

export function updateOrthographicCameraAngle(camera, CONFIG) {
    const angleRad = CONFIG.isometricAngle * Math.PI / 180;
    const perspectiveDistance = Math.sqrt(
        CONFIG.cameraX ** 2 + CONFIG.cameraY ** 2 + CONFIG.cameraZ ** 2,
    );
    camera.position.set(
        CONFIG.cameraX,
        perspectiveDistance * Math.sin(angleRad),
        perspectiveDistance * Math.cos(angleRad),
    );
    camera.lookAt(0, 0, 0);
}
