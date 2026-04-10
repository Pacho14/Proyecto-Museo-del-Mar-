const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

const PORT_HTTPS = 8443;
const PORT_HTTP = 8000;
const KEY_FILE = 'server.key';
const CERT_FILE = 'server.crt';


// Crear certificados auto-firmados
function ensureCertificates() {
    if (!fs.existsSync(KEY_FILE) || !fs.existsSync(CERT_FILE)) {
        console.log('📋 Generando certificados auto-firmados...');
        const attrs = [{ name: 'commonName', value: '172.20.10.4' }];
        const pems = selfsigned.generate(attrs, { 
            days: 365, 
            algorithm: 'sha256',
            keySize: 2048
        });
        
        fs.writeFileSync(KEY_FILE, pems.private);
        fs.writeFileSync(CERT_FILE, pems.cert);
        console.log('✓ Certificados generados correctamente');
    }
}

ensureCertificates();

// Servir archivos estáticos
function serveFile(req, res) {
    let filePath = '.' + req.url;
    if (filePath === './' || filePath === '.') {
        filePath = './index.html';
    }
    
    // Asegurar que sea una ruta segura
    filePath = path.normalize(filePath);
    if (!filePath.startsWith('.')) {
        filePath = './' + filePath;
    }

    const extname = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html;charset=utf-8',
        '.js': 'text/javascript;charset=utf-8',
        '.css': 'text/css;charset=utf-8',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html;charset=utf-8' });
            res.end('<h1>404 - Archivo no encontrado</h1>', 'utf-8');
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0'
            });
            res.end(content);
        }
    });
}

// HTTP server que redirige a HTTPS
http.createServer((req, res) => {
    const host = req.headers.host.split(':')[0];
    res.writeHead(301, { Location: `https://${host}:${PORT_HTTPS}${req.url}` });
    res.end();
}).listen(PORT_HTTP, '0.0.0.0', () => {
    console.log(`🌐 HTTP en puerto ${PORT_HTTP} → redirige a HTTPS`);
});

// HTTPS server
https.createServer({
    key: fs.readFileSync(KEY_FILE),
    cert: fs.readFileSync(CERT_FILE)
}, serveFile).listen(PORT_HTTPS, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║         🔒 SERVIDOR HTTPS ACTIVO - CÁMARA HABILITADA      ║
╠════════════════════════════════════════════════════════════╣
║  📱 ACCESO DESDE MÓVIL (iOS/Android):                     ║
║                                                            ║
║     https://172.20.10.4:${PORT_HTTPS}/MASCARA_PEZ/            ║
║                                                            ║
║  💻 O DESDE PC:                                            ║
║                                                            ║
║     https://localhost:${PORT_HTTPS}/MASCARA_PEZ/              ║
║                                                            ║
║  ⚠️ NOTA: El navegador advertirá sobre certificado         ║
║     (es normal - es un certificado auto-firmado).          ║
║     Haz clic en "Avanzado" y continúa.                    ║
║                                                            ║
║  ✓ La cámara debe funcionar ahora en iOS                  ║
╚════════════════════════════════════════════════════════════╝
    `);
});

console.log('✓ Servidores escuchando...\n');
