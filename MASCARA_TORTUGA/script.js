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
const detectionStatus = document.getElementById('detectionStatus');

let stream = null;
let capturedImages = [];
let isStreaming = false;
let referenceImageData = null;
let captureTimeout = null;
let maskPath = null;
let frameValidationCounter = 0; // Para throttle de logs

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

// ========== CONFIGURACIÓN DE MÁSCARAS Y QR ==========
const MASK_CONFIG = {
    pez: {
        name: '🐟 Pez',
        emoji: '🐟',
        qr: 'qr-code mascara pez',
        viewBox: '0 0 278.61 223.01',
        path: 'M104.23,200.9c1.03,3.78,1.66,7.61.73,11.5-1.45,6.09-6.56,8.97-12.96,7.07-8.68-2.58-14.41-8.61-18.34-16.53-1.29-2.59-2.43-5.26-2.96-8.1-.32-1.71-1.11-2.31-2.74-2.65-17.46-3.67-33.54-10.46-47.5-21.74-9.38-7.58-16.73-16.65-19.63-28.74-1.79-7.46-.6-14.51,2.67-21.3.62-1.29.86-2.31.09-3.73-4.96-9.18-2.07-23.93,8.27-28.99.9-.44,1.32-1.15,1.67-2.01,10.49-25.4,30.52-39.41,56.02-46.83,1.63-.47,2.59-1.25,3.44-2.65C84.39,17.45,100.28,4.84,122.24,1.01c11.32-1.98,22.49-1.26,33.04,3.98,6.62,3.29,10.06,8.51,10.09,15.96.04,9.43,4.06,16.62,12.08,21.65,3.66,2.3,7.39,4.53,10.79,7.24,10.99,8.77,13.68,21.77,6.92,34.39-.99,1.85-.84,2.8.63,4.27,3.73,3.7,7.47,7.34,12.02,10.05.77.46,1.55.92,2.37,1.3,6.3,2.93,8.98,2.32,13.38-3.05,3.39-4.13,5.97-8.82,8.98-13.2,7.79-11.35,17.61-20.01,31.08-23.96,2.87-.84,5.79-1.51,8.79-1.32,4.72.29,7.66,4.2,5.47,8.26-4.98,9.27-6.41,19.46-8.76,29.44-2.35,9.98-7.06,18.5-15.58,24.53.06.27.05.47.14.55,9.61,7.92,13.38,18.56,13.98,30.55.27,5.35,1.67,10.29,4.06,15.02.37.72.72,1.45,1.04,2.2,1.99,4.72.04,8.04-5.08,8.55-3.95.4-7.72-.56-11.41-1.81-9.82-3.31-17.58-9.44-23.79-17.61-3-3.95-5.79-8.06-8.73-12.06-2.99-4.05-4.18-4.36-8.96-2.76-4.99,1.67-9.03,4.83-12.97,8.16-.7.6-1,.96-.28,1.91,6.1,8.05,5.7,16.72,1.58,25.28-4.06,8.43-11.58,11.74-20.59,12.07-7.73.29-15.04-1.53-21.97-4.88-1.51-.73-2.73-.74-4.27.05-5.38,2.76-11.11,4.65-17.3,6.42,3.87,3.83,6.43,8.13,7.54,13.26.58,2.7.64,5.41.2,8.08-1.11,6.7-6.84,10.4-14.12,9.33-10.95-1.62-18.78-7.81-24.65-16.85-1.08-1.66-1.98-3.43-2.97-5.15-.25-.4-.5-.81-.74-1.21-.55.43-.16.86,0,1.29Z'
    },
    tortuga: {
        name: '🐢 Tortuga',
        emoji: '🐢',
        qr: 'qr-code mascara tortuga',
        viewBox: '0 0 377.38 236.97',
        path: 'M337.71,118.55c4.35.69,8.71,1.39,13.06,2.07,7.89,1.23,14.25,4.75,18.03,12.1.78,1.51,2.08,2.56,3.29,3.69,7.55,7.01,7.02,16.15-1.59,21.86-8.76,5.81-18.62,7.14-28.87,5.87-14.48-1.79-26.34-8.87-36.6-18.84-2.21-2.15-3.6-2.51-6.37-.76-11.95,7.57-25.31,11.63-38.99,14.72-9.61,2.17-19.37,3.36-29.19,4.08-1.25.09-2.49.32-4.25.56,3.54,3.14,5.17,7.07,7.27,10.69,1.9,3.27,4.76,5.64,7.81,7.69,3.74,2.51,6.3,5.82,8.01,9.91,1.67,4,4.28,7.23,7.78,9.83,4.36,3.25,8.58,6.69,11.96,11,2.19,2.79,3.81,5.91,4.37,9.41,1.13,7.09-3.52,12.48-11.81,13.77-11.99,1.86-23.66.17-35.09-3.53-19.54-6.34-36.56-17.04-52-30.4-8.68-7.51-16.34-15.9-22.37-25.73-2.62-4.26-4.55-8.82-5.88-13.62-.57-2.08-1.63-3.08-3.8-3.59-12.46-2.95-24.17-7.6-34.19-15.84-3.07-2.53-5.83-5.36-8.26-8.5-1.04-1.34-1.65-1.13-2.3.28-1.41,3.07-1.63,6.27-.61,9.42,1.13,3.49,2.43,6.94,3.92,10.29,1.79,4,2.94,8.15,3.12,12.49.23,5.61,2.36,10.52,4.92,15.34,2.37,4.48,4.63,9.02,4.62,14.26,0,6.09-3.76,10.02-9.89,10.23-5.17.18-10.09-1.17-14.62-3.52-20.32-10.54-34.82-26.17-40.38-48.72-3.39-13.77-.35-26.49,9.77-37,.62-.64,1.45-1.08,2-1.97-4.97-.25-9.67-.58-14.36-1.35-8.96-1.47-16.4-5.29-22.45-12.3-2.95-3.42-7.2-5.68-10.63-8.73C2.96,84.65-2.33,73.5.99,59.78c1.27-5.24,2.17-10.19,1.54-15.56-.48-4.08.7-8.09,2.9-11.6,1.62-2.59,1.6-5.61,2.68-8.34,2.75-6.95,7.71-10.75,15.15-11.35.84-.07,1.57-.28,2.3-.77C53.19-6.27,90.66,1.13,110.58,23.62c1.7,1.92,3.21,4.04,4.59,6.21.96,1.5,1.57,1.79,3.09.54,13.02-10.68,27.66-18.37,43.65-23.59C180.3.76,199.13-1.38,218.31.88c41.1,4.84,73.81,24.51,99.22,56.84,4.16,5.29,8.18,10.68,11.69,16.39,2.7,4.39,6.85,6.8,10.93,9.43,1.86,1.19,3.78,2.3,5.52,3.64,3.86,2.97,5.46,6.93,4.23,11.7-1.7,6.58-5.45,12.01-10.09,16.86-.75.78-1.74,1.32-2.62,1.98.17.28.34.56.51.84Z'
    }
};

