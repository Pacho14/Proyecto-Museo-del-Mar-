const fs = require('fs');
const { execSync } = require('child_process');

const KEY_FILE = 'server.key';
const CERT_FILE = 'server.crt';

// Verificar si ya existen los certificados
if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
    console.log('✓ Certificados ya existen');
    process.exit(0);
}

console.log('📋 Generando certificados SSL autofirmados...');

try {
    // Intentar con OpenSSL si está disponible
    execSync(`openssl req -x509 -newkey rsa:2048 -keyout ${KEY_FILE} -out ${CERT_FILE} -days 365 -nodes -subj "/CN=172.20.10.4"`, {
        stdio: 'inherit'
    });
    console.log('✓ Certificados generados con OpenSSL');
} catch (err) {
    console.log('⚠️ OpenSSL no disponible, generando con node-forge...');
    
    // Usar node-forge como alternativa
    const pforge = require('pem-promise');
    pforge.createCertificate({
        days: 365,
        selfSigned: true
    }).then((keys) => {
        fs.writeFileSync(KEY_FILE, keys.key);
        fs.writeFileSync(CERT_FILE, keys.cert);
        console.log('✓ Certificados generados con pem-promise');
    });
}
