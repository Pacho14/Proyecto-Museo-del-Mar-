const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// No cachear archivos estáticos (para desarrollo)
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Servir archivos estáticos
app.use(express.static(__dirname));

// Ruta raíz - Detector de marcadores
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'detector.html'));
});

// Ruta pez
app.get('/pez', (req, res) => {
    res.sendFile(path.join(__dirname, 'pez.html'));
});

// Ruta tortuga
app.get('/tortuga', (req, res) => {
    res.sendFile(path.join(__dirname, 'tortuga.html'));
});

// Ruta index original (escáner dinámico)
app.get('/dinamico', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Servir uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Crear carpeta de uploads si no existe
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configurar multer para guardar archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const id = uuidv4();
        const timestamp = Date.now();
        cb(null, `captura_${timestamp}_${id}.png`);
    }
});

const upload = multer({ storage });

// API: Subir captura
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const url = `/uploads/${req.file.filename}`;
    console.log(`✅ Captura guardada: ${url}`);
    res.json({
        success: true,
        url: url,
        filename: req.file.filename,
        timestamp: new Date().toISOString()
    });
});

// API: Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        server: '🎨 Escáner Dinámico',
        port: PORT
    });
});

// API: Listar capturas
app.get('/api/captures', (req, res) => {
    fs.readdir(uploadsDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Error reading directory' });
        }

        const captures = files.map(file => ({
            url: `/uploads/${file}`,
            filename: file,
            timestamp: fs.statSync(path.join(uploadsDir, file)).mtime
        }));

        res.json(captures);
    });
});

// API: Eliminar captura
app.delete('/api/captures/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    fs.unlink(filePath, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Error deleting file' });
        }
        res.json({ success: true });
    });
});

// API: Limpiar todas las capturas
app.delete('/api/captures', (req, res) => {
    fs.readdir(uploadsDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Error reading directory' });
        }

        files.forEach(file => {
            fs.unlink(path.join(uploadsDir, file), (err) => {
                if (err) console.error(`Error deleting ${file}:`, err);
            });
        });

        res.json({ success: true, deleted: files.length });
    });
});

app.listen(PORT, () => {
    console.log(`
🎨 ═══════════════════════════════════════════════════════════
🎨 Escáner Dinámico (Pez & Tortuga)
🎨 Puerto: ${PORT}
🎨 URL: http://localhost:${PORT}
🎨 ═══════════════════════════════════════════════════════════
    `);
});
