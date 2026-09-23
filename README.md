# BodegaPOS

Sistema de punto de venta para bodegas (PWA). Es una aplicación de una sola página: todas las vistas (inicio, productos, ventas, etc.) viven en la misma página y JavaScript decide cuál mostrar con `showPage()`. Cada vista está en su propio archivo dentro de `vistas/` y `index.html` es solo el esqueleto que las junta al cargar.

## Estructura

```
bodegapos/
├── index.html          Esqueleto: <div data-incluir="..."> marca dónde va cada vista
├── manifest.json       Configuración PWA
├── sw.js               Service Worker (debe quedar en la raíz)
├── img/                Íconos de la app
├── escritorio/         Versión instalable para Windows (Electron): main.js, instalador.nsi, construir.sh
├── vendor/             Librerías locales para funcionar sin internet: fuentes (Sora, JetBrains Mono, IBM Plex Mono,
│                       Courier Prime, Space Mono), Font Awesome 6.5.0 y supabase-js
├── vistas/             HTML de cada parte de la interfaz
│   ├── layout/             splash, setup (primera vez), login, header, sidebar
│   ├── paginas/            inicio (dashboard), productos, categorias, ventas, clientes,
│   │                       compras, vendedores, reportes, configuracion
│   └── modales/            17 modales, uno por archivo (producto, cliente, cobro, ticket, caja-inicial, compras-orden...)
├── css/                Estilos por sección
│   ├── base.css            Variables, reset, scrollbar
│   ├── login.css           Pantalla de configuración inicial y login
│   ├── header.css          Cabecera, reloj, notificaciones, chip de usuario
│   ├── layout.css          Estructura general, sidebar, botón hamburguesa
│   ├── componentes.css     Botones, tarjetas, tablas, modales, formularios
│   ├── vendedores.css      Permisos y turnos
│   ├── productos.css       Vista en cuadrícula de productos
│   ├── ventas.css          Punto de venta y carrito
│   ├── dashboard.css       Gráficos y tarjetas del dashboard
│   ├── clientes.css        Barras de deuda
│   ├── compras.css         Compras: pestañas, sugeridas, lista, órdenes, proveedores e histórico
│   ├── reportes.css        Reportes, pestañas y KPIs
│   ├── configuracion.css   Panel de configuración
│   ├── ticket.css          Ticket de venta (papel 58/80 mm) y panel de Configuración → Ticket
│   ├── caja.css            Ventana de efectivo en caja y su detalle en el dashboard
│   ├── responsive.css      Adaptación a laptop, tablet y móvil
│   └── splash.css          Pantalla de carga
└── js/                 Lógica por módulo
    ├── supabase.js         Sincronización en la nube
    ├── datos.js            Estado global y datos locales
    ├── auth.js             Login, configuración inicial y cierre de sesión
    ├── navegacion.js       Inicio de la app, reloj y cambio de página
    ├── notificaciones.js   Panel de notificaciones
    ├── productos.js        CRUD de productos (unidad / granel / paquete, costo y % de ganancia, promoción) y exportación a Excel
    ├── alertas.js          Stock bajo y deuda alta
    ├── buscador-select.js  Listas desplegables con búsqueda
    ├── categorias.js       Categorías
    ├── pos.js              Punto de venta, carrito y cobro
    ├── clientes.js         Clientes, cuentas y pago de deudas
    ├── compras.js          Compras: sugeridas, lista de compras, órdenes (recibir = stock + caja), proveedores e histórico
    ├── vendedores.js       Usuarios y permisos
    ├── reportes.js         Reporte del día, por producto y Yape
    ├── reportes-inventario.js  Reporte de inventario y exportación
    ├── graficos.js         Gráficos de ejemplo
    ├── utilidades.js       Modales, toast y utilidades generales
    ├── respaldo.js         Exportar e importar respaldo
    ├── dashboard.js        Métricas y gráficos reales del dashboard
    ├── envases-notas.js    Envases y notas de clientes
    ├── configuracion.js    Ajustes del sistema, apariencia y seguridad
    ├── pagos.js            Métodos de pago (efectivo, Yape, tarjeta, mixto) y Formas de Pago activas
    ├── ticket.js           Diseño del ticket (letra, tamaño, negrita), vista previa en Configuración e impresión
    ├── reportes-vendedores.js  Reporte por vendedor y filtros
    ├── pos-extras.js       Ayudas del cobro y del punto de venta
    ├── reportes-salidas.js Reporte de salidas de stock
    ├── pagos.js            Métodos de pago (efectivo, yape, tarjeta, mixto) y desglose por venta
    ├── caja.js             Efectivo en caja al iniciar sesión (por cajero) y su resumen en el dashboard
    ├── sidebar.js          Menú lateral responsivo
    ├── main.js             Arranque: sesión guardada o configuración inicial
    ├── pwa.js              Registro del Service Worker
    └── cargador.js         Descarga las vistas, carga los scripts en orden y arranca la app
```

## Cómo funciona la carga

`js/cargador.js` es el único script que carga `index.html`. Al abrir la página hace esto:

1. Descarga en paralelo todos los archivos de `vistas/` indicados en los `<div data-incluir="...">` y los inserta en su lugar.
2. Carga los scripts de `js/` en el orden de la lista `SCRIPTS` (dentro de `cargador.js`).
3. Dispara `DOMContentLoaded` de nuevo, porque los scripts se cargan después del evento real y sus inicializadores lo necesitan.

Para agregar una vista nueva se crea su archivo en `vistas/` y se añade su `<div data-incluir="...">` en `index.html`. Para agregar un script nuevo se añade a `SCRIPTS`.

