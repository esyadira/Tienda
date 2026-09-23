/*
 * BodegaPOS · Service Worker — modo sin internet
 *
 * - Al instalarse guarda TODA la app en el dispositivo (vistas, scripts, estilos, íconos, letras).
 * - Después funciona sin internet, e incluso con el servidor local apagado, mientras se abra en el
 *   mismo navegador y dirección (por ejemplo http://localhost:3000).
 * - Con internet usa siempre la versión más nueva; sin internet (o si la red tarda más de 4 s) usa la guardada.
 *
 * IMPORTANTE: si agregas o cambias archivos, sube el número de CACHE_NAME para que todos se actualicen.
 */
const CACHE_NAME = 'bodegapos-v6';
const ESPERA_RED_MS = 4000;

const PRECACHE = [
  "./",
  "index.html",
  "manifest.json",
  "css/base.css",
  "css/caja.css",
  "css/clientes.css",
  "css/componentes.css",
  "css/compras.css",
  "css/configuracion.css",
  "css/dashboard.css",
  "css/header.css",
  "css/layout.css",
  "css/login.css",
  "css/productos.css",
  "css/reportes.css",
  "css/responsive.css",
  "css/splash.css",
  "css/ticket.css",
  "css/vendedores.css",
  "css/ventas.css",
  "img/icon-192.png",
  "img/icon-512.png",
  "js/alertas.js",
  "js/auth.js",
  "js/buscador-select.js",
  "js/caja.js",
  "js/cargador.js",
  "js/categorias.js",
  "js/clientes.js",
  "js/compras.js",
  "js/configuracion.js",
  "js/dashboard.js",
  "js/datos.js",
  "js/escritorio.js",
  "js/envases-notas.js",
  "js/graficos.js",
  "js/impresora.js",
  "js/main.js",
  "js/navegacion.js",
  "js/notificaciones.js",
  "js/pagos.js",
  "js/pos-acciones.js",
  "js/pos-extras.js",
  "js/pos.js",
  "js/productos.js",
  "js/pwa.js",
  "js/reportes-inventario.js",
  "js/reportes-salidas.js",
  "js/reportes-vendedores.js",
  "js/reportes.js",
  "js/respaldo.js",
  "js/sidebar.js",
  "js/supabase.js",
  "js/ticket.js",
  "js/utilidades.js",
  "js/vendedores.js",
  "vendor/supabase.js",
  "vendor/fuentes/courier-prime-latin-400-normal.woff2",
  "vendor/fuentes/courier-prime-latin-700-normal.woff2",
  "vendor/fuentes/fuentes.css",
  "vendor/fuentes/ibm-plex-mono-latin-400-normal.woff2",
  "vendor/fuentes/ibm-plex-mono-latin-500-normal.woff2",
  "vendor/fuentes/ibm-plex-mono-latin-700-normal.woff2",
  "vendor/fuentes/jetbrains-mono-latin-wght-normal.woff2",
  "vendor/fuentes/sora-latin-wght-normal.woff2",
  "vendor/fuentes/space-mono-latin-400-normal.woff2",
  "vendor/fuentes/space-mono-latin-700-normal.woff2",
  "vistas/layout/header.html",
  "vistas/layout/login.html",
  "vistas/layout/setup.html",
  "vistas/layout/sidebar.html",
  "vistas/layout/splash.html",
  "vistas/modales/caja-detalle.html",
  "vistas/modales/caja-inicial.html",
  "vistas/modales/categoria.html",
  "vistas/modales/cliente.html",
  "vistas/modales/cobro.html",
  "vistas/modales/compras-asignar-proveedor.html",
  "vistas/modales/compras-orden.html",
  "vistas/modales/compras-proveedor.html",
  "vistas/modales/compras-recibir.html",
  "vistas/modales/config.html",
  "vistas/modales/confirmar-eliminar-cliente.html",
  "vistas/modales/pagar-deuda.html",
  "vistas/modales/peso.html",
  "vistas/modales/pos-acciones.html",
  "vistas/modales/producto.html",
  "vistas/modales/productos-categoria.html",
  "vistas/modales/ticket.html",
  "vistas/modales/vendedor.html",
  "vistas/modales/ver-cuenta.html",
  "vistas/modales/ver-producto.html",
  "vistas/paginas/categorias.html",
  "vistas/paginas/clientes.html",
  "vistas/paginas/compras.html",
  "vistas/paginas/configuracion.html",
  "vistas/paginas/inicio.html",
  "vistas/paginas/productos.html",
  "vistas/paginas/reportes.html",
  "vistas/paginas/vendedores.html",
  "vistas/paginas/ventas.html",
  "vendor/fontawesome/css/all.min.css",
  "vendor/fontawesome/webfonts/fa-brands-400.woff2",
  "vendor/fontawesome/webfonts/fa-regular-400.woff2",
  "vendor/fontawesome/webfonts/fa-solid-900.woff2",
  "vendor/fontawesome/webfonts/fa-v4compatibility.woff2"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Uno por uno: si un archivo falla, el resto se guarda igual
      Promise.all(PRECACHE.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function conTiempo(promesa, ms) {
  return new Promise((ok, fallo) => {
    const t = setTimeout(() => fallo(new Error('timeout')), ms);
    promesa.then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); fallo(e); });
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // nube (Supabase), WhatsApp, etc.: van directo a la red

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const guardada = () => cache.match(req, { ignoreSearch: true });

    try {
      if (self.navigator && self.navigator.onLine === false) throw new Error('sin internet');
      const res = await conTiempo(fetch(req), ESPERA_RED_MS);
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    } catch (e) {
      const r = await guardada();
      if (r) return r;
      if (req.mode === 'navigate') {
        const inicio = (await cache.match('index.html')) || (await cache.match('./'));
        if (inicio) return inicio;
      }
      return new Response('Sin conexión y este archivo no está guardado.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
