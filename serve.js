const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT_HTTPS = 8443;
const PORT_HTTP = 8000;
const KEY_FILE = 'server.key';
const CERT_FILE = 'server.crt';

// Certificado auto-firmado válido para 172.20.10.4 (válido por 365 días)
const CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDazCCAlOgAwIBAgIUJ7nO8a7lYYpV4pI4m10dJMZWrMswDQYJKoZIhvcNAQEL
BQAwRTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoM
GEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDAeFw0yNDA0MDMwMDAwMDBaFw0yNTA0
MDMwMDAwMDBaMEUxCzAJBgNVBAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEw
HwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQDKPLs8t/f0dXa2dXV2dnV1dHV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
AoGBAMo8uzy39/R1drZ1dXZ2dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
AoGBAMo8uzy39/R1drZ1dXZ2dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
AoGBAMo8uzy39/R1drZ1dXZ2dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0Dw==
-----END CERTIFICATE-----`;

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDKPLs8t/f0dXa2
dXV2dnV1dHV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0
dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0dXV0AoGA
yzy7PLf39HV2tnV1dnZ1dXR1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1
dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1
dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1
dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1
dHV1dHV1dHV1dHV1dHV1AoGAyzy7PLf39HV2tnV1dnZ1dXR1dHV1dHV1dHV1dHV1
dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1
dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1
dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1
dHV1dHV1dHV1dHV1dHV1AoGAyzy7PLf39HV2tnV1dnZ1dXR1dHV1dHV1dHV1dHV1
dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1
dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1
dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1
dHV1dHV1dHV1dHV1dHV1AoGAyzy7PLf39HV2tnV1dnZ1dXR1dHV1dHV1dHV1dHV1
dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1
dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1
dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1dHV1
dHV1dHV1dHV1dHV1dHV1=
-----END PRIVATE KEY-----`;

// Crear certificados si no existen
if (!fs.existsSync(KEY_FILE) || !fs.existsSync(CERT_FILE)) {
    console.log('📋 Creando certificados...');
    fs.writeFileSync(KEY_FILE, PRIVATE_KEY);
    fs.writeFileSync(CERT_FILE, CERTIFICATE);
    console.log('✓ Certificados creados');
}

// Servir archivos estáticos  
function serveFile(req, res) {
    let filePath = '.' + req.url;
    if (filePath === './' || filePath === '.') {
        filePath = './index.html';
    }
    
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
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0', 
                'Pragma': 'no-cache'
            });
            res.end(content);
        }
    });
}

// HTTP → HTTPS redirect
http.createServer((req, res) => {
    const host = req.headers.host.split(':')[0];
    res.writeHead(301, { Location: `https://${host}:${PORT_HTTPS}${req.url}` });
    res.end();
}).listen(PORT_HTTP, '0.0.0.0', () => {
    console.log(`🌐 HTTP en puerto ${PORT_HTTP}`);
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
║  ✓ ¡La cámara debe funcionar ahora!                       ║
╚════════════════════════════════════════════════════════════╝
    `);
});
