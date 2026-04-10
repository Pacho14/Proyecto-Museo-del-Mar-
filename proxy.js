const http = require('http');
const httpProxy = require('http-proxy');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const BASE_DIR = __dirname;
const MASCARA_PEZ_DIR = path.join(BASE_DIR, 'MASCARA_PEZ');
const DETECTOR_MASCARA_DIR = path.join(BASE_DIR, 'DETECTOR_MASCARA');
const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${url}`);
    
    // API calls y uploads van a Acuario en puerto 3000
    if (url.startsWith('/api') || url.startsWith('/uploads')) {
        console.log(`  ↳ REDIRIGIENDO → http://localhost:3000${url}`);
        proxy.web(req, res, { 
            target: 'http://localhost:3000', 
            changeOrigin: true,
            logLevel: 'debug'
        });
    } 
    // /DETECTOR_MASCARA/ rutas
    else if (url.startsWith('/DETECTOR_MASCARA')) {
        const cleanUrl = url.replace(/^\/DETECTOR_MASCARA/, '') || '/';
        let filePath;
        
        if (cleanUrl === '/' || cleanUrl === '') {
            filePath = path.join(DETECTOR_MASCARA_DIR, 'index.html');
        } else {
            filePath = path.join(DETECTOR_MASCARA_DIR, cleanUrl);
        }
        
        serveFile(filePath, DETECTOR_MASCARA_DIR, res);
    }
    // /MASCARA_PEZ/ rutas
    else if (url.startsWith('/MASCARA_PEZ')) {
        const cleanUrl = url.replace(/^\/MASCARA_PEZ/, '') || '/';
        let filePath;
        
        if (cleanUrl === '/' || cleanUrl === '') {
            filePath = path.join(MASCARA_PEZ_DIR, 'index.html');
        } else {
            filePath = path.join(MASCARA_PEZ_DIR, cleanUrl);
        }
        
        serveFile(filePath, MASCARA_PEZ_DIR, res);
    }
    // Raíz sirve MASCARA_PEZ
    else {
        let filePath;
        if (url === '/' || url === '') {
            filePath = path.join(MASCARA_PEZ_DIR, 'index.html');
        } else {
            filePath = path.join(MASCARA_PEZ_DIR, url);
        }
        
        serveFile(filePath, MASCARA_PEZ_DIR, res);
    }
});

function serveFile(filePath, baseDir, res) {
    filePath = path.normalize(filePath);
    const relPath = path.relative(baseDir, filePath);
    
    // Seguridad: no permitir salir del directorio
    if (relPath.startsWith('..')) {
        console.log(`  ⚠️  Acceso denegado: ${filePath}`);
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const extname = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html;charset=utf-8',
        '.js': 'text/javascript;charset=utf-8',
        '.css': 'text/css;charset=utf-8',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            console.log(`  ✗ No encontrado: ${filePath}`);
            res.writeHead(404, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end(`<h1>404 - No encontrado</h1>`, 'utf-8');
        } else {
            console.log(`  ✓ Sirviendo: ${path.relative(BASE_DIR, filePath)}`);
            res.writeHead(200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(content);
        }
    });
}

proxy.on('error', (err, req, res) => {
    console.error(`  ✗ Proxy error: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'text/html;charset=utf-8' });
    res.end('<h1>502 - Error del Acuario</h1><p>No se puede conectar al servidor del acuario en puerto 3000</p>', 'utf-8');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════╗
║  🔄 PROXY INICIADO                    ║
╠════════════════════════════════════════╣
║  📍 Escuchando: http://0.0.0.0:${PORT}       ║
║  📁 Scanner Pez: /MASCARA_PEZ/         ║
║  🎭 Detector: /DETECTOR_MASCARA/       ║
║  🔗 API redirige: localhost:3000      ║
╚════════════════════════════════════════╝
    `);
});
