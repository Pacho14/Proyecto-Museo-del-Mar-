// ========== DEBUG PANEL ==========
function addDebugLog(message, type = 'log') {
    const debugOutput = document.getElementById('debugOutput');
    if (!debugOutput) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.style.color = type === 'error' ? '#ff6b6b' : type === 'warn' ? '#ffd93d' : '#00ff00';
    logEntry.style.marginBottom = '3px';
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    debugOutput.appendChild(logEntry);
    debugOutput.scrollTop = debugOutput.scrollHeight;
    
    // Limitar a 50 líneas
    while (debugOutput.children.length > 50) {
        debugOutput.removeChild(debugOutput.firstChild);
    }
}

// Interceptar console para debug
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function(...args) {
    originalLog.apply(console, args);
    addDebugLog(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'log');
};

console.error = function(...args) {
    originalError.apply(console, args);
    addDebugLog('ERROR: ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'error');
};

console.warn = function(...args) {
    originalWarn.apply(console, args);
    addDebugLog('WARN: ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'warn');
};

// Capturar errores globales
window.addEventListener('error', (event) => {
    console.error('Global Error:', event.error);
});

// ========== PREVENIR ZOOM EN iPad ==========
// Prevent pinch zoom
document.addEventListener('touchmove', function(e) {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

// Prevent double-tap zoom
let lastTouchEnd = 0;
document.addEventListener('touchend', function(e) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, { passive: false });

// Prevent zoom with keyboard
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '0')) {
        e.preventDefault();
    }
}, { passive: false });

// Variables globales
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const detectionCanvas = document.getElementById('detectionCanvas');
const ctx = canvas.getContext('2d');
const detCtx = detectionCanvas.getContext('2d');
const captureBtn = document.getElementById('captureBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const gallery = document.getElementById('gallery');
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notificationText');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
let stream = null;
let capturedImages = [];
let isStreaming = false;
let referenceImageData = null;
let captureTimeout = null;
let maskPath = null;
let currentMaskConfidence = 0; // Confianza actual de detección (0-1)
let lastCapturedImage = null; // Último pez capturado (para modal)
let modalTimeout = null; // Timeout del modal

// API Server - Auto detectar configuración
// SIEMPRE usar mismo host/puerto pero con /api
let apiUrl = `${window.location.protocol}//${window.location.hostname}`;

// Si tienen puerto específico, incluirlo
if (window.location.port) {
    apiUrl += `:${window.location.port}`;
}

console.log(`📍 API URL detectada: ${apiUrl}`);

let serverConnected = false;

// Dimensiones del frame
const FRAME_WIDTH_PERCENT = 0.9;
const FRAME_HEIGHT_PERCENT = 0.7;

// Parámetros de detección
const MOTION_THRESHOLD = 2000;
const MOTION_SENSITIVITY = 0.3;
const AUTO_CAPTURE_DELAY = 800;

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎬 DOMContentLoaded: Inicializando Scanner de Pez...');
    
    startBtn.addEventListener('click', startCamera);
    stopBtn.addEventListener('click', stopCamera);
    const captureBtn = document.getElementById('captureManualBtn');
    if (captureBtn) {
        captureBtn.addEventListener('click', () => {
            clearTimeout(captureTimeout);
            captureImage('manual');
        });
    }
    downloadAllBtn.addEventListener('click', downloadAll);
    clearAllBtn.addEventListener('click', clearAll);

    // Nuevos listener para servidor
    document.getElementById('connectBtn').addEventListener('click', manualConnect);
    document.getElementById('sendAllBtn').addEventListener('click', sendAllPecesToAquarium);
    document.getElementById('serverUrl').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') manualConnect();
    });

    // Listener para pantalla completa
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);

    // Cerrar modal si se hace clic fuera
    const captureModal = document.getElementById('captureModal');
    captureModal.addEventListener('click', (e) => {
        if (e.target === captureModal) {
            hideCaptureModal();
        }
    });

    // Tecla Escape para salir de fullscreen
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const cameraSection = document.querySelector('.camera-section');
            if (cameraSection.classList.contains('fullscreen')) {
                toggleFullscreen();
            }
        }
    });

    initializeMaskPath();
    
    // Conectar automáticamente al servidor
    connectToServer();
    
    // Solicitar permisos y luego iniciar cámara
    console.log('📷 Solicitando permisos de cámara...');
    requestCameraPermission().then(() => {
        console.log('✅ Permisos otorgados, iniciando cámara...');
        setTimeout(() => {
            startCamera();
        }, 500);
    }).catch(err => {
        console.error('❌ Error con permisos:', err);
    });
});