let currentMaskType = 'tortuga'; // Máscara actual (tortuga en MASCARA_TORTUGA)
let lastQRDetection = null; // Último QR detectado (para evitar duplicados)
let qrDetectionThrottle = 0; // Throttle para no procesar cada frame

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎬 DOMContentLoaded: Inicializando Scanner de Tortuga...');
    
    startBtn.addEventListener('click', startCamera);
    stopBtn.addEventListener('click', stopCamera);
    captureBtn.addEventListener('click', () => {
        clearTimeout(captureTimeout);
        captureImage('manual');
    });
    downloadAllBtn.addEventListener('click', downloadAll);
    clearAllBtn.addEventListener('click', clearAll);

    // Nuevos listener para servidor
    document.getElementById('connectBtn').addEventListener('click', manualConnect);
    document.getElementById('sendAllBtn').addEventListener('click', sendAllTortugasToRefugio);
    document.getElementById('serverUrl').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') manualConnect();
    });

    // Listener para pantalla completa
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);

    // Tecla Escape para salir de fullscreen
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const cameraSection = document.querySelector('.camera-section');
            if (cameraSection.classList.contains('fullscreen')) {
                toggleFullscreen();
            }
        }
    });

    // Monitor fullscreen changes para actualizar canvas
    document.addEventListener('fullscreenchange', updateCanvasForFullscreen);
    document.addEventListener('webkitfullscreenchange', updateCanvasForFullscreen);
    document.addEventListener('mozfullscreenchange', updateCanvasForFullscreen);
    document.addEventListener('MSFullscreenChange', updateCanvasForFullscreen);

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

// Actualizar canvas cuando cambia fullscreen
function updateCanvasForFullscreen() {
    setTimeout(() => {
        if (video && isStreaming && detectionCanvas) {
            detectionCanvas.width = video.videoWidth;
            detectionCanvas.height = video.videoHeight;
            console.log('📐 Canvas actualizado:', detectionCanvas.width, 'x', detectionCanvas.height);
        }
    }, 50);
}

