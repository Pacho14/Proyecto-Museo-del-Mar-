const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

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

// Servir archivos estáticos del acuario
app.use(express.static(__dirname));

// Ruta raíz - servir Acuario UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Servir uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Crear carpeta de uploads si no existe
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configurar multer para guardas archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const id = uuidv4();
        cb(null, `turtle_${id}.png`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/png') {
            cb(null, true);
        } else {
            cb(new Error('Solo se aceptan archivos PNG'));
        }
    }
});

// Store para mantener registro de capturas (en memoria para demo)
let capturedTurtles = [];

// Rutas API

// POST: Recibir captura de tortuga
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se envió archivo' });
    }

    const turtleData = {
        id: path.parse(req.file.filename).name,
        filename: req.file.filename,
        url: `http://${req.hostname}:${PORT}/uploads/${req.file.filename}`,
        timestamp: new Date().toISOString(),
        width: req.body.width || 800,
        height: req.body.height || 600
    };

    capturedTurtles.push(turtleData);

    console.log(`✓ Tortuga capturada: ${turtleData.filename}`);

    res.json({
        success: true,
        message: 'Tortuga capturada exitosamente',
        turtle: turtleData
    });
});

// GET: Obtener todas las tortugas capturadas
app.get('/api/turtles', (req, res) => {
    res.json({
        success: true,
        count: capturedTurtles.length,
        turtles: capturedTurtles
    });
});

// GET: Obtener una tortuga específica
app.get('/api/turtles/:id', (req, res) => {
    const turtle = capturedTurtles.find(t => t.id === req.params.id);
    
    if (!turtle) {
        return res.status(404).json({ error: 'Tortuga no encontrada' });
    }

    res.json({
        success: true,
        turtle: turtle
    });
});

// DELETE: Eliminar una tortuga
app.delete('/api/turtles/:id', (req, res) => {
    const index = capturedTurtles.findIndex(t => t.id === req.params.id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Tortuga no encontrada' });
    }

    const removed = capturedTurtles.splice(index, 1)[0];

    // Eliminar archivo
    const filePath = path.join(uploadsDir, removed.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    console.log(`🗑️ Tortuga eliminada: ${removed.filename}`);

    res.json({
        success: true,
        message: 'Tortuga eliminada',
        turtle: removed
    });
});

// DELETE: Limpiar todas las tortugas
app.delete('/api/turtles', (req, res) => {
    const count = capturedTurtles.length;

    // Eliminar archivos
    capturedTurtles.forEach(turtle => {
        const filePath = path.join(uploadsDir, turtle.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    });

    capturedTurtles = [];

    console.log(`🗑️ Todas las tortugas eliminadas (${count})`);

    res.json({
        success: true,
        message: `${count} tortugas eliminadas`
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        server: 'Acuario Museo del Mar API',
        turtles: capturedTurtles.length
    });
});

// Fallback para rutas no API - servir index.html (para SPA)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌊 Acuario Museo del Mar - Servidor API`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`🐢 API disponible en http://localhost:${PORT}/api`);
    console.log(`\n✓ Servidor escuchando en puerto ${PORT}\n`);
});
