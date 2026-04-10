# 🐢 Scanner de Máscaras + Acuario Museo del Mar

## 🚀 Inicio Rápido

### Opción 1: TODO AUTOMÁTICO (Recomendado)
Ejecuta este archivo:
```
INICIAR_TODO.bat
```
Esto abrirá automáticamente:
- Scanner: http://localhost:8000
- Acuario: http://localhost:3000

### Opción 2: Abrir Solo URLs
Ejecuta este archivo para abrir las apps en localhost:
```
ABRIR_APPS.bat
```

---

## 💻 Para PC

**URL a usar:**
- Scanner: http://localhost:8000
- Acuario: http://localhost:3000

> ⚠️ NO uses http://192.168.40.11:8000 en PC
> 
> Los navegadores bloquean la cámara en HTTP cuando accedes desde una IP diferente a localhost por razones de seguridad.

---

## 📱 Para Móvil

**URLs a usar:**
- Scanner: http://192.168.40.11:8000
- Acuario: http://192.168.40.11:3000

Asegúrate que PS y móvil estén en la misma red WiFi.

---

## 📸 Cómo Usar el Scanner

1. Abre http://localhost:8000 en el navegador
2. La cámara se iniciará automáticamente
3. Posiciona la mascará dentro del encuadre
4. Cuando detecte movimiento, capturará automáticamente 📸
5. Las imágenes se guardan en la galería

### Acciones Manuales
- **Capturar**: Botón para captura manual
- **Enviar al Acuario**: Botón para enviar todas las imágenes al acuario
- **Descargar**: Descarga todas las imágenes capturadas

---

## 🌊 Cómo Usar el Acuario

1. Abre http://localhost:3000 en otra pestaña
2. El Acuario se conectará automáticamente al API
3. Las tortugas que envíes desde el Scanner aparecerán nadando en el acuario
4. Haz clic en una tortuga para ver su información

---

## 🔧 Requisitos

- Node.js + npm
- Navegador moderno (Chrome, Firefox, Edge)
- Cámara web en el dispositivo

---

## ⚡ Puertos

- **Puerto 8000**: Scanner HTTP
- **Puerto 3000**: Acuario API + UI

Si estos puertos están ocupados, cambiarlos en los archivos BAT.

---

## 🐛 Troubleshooting

### La cámara no funciona en PC
→ Usa `http://localhost:8000` en lugar de la IP

### El Acuario no muestra tortugas
→ Verifica que el Scanner esté enviando imágenes (botón "Enviar al Acuario")

### No puedo acceder desde móvil
→ Confirma que estés en la misma red WiFi que la PC
→ Usa `http://192.168.40.11:8000` (reemplaza la IP si es diferente)

### Puerto ya está en uso
→ Ejecuta en terminal: `netstat -ano | findstr :3000` o `:8000`
→ Luego: `taskkill /PID [numero] /F`

---

**¡Disfrutá el Acuario! 🐢🌊**