// Inicializar el path de la máscara desde el SVG
function initializeMaskPath() {
    const maskSvg = document.getElementById('maskOverlay');
    const pathElement = maskSvg.querySelector('.mask-path');
    
    if (pathElement) {
        const d = pathElement.getAttribute('d');
        try {
            maskPath = new Path2D(d);
        } catch (error) {
            console.error('Error al crear Path2D:', error);
            maskPath = null;
        }
    }
}

// ========== CONEXIÓN CON SERVIDOR ==========
async function connectToServer() {
    try {
        console.log(`🔍 Intentando conectar a: ${apiUrl}`);
        const response = await fetch(`${apiUrl}/api/health`, { timeout: 5000 });
        if (response.ok) {
            serverConnected = true;
            updateServerUI();
            showNotification('✓ Conectado al Acuario 🐟', 'success');
            console.log('🐟 ✓ Servidor del acuario conectado');
        }
    } catch (error) {
        serverConnected = false;
        updateServerUI();
        console.log('⚠️ Acuario no disponible. Reintentando en 3s...');
        // Reintentar en 3 segundos
        setTimeout(connectToServer, 3000);
    }
}

async function manualConnect() {
    const urlInput = document.getElementById('serverUrl').value.trim();
    
    if (!urlInput) {
        showNotification('Ingresa un IP:Puerto válido', 'danger');
        return;
    }

    // Agregar protocolo si no tiene
    const url = urlInput.startsWith('http') ? urlInput : `http://${urlInput}`;
    apiUrl = url;

    try {
        const response = await fetch(`${apiUrl}/api/health`);
        if (response.ok) {
            serverConnected = true;
            updateServerUI();
            showNotification(`✓ Conectado a ${urlInput}`, 'success');
            console.log('🐟 Servidor conectado:', apiUrl);
        } else {
            throw new Error('Servidor no respondió correctamente');
        }
    } catch (error) {
        serverConnected = false;
        updateServerUI();
        showNotification(`❌ Error: ${error.message}`, 'danger');
        console.error('Error conectando:', error);
    }
}

function updateServerUI() {
    const statusEl = document.getElementById('connectionStatus');
    const sendBtn = document.getElementById('sendAllBtn');
    
    if (serverConnected) {
        statusEl.textContent = '🟢 CONECTADO al Acuario';
        statusEl.style.color = '#10b981';
        statusEl.style.fontWeight = 'bold';
        statusEl.parentElement.style.borderLeftColor = '#10b981';
        statusEl.parentElement.style.backgroundColor = '#f0fdf4';
        sendBtn.style.display = 'flex';
    } else {
        statusEl.textContent = '🔴 DESCONECTADO - Modo Offline';
        statusEl.style.color = '#ef4444';
        statusEl.style.fontWeight = 'bold';
        statusEl.parentElement.style.borderLeftColor = '#ef4444';
        statusEl.parentElement.style.backgroundColor = '#fef2f2';
        sendBtn.style.display = 'none';
    }
}

