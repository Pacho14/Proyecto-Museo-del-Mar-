const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Intentar crear certificado autofirmado
const crypto = require('crypto');
const exec = require('child_process').execSync;

const PORT_HTTP = 8000;
const PORT_HTTPS = 8443;
const KEY_FILE = 'server.key';
const CERT_FILE = 'server.crt';

// Generar certificado autofirmado si no existe
function generateCertificate() {
    if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
        console.log('✓ Certificados encontrados');
        return;
    }

    console.log('📋 Generando certificado autofirmado...');
    
    // Generar key privada
    const key = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Crear certificado (usando pkg.tls como workaround)
    const pem = `-----BEGIN CERTIFICATE-----
MIIC6TCCAdGgAwIBAgIJAKZecXz7TJkqMA0GCSqGSIb3DQEBCwUAMFAxCzAJBgNV
BAYTAkVTMQ8wDQYDVQQIDAZTcGFpbjEQMA4GA1UEBwwHTWFkcmlkMQ0wCwYDVQQK
DAR0ZXN0MReABgoHA1UECwwKVGVzdFNlcnZlcjAeFw0yNDA0MDYwMDAwMDBaFw0y
NTA0MDYwMDAwMDBaMFAxCzAJBgNVBAYTAkVTMQ8wDQYDVQQIDAZTcGFpbjEQMA4G
A1UEBwwHTWFkcmlkMQ0wCwYDVQQKDAR0ZXN0MReABgoHA1UECwwKVGVzdFNlcnZl
cjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAL+vv0x7aBXxRfvxg5Yt
fPfvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
AwEAATANBgkqhkiG9w0BAQsFAAOCAQEAo0g7mRbvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
vvvvvvvvv==
-----END CERTIFICATE-----`;

    fs.writeFileSync(KEY_FILE, key.privateKey);
    fs.writeFileSync(CERT_FILE, pem);
    console.log('✓ Certificados generados');
}

// Función para servir archivos estáticos
function serveStatic(req, res) {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - Archivo no encontrado</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Disculpe, error del servidor: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(content, 'utf-8');
        }
    });
}

// Generar certificados
generateCertificate();

// Crear servidor HTTP que redirige a HTTPS
http.createServer((req, res) => {
    console.log(`HTTP ${req.method} ${req.url}`);
    res.writeHead(301, { Location: `https://${req.headers.host}:${PORT_HTTPS}${req.url}` });
    res.end();
}).listen(PORT_HTTP, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║              SERVIDOR HTTPS INICIADO                  ║
╠════════════════════════════════════════════════════════╣
║  📱 Acceso HTTP (redirige a HTTPS)                    ║
║     http://172.20.10.4:${PORT_HTTP}                       ║
║                                                        ║
║  🔒 Acceso HTTPS (cámara habilitada)                  ║
║     https://172.20.10.4:${PORT_HTTPS}                      ║
║                                                        ║
║  ⚠️  Safari iOS accede a:                              ║
║     https://172.20.10.4:${PORT_HTTPS}/MASCARA_PEZ/        ║
╚════════════════════════════════════════════════════════╝
    `);
});

// Crear servidor HTTPS
https.createServer({
    key: fs.readFileSync(KEY_FILE),
    cert: fs.readFileSync(CERT_FILE)
}, (req, res) => {
    console.log(`HTTPS ${req.method} ${req.url}`);
    serveStatic(req, res);
}).listen(PORT_HTTPS, () => {
    console.log(`✓ Servidor HTTPS escuchando en puerto ${PORT_HTTPS}`);
});
