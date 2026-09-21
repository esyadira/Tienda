// ========================================
// IMPRESORA DE TICKETS: elegir impresora, letra/tamaño y modo de impresión
// ========================================
// IMPORTANTE — límite real de los navegadores:
// Por seguridad, ninguna página web puede mandar a imprimir "silenciosamente" a la impresora
// que uno elija, sin que el navegador muestre ningún cuadro. Eso no depende del código de
// BodegaPOS: lo bloquea el propio Chrome/Edge/Firefox en cualquier sitio web.
// Hay dos caminos reales para que no aparezca el diálogo/vista previa:
//  1) IMPRESIÓN DIRECTA (lo que se implementa aquí): la impresora térmica se conecta por USB y
//     el ticket se le manda en crudo (comandos ESC/POS) sin pasar por el sistema de impresión del
//     navegador. No hay diálogo, no hay PDF: la impresora arranca a imprimir sola.
//     Requiere Chrome o Edge de escritorio (Web Serial) y volver a autorizar la impresora si se
//     borran los permisos del sitio.
//  2) Si prefieres seguir usando el diálogo normal: abriendo BodegaPOS con Chrome en modo
//     "--kiosk-printing" (un acceso directo especial), Chrome deja de mostrar el diálogo y de
//     ofrecer "Guardar como PDF": imprime directo a la impresora predeterminada de Windows.

const IMPRESORA_DEFECTO = {
  modo: 'navegador',   // 'navegador' (diálogo de impresión) | 'directa' (ESC/POS por USB, sin diálogo)
  columnas: 36,        // (heredado) ahora las columnas, el tamaño y las negritas se eligen en Configuración → Ticket → Letra
  nombre: '',          // nombre elegido por el usuario, solo para mostrarlo en el selector
  cajon: true           // abrir el cajón de dinero (si está conectado al puerto de la impresora) cada vez que se imprime
};

let _impresoraPuerto = null; // SerialPort ya abierto (dura mientras la pestaña esté abierta)

function impresoraSoportada() {
  return typeof navigator !== 'undefined' && !!navigator.serial;
}

function impresoraCfg() {
  const g = (typeof settings !== 'undefined' && settings.impresora) || {};
  return Object.assign({}, IMPRESORA_DEFECTO, g);
}

// ---------------------------------------
// Panel de configuración
// ---------------------------------------
function cargarImpresoraPanel() {
  const c = impresoraCfg();
  const safe = (id, val) => {
    const e = document.getElementById(id);
    if (!e) return;
    if (e.type === 'checkbox') e.checked = !!val; else e.value = val;
  };
  safe('cfg-imp-cajon', c.cajon !== false);
  actualizarSelectorImpresora();
}

// El cajón se guarda al toque (no hace falta pasar por "Guardar Ticket") porque es un
// interruptor de sí/no, igual que elegir el modo de impresión.
function cfgImpresoraCajon(checked) {
  settings.impresora = Object.assign(impresoraCfg(), { cajon: !!checked });
  localStorage.setItem('bodega_settings', JSON.stringify(settings));
  if (typeof sbSyncDebounced === 'function') sbSyncDebounced();
}

function actualizarSelectorImpresora() {
  const sel = document.getElementById('cfg-imp-select');
  const estado = document.getElementById('cfg-imp-estado');
  if (!sel) return;
  const c = impresoraCfg();

  sel.innerHTML = '';
  const optNav = document.createElement('option');
  optNav.value = 'navegador';
  optNav.textContent = 'Impresión del navegador (con vista previa)';
  sel.appendChild(optNav);

  if (_impresoraPuerto || c.modo === 'directa') {
    const optDir = document.createElement('option');
    optDir.value = 'directa';
    optDir.textContent = (c.nombre || 'Impresora térmica') + ' — impresión directa (sin vista previa)';
    sel.appendChild(optDir);
  }
  sel.value = c.modo === 'directa' ? 'directa' : 'navegador';

  const cajonWrap = document.getElementById('cfg-imp-cajon-wrap');
  if (cajonWrap) cajonWrap.style.display = c.modo === 'directa' ? '' : 'none';

  if (!estado) return;
  if (!impresoraSoportada()) {
    estado.innerHTML = '⚠️ Este navegador no permite impresión directa. Usa Chrome o Edge en una computadora, o abre BodegaPOS con el acceso directo "--kiosk-printing" para que el navegador imprima sin preguntar.';
  } else if (c.modo === 'directa' && _impresoraPuerto) {
    estado.innerHTML = '🟢 Impresora conectada — al imprimir, sale directo, sin vista previa ni PDF. Si el cajón de dinero está enchufado al puerto de la impresora, se abre solo (con F2 "Cobrar sin Imprimir" no se abre, porque no se manda nada a imprimir).';
  } else if (c.modo === 'directa') {
    estado.innerHTML = '🟡 Impresora elegida, pero hay que volver a conectarla (haz clic en "Conectar impresora").';
  } else {
    estado.innerHTML = '⚪ Usando el diálogo de impresión del navegador. El cajón de dinero solo se puede abrir automáticamente en modo impresión directa (arriba), porque el navegador no deja mandar comandos crudos a la impresora por su diálogo normal.';
  }
}