// Enviar pez capturado al servidor
async function sendPezToAquarium(blob, timestamp) {
    if (!serverConnected) {
        console.log('No conectado. Guardando localmente.');
        return false;
    }

    try {
        const formData = new FormData();
        formData.append('image', blob, `pez_${Date.now()}.png`);
        formData.append('width', canvas.width * FRAME_WIDTH_PERCENT);
        formData.append('height', canvas.height * FRAME_HEIGHT_PERCENT);

        console.log('📤 Enviando pez al API...');
        const response = await fetch(`${apiUrl}/api/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Error enviando');

        const data = await response.json();
        showNotification('🐟 Pez enviado al Acuario', 'success');
        console.log('✓ Pez enviado:', data.turtle.id);
        console.log('✅ El Acuario lo detectará automáticamente en < 1 segundo');
        
        return true;

    } catch (error) {
        console.error('Error enviando pez:', error);
        showNotification('⚠️ No se pudo enviar al acuario', 'warning');
        return false;
    }
}

// Enviar todos los peces capturados
async function sendAllPecesToAquarium() {
    if (!serverConnected) {
        showNotification('❌ No conectado al acuario', 'danger');
        return;
    }

    if (capturedImages.length === 0) {
        showNotification('❌ No hay peces para enviar', 'danger');
        return;
    }

    let sent = 0;
    for (let pez of capturedImages) {
        const response = await fetch(pez.url);
        const blob = await response.blob();
        const success = await sendPezToAquarium(blob, pez.timestamp);
        if (success) sent++;
    }

    showNotification(`✓ ${sent}/${capturedImages.length} peces enviados`, 'success');
}

// Solicitar permisos de cámara (compatible con múltiples navegadores)
async function requestCameraPermission() {
    try {
        console.log('🔐 Solicitando permiso de cámara...');
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 960 }
            },
            audio: false
        };

        // Intentar con mediaDevices primero (Chrome, Firefox, Edge)
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const tempStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('✅ Permiso de cámara otorgado (mediaDevices)');
            tempStream.getTracks().forEach(track => track.stop());
            showNotification('✓ Permisos de cámara otorgados', 'success');
            return true;
        }

        // Fallback para navegadores antiguos
        navigator.getUserMedia = navigator.getUserMedia || 
                                 navigator.webkitGetUserMedia || 
                                 navigator.mozGetUserMedia || 
                                 navigator.msGetUserMedia;

        if (navigator.getUserMedia) {
            return new Promise((resolve, reject) => {
                navigator.getUserMedia(constraints, (stream) => {
                    console.log('✅ Permiso de cámara otorgado (fallback)');
                    stream.getTracks().forEach(track => track.stop());
                    showNotification('✓ Permisos de cámara otorgados', 'success');
                    resolve(true);
                }, (error) => {
                    reject(error);
                });
            });
        }

        throw new Error('Tu navegador no soporta acceso a la cámara. Intenta con Chrome, Firefox o Edge.');
    } catch (error) {
        console.error('❌ Error al solicitar permisos:', error);
        console.error('Detalles:', {
            name: error.name,
            message: error.message,
            url: window.location.href,
            userAgent: navigator.userAgent
        });
        showNotification('❌ Error: ' + error.message, 'danger');
        throw error;
    }
}

// Iniciar cámara (compatible con múltiples navegadores)
async function startCamera() {
    try {
        console.log('🎥 Iniciando cámara...');
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 960 }
            },
            audio: false
        };

        // Intentar con mediaDevices primero
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('✅ Stream obtenido (mediaDevices)');
        } else {
            // Fallback para navegadores antiguos
            navigator.getUserMedia = navigator.getUserMedia || 
                                     navigator.webkitGetUserMedia || 
                                     navigator.mozGetUserMedia || 
                                     navigator.msGetUserMedia;

            if (!navigator.getUserMedia) {
                throw new Error('Tu navegador no soporta acceso a la cámara');
            }

            stream = await new Promise((resolve, reject) => {
                navigator.getUserMedia(constraints, resolve, reject);
            });
            console.log('✅ Stream obtenido (fallback)');
        }

        video.srcObject = stream;
        console.log('✅ Stream asignado al video element');

        video.onloadedmetadata = () => {
            console.log('✅ Video metadata cargado:', {
                width: video.videoWidth,
                height: video.videoHeight
            });
            
            video.play().then(() => {
                console.log('▶️ Video playing');
            }).catch(err => {
                console.error('❌ Error al reproducir video:', err);
            });
            
            isStreaming = true;
            updateUI();
            showNotification('▶️ Cámara iniciada - Listo para capturar');

            // Configurar canvas de detección
            detectionCanvas.width = video.videoWidth;
            detectionCanvas.height = video.videoHeight;
            console.log('Canvas configurado:', detectionCanvas.width, 'x', detectionCanvas.height);
        };

        video.onerror = (e) => {
            console.error('❌ Error en video:', e);
            showNotification('❌ Error en el video', 'danger');
        };

    } catch (error) {
        console.error('❌ Error al acceder a la cámara:', error);
        console.error('Detalles:', {
            name: error.name,
            message: error.message,
            userAgent: navigator.userAgent
        });
        showNotification('❌ Error de cámara: ' + error.message + '. Intenta con Chrome, Firefox o Edge.', 'danger');
        isStreaming = false;
        updateUI();
    }
}

// Obtener información de la región del frame
function getFrameRegion() {
    const frameWidth = detectionCanvas.width * FRAME_WIDTH_PERCENT;
    const frameHeight = detectionCanvas.height * FRAME_HEIGHT_PERCENT;
    const frameX = (detectionCanvas.width - frameWidth) / 2;
    const frameY = (detectionCanvas.height - frameHeight) / 2;

    return {
        startX: Math.floor(frameX),
        startY: Math.floor(frameY),
        endX: Math.floor(frameX + frameWidth),
        endY: Math.floor(frameY + frameHeight),
        width: Math.floor(frameWidth)
    };
}

// Detener cámara
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        stream = null;
        isStreaming = false;
        referenceImageData = null;
        clearTimeout(captureTimeout);
        updateUI();
        showNotification('⏹️ Cámara detenida');
    }
}

// Pantalla completa
function toggleFullscreen() {
    const cameraSection = document.querySelector('.camera-section');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const controls = document.querySelector('.controls');
    const container = document.querySelector('.container');
    const header = document.querySelector('header');
    const serverControls = document.querySelector('.server-controls');
    const gallerySection = document.querySelector('.gallery-section');
    
    cameraSection.classList.toggle('fullscreen');
    
    if (cameraSection.classList.contains('fullscreen')) {
        fullscreenBtn.innerHTML = '<span class="btn-icon">✖️</span><span class="btn-text">Salir Completa</span>';
        document.body.style.overflow = 'hidden';
        
        // Ocultar elementos innecesarios
        if (header) header.style.display = 'none';
        if (serverControls) serverControls.style.display = 'none';
        if (gallerySection) gallerySection.style.display = 'none';
        if (container) {
            container.style.maxWidth = '100%';
            container.style.width = '100%';
            container.style.height = '100vh';
            container.style.borderRadius = '0';
            container.style.boxShadow = 'none';
            container.style.padding = '0';
            container.style.margin = '0';
        }
        
        // Mostrar solo botones necesarios
        const allBtns = controls.querySelectorAll('.btn');
        allBtns.forEach(btn => {
            const text = btn.getAttribute('title');
            if (text && (text.includes('Capturar') || text.includes('Pantalla') || text.includes('Detener'))) {
                btn.style.display = 'flex';
            } else {
                btn.style.display = 'none';
            }
        });
        
        // Activar fullscreen API
        const element = container || document.documentElement;
        if (element.requestFullscreen) {
            element.requestFullscreen().catch(err => console.error('Error fullscreen:', err));
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
        
    } else {
        fullscreenBtn.innerHTML = '<span class="btn-icon">🖥️</span><span class="btn-text">Pantalla Completa</span>';
        document.body.style.overflow = 'auto';
        
        // Mostrar elementos nuevamente
        if (header) header.style.display = 'block';
        if (serverControls) serverControls.style.display = 'block';
        if (gallerySection) gallerySection.style.display = 'block';
        if (container) {
            container.style.maxWidth = '700px';
            container.style.width = '100%';
            container.style.height = 'auto';
            container.style.borderRadius = '16px';
            container.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1)';
            container.style.padding = 'auto';
            container.style.margin = '0 auto';
        }
        
        // Mostrar todos los botones
        const allBtns = controls.querySelectorAll('.btn');
        allBtns.forEach(btn => {
            btn.style.display = 'flex';
        });
        
        // Salir de fullscreen API
        if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }
}

// Capturar imagen
function captureImage(mode = 'manual') {
    if (!isStreaming) {
        showNotification('❌ Inicia la cámara primero', 'danger');
        return;
    }

    try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Detectar si estamos en fullscreen
        const cameraSection = document.querySelector('.camera-section');
        const isFullscreen = cameraSection.classList.contains('fullscreen');

        // Crear canvas con la máscara recortada
        const maskedCanvas = isFullscreen 
            ? createAbsoluteMaskedCapture(canvas) 
            : createMaskedCapture(canvas);

        // Convertir a blob y guardar
        maskedCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const timestamp = new Date().toLocaleString('es-ES');
            const captureMode = mode === 'automatic' ? '📸 Automática' : '👆 Manual';
            
            const captureData = {
                url: url,
                blob: blob,
                timestamp: timestamp,
                mode: captureMode,
                id: Date.now()
            };

            capturedImages.push(captureData);
            lastCapturedImage = captureData;

            addImageToGallery(url, timestamp, capturedImages.length - 1);
            updateUI();
            showNotification(`✓ ${captureMode} (${capturedImages.length})`);

            // Mostrar modal de captura exitosa
            showCaptureModal(url);

            // Envío automático al acuario
            if (serverConnected) {
                sendPezToAquarium(blob, timestamp);
            }

            flashEffect();
        });

    } catch (error) {
        console.error('Error al capturar:', error);
        showNotification('❌ Error al capturar la imagen', 'danger');
    }
}

// Crear captura con máscara absoluta (fullscreen) - captura 100% de la imagen
function createAbsoluteMaskedCapture(sourceCanvas) {
    // En fullscreen, capturar toda la imagen (100% del canvas)
    const absoluteCanvas = document.createElement('canvas');
    absoluteCanvas.width = sourceCanvas.width;
    absoluteCanvas.height = sourceCanvas.height;
    const absoluteCtx = absoluteCanvas.getContext('2d');
    absoluteCtx.drawImage(sourceCanvas, 0, 0);

    if (!maskPath) {
        return absoluteCanvas;
    }

    try {
        const svgWidth = 278.61;
        const svgHeight = 223.01;
        
        // Calcular escala más grande para fullscreen
        const scaleX = sourceCanvas.width / svgWidth;
        const scaleY = sourceCanvas.height / svgHeight;
        const scale = Math.min(scaleX, scaleY) * 0.25; // 25% para captura absoluta

        const offsetX = (sourceCanvas.width - (svgWidth * scale)) / 2;
        const offsetY = (sourceCanvas.height - (svgHeight * scale)) / 2;

        // Canvas para crear la máscara
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = sourceCanvas.width;
        maskCanvas.height = sourceCanvas.height;
        const maskCtx = maskCanvas.getContext('2d');

        // Llenar con blanco primero
        maskCtx.fillStyle = '#FFFFFF';
        maskCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);

        // Dibujar la máscara del pez en negro
        maskCtx.fillStyle = '#000000';
        maskCtx.save();
        maskCtx.translate(offsetX, offsetY);
        maskCtx.scale(scale, scale);
        maskCtx.fill(maskPath);
        maskCtx.restore();

        // Canvas final con imagen recortada por máscara
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = sourceCanvas.width;
        finalCanvas.height = sourceCanvas.height;
        const finalCtx = finalCanvas.getContext('2d');

        // Copiar imagen original
        finalCtx.drawImage(sourceCanvas, 0, 0);

        // Aplicar máscara
        const imageData = finalCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
        const maskData = maskCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
        
        for (let i = 3; i < imageData.data.length; i += 4) {
            // Si el píxel en la máscara es blanco (255), hacer transparente el original
            if (maskData.data[i - 3] === 255 && maskData.data[i - 2] === 255 && maskData.data[i - 1] === 255) {
                imageData.data[i] = 0; // Alpha = 0 (transparente)
            }
        }
        finalCtx.putImageData(imageData, 0, 0);

        return finalCanvas;
    } catch (error) {
        console.error('Error aplicando máscara absoluta:', error);
        return absoluteCanvas;
    }
}

// Crear captura con máscara real del pez
function createMaskedCapture(sourceCanvas) {
    // Obtener región del frame
    const frameWidth = sourceCanvas.width * FRAME_WIDTH_PERCENT;
    const frameHeight = sourceCanvas.height * FRAME_HEIGHT_PERCENT;
    const frameX = (sourceCanvas.width - frameWidth) / 2;
    const frameY = (sourceCanvas.height - frameHeight) / 2;

    // Canvas con la región del frame
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = frameWidth;
    frameCanvas.height = frameHeight;
    const frameCtx = frameCanvas.getContext('2d');
    frameCtx.drawImage(
        sourceCanvas,
        frameX, frameY, frameWidth, frameHeight,
        0, 0, frameWidth, frameHeight
    );

    if (!maskPath) {
        return frameCanvas;
    }

    try {
        const svgWidth = 278.61;
        const svgHeight = 223.01;
        
        // Calcular escala y posición de la máscara
        // El pez debe estar centrado y ocupar la mayor parte del frame
        const scaleX = frameWidth / svgWidth;
        const scaleY = frameHeight / svgHeight;
        const scale = Math.min(scaleX, scaleY) * 0.65; // 65% para dar margen

        const offsetX = (frameWidth - (svgWidth * scale)) / 2;
        const offsetY = (frameHeight - (svgHeight * scale)) / 2;

        // Canvas para crear la máscara
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = frameWidth;
        maskCanvas.height = frameHeight;
        const maskCtx = maskCanvas.getContext('2d');

        // Llenar con blanco primero (para poder identificar el área externa)
        maskCtx.fillStyle = '#FFFFFF';
        maskCtx.fillRect(0, 0, frameWidth, frameHeight);
        
        // Dibujar el pez en NEGRO
        maskCtx.fillStyle = '#000000';
        maskCtx.save();
        maskCtx.translate(offsetX, offsetY);
        maskCtx.scale(scale, scale);
        maskCtx.fill(maskPath);
        maskCtx.restore();

        // Obtener datos de imagen y máscara
        const imageData = frameCtx.getImageData(0, 0, frameWidth, frameHeight);
        const imgData = imageData.data;
        
        const maskImageData = maskCtx.getImageData(0, 0, frameWidth, frameHeight);
        const maskData = maskImageData.data;

        // Canvas final
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = frameWidth;
        finalCanvas.height = frameHeight;
        const finalCtx = finalCanvas.getContext('2d');

        // NO llenar con blanco - mantener transparente

        // Aplicar máscara: copiar píxeles donde la máscara es negra
        const finalImageData = finalCtx.createImageData(frameWidth, frameHeight);
        const finalData = finalImageData.data;

        for (let i = 0; i < maskData.length; i += 4) {
            if (maskData[i] < 128) { // Si es NEGRO o muy oscuro en máscara (pez)
                // Copiar píxel de la imagen capturada
                finalData[i] = imgData[i];         // R
                finalData[i + 1] = imgData[i + 1]; // G
                finalData[i + 2] = imgData[i + 2]; // B
                finalData[i + 3] = 255;            // A opaco
            } else {
                // Si está fuera del pez, hacer transparente
                finalData[i] = 0;       // R
                finalData[i + 1] = 0;   // G
                finalData[i + 2] = 0;   // B
                finalData[i + 3] = 0;   // A transparente
            }
        }

        finalCtx.putImageData(finalImageData, 0, 0);
        return finalCanvas;

    } catch (error) {
        console.error('Error aplicando máscara:', error);
        return frameCanvas; // Si hay error, retornar sin máscara
    }
}

// Efecto flash al capturar
function flashEffect() {
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: white;
        opacity: 0.7;
        pointer-events: none;
        border-radius: 16px 16px 0 0;
    `;
    document.querySelector('.camera-section').style.position = 'relative';
    document.querySelector('.camera-section').appendChild(flash);

    setTimeout(() => {
        flash.style.transition = 'opacity 0.3s ease';
        flash.style.opacity = '0';
        setTimeout(() => flash.remove(), 300);
    }, 50);
}

// Agregar imagen a la galería
function addImageToGallery(url, timestamp, index) {
    if (gallery.querySelector('.gallery-empty')) {
        gallery.innerHTML = '';
    }

    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.innerHTML = `
        <img src="${url}" alt="Capturada el ${timestamp}">
        <div class="gallery-item-overlay">
            <button class="gallery-btn view-btn" title="Ver">👁️</button>
            <button class="gallery-btn download-btn" title="Descargar">⬇️</button>
            <button class="gallery-btn delete-btn" title="Eliminar">🗑️</button>
        </div>
    `;

    item.querySelector('.view-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        viewImage(url, timestamp);
    });

    item.querySelector('.download-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        downloadImage(index);
    });

    item.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteImage(index);
    });

    gallery.appendChild(item);
}

