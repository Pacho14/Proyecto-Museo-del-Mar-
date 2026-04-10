// ========== VARIABLES GLOBALES ==========
let currentMask = 'pez'; // pez, tortuga, auto
let isAutoMode = false;
let cameraActive = false;
let stream = null;
let capturedImage = null;
let serverUrl = null;
let serverConnected = false;

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const detectionCanvas = document.getElementById('detectionCanvas');
const detectionCtx = detectionCanvas.getContext('2d');

const maskPez = document.getElementById('maskOverlayPez');
const maskTortuga = document.getElementById('maskOverlayTortuga');

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎨 Escáner Dinámico inicializando...');
    setupEventListeners();
    loadServerUrl();
});

function setupEventListeners() {
    // Selector de máscara
    document.getElementById('pezBtn').addEventListener('click', () => selectMask('pez'));
    document.getElementById('tortugaBtn').addEventListener('click', () => selectMask('tortuga'));
    document.getElementById('autoBtn').addEventListener('click', () => selectMask('auto'));

    // Controles de cámara
    document.getElementById('startBtn').addEventListener('click', startCamera);
    document.getElementById('stopBtn').addEventListener('click', stopCamera);
    document.getElementById('captureBtn').addEventListener('click', capture);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);

    // Servidor
    document.getElementById('connectBtn').addEventListener('click', connectToServer);
    document.getElementById('serverUrl').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') connectToServer();
    });
}

// ========== SELECTOR DE MÁSCARA ==========
function selectMask(mask) {
    currentMask = mask;
    isAutoMode = (mask === 'auto');

    // Actualizar botones
    document.getElementById('pezBtn').classList.toggle('active', mask === 'pez');
    document.getElementById('tortugaBtn').classList.toggle('active', mask === 'tortuga');
    document.getElementById('autoBtn').classList.toggle('active', mask === 'auto');

    // Mostrar/ocultar máscaras
    if (mask === 'pez') {
        maskPez.classList.remove('hidden');
        maskTortuga.classList.add('hidden');
        updateStatusDisplay('pez');
        console.log('🐟 Modo Pez activado');
    } else if (mask === 'tortuga') {
        maskPez.classList.add('hidden');
        maskTortuga.classList.remove('hidden');
        updateStatusDisplay('tortuga');
        console.log('🐢 Modo Tortuga activado');
    } else if (mask === 'auto') {
        // En auto, mostrar ambas al inicio
        maskPez.classList.remove('hidden');
        maskTortuga.classList.add('hidden');
        console.log('🤖 Modo Automático activado');
    }
}

function updateStatusDisplay(maskType) {
    const status = document.getElementById('detectionStatus');
    status.classList.remove('pez', 'tortuga');

    if (maskType === 'pez') {
        status.textContent = '🐟 Pez';
        status.classList.add('pez');
    } else if (maskType === 'tortuga') {
        status.textContent = '🐢 Tortuga';
        status.classList.add('tortuga');
    }
}

// ========== DETECCIÓN AUTOMÁTICA ==========
function detectMaskType(imageData) {
    const data = imageData.data;
    let edgeCount = 0;
    let variance = 0;

    // Analizar características de la imagen
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Calcular luminancia
        const lum = (r + g + b) / 3;
        variance += Math.abs(lum - 128);
    }

    // Muy simplificado: si hay más características, probablemente sea una tortuga (más compleja)
    // Si hay menos, probablemente sea un pez (más simple)
    const complexity = variance / data.length;

    console.log(`Detección: Complejidad=${complexity.toFixed(2)}`);

    // Umbral: si complejidad > 50, probablemente tortuga
    return complexity > 50 ? 'tortuga' : 'pez';
}

// ========== CÁMARA ==========
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        video.srcObject = stream;
        cameraActive = true;

        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('stopBtn').style.display = 'flex';

        console.log('✅ Cámara iniciada');

        // En modo auto, iniciar detección
        if (isAutoMode) {
            startAutoDetection();
        }

    } catch (error) {
        console.error('❌ Error al acceder a la cámara:', error);
        alert('❌ No se pudo acceder a la cámara');
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    cameraActive = false;

    document.getElementById('startBtn').style.display = 'flex';
    document.getElementById('stopBtn').style.display = 'none';

    console.log('⏹️ Cámara detenida');
}

// ========== DETECCIÓN AUTOMÁTICA EN TIEMPO REAL ==========
let autoDetectionInterval = null;