function cfgImpresoraCambiarModo(valor) {
  if (valor === 'directa' && !_impresoraPuerto) {
    conectarImpresoraDirecta().then(() => actualizarSelectorImpresora());
  } else {
    actualizarSelectorImpresora();
  }
}

// Pide al usuario elegir el puerto USB de su impresora térmica (una sola vez; el navegador
// recuerda el permiso para la próxima visita, salvo que lo borre desde su configuración).
async function conectarImpresoraDirecta() {
  if (!impresoraSoportada()) {
    showToast('Tu navegador no soporta impresión directa (usa Chrome o Edge de escritorio)', 'error');
    return false;
  }
  try {
    const puerto = await navigator.serial.requestPort();
    await puerto.open({ baudRate: 9600 });
    _impresoraPuerto = puerto;
    const nombre = prompt('Ponle un nombre a esta impresora (ej: "Impresora del mostrador"):', settings.impresora.nombre || 'Impresora térmica') || 'Impresora térmica';
    settings.impresora = Object.assign(impresoraCfg(), { modo: 'directa', nombre });
    localStorage.setItem('bodega_settings', JSON.stringify(settings));
    actualizarSelectorImpresora();
    showToast('Impresora conectada ✓', 'success');
    return true;
  } catch (e) {
    showToast('No se conectó ninguna impresora (¿cancelaste el permiso del navegador?)', 'error');
    return false;
  }
}

// Al abrir BodegaPOS, intenta reconectar sola a una impresora ya autorizada antes (sin preguntar).
async function reconectarImpresoraGuardada() {
  if (!impresoraSoportada()) return;
  const c = impresoraCfg();
  if (c.modo !== 'directa' || _impresoraPuerto) return;
  try {
    const puertos = await navigator.serial.getPorts();
    if (puertos.length) { await puertos[0].open({ baudRate: 9600 }); _impresoraPuerto = puertos[0]; }
  } catch (e) { /* si falla, se sigue usando el navegador hasta reconectar a mano */ }
  actualizarSelectorImpresora();
}
document.addEventListener('DOMContentLoaded', () => setTimeout(reconectarImpresoraGuardada, 500));

function guardarImpresora() {
  const sel = document.getElementById('cfg-imp-select');
  settings.impresora = Object.assign(impresoraCfg(), {
    modo: sel ? sel.value : 'navegador'
  });
  localStorage.setItem('bodega_settings', JSON.stringify(settings));
  if (typeof sbSyncDebounced === 'function') sbSyncDebounced();
  actualizarSelectorImpresora();
  showToast('Impresora guardada ✓', 'success');
}

function olvidarImpresora() {
  if (_impresoraPuerto) { try { _impresoraPuerto.close(); } catch (e) {} _impresoraPuerto = null; }
  settings.impresora = Object.assign(impresoraCfg(), { modo: 'navegador', nombre: '' });
  localStorage.setItem('bodega_settings', JSON.stringify(settings));
  actualizarSelectorImpresora();
  showToast('Impresora directa quitada — se vuelve a usar el navegador', 'success');
}

// ---------------------------------------
// Ticket ya dibujado (HTML) → comandos ESC/POS
// ---------------------------------------
const _ACENTOS = { 'á':'a','é':'e','í':'i','ó':'o','ú':'u','Á':'A','É':'E','Í':'I','Ó':'O','Ú':'U','ñ':'n','Ñ':'N','¿':'?','¡':'!','°':'o','º':'o' };
function _sinAcentos(t) { return String(t == null ? '' : t).replace(/[áéíóúÁÉÍÓÚñÑ¿¡°º]/g, c => _ACENTOS[c] || c); }