// Ver imagen agrandada
function viewImage(url, timestamp) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close">✕</button>
            <img src="${url}" alt="${timestamp}">
        </div>
    `;

    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
}

// Descargar imagen individual
function downloadImage(index) {
    const image = capturedImages[index];
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `mascara_${image.id}.png`;
    link.click();
    showNotification('⬇️ Imagen descargada');
}

// Eliminar imagen
function deleteImage(index) {
    const image = capturedImages[index];
    URL.revokeObjectURL(image.url);
    capturedImages.splice(index, 1);

    // Reconstruir galería
    gallery.innerHTML = '';
    if (capturedImages.length === 0) {
        gallery.innerHTML = '<p class="gallery-empty">No hay imágenes capturadas aún</p>';
    } else {
        capturedImages.forEach((img, i) => {
            addImageToGallery(img.url, img.timestamp, i);
        });
    }

    updateUI();
    showNotification('🗑️ Imagen eliminada');
}

// Descargar todas las imágenes
function downloadAll() {
    if (capturedImages.length === 0) {
        showNotification('❌ No hay imágenes para descargar', 'danger');
        return;
    }

    capturedImages.forEach((image, index) => {
        const link = document.createElement('a');
        link.href = image.url;
        link.download = `mascara_${image.id}.png`;
        
        // Pequeño delay entre descargas
        setTimeout(() => link.click(), index * 100);
    });

    showNotification(`⬇️ Descargando ${capturedImages.length} imágenes...`);
}

// Limpiar todo
function clearAll() {
    if (capturedImages.length === 0) {
        showNotification('❌ No hay imágenes para limpiar', 'danger');
        return;
    }

    const confirmed = confirm(`¿Eliminar las ${capturedImages.length} imágenes capturadas?`);
    
    if (confirmed) {
        capturedImages.forEach(image => {
            URL.revokeObjectURL(image.url);
        });
        capturedImages = [];
        gallery.innerHTML = '<p class="gallery-empty">No hay imágenes capturadas aún</p>';
        updateUI();
        showNotification('🗑️ Todas las imágenes fueron eliminadas');
    }
}

// Mostrar notificación
function showNotification(message, type = 'success') {
    notificationText.textContent = message;
    notification.className = 'notification show';

    if (type === 'danger') {
        notification.style.background = '#ef4444';
    } else if (type === 'warning') {
        notification.style.background = '#f59e0b';
    } else {
        notification.style.background = '#10b981';
    }

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Actualizar UI
function updateUI() {
    const captureManualBtn = document.getElementById('captureManualBtn');
    
    if (isStreaming) {
        startBtn.style.display = 'none';
        stopBtn.style.display = 'flex';
        if (captureManualBtn) captureManualBtn.style.display = 'flex';
    } else {
        startBtn.style.display = 'flex';
        stopBtn.style.display = 'none';
        if (captureManualBtn) captureManualBtn.style.display = 'none';
    }

    if (capturedImages.length > 0) {
        downloadAllBtn.style.display = 'flex';
        clearAllBtn.style.display = 'flex';
    } else {
        downloadAllBtn.style.display = 'none';
        clearAllBtn.style.display = 'none';
    }
}

// ========== MODAL DE CAPTURA EXITOSA ==========
function showCaptureModal(imageUrl) {
    const modal = document.getElementById('captureModal');
    const preview = document.getElementById('capturePreview');
    const sendBtn = document.getElementById('modalSendBtn');
    const discardBtn = document.getElementById('modalDiscardBtn');
    const timerSpan = document.getElementById('modalTimer');

    // Mostrar modal
    modal.style.display = 'flex';
    preview.src = imageUrl;

    // Limpiar timeout anterior si existe
    if (modalTimeout) {
        clearInterval(modalTimeout);
    }

    let countdown = 6;
    timerSpan.textContent = countdown;

    // Countdown de 6 segundos
    modalTimeout = setInterval(() => {
        countdown--;
        timerSpan.textContent = countdown;

        if (countdown === 0) {
            clearInterval(modalTimeout);
            hideCaptureModal();
        }
    }, 1000);

    // Event listeners
    sendBtn.onclick = () => {
        clearInterval(modalTimeout);
        if (lastCapturedImage && serverConnected) {
            sendPezToAquarium(lastCapturedImage.blob, lastCapturedImage.timestamp);
            hideCaptureModal();
            showNotification('🐟 Enviando al arrecife...', 'success');
        } else if (!serverConnected) {
            showNotification('❌ No conectado al acuario', 'danger');
        }
    };

    discardBtn.onclick = () => {
        clearInterval(modalTimeout);
        if (lastCapturedImage && capturedImages.length > 0) {
            const index = capturedImages.findIndex(img => img.id === lastCapturedImage.id);
            if (index > -1) {
                deleteImage(index);
            }
        }
        hideCaptureModal();
    };
}

function hideCaptureModal() {
    const modal = document.getElementById('captureModal');
    modal.style.display = 'none';
    
    if (modalTimeout) {
        clearInterval(modalTimeout);
    }
}

// Limpiar al cerrar la página
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});
