https://ezequielarcos-crypto.github.io/embarque_fly/

# Embarque ✈️

App web instalable (PWA) para guardar, mostrar y gestionar tarjetas de embarque **.pkpass**.
Sencilla, en español, funciona **sin conexión** y todos los datos se quedan **en el dispositivo** (IndexedDB).

## Funciones

- **Añadir tarjetas** con el botón *Explorar archivos*: abre el selector del sistema para buscar el `.pkpass` en la memoria del teléfono (p. ej. *Descargas*). Admite varios archivos a la vez y arrastrar y soltar en escritorio.
- **Compartir desde otras apps (Android)**: con la app instalada, comparte un `.pkpass` desde el gestor de archivos o el correo y elige *Embarque*.
- **Ver la tarjeta** con sus colores, logo y campos originales, y el código (PDF417, Aztec, QR o Code128).
- **Modo puerta de embarque**: código a pantalla completa sobre fondo blanco y pantalla siempre encendida.
- **Gestionar**: cancelar / reactivar, notas, descargar o compartir el `.pkpass` original, eliminar, buscar y filtrar.
- **Crear manualmente** una tarjeta si no tienes el archivo.
- **Panel** con el próximo vuelo (cuenta atrás) y estadísticas: tarjetas creadas, activas, voladas y canceladas, más un gráfico por mes.
- **Copia de seguridad** exportable/importable en JSON, tema claro/oscuro y almacenamiento persistente.

Si se vuelve a importar la misma tarjeta (mismo `passTypeIdentifier` + `serialNumber`), se actualiza en lugar de duplicarse.
Una tarjeta pasa a *volada* 3 h después de la hora de salida.

## Probarla en local

No necesita compilación: son archivos estáticos.

```bash
npx http-server -c-1 .
# abre http://localhost:8080
```

En el panel vacío, *Probar con ejemplos* carga tres tarjetas ficticias de `ejemplos/`
(regenerables con `python3 tools/crear_ejemplos.py`).

## Instalar en Android

1. Publica la carpeta en un hosting con HTTPS (el repo incluye un flujo de **GitHub Pages** que se ejecuta al hacer push a `main`; actívalo en *Settings → Pages → Source: GitHub Actions*).
2. Abre la URL en Chrome para Android y pulsa **Instalar app** (o menú ⋮ → *Instalar aplicación*).

Requisitos: Chrome/Edge para Android 103 o superior.

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html`, `css/app.css` | Interfaz y estilos |
| `js/zip.js` | Lector ZIP nativo (`DecompressionStream`), sin dependencias |
| `js/pkpass.js` | Lectura de `pass.json`, traducciones `*.lproj` e imágenes; resumen del vuelo |
| `js/cards.js`, `js/db.js` | Estados, estadísticas, copias de seguridad y almacenamiento IndexedDB |
| `js/views/` | Pantallas: panel, lista, detalle, añadir y ajustes |
| `sw.js`, `manifest.webmanifest` | Funcionamiento sin conexión, instalación y recepción de archivos compartidos |
| `vendor/bwip-js.min.js` | Generador de códigos de barras ([bwip-js](https://github.com/metafloor/bwip-js), MIT) |
| `fonts/` | Archivo y JetBrains Mono (SIL OFL), incluidas para uso sin conexión |

> Nota: la app no verifica la firma criptográfica de los `.pkpass`; solo los lee y los muestra.
