// FPS counter and graph module

let fpsCounter = null;
let fpsText = null;
let fpsCanvas = null;
let fpsCtx = null;
let lastTime = performance.now();
let frameCount = 0;
let fps = 0;
const fpsHistory = [];
const maxFpsHistory = 100;

export function initFpsCounter() {
    fpsCounter = document.getElementById('fps-counter');
    fpsText = document.getElementById('fps-text');
    fpsCanvas = document.getElementById('fps-graph');
    fpsCtx = fpsCanvas.getContext('2d');

    // Set canvas size
    fpsCanvas.width = 200;
    fpsCanvas.height = 60;

    return { fpsCounter, fpsText, fpsCanvas, fpsCtx };
}

export function setFpsVisibility(visible) {
    if (!fpsCounter) return;
    if (visible) {
        fpsCounter.classList.add('visible');
    } else {
        fpsCounter.classList.remove('visible');
    }
}

export function updateFps(showFPS) {
    frameCount++;
    const currentTime = performance.now();
    const elapsed = currentTime - lastTime;

    if (elapsed >= 1000) {
        fps = Math.round((frameCount * 1000) / elapsed);
        if (fpsText) {
            fpsText.textContent = `FPS: ${fps}`;
        }

        // Update FPS history
        fpsHistory.push(fps);
        if (fpsHistory.length > maxFpsHistory) {
            fpsHistory.shift();
        }

        // Draw FPS graph
        if (showFPS && fpsCtx && fpsCanvas) {
            drawFpsGraph();
        }

        frameCount = 0;
        lastTime = currentTime;
    }

    return fps;
}

function drawFpsGraph() {
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

export function getFps() {
    return fps;
}
