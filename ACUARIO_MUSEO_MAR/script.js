// ========== VARIABLES GLOBALES ==========
let apiUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
let turtles = [];
let selectedTurtle = null;
let pollingInterval = null;
let lastTurtleCount = 0;

console.log('✅ Script cargando...');
console.log('🌐 API URL detectada:', apiUrl);

// ========== INICIALIZACIÓN AL CARGAR DOM ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('🐢 DOM Cargado, inicializando Acuario...');
    console.log(`🌐 Auto-conectando a: ${apiUrl}`);
    
    try {
        showToast(`🌐 Auto-conectando a ${apiUrl}...`, 'info');
    } catch (e) {
        console.error('Error en showToast:', e);
    }
    
    initializeAquarium();
    setupEventListeners();
    generateBubbles();
    // generatePlankton(); // DESACTIVADO
    
    console.log('⏱️ Esperando 500ms para auto-conectar...');
    setTimeout(() => {
        console.log('🔄 Iniciando autoConnect()...');
        autoConnect();
    }, 500);
});

// ========== INICIALIZACIÓN ==========
function initializeAquarium() {
    console.log('🌊 Acuario inicializado');
    updateStatus('Esperando conexión...', false);
}

function setupEventListeners() {
    document.getElementById('connectBtn').addEventListener('click', connect);
    document.getElementById('refreshBtn').addEventListener('click', refreshTurtles);
    document.getElementById('clearBtn').addEventListener('click', clearAll);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
    
    document.getElementById('apiUrl').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') connect();
    });
    
    // Salir de fullscreen con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('fullscreen-mode')) {
            toggleFullscreen();
        }
    });
}