## Versión de escritorio (instalador para Windows)

`escritorio/` envuelve esta misma app en un programa de Windows: `BodegaPOS-Setup.exe` instala BodegaPOS (sin permisos de administrador), crea el ícono en el escritorio y abre la app en su propia ventana, **sin navegador, sin servidor y sin internet**.

- **Datos.** Quedan en `%APPDATA%\BodegaPOS` (no dentro del programa). Reinstalar, actualizar o desinstalar **no los borra**. Para pasar los datos a otra PC usa Configuración → Respaldo (exportar / importar).
- **Actualizar.** Se genera un `Setup.exe` nuevo y se instala encima; conserva los datos.
- **Cómo se genera.** `bash escritorio/construir.sh` (Linux con `node` y `makensis`): descarga Electron para Windows, copia la app a `resources/app/www` y compila el instalador con `instalador.nsi`. Cambia `ELECTRON_VERSION` para otra versión de Electron.
- **`prompt()`.** Electron no lo trae; `js/escritorio.js` lo reemplaza por una ventana propia (envases, borrar todo, nombre de impresora).
- **Impresora térmica USB (impresión directa).** Usa Web Serial; en escritorio se elige sola si hay una sola conectada. Con impresión "por navegador" se usa `--kiosk-printing` (imprime a la predeterminada sin diálogo).
- Requiere Windows 10 u 11 de 64 bits. El instalador no está firmado: Windows SmartScreen mostrará "Windows protegió su PC" → Más información → Ejecutar de todas formas.

## Funciona sin internet

Todo lo que la app necesita está dentro de la carpeta (letras, íconos y librería de la nube en `vendor/`), y los datos se guardan en el navegador (`localStorage`). No se pide nada a internet para vender, comprar, imprimir tickets o ver reportes.

- **Service Worker (`sw.js`).** La primera vez que se abre la app (con o sin internet, pero con el servidor encendido) guarda toda la app en el navegador. Desde ahí abre aunque no haya internet **e incluso con el servidor apagado**, siempre que se use el mismo navegador y la misma dirección (por ejemplo `http://localhost:3000`).
- **Actualizaciones.** Con internet o servidor disponible usa siempre los archivos más nuevos; sin conexión usa los guardados. Si cambias o agregas archivos, sube el número de `CACHE_NAME` en `sw.js` y, si es un archivo nuevo, agrégalo a `PRECACHE`.
- **Nube (Supabase, opcional).** Es lo único que necesita internet, y solo si la activas en Configuración. Si trabajas sin conexión, los cambios quedan marcados como pendientes (`bodega_sb_pendiente`) y se suben solos al volver el internet, sin que la nube pise lo hecho sin conexión.
- **WhatsApp.** El botón de enviar pedido por WhatsApp abre wa.me, así que ese botón sí necesita internet.
- **Ojo con los datos.** Al no haber nube de por medio, la información vive solo en ese navegador: haz respaldos seguido (Configuración → Respaldo) y no borres los datos del sitio.

## Importante

- **Orden de carga.** Los archivos de `js/` comparten el mismo ámbito global, igual que cuando estaban en un solo `<script>`. El orden de `SCRIPTS` debe mantenerse y `main.js` debe ir después de todos los demás (solo antes de `pwa.js`). Lo mismo aplica a las hojas de `css/`, donde `responsive.css` va después del resto para que sus reglas tengan prioridad.
- **Orden de los modales.** Se incluyen en el mismo orden que tenían originalmente porque, cuando dos modales están abiertos a la vez, el que aparece después en el HTML queda encima.
- **Necesita un servidor.** Como las vistas se descargan con `fetch`, abrir `index.html` con doble clic no funciona (el navegador bloquea las descargas desde `file://`). Con Live Server de VS Code o con `python3 -m http.server` dentro de esta carpeta funciona, y al publicar en un hosting (GitHub Pages, Netlify, etc.) no requiere nada extra. Si falla la carga, la página muestra un mensaje explicándolo.

## Observaciones encontradas al separar el código

Se conservaron tal cual para no alterar el comportamiento, pero conviene revisarlas:

- Hay funciones definidas dos veces y solo la última se usa: `renderReportes` (reportes.js y reportes-vendedores.js), `exportarBackup`, `importarBackup` y `reiniciarSistemaCompleto` (respaldo.js y configuracion.js), `aplicarColorPreset` (configuracion.js) y `showToast` (utilidades.js, sobrescrita en configuracion.js).
- Un botón llama a una función que no existe: `clearCatFilter()` (botón Limpiar de la página Categorías).
- `_origDelVend` en `auth.js` se declara pero nunca se usa.
- El HTML original nunca cerraba `</main>` y dejaba el `#app` abierto, por lo que los modales quedaban dentro de `#app`. Ahora `index.html` cierra ambos de forma explícita, y el resultado en pantalla es el mismo.

## Compras

Reemplaza a la antigua página Proveedores. Datos en `localStorage`/nube: `proveedores`, `ordenesCompra` y `listaCompras` (dentro de `bodega_data_permanente`). Cada producto guarda el nombre de su proveedor en `producto.proveedor`.

- **Sugeridas:** stock ≤ mínimo del producto, o se agota en ≤ 3 días según las ventas de los últimos 30 días.
- **Recibir una orden:** suma stock (cantidad × unidades por presentación), actualiza el costo del producto y, si se paga en efectivo o Yape, registra la salida en `pagosProveedoresHistorial` y en `ventasHistorial` (con `esPagoPedidoProv`), como ya hacía el sistema.
- El permiso guardado de los usuarios sigue llamándose `Proveedores` y ahora abre la página Compras.
