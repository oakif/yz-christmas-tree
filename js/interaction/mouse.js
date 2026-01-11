// Mouse and device orientation parallax tracking
import * as THREE from 'three';

const mouse = new THREE.Vector2(0, 0);
const prevMouse = new THREE.Vector2(0, 0);
const mouseVelocity = new THREE.Vector2(0, 0);
const targetRotation = new THREE.Vector2(0, 0);
const targetPosition = new THREE.Vector2(0, 0);
let lastMouseMoveTime = 0;
let CONFIG = null;

// Device orientation state
const deviceOrientation = new THREE.Vector2(0, 0);
let baselineOrientation = null;
let useDeviceOrientation = false;
let deviceOrientationEnabled = false; // User preference - disabled by default
let deviceOrientationPermissionGranted = false;

// Touch drag state - velocity-based rotation for mobile
let lastTouchPos = null;
// Accumulated rotation from touch (adds to parallax target)
const touchRotationOffset = new THREE.Vector2(0, 0);
// Velocity for momentum after touch ends
const touchVelocity = new THREE.Vector2(0, 0);
let isTouching = false;
let lastTouchMoveFrame = 0; // Track when last touchmove occurred
// For smooth velocity blending on touch start
let storedMomentum = null;
let touchMoveCount = 0;

export function initMouseTracking(configRef) {
    CONFIG = configRef;

    // Track mouse using multiple event types for reliability
    // Using document-level listeners to work even without focus
    document.addEventListener('mousemove', updateMousePosition, { passive: true });
    document.addEventListener('pointermove', updateMousePosition, { passive: true });

    // Touch drag for mobile parallax - track relative movement
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

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
        // Only update position for mouse, not touch (touch is handled separately)
        if (event.pointerType !== 'touch') {
            updateMousePosition(event);
        }
        // Release any implicit pointer capture that Edge might set
        if (event.target.releasePointerCapture) {
            try {
                event.target.releasePointerCapture(event.pointerId);
            } catch (e) {
                // Ignore - pointer might not be captured
            }
        }
    }, { passive: true });

    // Device orientation for mobile parallax
    window.addEventListener('deviceorientation', handleDeviceOrientation, true);
}

function updateMousePosition(event) {
    prevMouse.copy(mouse);
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    mouseVelocity.x = mouse.x - prevMouse.x;
    mouseVelocity.y = mouse.y - prevMouse.y;
    lastMouseMoveTime = performance.now();
}

function handleTouchStart(event) {
    if (event.touches.length === 0) return;
    const touch = event.touches[0];
    lastTouchPos = { x: touch.clientX, y: touch.clientY };
    isTouching = true;
    // Store current momentum for smooth blending
    storedMomentum = { x: touchVelocity.x, y: touchVelocity.y };
    touchMoveCount = 0;
    console.log('[touchstart] grabbing tree, stored momentum', { velocity: { x: touchVelocity.x.toFixed(4), y: touchVelocity.y.toFixed(4) } });
}

function handleTouchMove(event) {
    if (event.touches.length === 0 || !lastTouchPos) return;
    const touch = event.touches[0];

    // Calculate delta from last position (not from start)
    const deltaX = ((touch.clientX - lastTouchPos.x) / window.innerWidth) * 2;
    // Positive deltaY when dragging down - tree follows finger direction
    const deltaY = ((touch.clientY - lastTouchPos.y) / window.innerHeight) * 2;

    // Axis separation: filter non-dominant axis to prevent cross-contamination
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const threshold = CONFIG.touchAxisSeparationThreshold || 2.0;

    let filteredX = deltaX;
    let filteredY = deltaY;

    if (absX > absY * threshold) {
        // Primarily horizontal drag - suppress vertical
        filteredY = 0;
    } else if (absY > absX * threshold) {
        // Primarily vertical drag - suppress horizontal
        filteredX = 0;
    } else {
        // Mixed movement - dampen vertical in ambiguous cases
        filteredY = deltaY * 0.5;
    }

    // Smooth velocity blending: blend stored momentum with new drag on first few frames
    touchMoveCount++;
    const blendFrames = 5;

    if (touchMoveCount <= blendFrames && storedMomentum) {
        const blend = touchMoveCount / blendFrames;
        touchVelocity.x = storedMomentum.x * (1 - blend) + filteredX * blend;
        touchVelocity.y = storedMomentum.y * (1 - blend) + filteredY * blend;
    } else {
        touchVelocity.x = filteredX;
        touchVelocity.y = filteredY;
    }
    lastTouchMoveFrame = performance.now();

    console.log('[touchmove] velocity:', { x: touchVelocity.x.toFixed(4), y: touchVelocity.y.toFixed(4) });

    lastTouchPos = { x: touch.clientX, y: touch.clientY };
    lastMouseMoveTime = performance.now();
}

function handleTouchEnd() {
    lastTouchPos = null;
    isTouching = false;
    // Velocity is preserved for momentum decay
    console.log('[touchend] releasing, velocity:', { x: touchVelocity.x.toFixed(4), y: touchVelocity.y.toFixed(4) });
}

// Request device orientation permission (required on iOS 13+)
export async function requestDeviceOrientationPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            deviceOrientationPermissionGranted = permission === 'granted';
            return deviceOrientationPermissionGranted;
        } catch (e) {
            return false;
        }
    }
    // No permission needed on Android/desktop
    deviceOrientationPermissionGranted = true;
    return true;
}

// Enable/disable device orientation parallax
export function setDeviceOrientationEnabled(enabled) {
    deviceOrientationEnabled = enabled;
    if (!enabled) {
        useDeviceOrientation = false;
        baselineOrientation = null;
    }
}