// ========== CONEXIÓN CON SERVIDOR ==========
async function connectToServer() {
    try {
        console.log(`🔍 Intentando conectar a: ${apiUrl}`);
        const response = await fetch(`${apiUrl}/api/health`, { timeout: 5000 });
        if (response.ok) {
            serverConnected = true;
            updateServerUI();
            showNotification('✓ Conectado al Refugio 🐢', 'success');
            console.log('🐢 ✓ Servidor del refugio conectado');
        }
    } catch (error) {
        serverConnected = false;
        updateServerUI();
        console.log('⚠️ Refugio no disponible. Reintentando en 3s...');
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
            console.log('🐢 Servidor conectado:', apiUrl);
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
        statusEl.textContent = '🟢 CONECTADO al Refugio';
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

// Enviar tortuga capturada al servidor
async function sendTortugaToRefugio(blob, timestamp) {
    if (!serverConnected) {
        console.log('No conectado. Guardando localmente.');
        return false;
    }

    try {
        const formData = new FormData();
        formData.append('image', blob, `tortuga_${Date.now()}.png`);
        formData.append('width', canvas.width * FRAME_WIDTH_PERCENT);
        formData.append('height', canvas.height * FRAME_HEIGHT_PERCENT);

        console.log('📤 Enviando tortuga al API...');
        const response = await fetch(`${apiUrl}/api/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Error enviando');

        const data = await response.json();
        showNotification('🐢 Tortuga enviada al Refugio', 'success');
        console.log('✓ Tortuga enviada:', data.turtle.id);
        console.log('✅ El Refugio lo detectará automáticamente en < 1 segundo');
        
        return true;

    } catch (error) {
        console.error('Error enviando tortuga:', error);
        showNotification('⚠️ No se pudo enviar al refugio', 'warning');
        return false;
    }
}

// Enviar todas las tortugas capturadas
async function sendAllTortugasToRefugio() {
    if (!serverConnected) {
        showNotification('❌ No conectado al refugio', 'danger');
        return;
    }

    if (capturedImages.length === 0) {
        showNotification('❌ No hay tortugas para enviar', 'danger');
        return;
    }

    let sent = 0;
    for (let tortuga of capturedImages) {
        const response = await fetch(tortuga.url);
        const blob = await response.blob();
        const success = await sendTortugaToRefugio(blob, tortuga.timestamp);
        if (success) sent++;
    }

    showNotification(`✓ ${sent}/${capturedImages.length} tortugas enviadas`, 'success');
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
                // Iniciar detección de QR en tiempo real
                startQRDetectionLoop();
            }).catch(err => {
                console.error('❌ Error al reproducir video:', err);
            });
            
            isStreaming = true;
            updateUI();
            showNotification('▶️ Cámara iniciada - Validación en tiempo real activada');

            // Configurar canvas de detección
            detectionCanvas.width = video.videoWidth;
            detectionCanvas.height = video.videoHeight;
            console.log('Canvas configurado:', detectionCanvas.width, 'x', detectionCanvas.height);

            // Iniciar validación de encuadre en tiempo real
            validateFrameQuality();
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

// Validación de encuadre con IA en tiempo real
function validateFrameQuality() {
    if (!isStreaming) return;

    try {
        // Dibujar frame actual en canvas de detección
        detCtx.drawImage(video, 0, 0, detectionCanvas.width, detectionCanvas.height);
        
        // Obtener la región del frame (donde debería estar la tortuga)
        const frameInfo = getFrameRegion();
        const imageData = detCtx.getImageData(frameInfo.startX, frameInfo.startY, frameInfo.width, frameInfo.height);
        
        // Analizar la región para determinar la calidad del encuadre
        const quality = analyzeFrameContent(imageData);
        
        // Log cada 10 frames para evitar spam
        if (frameValidationCounter % 10 === 0) {
            console.log(`📊 Quality: ${quality.score.toFixed(1)}/100 | Centering: ${(quality.centeringScore * 100).toFixed(0)}%`);
        }
        frameValidationCounter++;
        
        // Actualizar estado visual y mensaje
        updateFrameQuality(quality);
        
    } catch (error) {
        console.error('Error validando encuadre:', error);
    }

    // Continuar validando en tiempo real
    requestAnimationFrame(validateFrameQuality);
}

// Analizar contenido del frame para determinar la calidad del encuadre
function analyzeFrameContent(imageData) {
    const data = imageData.data;
    let brightness = 0;
    let contrast = 0;
    let edgePixels = 0;
    let uniformPixels = 0;
    let totalPixels = data.length / 4;

    // Calcular brillo y contraste
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Brillo promedio
        brightness += (r + g + b) / 3;
    }
    brightness = brightness / totalPixels;

    // Análisis de varianza (contraste)
    let variance = 0;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const pixel = (r + g + b) / 3;
        variance += Math.pow(pixel - brightness, 2);
    }
    contrast = Math.sqrt(variance / totalPixels);

    // Análisis de bordes (detección de formas)
    for (let i = 0; i < data.length - 8; i += 4) {
        const diff = Math.abs((data[i] - data[i + 4]) + (data[i + 1] - data[i + 5]) + (data[i + 2] - data[i + 6]));
        if (diff > 30) edgePixels++;
        if (diff < 5) uniformPixels++;
    }

    // NUEVA: DETECCIÓN DE CENTRADO HORIZONTAL
    const centeringScore = detectMaskCentering(imageData);

    // Calcular puntuación de calidad (0-100)
    let quality = 0;
    
    // Luz suficiente (brillo entre 30-220)
    const lightnessScore = brightness > 30 && brightness < 220 ? 25 : 0;
    
    // Contraste suficiente (entre 20-150)
    const contrastScore = contrast > 20 && contrast < 150 ? 25 : 0;
    
    // Bordes detectados (indica forma/objeto visible)
    const edgeScore = edgePixels > totalPixels * 0.05 ? 20 : 0;
    
    // No muy vacío (no demasiados píxeles uniformes)
    const contentScore = uniformPixels < totalPixels * 0.8 ? 15 : 0;
    
    // Centrado horizontal (nueva métrica)
    const centeringQuality = centeringScore * 15; // Máx 15 puntos
    
    quality = lightnessScore + contrastScore + edgeScore + contentScore + centeringQuality;

    return {
        score: Math.min(quality, 100),
        brightness: brightness,
        contrast: contrast,
        edges: edgePixels,
        uniformity: uniformPixels,
        centeringScore: centeringScore,
        centeringPercent: Math.round(centeringScore * 100)
    };
}

// Detectar si la máscara está centrada horizontalmente
function detectMaskCentering(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Detectar píxeles "diferentes" (contenido, no fondo uniforme)
    const significantPixels = [];
    
    // Analizar histograma horizontal para encontrar dónde está el contenido
    const horizontalDensity = new Array(width).fill(0);
    
    // Buscar píxeles que representen contenido (bajo luminance O colores saturados)
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luminance = (r + g + b) / 3;
        
        // Detectar: píxeles oscuros OR píxeles muy saturados (colores fuertes)
        const isBright = Math.max(r, g, b) > 200;
        const isDark = Math.min(r, g, b) < 100;
        const isSaturated = Math.max(r, g, b) - Math.min(r, g, b) > 80;
        
        if (isDark || (isBright && isSaturated) || isSaturated) {
            const pixelIndex = i / 4;
            const x = pixelIndex % width;
            const y = Math.floor(pixelIndex / width);
            
            // Solo contar píxeles en el tercio medio verticalmente (para evitar ruido arriba/abajo)
            if (y > height * 0.25 && y < height * 0.75) {
                horizontalDensity[x]++;
                significantPixels.push(x);
            }
        }
    }
    
    if (significantPixels.length < width * height * 0.01) {
        console.log('⚠️ Muy poco contenido detectado');
        return 0;
    }
    
    // Encontrar el rango con más densidad (donde está la máscara)
    let maxDensity = 0;
    let maxDensityPos = 0;
    for (let x = 0; x < width; x++) {
        if (horizontalDensity[x] > maxDensity) {
            maxDensity = horizontalDensity[x];
            maxDensityPos = x;
        }
    }
    
    // Encontrar bordes del contenido (donde la densidad es significativa)
    let contentLeft = 0;
    let contentRight = width - 1;
    
    const densityThreshold = maxDensity * 0.3; // 30% de la densidad máxima
    
    // Encontrar borde izquierdo
    for (let x = 0; x < width; x++) {
        if (horizontalDensity[x] > densityThreshold) {
            contentLeft = x;
            break;
        }
    }
    
    // Encontrar borde derecho
    for (let x = width - 1; x >= 0; x--) {
        if (horizontalDensity[x] > densityThreshold) {
            contentRight = x;
            break;
        }
    }
    
    const contentWidth = contentRight - contentLeft;
    const contentCenter = contentLeft + contentWidth / 2;
    const frameCenter = width / 2;
    
    const deviation = Math.abs(contentCenter - frameCenter);
    const tolerance = width * 0.15; // ±15%
    
    const centeringScore = Math.max(0, 1 - (deviation / tolerance));
    
    if (frameValidationCounter % 10 === 0) {
        console.log(`🎯 Centrado: Desv=${deviation.toFixed(0)}px, Tol=${tolerance.toFixed(0)}px, Score=${centeringScore.toFixed(2)}`);
        console.log(`📍 Contenido: Izq=${contentLeft}, Der=${contentRight}, Ancho=${contentWidth}, Centro=${contentCenter.toFixed(0)}`);
    }
    
    return centeringScore;
}

// Actualizar estado visual del encuadre
function updateFrameQuality(quality) {
    const status = document.getElementById('detectionStatus');
    status.textContent = '🎯 Posiciona tu dibujo aquí';
    status.style.color = '#ffffff';
    status.style.fontSize = '14px';
    status.style.fontWeight = '600';
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
        stopQRDetectionLoop(); // Detener detección de QR
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
            container.style.borderRadius = '0';
            container.style.boxShadow = 'none';
            container.style.padding = '0';
            container.style.margin = '0';
        }
        
        // Mostrar solo botones necesarios
        const allBtns = controls.querySelectorAll('.btn');
        allBtns.forEach(btn => {
            const text = btn.getAttribute('title');
            if (text && (text.includes('Capturar') || text.includes('Pantalla') || text.includes('Detener') || text.includes('Iniciar'))) {
                btn.style.display = 'flex';
            } else {
                btn.style.display = 'none';
            }
        });
        
        // Redimensionar canvas INMEDIATAMENTE
        if (video && isStreaming) {
            detectionCanvas.width = video.videoWidth;
            detectionCanvas.height = video.videoHeight;
            console.log('✅ Canvas redimensionado para fullscreen:', detectionCanvas.width, 'x', detectionCanvas.height);
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
    }
}

// ========== DETECCIÓN DE CÓDIGOS QR ==========
let qrDetectionLoopId = null;

// Iniciar loop de detección de QR
function startQRDetectionLoop() {
    if (qrDetectionLoopId) return; // Ya está activo
    
    function detectionLoop() {
        if (!isStreaming) {
            qrDetectionLoopId = null;
            return;
        }
        
        try {
            // Dibujar frame actual del video en canvas de detección
            if (video && detectionCanvas) {
                detCtx.drawImage(video, 0, 0, detectionCanvas.width, detectionCanvas.height);
                
                // Obtener datos de imagen para jsQR
                const imageData = detCtx.getImageData(0, 0, detectionCanvas.width, detectionCanvas.height);
                
                // Detección de QR (cada 5 frames para mejor performance)
                qrDetectionThrottle++;
                if (qrDetectionThrottle >= 5) {
                    qrDetectionThrottle = 0;
                    
                    if (window.jsQR) {
                        const code = jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: 'dontInvert'
                        });
                        
                        if (code) {
                            const qrData = code.data;
                            console.log(`📱 QR Detectado: ${qrData}`);
                            
                            // Procesar QR code
                            processQRCode(qrData);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error en loop de detección QR:', error);
        }
        
        qrDetectionLoopId = requestAnimationFrame(detectionLoop);
    }
    
    qrDetectionLoopId = requestAnimationFrame(detectionLoop);
    console.log('✅ Loop de detección QR iniciado');
}

// Detener loop de detección de QR
function stopQRDetectionLoop() {
    if (qrDetectionLoopId) {
        cancelAnimationFrame(qrDetectionLoopId);
        qrDetectionLoopId = null;
        console.log('⏹️ Loop de detección QR detenido');
    }
}

// Procesar datos de QR
function processQRCode(qrData) {
    // Evitar detectar el mismo QR múltiples veces en poco tiempo
    if (lastQRDetection === qrData && Date.now() - (lastQRDetection.timestamp || 0) < 2000) {
        return;
    }
    
    lastQRDetection = qrData;
    
    // Buscar coincidencia en máscaras
    for (const [maskKey, maskConfig] of Object.entries(MASK_CONFIG)) {
        // Comprobar diferentes variaciones del QR
        if (qrData.toLowerCase().includes(maskConfig.qr.toLowerCase()) ||
            qrData.toLowerCase().includes(maskKey)) {
            
            if (currentMaskType !== maskKey) {
                console.log(`🎭 Cambiando a máscara: ${maskConfig.name}`);
                switchMask(maskKey);
            }
            return;
        }
    }
    
    // Si no coincide con ninguna máscara
    console.log(`⚠️ QR no reconocido: ${qrData}`);
    updateQRDetectionStatus(`QR no reconocido: ${qrData.substring(0, 30)}...`);
}

// Cambiar máscara
function switchMask(maskKey) {
    if (!MASK_CONFIG[maskKey]) {
        console.error(`❌ Máscara no encontrada: ${maskKey}`);
        return;
    }
    
    const newMask = MASK_CONFIG[maskKey];
    currentMaskType = maskKey;
    
    try {
        // Actualizar SVG
        const svg = document.getElementById('maskOverlay');
        const path = svg.querySelector('.mask-path');
        
        svg.setAttribute('viewBox', newMask.viewBox);
        path.setAttribute('d', newMask.path);
        
        // Re-inicializar el Path2D
        try {
            maskPath = new Path2D(newMask.path);
        } catch (error) {
            console.error('Error al crear Path2D:', error);
            maskPath = null;
        }
        
        // Actualizar UI
        const maskNameEl = document.getElementById('currentMaskName');
        if (maskNameEl) {
            maskNameEl.textContent = newMask.name;
        }
        
        updateQRDetectionStatus(`✅ Máscara: ${newMask.name}`);
        showNotification(`🎭 Cambio de máscara: ${newMask.name}`);
        
        console.log(`✅ Máscara cambiada a: ${newMask.name}`);
        
    } catch (error) {
        console.error(`❌ Error al cambiar máscara:`, error);
        showNotification(`❌ Error al cambiar máscara`, 'danger');
    }
}

// Actualizar estado de detección QR en UI
function updateQRDetectionStatus(message) {
    const statusEl = document.getElementById('qrDetectionInfo');
    if (statusEl) {
        statusEl.textContent = message;
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

        // Crear canvas con la máscara recortada
        const maskedCanvas = createMaskedCapture(canvas);

        // Convertir a blob y guardar
        maskedCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const timestamp = new Date().toLocaleString('es-ES');
            const captureMode = mode === 'automatic' ? '📸 Automática' : '👆 Manual';
            
            capturedImages.push({
                url: url,
                blob: blob,
                timestamp: timestamp,
                mode: captureMode,
                id: Date.now()
            });

            addImageToGallery(url, timestamp, capturedImages.length - 1);
            updateUI();
            showNotification(`✓ ${captureMode} (${capturedImages.length})`);

            // Envío automático al refugio
            if (serverConnected) {
                sendTortugaToRefugio(blob, timestamp);
            }

            flashEffect();
        });

    } catch (error) {
        console.error('Error al capturar:', error);
        showNotification('❌ Error al capturar la imagen', 'danger');
    }
}

// Crear captura con máscara real de la tortuga
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
        const svgWidth = 377.38;
        const svgHeight = 236.97;
        
        // Calcular escala y posición de la máscara
        // La tortuga debe estar centrada y ocupar la mayor parte del frame
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
        
        // Dibujar la tortuga en NEGRO
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

        // Aplicar máscara: copiar píxeles donde la máscara es negra
        const finalImageData = finalCtx.createImageData(frameWidth, frameHeight);
        const finalData = finalImageData.data;

        for (let i = 0; i < maskData.length; i += 4) {
            if (maskData[i] < 128) { // Si es NEGRO o muy oscuro en máscara (tortuga)
                // Copiar píxel de la imagen capturada
                finalData[i] = imgData[i];         // R
                finalData[i + 1] = imgData[i + 1]; // G
                finalData[i + 2] = imgData[i + 2]; // B
                finalData[i + 3] = 255;            // A opaco
            } else {
                // Si está fuera de la tortuga, hacer transparente
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
    if (isStreaming) {
        startBtn.style.display = 'none';
        stopBtn.style.display = 'flex';
        captureBtn.disabled = false;
    } else {
        startBtn.style.display = 'flex';
        stopBtn.style.display = 'none';
        captureBtn.disabled = true;
    }

    if (capturedImages.length > 0) {
        downloadAllBtn.style.display = 'flex';
        clearAllBtn.style.display = 'flex';
    } else {
        downloadAllBtn.style.display = 'none';
        clearAllBtn.style.display = 'none';
    }
}

// Limpiar al cerrar la página
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});
