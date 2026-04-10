# 🎯 Escáner Dinámico con Detección de Marcadores

## Descripción

Sistema de detección automática de marcadores `.mind` que abre el escáner correspondiente:
- 🐟 **Marcador Pez** → Abre escáner de peses
- 🐢 **Marcador Tortuga** → Abre escáner de tortugas

## Estructura del Proyecto

```
ESCANNER_DINAMICO/
├── detector.html          # Página de detección (página principal)
├── pez.html              # Escáner específico para pez
├── tortuga.html          # Escáner específico para tortuga
├── index.html            # Escáner dinámico clásico (con selector manual)
│
├── script-pez.js         # Lógica del escáner pez
├── script-tortuga.js     # Lógica del escáner tortuga
├── script.js             # Lógica del escáner dinámico
│
├── styles.css            # Estilos compartidos
│
├── Marcador pez.mind     # Archivo de marcador (detección por imagen)
├── Marcador tortuga.mind # Archivo de marcador (detección por imagen)
│
├── server.js             # Servidor Express (puerto 3002)
├── package.json          # Dependencias
└── uploads/              # Carpeta de capturas
```

## Rutas Disponibles

| Ruta | Descripción |
|------|------------|
| **`/`** | Detector de marcadores (página principal) |
| **`/pez`** | Escáner directo de pez |
| **`/tortuga`** | Escáner directo de tortuga |
| **`/dinamico`** | Escáner dinámico con selector manual |

## Flujo de Uso

### 🤖 Automático (Recomendado)
1. Abre `http://localhost:3002/`
2. Cámara inicia automáticamente
3. Apunta a **Marcador Pez** o **Marcador Tortuga**
4. Automáticamente se abre el escáner correspondiente
5. ¡Captura y envía al acuario!

### 📱 Manual
1. Abre `http://localhost:3002/dinamico`
2. Selecciona modo (Pez/Tortuga/Auto)
3. Inicia la cámara
4. Captura manualmente
5. Envía al acuario

### 🎯 Directo
1. Abre `http://localhost:3002/pez` (para pez)
2. O `http://localhost:3002/tortuga` (para tortuga)

## Instalación y Ejecución

### Opción 1: Script Batch (Windows)
```bash
INICIAR_ESCANNER_DINAMICO.bat
```

### Opción 2: Manual
```bash
cd ESCANNER_DINAMICO
npm install
npm start
```

Luego abre: `http://localhost:3002`

## Características

### Detección de Marcadores
- Usa **Mind AR** (librería de detección de imágenes)
- Detecta marcadores `.mind` automáticamente
- Redirecciona sin intervención del usuario

### Captura de Imágenes
- Captura manual con botón
- Envío directo al acuario
- Almacenamiento en `/uploads`

### Conexión al Acuario
- Ingresa IP:Puerto del acuario
- Se guarda automáticamente en localStorage
- Envía capturas al acuario (`/api/upload`)

### Pantalla Completa
- Botón para expandir a pantalla completa
- ESC para salir

## Tecnología

- **Express.js** - Servidor web
- **MindAR.js** - Detección de marcadores
- **HTML5 MediaDevices API** - Acceso a cámara
- **Canvas API** - Captura de imágenes
- **LocalStorage** - Persistencia de configuración

## Notas

- Los marcadores `.mind` ya están incluidos
- La cámara debe tener permisos de acceso
- Funciona en iPad con HTTPS o localhost
- Compatible con navegadores modernos (Chrome, Safari, Firefox)

## Troubleshooting

### "Cámara no disponible"
- Verifica permisos de cámara en el navegador
- Intenta recargar la página
- En iOS, necesita HTTPS

### "Marcador no detecta"
- Asegúrate de que el marcador esté bien iluminado
- Apunta directamente al marcador
- Intenta desde diferentes ángulos

### "No conecta al acuario"
- Verifica que la IP y puerto sean correctos
- Asegúrate de que el acuario esté en ejecución
- Prueba en la misma red

## Archivos Generados

Las capturas se guardan en `/uploads/`:
- Nombre: `captura_TIMESTAMP_UUID.png`
- Accesible en: `http://localhost:3002/uploads/...`

---

**Creado para:** Web AR Scanner Mask  
**Versión:** 1.0.0  
**Fecha:** 2026-04-10