function startAutoDetection() {
    if (autoDetectionInterval) return;

    autoDetectionInterval = setInterval(() => {
        if (!cameraActive || !isAutoMode) return;

        // Capturar frame actual
        detectionCanvas.width = video.videoWidth;
        detectionCanvas.height = video.videoHeight;
        detectionCtx.drawImage(video, 0, 0);

        // Analizar imagen
        const imageData = detectionCtx.getImageData(0, 0, detectionCanvas.width, detectionCanvas.height);
        const detectedMask = detectMaskType(imageData);

        // Si cambió, actualizar
        if (detectedMask !== currentMask) {
            currentMask = detectedMask;
            selectMask(detectedMask);
        }
    }, 1000); // 1 segundo entre detecciones
}

function stopAutoDetection() {
    if (autoDetectionInterval) {
        clearInterval(autoDetectionInterval);
        autoDetectionInterval = null;
    }
}

// ========== CAPTURA ==========
async function capture() {
    if (!cameraActive) {
        alert('❌ Primero inicia la cámara');
        return;
    }

    try {
        // Preparar canvas
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Dibujar video en canvas
        ctx.drawImage(video, 0, 0);

        // Convertir a blob
        canvas.toBlob(async (blob) => {
            capturedImage = blob;
            console.log('📸 Imagen capturada');

            // Mostrar en UI
            showCaptureSuccess();

            // Si está conectado al servidor, enviar
            if (serverConnected) {
                uploadToServer();
            }
        }, 'image/png');

    } catch (error) {
        console.error('❌ Error al capturar:', error);
        alert('❌ Error al capturar imagen');
    }
}

function showCaptureSuccess() {
    const captureBtn = document.getElementById('captureBtn');
    const originalText = captureBtn.innerHTML;

    captureBtn.innerHTML = '<span class="btn-icon">✅</span><span class="btn-text">¡Capturada!</span>';
    captureBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';

    setTimeout(() => {
        captureBtn.innerHTML = originalText;
        captureBtn.style.background = '';
    }, 2000);
}

// ========== SERVIDOR / ACUARIO ==========
function loadServerUrl() {
    const saved = localStorage.getItem('acuarioServerUrl');
    if (saved) {
        document.getElementById('serverUrl').value = saved;
        serverUrl = saved;
    }
}

async function connectToServer() {
    const url = document.getElementById('serverUrl').value.trim();

    if (!url) {
        alert('❌ Ingresa la dirección del servidor');
        return;
    }

    try {
        // Agregar protocolo si falta
        let fullUrl = url;
        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
            fullUrl = `http://${fullUrl}`;
        }

        const response = await fetch(`${fullUrl}/api/health`);

        if (!response.ok) {
            throw new Error('Servidor no disponible');
        }

        const data = await response.json();

        serverUrl = fullUrl;
        serverConnected = true;
        localStorage.setItem('acuarioServerUrl', url);

        updateServerStatus(`✅ Conectado: ${data.server}`);
        console.log('🔗 Conectado al acuario:', fullUrl);

    } catch (error) {
        console.error('❌ Error de conexión:', error);
        updateServerStatus('❌ Error de conexión');
        serverConnected = false;
    }
}

async function uploadToServer() {
    if (!capturedImage || !serverConnected) {
        alert('❌ No hay imagen o no está conectado al servidor');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('image', capturedImage, `${currentMask}_${Date.now()}.png`);

        const response = await fetch(`${serverUrl}/api/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Error en upload');
        }

        const data = await response.json();
        console.log('✅ Imagen enviada al acuario:', data.url);
        updateServerStatus(`✅ ¡Captura enviada! ${currentMask.toUpperCase()}`);

    } catch (error) {
        console.error('❌ Error al enviar:', error);
        updateServerStatus('❌ Error al enviar');
    }
}

function updateServerStatus(message) {
    document.getElementById('connectionStatus').textContent = message;
}

// ========== PANTALLA COMPLETA ==========
function toggleFullscreen() {
    const cameraSection = document.querySelector('.camera-section');
    cameraSection.classList.toggle('fullscreen');

    const btn = document.getElementById('fullscreenBtn');
    btn.classList.toggle('fullscreen-active');

    if (cameraSection.classList.contains('fullscreen')) {
        console.log('🖥️ Modo pantalla completa');
    } else {
        console.log('📱 Modo normal');
    }
}

// Salir de fullscreen con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const cameraSection = document.querySelector('.camera-section');
        if (cameraSection.classList.contains('fullscreen')) {
            toggleFullscreen();
        }
    }
});

// ========== INICIALIZAR EN CARGA ==========
console.log('🎨 Escáner Dinámico listo');
selectMask('pez'); // Iniciar en modo pez
