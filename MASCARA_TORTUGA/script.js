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
