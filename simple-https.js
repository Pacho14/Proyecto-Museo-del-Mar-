const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const PORT_HTTPS = 8443;
const PORT_HTTP = 8000;
const KEY_FILE = 'server.key';
const CERT_FILE = 'server.crt';

// Generar certificados auto-firmados
function generateCertificates() {
    if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
        console.log('✓ Certificados encontrados');
        return;
    }

    console.log('📋 Generando certificados auto-firmados...');
    try {
        // Generar con OpenSSL por PowerShell
        execSync(`powershell -Command "$cert = New-SelfSignedCertificate -CertStoreLocation 'Cert:\\CurrentUser\\My' -DnsName '172.20.10.4' -FriendlyName 'ServerCert' -NotAfter (Get-Date).AddYears(1); [System.io.file]::WriteAllBytes('temp.pfx', (Export-PfxCertificate -Cert $cert -NoProperties -Password (New-Object System.Security.SecureString)))"`, {stdio: 'pipe'});
        
        // Convertir PFX a PEM
        execSync(`openssl pkcs12 -in temp.pfx -out ${KEY_FILE} -nodes -passin pass:`, {stdio: 'pipe'});
        execSync(`openssl pkcs12 -in temp.pfx -out ${CERT_FILE} -nokeys -passin pass:`, {stdio: 'pipe'});
        
        fs.unlinkSync('temp.pfx');
        console.log('✓ Certificados generados');
    } catch (e) {
        console.log('⚠️ No se pudo generar automáticamente. Usar http-server simple.');
        process.exit(1);
    }
}

generateCertificates();

// Servir archivos
function serveFile(req, res) {
    let filePath = '.' + req.url;
    if (filePath === './' || filePath === '.') {
        filePath = './index.html';
    }
    
    filePath = path.normalize(filePath);
    if (!filePath.startsWith('.')) filePath = './' + filePath;

    const extname = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html;charset=utf-8',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(content);
        }
    });
}

// HTTP redirect
http.createServer((req, res) => {
    const host = req.headers.host.split(':')[0];
    res.writeHead(301, { Location: `https://${host}:${PORT_HTTPS}${req.url}` });
    res.end();
}).listen(PORT_HTTP, '0.0.0.0');

// HTTPS
https.createServer({
    key: fs.readFileSync(KEY_FILE),
    cert: fs.readFileSync(CERT_FILE)
}, serveFile).listen(PORT_HTTPS, '0.0.0.0', () => {
    console.log(`
🔒 SERVIDOR HTTPS ACTIVO
========================
📱 Móvil: https://172.20.10.4:${PORT_HTTPS}/MASCARA_PEZ/
💻 PC: https://localhost:${PORT_HTTPS}/MASCARA_PEZ/
    `);
});
