/*
 * BodegaPOS · cargador.js
 *
 * index.html es solo el esqueleto: cada <div data-incluir="ruta.html"> se reemplaza por el
 * contenido de ese archivo (carpeta vistas/). Después se cargan los scripts de la app, en orden,
 * y se dispara DOMContentLoaded para que los inicializadores se ejecuten igual que antes.
 *
 * Para agregar un script nuevo, añádelo a la lista SCRIPTS respetando el orden de dependencias.
 */
(function () {
  'use strict';

  // Orden de carga: comparten el mismo ámbito global, no cambiar el orden sin revisar dependencias.
  var SCRIPTS = [
    'js/escritorio.js',
    'js/supabase.js',
    'js/datos.js',
    'js/pagos.js',
    'js/impresora.js',
    'js/ticket.js',
    'js/auth.js',
    'js/navegacion.js',
    'js/notificaciones.js',
    'js/productos.js',
    'js/alertas.js',
    'js/buscador-select.js',
    'js/categorias.js',
    'js/pos.js',
    'js/pos-acciones.js',
    'js/clientes.js',
    'js/compras.js',
    'js/vendedores.js',
    'js/reportes.js',
    'js/reportes-inventario.js',
    'js/graficos.js',
    'js/utilidades.js',
    'js/respaldo.js',
    'js/dashboard.js',
    'js/envases-notas.js',
    'js/configuracion.js',
    'js/reportes-vendedores.js',
    'js/pos-extras.js',
    'js/reportes-salidas.js',
    'js/caja.js',
    'js/sidebar.js',
    'js/main.js',
    'js/pwa.js'
  ];

  // 1) Precarga los scripts en paralelo mientras se descargan las vistas
  SCRIPTS.forEach(function (src) {
    var l = document.createElement('link');
    l.rel = 'preload'; l.as = 'script'; l.href = src;
    document.head.appendChild(l);
  });

  function domListo() {
    return new Promise(function (ok) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ok, { once: true });
      else ok();
    });
  }

  function descargarVistas() {
    var marcas = Array.prototype.slice.call(document.querySelectorAll('[data-incluir]'));
    return Promise.all(marcas.map(function (m) {
      return fetch(m.getAttribute('data-incluir')).then(function (r) {
        if (!r.ok) throw new Error(r.status + ' al cargar ' + m.getAttribute('data-incluir'));
        return r.text();
      });
    })).then(function (textos) {
      return domListo().then(function () {
        marcas.forEach(function (m, i) {
          var t = document.createElement('template');
          t.innerHTML = textos[i];
          m.replaceWith(t.content);
        });
      });
    });
  }

  function cargarScripts() {
    return Promise.all(SCRIPTS.map(function (src) {
      return new Promise(function (ok, fallo) {
        var s = document.createElement('script');
        s.src = src;
        s.async = false;                 // conserva el orden de ejecución
        s.onload = ok;
        s.onerror = function () { fallo(new Error('No se pudo cargar ' + src)); };
        document.body.appendChild(s);
      });
    }));
  }

  function mostrarError(e) {
    console.error('BodegaPOS:', e);
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:#f0f2f5;font-family:sans-serif;padding:24px;text-align:center;color:#1f2937;';
    d.innerHTML = '<div style="max-width:460px"><h2 style="margin-bottom:12px">No se pudo cargar BodegaPOS</h2>' +
      '<p style="margin-bottom:8px">' + String(e.message || e) + '</p>' +
      '<p style="font-size:14px;color:#4b5563">Si abriste index.html con doble clic, sírvelo por HTTP: ' +
      'usa Live Server en VS Code o ejecuta <code>python3 -m http.server</code> en esta carpeta y abre http://localhost:8000</p></div>';
    document.body.appendChild(d);
  }

  descargarVistas()
    .then(cargarScripts)
    .then(function () {
      // Los scripts se cargaron después del evento real: se dispara de nuevo para sus inicializadores
      document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    })
    .catch(mostrarError);
})();