export function isDeviceOrientationEnabled() {
    return deviceOrientationEnabled;
}

// Handle device orientation for mobile parallax
function handleDeviceOrientation(event) {
    // Only process if user has enabled this feature
    if (!deviceOrientationEnabled) return;
    if (event.gamma === null || event.beta === null) return;

    // gamma: left/right tilt (-90 to 90)
    // beta: front/back tilt (-180 to 180)

    // Initialize baseline on first reading
    if (baselineOrientation === null) {
        baselineOrientation = { beta: event.beta, gamma: event.gamma };
    }

    // Continuous recalibration: slowly drift baseline toward current position
    const recalibrationSpeed = 0.005;
    baselineOrientation.gamma += (event.gamma - baselineOrientation.gamma) * recalibrationSpeed;
    baselineOrientation.beta += (event.beta - baselineOrientation.beta) * recalibrationSpeed;

    // Calculate delta from drifting baseline
    const gammaDelta = event.gamma - baselineOrientation.gamma;
    const betaDelta = event.beta - baselineOrientation.beta;

    // Map deltas to -1 to 1 range, clamped at ~25 degrees of tilt
    const tiltRange = 25;
    deviceOrientation.x = Math.max(-1, Math.min(1, gammaDelta / tiltRange));
    deviceOrientation.y = -Math.max(-1, Math.min(1, betaDelta / tiltRange));
    useDeviceOrientation = true;
}

function resetMousePosition() {
    if (CONFIG && CONFIG.resetMouseOnLeave) {
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

export function getMouse() {
    // Return device orientation on mobile when active, otherwise mouse
    if (useDeviceOrientation) {
        return deviceOrientation;
    }
    return mouse;
}

export function getMouseVelocity() {
    return mouseVelocity;
}

export function getLastMouseMoveTime() {
    return lastMouseMoveTime;
}

export function getTargetRotation() {
    return targetRotation;
}

export function getTargetPosition() {
    return targetPosition;
}

// Calculate parallax targets based on animation state
export function updateParallaxTargets(animationState) {
    const isExploding = animationState === "EXPLODING";
    const parallaxActive = isExploding ? CONFIG.explodedParallaxEnabled : CONFIG.parallaxEnabled;

    // Apply velocity to offset
    touchRotationOffset.x += touchVelocity.x;
    touchRotationOffset.y += touchVelocity.y;

    // Apply friction when:
    // 1. Not touching at all, OR
    // 2. Touching but finger hasn't moved recently (holding still)
    const timeSinceLastMove = performance.now() - lastTouchMoveFrame;
    const fingerIsStill = isTouching && timeSinceLastMove > 50; // 50ms = ~3 frames

    if (!isTouching || fingerIsStill) {
        const friction = CONFIG.touchSpinFriction || 0.95;
        touchVelocity.x *= friction;
        touchVelocity.y *= friction;

        // Stop velocity when very small
        if (Math.abs(touchVelocity.x) < 0.0001) touchVelocity.x = 0;
        if (Math.abs(touchVelocity.y) < 0.0001) touchVelocity.y = 0;
    }

    // Spring back Y (up/down tilt) to center when not touching
    if (!isTouching) {
        const returnSpeed = CONFIG.touchTiltReturnSpeed || 0.02;
        touchRotationOffset.y *= (1 - returnSpeed);

        // Snap to zero when very close to prevent drift
        if (Math.abs(touchRotationOffset.y) < 0.001) {
            touchRotationOffset.y = 0;
            touchVelocity.y = 0;
        }
    }

    // Log velocity (only when there's meaningful velocity)
    if (Math.abs(touchVelocity.x) > 0.0001 || Math.abs(touchVelocity.y) > 0.0001) {
        console.log('[update]', isTouching ? 'touching' : 'momentum', 'velocity:', { x: touchVelocity.x.toFixed(4), y: touchVelocity.y.toFixed(4) }, 'offset:', { x: touchRotationOffset.x.toFixed(4), y: touchRotationOffset.y.toFixed(4) });
    }

    if (parallaxActive) {
        const parallaxX = isExploding ? CONFIG.explodedParallaxStrengthX : CONFIG.parallaxStrengthX;
        const parallaxY = isExploding ? CONFIG.explodedParallaxStrengthY : CONFIG.parallaxStrengthY;
        const input = getMouse(); // Use device orientation or mouse

        // Combine mouse/device input with touch rotation offset
        targetRotation.x = input.y * parallaxX + touchRotationOffset.y * parallaxX;
        targetRotation.y = input.x * parallaxY + touchRotationOffset.x * parallaxY;
        targetPosition.x = input.x * CONFIG.parallaxPositionStrengthX;
        targetPosition.y = input.y * CONFIG.parallaxPositionStrengthY;
    } else {
        targetRotation.x = 0;
        targetRotation.y = 0;
        targetPosition.x = 0;
        targetPosition.y = 0;
    }

    return { targetRotation, targetPosition };
}

// Apply parallax to tree group
export function applyParallaxToGroup(treeGroup) {
    treeGroup.rotation.x += (targetRotation.x - treeGroup.rotation.x) * CONFIG.parallaxSmoothing;
    treeGroup.rotation.y += (targetRotation.y - treeGroup.rotation.y) * CONFIG.parallaxSmoothing;
    treeGroup.position.x += (targetPosition.x - treeGroup.position.x) * CONFIG.parallaxSmoothing;
    treeGroup.position.y += (targetPosition.y + CONFIG.treeYOffset - treeGroup.position.y) * CONFIG.parallaxSmoothing;
}