function _pad(a, b, ancho) {
  a = _sinAcentos(a); b = _sinAcentos(b);
  if (a.length + b.length >= ancho) return (a + ' ' + b).slice(0, ancho);
  return a + ' '.repeat(ancho - a.length - b.length) + b;
}

// Recorre el nodo .tk ya renderizado y arma líneas de texto con su alineación y estilo,
// para no depender de reconstruir el ticket desde cero (usa el mismo diseño que ya se ve en pantalla).
// cfg: columnas (caracteres por línea), negritas (todo en negrita) y totNormal (false = total, pagó y vuelto resaltados).
function ticketALineas(nodo, cfg) {
  const ancho = cfg.columnas || 36;
  const lineas = [];
  const push = (t, align, o) => lineas.push(Object.assign({ t: t, align: align || 'L', bold: false, big: false, hl: false }, o || {}));
  const txt = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const resaltar = !cfg.totNormal;

  // Columnas Cant. | Descripción | (Precio) | Importe: cada una del ancho de su texto más largo; la descripción toma el resto
  const cols = nodo.querySelector('.tk-cols');
  const enc = cols ? Array.from(cols.children).map(txt) : [];
  const conPrecio = enc.length >= 4;
  const celda = (el, c) => { const e = el.querySelector(c); return e ? txt(e) : ''; };
  const items = Array.from(nodo.querySelectorAll('.tk-item'));
  const mayor = (min, arr) => Math.max(min, ...arr.map(x => _sinAcentos(x).length));
  const wc = mayor(0, [enc[0] || ''].concat(items.map(e => celda(e, '.tk-c'))));
  const wp = conPrecio ? mayor(0, [enc[2] || ''].concat(items.map(e => celda(e, '.tk-p')))) : 0;
  const wi = mayor(0, [enc[conPrecio ? 3 : 2] || ''].concat(items.map(e => celda(e, '.tk-i'))));
  const dw = Math.max(6, ancho - wc - wi - (conPrecio ? wp + 1 : 0) - 2);
  const pad = (x, n) => x + ' '.repeat(Math.max(0, n - x.length));
  const padL = (x, n) => ' '.repeat(Math.max(0, n - x.length)) + x;
  // parte un texto largo en varias líneas de n caracteres (sin cortar palabras cuando se puede)
  const partir = (t, n) => {
    const out = []; let cur = '';
    _sinAcentos(t).split(' ').forEach(w => {
      while (w.length > n) { if (cur) { out.push(cur); cur = ''; } out.push(w.slice(0, n)); w = w.slice(n); }
      if (!cur) cur = w; else if ((cur + ' ' + w).length <= n) cur += ' ' + w; else { out.push(cur); cur = w; }
    });
    if (cur || !out.length) out.push(cur);
    return out;
  };
  const filaTabla = (c, d, p, i) => partir(d, dw).map((trozo, k) => k
    ? ' '.repeat(wc + 1) + trozo
    : (pad(_sinAcentos(c), wc) + ' ' + pad(trozo, dw) + (conPrecio ? ' ' + padL(_sinAcentos(p), wp) : '') + ' ' + padL(_sinAcentos(i), wi)).slice(0, ancho));

  const clase = el => (el.className && typeof el.className === 'string') ? el.className : '';
  const recorrer = padre => Array.from(padre.children).forEach(el => {
    const cls = clase(el);
    const t = txt(el);
    if (/tk-logo/.test(cls)) return; // el logo no se manda en modo directo (solo texto)
    if (/\btk-(cab|pie|bloque)\b/.test(cls)) { recorrer(el); return; }
    if (/\btk-sep\b/.test(cls)) { push(''); return; }
    if (/\btk-eq\b/.test(cls)) { push('='.repeat(ancho)); return; }
    if (/\btk-nombre\b/.test(cls)) { if (t) push(t, 'C', { bold: true, big: true }); return; }
    if (/\btk-boleta\b/.test(cls)) { if (t) push(t, 'C', { bold: true }); return; }
    if (/\btk-fecha\b/.test(cls)) { if (t) push(t, 'R'); return; }
    if (/\btk-(dato|msg)\b/.test(cls)) { if (t) push(t, 'C'); return; }
    if (/\btk-row\b/.test(cls)) {
      const sp = el.querySelectorAll('span');
      push(_pad(sp[0] ? txt(sp[0]) : '', sp[1] ? txt(sp[1]) : '', ancho));
      return;
    }
    if (/\btk-cols\b/.test(cls)) { filaTabla(enc[0] || '', enc[1] || '', enc[2] || '', enc[conPrecio ? 3 : 2] || '').forEach(l => push(l)); return; }
    if (/\btk-item\b/.test(cls)) {
      filaTabla(celda(el, '.tk-c'), celda(el, '.tk-d'), celda(el, '.tk-p'), celda(el, '.tk-i')).forEach(l => push(l));
      const pr = celda(el, '.tk-pr'); // promoción aplicada: una línea abajo del producto
      if (pr) push((' '.repeat(wc + 1) + _sinAcentos(pr)).slice(0, ancho));
      return;
    }
    if (/\btk-cant\b/.test(cls)) { if (t) push(t, 'L'); return; }
    if (/\btk-total\b/.test(cls)) { if (t) push(t, 'C', { bold: true, hl: resaltar }); return; }   // el total va al centro
    if (/\btk-r\b/.test(cls)) {
      const fiado = /\btk-fiado\b/.test(cls), mini = /\btk-mini\b/.test(cls);
      if (t) push(t, 'R', { bold: fiado, hl: resaltar && !fiado && !mini });
      return;
    }
    if (el.children.length) { recorrer(el); return; }
    if (t) push(t, 'C');
  });
  recorrer(nodo);
  return lineas;
}

