# 🐢 Acuario Museo del Mar - Sistema Completo

## 📋 Requisitos

- **Node.js** 14+ ([descargar](https://nodejs.org/))
- **npm** (se instala con Node.js)

## 🚀 INSTALACIÓN Y INICIO RÁPIDO

### Opción 1: Automático (✨ Recomendado)

**Windows:**
1. Navega a la carpeta del proyecto
2. Haz doble clic en `INICIAR.bat`
3. ¡Listo! Se abrirán ambas apps automáticamente

### Opción 2: Manual

**Terminal 1 - Servidor API:**
```bash
cd ACUARIO_MUSEO_MAR
npm install
npm start
```

**Terminal 2 - Servidor Scanner:**
```bash
http-server -p 8000 -c-1
```

Luego abre:
- PC: `http://localhost:8000` (Scanner)
- PC: `http://localhost:3000` (Acuario)

---

## 📱 ACCESO DESDE MÓVIL

### Para ver el Scanner en tu móvil:

1. **Obtén su IP de computadora:**
   - Windows: Abre CMD y escribe `ipconfig`
   - Busca "IPv4 Address" (ej: 192.168.1.100)

2. **En tu móvil (misma WiFi):**
   - Abre navegador
   - Ingresa: `http://[TU_IP]:8000`
   - Ejemplo: `http://192.168.1.100:8000`

3. **Funciones:**
   - 📸 Captura tortugas con la cámara
   - 🐢 Se envían automáticamente al Acuario
   - 📤 Botón para enviar manualmente si falla

---

## 🎮 USO

### Scanner (Móvil + PC):
- ▶️ Iniciar Cámara
- 📸 Capturar imagen (manual o automático por movimiento)
- 🐢 Conectar al Acuario (automático al iniciar)
- 📤 Enviar al Acuario (manual si es necesario)

### Acuario (Solo PC):
- 🐢 Ver tortugas nadando
- 👁️ Click en tortuga para ver detalles
- 🔗 Cambiar servidor si es necesario
- 🗑️ Eliminar tortugas

---

## 📂 Estructura del Proyecto

```
WEB AR SCANNER MASK/
├── INICIAR.bat                    ← Ejecuta todo automáticamente
├── index.html                     ← Scanner (PC y Móvil)
├── script.js                      ← Lógica del Scanner
├── styles.css                     ← Estilos del Scanner
│
└── ACUARIO_MUSEO_MAR/
    ├── server.js                  ← API + Servidor Acuario
    ├── index.html                 ← Interfaz del Acuario
    ├── script.js                  ← Lógica del Acuario
    ├── styles.css                 ← Estilos del Acuario
    ├── package.json               ← Dependencias
    └── uploads/                   ← Carpeta de cargas
```

---

## 🔧 Puertos Utilizados

- **Puerto 8000**: Scanner (PC y Móvil)
- **Puerto 3000**: Acuario + API

---

## 🎯 Flujo de Uso

```
1. Ejecutar INICIAR.bat
   ↓
2. Se abren automáticamente:
   - Scanner en http://localhost:8000 (PC)
   - Acuario en http://localhost:3000 (PC)
   ↓
3. En móvil (WiFi):
   - Ir a http://[TU_IP]:8000/
   - Permitir acceso a cámara
   - Capturar tortugas
   ↓
4. Las tortugas aparecen en el Acuario:
   - Nadando animadas
   - Click para ver información
   - Descargar o eliminar
```

---

## ⚠️ Solución de Problemas

### "Puerto en uso"
```bash
# Cambiar puerto en INICIAR.bat
http-server -p 8080 -c-1  # Usar 8080 en lugar de 8000
```

### "No encuentra http-server"
```bash
npm install -g http-server
```

### "Error de permisos (Windows)"
- Botón derecho en INICIAR.bat
- Ejecutar como Administrador

### "No conecta desde móvil"
- Verifica IP con `ipconfig`
- Asegúrate que PC y móvil están en la misma WiFi
- Desactiva firewall temporalmente para probar

---

## 📝 Notas

- Primera ejecución instalará dependencias (~30 segundos)
- Las imágenes se guardan en `ACUARIO_MUSEO_MAR/uploads/`
- El API es RESTful y puede usarse desde cualquier cliente
- Las tortugas nadan automáticamente en el Acuario

---

## 🎨 Personalización

Edita estos archivos para cambiar:
- **Colores del Acuario**: `ACUARIO_MUSEO_MAR/styles.css`
- **Velocidad de tortugas**: `ACUARIO_MUSEO_MAR/script.js` (función `animateTurtle()`)
- **Frame del Scanner**: `styles.css` (variables `FRAME_WIDTH_PERCENT`, etc)

---

¡Disfruta capturando tortugas! 🐢✨