// ========== CONEXIÓN Y API ==========
async function autoConnect() {
    console.log('🔍 autoConnect() iniciado');
    try {
        const healthUrl = `${apiUrl}/api/health`;
        console.log('📡 Intentando fetch a:', healthUrl);
        
        showToast(`🔄 Conectando a ${apiUrl}...`, 'info');
        
        const response = await fetch(healthUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('📨 Respuesta recibida:', response.status);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        console.log('✅ API respondió:', data);
        
        updateStatus(`✓ ${data.server}`, true);
        showToast(`✓ ¡Acuario Conectado! 🐢`, 'success');
        console.log('🐢 ✓ Conectado exitosamente');
        
        await refreshTurtles();
        startAutoRefresh();

    } catch (error) {
        console.error('❌ Error en autoConnect:', error);
        updateStatus(`✗ Esperando conexión...`, false);
        console.log('⏱️ Reintentando en 3 segundos...');
        setTimeout(autoConnect, 3000);
    }
}

async function connect() {
    const urlInput = document.getElementById('apiUrl').value.trim();
    
    if (!urlInput) {
        showToast('Ingresa un IP:Puerto válido', 'error');
        return;
    }

    const url = urlInput.startsWith('http') ? urlInput : `http://${urlInput}`;
    apiUrl = url;

    try {
        showToast(`🔄 Conectando a ${urlInput}...`, 'info');
        const response = await fetch(`${apiUrl}/api/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Servidor no respondió');

        const data = await response.json();
        updateStatus(`✓ ${data.server}`, true);
        showToast(`✓ ¡Conectado a ${urlInput}!`, 'success');
        
        await refreshTurtles();
        startAutoRefresh();

    } catch (error) {
        updateStatus(`✗ Error: ${error.message}`, false);
        showToast(`❌ Error conectando: ${error.message}`, 'error');
        console.error('Error conectando:', error);
    }
}

// ========== AUTO-REFRESCO ==========
function startAutoRefresh() {
    console.log('🔄 Iniciando polling automático cada 1 segundo...');
    
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`${apiUrl}/api/turtles`);
            if (!response.ok) return;
            
            const data = await response.json();
            const currentCount = data.turtles ? data.turtles.length : 0;
            
            if (currentCount !== lastTurtleCount) {
                console.log(`📊 Cambio detectado: ${lastTurtleCount} → ${currentCount} tortugas`);
                lastTurtleCount = currentCount;
                
                if (currentCount > 0 && data.turtles.length > turtles.length) {
                    showToast(`🐢 ¡Nueva tortuga llegó! (Total: ${currentCount})`, 'success');
                }
                
                turtles = data.turtles || [];
                renderTurtles();
                updateTurtleCount();
            }
        } catch (error) {
            // Silencio en errores de polling
        }
    }, 1000);
}

function stopAutoRefresh() {
    console.log('⏹️ Deteniendo polling automático');
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

async function refreshTurtles() {
    try {
        const response = await fetch(`${apiUrl}/api/turtles`);
        
        if (!response.ok) throw new Error('Error obteniendo tortugas');

        const data = await response.json();
        turtles = data.turtles || [];

        renderTurtles();
        updateTurtleCount();
        showToast(`✓ ${turtles.length} tortugas cargadas`, 'success');

    } catch (error) {
        showToast(`❌ Error: ${error.message}`, 'error');
        console.error('Error refrescando:', error);
    }
}

async function deleteTurtle(id) {
    if (!confirm('¿Eliminar esta tortuga?')) return;

    try {
        const response = await fetch(`${apiUrl}/api/turtles/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Error eliminando');

        turtles = turtles.filter(t => t.id !== id);
        renderTurtles();
        updateTurtleCount();
        closeInfo();
        showToast('🗑️ Tortuga eliminada', 'success');

    } catch (error) {
        showToast(`❌ Error: ${error.message}`, 'error');
    }
}

async function clearAll() {
    if (!confirm('¿Eliminar TODAS las tortugas del acuario?')) return;

    try {
        const response = await fetch(`${apiUrl}/api/turtles`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Error limpiando');

        turtles = [];
        renderTurtles();
        updateTurtleCount();
        closeInfo();
        showToast('🗑️ Acuario limpiado', 'success');

    } catch (error) {
        showToast(`❌ Error: ${error.message}`, 'error');
    }
}

// ========== PANTALLA COMPLETA ==========
function toggleFullscreen() {
    document.body.classList.toggle('fullscreen-mode');
    const btn = document.getElementById('fullscreenBtn');
    const isFullscreen = document.body.classList.contains('fullscreen-mode');
    btn.textContent = isFullscreen ? '⛶ Salir' : '⛶ Fullscreen';
    btn.classList.toggle('btn-active');
    
    if (isFullscreen) {
        showToast('🖥️ Modo pantalla completa (presiona ESC para salir)', 'success');
    } else {
        showToast('📱 Modo normal', 'info');
    }
}

// ========== RENDERIZADO DE TORTUGAS ==========
function renderTurtles() {
    const container = document.getElementById('turtlesContainer');
    container.innerHTML = '';

    turtles.forEach((turtle, index) => {
        const turtleEl = document.createElement('div');
        turtleEl.className = 'turtle';
        turtleEl.style.width = '300px';
        turtleEl.style.height = '300px';
        turtleEl.innerHTML = `<img src="${turtle.url}" alt="Tortuga ${index + 1}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2240%22 fill=%22%23666%22/%3E%3C/svg%3E'">`;
        
        turtleEl.addEventListener('click', () => showTurtleInfo(turtle));
        
        container.appendChild(turtleEl);
        animateTurtle(turtleEl, index);
    });
    
    console.log(`✅ ${turtles.length} tortugas renderizadas`);
}

function animateTurtle(element, index) {
    const startX = Math.random() * (window.innerWidth - 300);
    const startY = Math.random() * (window.innerHeight - 500) + 100;
    
    const speedX = 0.3 + Math.random() * 0.5;
    const speedY = 0.1 + Math.random() * 0.3;
    const direction = Math.random() > 0.5 ? 1 : -1;

    let x = startX;
    let y = startY;
    let vx = speedX * direction;
    let vy = speedY * (Math.random() > 0.5 ? 1 : -1);

    function swim() {
        x += vx;
        y += vy;

        if (x <= 0 || x >= window.innerWidth - 300) vx *= -1;
        if (y <= 100 || y >= window.innerHeight - 250) vy *= -1;

        element.style.left = x + 'px';
        element.style.top = y + 'px';

        if (vx < 0) {
            element.style.transform = 'scaleX(1) scaleY(1)';
        } else {
            element.style.transform = 'scaleX(-1) scaleY(1)';
        }

        const wave = Math.sin(x * 0.01) * 10;
        element.style.transform += ` translateY(${wave}px)`;

        requestAnimationFrame(swim);
    }

    swim();
}

// ========== INFORMACIÓN DE TORTUGA ==========
function showTurtleInfo(turtle) {
    selectedTurtle = turtle;
    const panel = document.getElementById('infoPanel');
    const title = document.getElementById('infoTitle');
    const content = document.getElementById('infoContent');

    const date = new Date(turtle.timestamp).toLocaleString('es-ES');
    const info = `
        <strong>ID:</strong> ${turtle.id}<br>
        <strong>Capturada:</strong> ${date}<br>
        <strong>Dimensiones:</strong> ${turtle.width}x${turtle.height}px<br>
        <strong>URL:</strong> <a href="${turtle.url}" target="_blank" style="color: #0dd9ff;">Ver imagen</a><br>
        <button class="btn btn-danger" style="margin-top: 10px;" onclick="deleteTurtle('${turtle.id}')">Eliminar</button>
    `;

    title.textContent = `🐢 Tortuga capturada`;
    content.innerHTML = info;
    panel.style.display = 'block';
}

function closeInfo() {
    document.getElementById('infoPanel').style.display = 'none';
    selectedTurtle = null;
}

// ========== EFECTOS VISUALES ==========
function generateBubbles() {
    const container = document.querySelector('.bubbles');
    
    setInterval(() => {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        
        // Realismo: Variación realista de tamaños de burbujas
        const size = Math.random() * 50 + 5;
        const duration = 5 + Math.random() * 8 + (size / 50) * 3;  // Burbujas grandes = viaje más largo
        const delay = Math.random() * 2;
        
        // Posición horizontal aleatoria
        const startX = Math.random() * 100;
        
        // Efecto de brillo variable
        const opacity = 0.4 + Math.random() * 0.4;

        bubble.style.width = size + 'px';
        bubble.style.height = size + 'px';
        bubble.style.left = startX + '%';
        bubble.style.opacity = opacity;
        bubble.style.animation = `rise ${duration}s linear ${delay}s forwards`;

        container.appendChild(bubble);

        // Remover burbuja después de completar animación
        setTimeout(() => bubble.remove(), (duration + delay) * 1000 + 100);
    }, 250);
}

function generatePlankton() {
    const container = document.querySelector('.plankton');
    
    // Colores fotorrealistas de plancton marino
    const planktonColors = [
        'rgba(150, 200, 255, 0.6)',   /* Azul claro */
        'rgba(100, 180, 255, 0.5)',   /* Azul medio */
        'rgba(120, 200, 200, 0.55)',  /* Cyan */
        'rgba(180, 210, 255, 0.65)',  /* Azul pálido */
        'rgba(150, 220, 150, 0.5)',   /* Verde azul */
        'rgba(200, 220, 255, 0.6)',   /* Blanco azulado */
    ];
    
    // Crear múltiples capas de plancton para profundidad
    for (let layer = 0; layer < 3; layer++) {
        const particlesPerLayer = 15 + Math.random() * 10;
        
        for (let i = 0; i < particlesPerLayer; i++) {
            const particle = document.createElement('div');
            particle.className = 'plankton-particle';
            
            // Variación realista de tamaño
            const size = 0.5 + Math.random() * 3;
            const startX = Math.random() * 100;
            const startY = Math.random() * 100;
            
            // Movimiento más lento y suave
            const tx = (Math.random() - 0.5) * 150 - (layer * 50);
            const ty = (Math.random() - 0.5) * 150;
            const duration = 20 + Math.random() * 25 + (layer * 5);
            
            // Profundidad: plancton más profundo es más traslúcido
            const opacityVariation = 0.3 + (0.7 * (1 - layer / 3));
            
            particle.style.width = size + 'px';
            particle.style.height = size + 'px';
            particle.style.left = startX + '%';
            particle.style.top = startY + '%';
            particle.style.background = planktonColors[Math.floor(Math.random() * planktonColors.length)];
            particle.style.setProperty('--tx', tx + 'px');
            particle.style.setProperty('--ty', ty + 'px');
            particle.style.animation = `float ${duration}s linear infinite`;
            particle.style.animationDelay = Math.random() * duration + 's';
            particle.style.opacity = opacityVariation;

            container.appendChild(particle);
        }
    }
}

// ========== UTILIDADES UI ==========
function updateStatus(message, connected) {
    const status = document.getElementById('status');
    status.innerHTML = `${connected ? '✓ ' : '✗ '}<strong>${message}</strong>`;
    status.style.color = connected ? '#00ff88' : '#ff6464';
}

function updateTurtleCount() {
    document.getElementById('turtleCount').innerHTML = 
        `🐢 Tortugas: <strong>${turtles.length}</strong>`;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    const duration = type === 'error' ? 5000 : (type === 'info' ? 4000 : 3000);

    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

console.log(`
╔════════════════════════════════════════╗
║  🌊 Acuario del Museo del Mar 🌊      ║
║  Acuario Interactivo con API 2D        ║
╚════════════════════════════════════════╝
`);