// Arma los bytes ESC/POS (init, letra, alineado, negrita, tamaño, texto, corte de papel)
function _escposDeLineas(lineas, cfg) {
  const ESC = 0x1b, GS = 0x1d;
  const bytes = [];
  const push = (...b) => b.forEach(x => bytes.push(x));
  const texto = t => { const s = _sinAcentos(t); for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xff); };

  push(ESC, 0x40); // inicializar impresora
  // Cajón de dinero: casi todas las impresoras térmicas tienen un puerto (RJ11) donde se conecta el
  // cable del cajón. No es un dispositivo aparte para la compu: el pulso que lo abre se manda a través
  // de la propia impresora, por eso solo puede abrirse cuando de verdad se manda a imprimir por USB
  // directo (aquí). Si no hay cajón conectado a ese puerto, este comando simplemente no hace nada.
  if (cfg.cajon !== false) push(ESC, 0x70, 0x00, 0x19, 0xfa);
  // La impresora térmica solo tiene dos letras: la normal (A) y una más pequeña (B, para tamaños de 10 o menos)
  const tam = parseInt(cfg.fuenteTam) || 0;
  push(ESC, 0x4d, tam && tam <= 10 ? 1 : 0);
  for (let i = 0; i < (cfg.espInicio || 0); i++) texto('\n');

  lineas.forEach(L => {
    push(ESC, 0x61, L.align === 'C' ? 1 : L.align === 'R' ? 2 : 0);
    push(ESC, 0x45, (cfg.negritas || L.bold || L.big || L.hl) ? 1 : 0);
    push(GS, 0x21, L.big ? 0x11 : (L.hl ? 0x01 : 0x00)); // 0x11 = doble ancho y alto (nombre); 0x01 = doble alto (totales resaltados)
    texto(L.t);
    texto('\n');
  });

  push(GS, 0x21, 0x00);
  push(ESC, 0x45, 0);
  push(ESC, 0x61, 0);
  for (let i = 0; i < (cfg.espFin != null ? cfg.espFin : 2); i++) texto('\n');
  push(GS, 0x56, 66, 0); // corte parcial de papel (si la impresora no corta, simplemente no hace nada)
  return new Uint8Array(bytes);
}

// Envía el ticket directo a la impresora conectada por USB. Devuelve true si funcionó.
async function imprimirDirecto(nodo, cfg) {
  if (!_impresoraPuerto) {
    const ok = await conectarImpresoraDirecta();
    if (!ok) return false;
  }
  try {
    const lineas = ticketALineas(nodo, cfg);
    const datos = _escposDeLineas(lineas, cfg);
    const writer = _impresoraPuerto.writable.getWriter();
    await writer.write(datos);
    writer.releaseLock();
    return true;
  } catch (e) {
    showToast('No se pudo imprimir directo — se abre el diálogo del navegador', 'error');
    _impresoraPuerto = null;
    return false;
  }
}
