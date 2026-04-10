// ========== ESCÁNER TORTUGA ==========
let cameraActive = false;
let stream = null;
let capturedImage = null;
let serverUrl = null;
let serverConnected = false;

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const maskTortuga = document.getElementById('maskOverlayTortuga');

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('🐢 Escáner Tortuga inicializando...');
    setupEventListeners();
    loadServerUrl();
});

function setupEventListeners() {
    document.getElementById('startBtn').addEventListener('click', startCamera);
    document.getElementById('stopBtn').addEventListener('click', stopCamera);
    document.getElementById('captureBtn').addEventListener('click', capture);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
    document.getElementById('backBtn').addEventListener('click', () => window.location.href = '/detector.html');

    document.getElementById('connectBtn').addEventListener('click', connectToServer);
    document.getElementById('serverUrl').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') connectToServer();
    });
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

// ========== CAPTURA ==========
async function capture() {
    if (!cameraActive) {
        alert('❌ Primero inicia la cámara');
        return;
    }

    try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.drawImage(video, 0, 0);

        canvas.toBlob(async (blob) => {
            capturedImage = blob;
            console.log('📸 Imagen capturada');

            showCaptureSuccess();

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

// ========== SERVIDOR ==========
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
        formData.append('image', capturedImage, `tortuga_${Date.now()}.png`);

        const response = await fetch(`${serverUrl}/api/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Error en upload');
        }

        const data = await response.json();
        console.log('✅ Imagen enviada al acuario:', data.url);
        updateServerStatus(`✅ ¡Captura enviada! TORTUGA`);

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
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const cameraSection = document.querySelector('.camera-section');
        if (cameraSection.classList.contains('fullscreen')) {
            toggleFullscreen();
        }
    }
});

console.log('🐢 Escáner Tortuga listo');
