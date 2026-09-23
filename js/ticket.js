// ========================================
// TICKET DE VENTA: diseño, personalización e impresión
// ========================================
// settings.ticket guarda cómo se ve el ticket (Configuración → Ticket).
// ticketHTML() arma el ticket; lo usan la venta real y la vista previa del panel.

const TICKET_DEFECTO = {
  ancho: 80,               // ancho del papel en mm: 58 u 80
  // qué partes del encabezado se muestran
  logo: true, nombre: true, dir: true, contacto: true,   // contacto = teléfono
  correo: false, rus: false, ruc: false,                  // líneas opcionales del encabezado
  // qué datos de la venta se muestran
  fecha: true, numero: true, cajero: true, cliente: true,
  // textos propios del ticket (si no se han editado, usa "Datos del Negocio"):
  //   hNombre, hDir, hTel, hCorreo, hRus, hRuc, hLogo  → undefined = usar los datos del negocio (RUS y RUC parten vacíos)
  hBoleta: 'BOLETA ELECTRÓNICA',   // siempre se imprime debajo del teléfono / RUS
  mensaje: '¡Gracias por su compra!',
  extra: '',
  espInicio: 0, espFin: 2,
  // letra e impresión (Configuración → Ticket → Letra)
  fuente: 'jetbrains',     // tipo de letra, todas monoespaciadas: jetbrains | plex | courier | space
  fuenteTam: null,         // tamaño en px; null = automático (12 en papel de 80 mm, 11 en 58 mm)
  columnas: 36,            // caracteres por línea (solo impresión directa)
  totNormal: true,         // total, pagó y vuelto en tamaño normal (false = resaltados)
  negritas: true           // todo el ticket en negrita
};
// Siempre se imprimen (no se pueden apagar): columnas Cant./Descripción/Importe (y Precio en papel de 80 mm),
// total, pagó y vuelto, y lo que queda a deber si la venta es fiada.
// Cantidad: los productos por unidad muestran solo el número (2); los de peso muestran los kilos (1kg, 0.5kg).
// La forma de pago ya no se imprime; en pagos mixtos sí salen los montos de cada método bajo el total.

// Tipos de letra disponibles (todos monoespaciados para que las columnas queden alineadas).
// Se cargan desde vendor/fuentes (copia local, sin internet) en index.html y en la ventana de impresión.
const TK_FUENTES = {
  jetbrains: { nombre: 'JetBrains', fam: 'JetBrains Mono' },
  plex:      { nombre: 'Plex',      fam: 'IBM Plex Mono' },
  courier:   { nombre: 'Courier',   fam: 'Courier Prime' },
  space:     { nombre: 'Space',     fam: 'Space Mono' }
};
const TK_FUENTES_URL = 'vendor/fuentes/fuentes.css';

// Valor de contenteditable para los textos editables del ticket (solo texto plano, sin formato pegado)
const _TK_CE = (() => {
  try { const d = document.createElement('div'); d.contentEditable = 'plaintext-only'; if (d.contentEditable === 'plaintext-only') return 'plaintext-only'; } catch (e) {}
  return 'true';
})();

// Configuración vigente (completa aunque falten campos en lo guardado)
function ticketCfg() {
  const g = (typeof settings !== 'undefined' && settings.ticket) || {};
  const c = Object.assign({}, TICKET_DEFECTO, g);
  if (!TK_FUENTES[c.fuente]) c.fuente = 'jetbrains';
  if (g.contacto === undefined && g.tel !== undefined) c.contacto = !!g.tel; // diseño anterior
  // las columnas antes se guardaban en Configuración → Impresora
  if (g.columnas === undefined && settings.impresora && settings.impresora.columnas) c.columnas = settings.impresora.columnas;
  // diseño anterior: una sola línea que era teléfono o RUS. Si mostraba RUS, ahora se enciende RUS y se apaga el teléfono
  if (g.rus === undefined && g.hTipo === 'rus') { c.rus = !!c.contacto; c.contacto = false; }
  return c;
}

function tkEsc(t) {
  return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Símbolo de moneda pegado al monto: "S/4.00" (sin punto ni espacio). Solo las monedas escritas con letras (COP, MXN...) llevan espacio.
function tkMoneda() {
  const s = String((typeof moneda === 'function') ? moneda() : 'S/.').replace(/\.$/, '');
  return /[A-Za-z]$/.test(s) ? s + ' ' : s;
}

// Líneas del encabezado que se pueden activar: clave de la casilla, clave del texto, prefijo, ejemplo y largo máximo
const _TK_LINEAS = [
  { k: 'contacto', t: 'tel',    pref: 'TEL.',    ph: '999 123 456',       max: 30 },
  { k: 'correo',   t: 'correo', pref: 'CORREO:', ph: 'bodega@gmail.com',  max: 50 },
  { k: 'rus',      t: 'rus',    pref: 'RUS:',    ph: '10123456789',       max: 30 },
  { k: 'ruc',      t: 'ruc',    pref: 'RUC:',    ph: '20123456789',       max: 30 }
];

// Textos del encabezado: los del ticket si se editaron; si no, los de "Datos del Negocio"
function ticketDatos(cfg, neg, muestra) {
  neg = neg || {};
  const pick = (k, fb) => (cfg[k] !== undefined ? cfg[k] : fb);
  const nombre = pick('hNombre', neg.nombre) || (muestra ? 'Mi Bodega' : '');
  const dir = pick('hDir', neg.dir) || (muestra ? 'Jr. Los Olivos 123, Lima' : '');
  const d = {
    nombre, dir,
    tel: pick('hTel', neg.tel) || '',
    correo: pick('hCorreo', neg.email) || '',
    rus: pick('hRus', '') || '',
    ruc: pick('hRuc', '') || '',
    logo: pick('hLogo', neg.logo) || '',
    boleta: (cfg.hBoleta || '').trim() || TICKET_DEFECTO.hBoleta
  };
  if (muestra) _TK_LINEAS.forEach(L => { d[L.t] = d[L.t] || L.ph; });
  return d;
}

// v: { fecha, hora, numero, items:[{nombre,qty,precio,kg}], total, dado, vuelto, fiado,
//      cliente, vendedor, pagoLabel, pagoDetalle:[{label,monto}] }
// cfg: opciones del ticket. neg: datos del negocio. muestra=true usa textos de ejemplo si faltan datos.
// editable=true (solo la vista previa de Configuración): logo y textos se editan con clic sobre el ticket.
function ticketHTML(v, cfg, neg, muestra, editable) {
  cfg = Object.assign({}, TICKET_DEFECTO, cfg || {});
  const m = tkMoneda();
  const f2 = n => (Number(n) || 0).toFixed(2);
  const fq = n => String(+(Number(n) || 0).toFixed(3)); // cantidades: 2, 0.5, 1.25
  const fila = (a, b, cls) => `<div class="tk-row ${cls || ''}"><span>${a}</span><span>${b}</span></div>`;
  const d = ticketDatos(cfg, neg, muestra && !editable);
  // texto editable con clic (solo en la vista previa)
  const ed = (k, max, ph, txt, cls, tag) => {
    tag = tag || 'div';
    return `<${tag} class="${cls} tk-ed" contenteditable="${_TK_CE}" spellcheck="false" data-k="${k}" data-max="${max}" data-ph="${tkEsc(ph)}">${tkEsc(txt)}</${tag}>`;
  };

  // --- Encabezado ---
  let cab = '';
  if (cfg.logo) {
    if (editable) {
      cab += d.logo
        ? `<div class="tk-logo-wrap"><img class="tk-logo tk-clic" src="${d.logo}" alt="" data-act="logo" title="Clic para cambiar el logo"><button type="button" class="tk-logo-x" data-act="logo-quitar" title="Quitar logo">×</button></div>`
        : `<div class="tk-logo-vacio tk-clic" data-act="logo" title="Clic para agregar tu logo">+ LOGO</div>`;
    } else if (d.logo) cab += `<img class="tk-logo" src="${d.logo}" alt="">`;
    else if (muestra) cab += `<div class="tk-logo-vacio">TU LOGO</div>`;
  }
  if (cfg.nombre && (d.nombre || editable)) cab += editable
    ? ed('nombre', 40, 'Nombre del negocio', d.nombre, 'tk-nombre')
    : `<div class="tk-nombre">${tkEsc(d.nombre)}</div>`;
  if (cfg.dir && (d.dir || editable)) cab += editable
    ? ed('dir', 70, 'Dirección', d.dir, 'tk-dato')
    : `<div class="tk-dato">${tkEsc(d.dir)}</div>`;
  _TK_LINEAS.forEach(L => {
    if (!cfg[L.k]) return;
    if (editable) cab += `<div class="tk-dato">${L.pref} ${ed(L.t, L.max, L.ph, d[L.t], '', 'span')}</div>`;
    else if (d[L.t]) cab += `<div class="tk-dato">${L.pref} ${tkEsc(d[L.t])}</div>`;
  });
  cab += editable
    ? ed('boleta', 40, 'BOLETA ELECTRÓNICA', d.boleta, 'tk-boleta') // siempre
    : `<div class="tk-boleta">${tkEsc(d.boleta)}</div>`;             // siempre

  // --- Datos de la venta: la fecha va sola a la derecha; luego etiqueta a la izquierda y dato a la derecha ---
  let meta = '';
  if (cfg.fecha) meta += `<div class="tk-fecha">${tkEsc(v.fecha)} ${tkEsc(v.hora)}</div>`;
  if (cfg.cajero && v.vendedor) meta += fila('CAJERO:', tkEsc(v.vendedor));
  if (cfg.cliente) meta += fila('CLIENTE:', tkEsc(v.cliente || 'Público General'));
  if (cfg.numero) meta += fila('TICKET:', '#' + tkEsc(v.numero));

  // --- Productos: Cant. | Descripción | Precio | Importe (siempre) ---
  // Cant.: por unidad va el número (2); por peso van los kilos (1kg, 0.5kg).
  // Precio: el de una unidad, o el de un kilo si es por peso. Precio e Importe llevan el símbolo de la moneda elegida.
  // En papel de 58 mm no entra la columna Precio.
  const conPrecio = cfg.ancho != 58;
  const precioU = c => c.kg ? (c.precio * c.qty) / c.kg : (c.precioOrig != null ? c.precioOrig : c.precio);
  const cant = v.items.reduce((a, c) => a + c.qty, 0);
  const filas = v.items.map(c => ({
    c: c.kg ? fq(c.kg) + 'kg' : fq(c.qty),
    d: c.nombre,
    p: `${m}${f2(precioU(c))}`,
    i: `${m}${f2(c.precio * c.qty)}`,
    // si se aplicó una promoción, va abajito del producto: 4 x S/1.00 · 3x2 · 87.1%
    pr: c.promo ? String(c.promo).split((typeof moneda === 'function' ? moneda() : 'S/.') + ' ').join(m) : ''
  }));
  // ancho de cada columna en caracteres (la letra es monoespaciada): lo justo para el monto más largo y el título
  const col = (k, min) => Math.max(min, ...filas.map(f => f[k].length));
  const anchos = `--wc:${col('c', 5)}ch;--wp:${col('p', 6)}ch;--wi:${col('i', 7)}ch`;
  const items = filas.map(f => `
    <div class="tk-item">
      <span class="tk-c">${tkEsc(f.c)}</span>
      <span class="tk-d">${tkEsc(f.d)}</span>
      ${conPrecio ? `<span class="tk-p">${tkEsc(f.p)}</span>` : ''}
      <span class="tk-i">${tkEsc(f.i)}</span>
      ${f.pr ? `<span class="tk-pr">${tkEsc(f.pr)}</span>` : ''}
    </div>`).join('');
  // línea de signos "=" (se recorta al ancho del papel)
  const eq = '<div class="tk-eq" aria-hidden="true"><span>' + '='.repeat(90) + '</span></div>';

  // --- Total y pago (siempre): "ETIQUETA: MONTO". El total va al centro; pagó y vuelto, a la derecha ---
  const der = (a, b, cls) => `<div class="tk-r ${cls || ''}">${a}: ${b}</div>`;
  let pago = '';
  (v.pagoDetalle || []).forEach(x => { pago += der(tkEsc(x.label), `${m}${f2(x.monto)}`, 'tk-mini'); });
  pago += der('PAGÓ', `${m}${f2(v.dado)}`);
  pago += der('VUELTO', `${m}${f2(v.vuelto)}`);
  if (v.fiado > 0) pago += der('QUEDA A DEBER', `${m}${f2(v.fiado)}`, 'tk-fiado');
  if (v.referencia) pago += `<div class="tk-r tk-mini">REF: ${tkEsc(v.referencia)}</div>`;
  if (v.notaVenta) pago += `<div class="tk-r tk-mini">NOTA: ${tkEsc(v.notaVenta)}</div>`;

  const extra = editable
    ? ed('extra', 200, 'Líneas adicionales (opcional)', cfg.extra || '', 'tk-dato tk-extra')
    : String(cfg.extra || '').split('\n').map(x => x.trim()).filter(Boolean)
        .map(x => `<div class="tk-dato">${tkEsc(x)}</div>`).join('');
  const msg = editable
    ? ed('mensaje', 60, 'Mensaje de despedida', cfg.mensaje || '', 'tk-msg')
    : (cfg.mensaje ? `<div class="tk-msg">${tkEsc(cfg.mensaje)}</div>` : '');
  const sp = n => n > 0 ? `<div style="height:${(n * 1.4).toFixed(1)}em"></div>` : '';

  const fam = TK_FUENTES[cfg.fuente] ? cfg.fuente : 'jetbrains';
  const tam = Math.min(20, Math.max(8, parseInt(cfg.fuenteTam) || 0));
  const estilo = anchos + (parseInt(cfg.fuenteTam) ? `;font-size:${tam}px` : '');
  const clases = `tk tk-${cfg.ancho == 58 ? 58 : 80} tk-f-${fam}${cfg.negritas ? ' tk-neg' : ''}${cfg.totNormal ? ' tk-tot-n' : ''}${editable ? ' tk-editable' : ''}`;

  return `<div class="${clases}" data-ancho="${cfg.ancho == 58 ? 58 : 80}" style="${estilo}">
    ${sp(cfg.espInicio)}
    <div class="tk-cab">${cab}</div>
    <div class="tk-sep"></div><div class="tk-bloque">${meta}</div>
    <div class="tk-sep"></div>
    <div class="tk-cols"><span>CANT.</span><span>DESCRIPCIÓN</span>${conPrecio ? '<span>PRECIO</span>' : ''}<span>IMPORTE</span></div>
    ${eq}
    <div class="tk-bloque">${items}</div>
    ${eq}
    <div class="tk-cant">N° DE ARTÍCULOS: ${fq(cant)}</div>
    ${der('TOTAL', `${m}${f2(v.total)}`, 'tk-total')}
    <div class="tk-bloque">${pago}</div>
    <div class="tk-sep"></div>
    <div class="tk-pie">
      ${msg}
      ${extra}
    </div>
    ${sp(cfg.espFin)}
  </div>`;
}

// Ticket de ejemplo para la vista previa y la prueba de impresión
function ticketEjemplo(cfg, editable) {
  const items = [
    { nombre: 'Arroz Costeño 1kg', qty: 2, precio: 4.5 },      // por unidad: la cantidad va en número
    { nombre: 'Tomate', qty: 1, precio: 2, kg: 0.5 }           // por peso: la cantidad va en kilos; precio = importe de lo pesado
  ];
  const total = items.reduce((a, c) => a + c.qty * c.precio, 0);
  const now = new Date();
  return ticketHTML({
    fecha: now.toLocaleDateString('es-PE'),
    hora: now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    numero: '0128', items, total, dado: 20, vuelto: 20 - total, fiado: 0,
    cliente: 'Público General',
    vendedor: (typeof currentUser !== 'undefined' && currentUser && currentUser.nombre) || 'Admin',
    pagoLabel: 'Efectivo', pagoDetalle: []
  }, cfg, (settings && settings.negocio) || {}, true, editable);
}

// --- Impresión: solo el ticket, con el ancho de papel elegido ---
// Si en Configuración → Impresora de Tickets se conectó una impresora térmica (modo "directa"),
// se manda en crudo por USB (ESC/POS) y no aparece ningún diálogo ni vista previa de PDF.
// Si no, se usa el diálogo normal del navegador (como antes).
function imprimirTicketHTML(html, ancho, cfgTk) {
  const cfgImp = (typeof impresoraCfg === 'function') ? impresoraCfg() : { modo: 'navegador' };
  if (cfgImp.modo === 'directa') {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const nodo = tmp.querySelector('.tk') || tmp;
    const ck = cfgTk || ticketCfg();
    imprimirDirecto(nodo, Object.assign({}, cfgImp, {
      espInicio: ck.espInicio || 0,
      espFin: ck.espFin != null ? ck.espFin : 2,
      columnas: ck.columnas,
      negritas: !!ck.negritas,
      totNormal: !!ck.totNormal,
      fuenteTam: ck.fuenteTam
    }))
      .then(ok => { if (!ok) _imprimirTicketPorNavegador(html, ancho); });
    return;
  }
  _imprimirTicketPorNavegador(html, ancho);
}

function _imprimirTicketPorNavegador(html, ancho) {
  const viejo = document.getElementById('tkPrintFrame');
  if (viejo) viejo.remove();
  const f = document.createElement('iframe');
  f.id = 'tkPrintFrame';
  const fam = ((html.match(/tk-f-(\w+)/) || [])[1]);
  const famCss = (TK_FUENTES[fam] || TK_FUENTES.jetbrains).fam;
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(f);
  const d = f.contentWindow.document;
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${location.href}">
    <link rel="stylesheet" href="${TK_FUENTES_URL}">
    <link rel="stylesheet" href="css/ticket.css">
    <style>@page{size:${ancho}mm auto;margin:0}html,body{margin:0;background:#fff}
    /* ancho 100%: toma el área que la impresora realmente puede imprimir (los 80 mm completos no caben y Chrome achicaba todo) */
    .tk{box-shadow:none!important;margin:0!important;width:100%!important;max-width:none!important;padding:1mm 1.5mm 4mm!important}.tk::after{display:none!important}</style>
    </head><body>${html}</body></html>`);
  d.close();
  let listo = false;
  const imprimir = () => {
    if (listo) return; listo = true;
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} }, 60);
  };
  // Espera a que carguen los estilos y el tipo de letra elegido (sin esto la impresión salía con la letra de respaldo)
  const links = Array.from(d.querySelectorAll('link'));
  let pend = links.length;
  const fuenteLista = () => {
    try { Promise.all([d.fonts.load(`400 12px "${famCss}"`), d.fonts.load(`700 12px "${famCss}"`)]).then(imprimir, imprimir); }
    catch (e) { imprimir(); }
  };
  const uno = () => { if (--pend <= 0) fuenteLista(); };
  links.forEach(l => { l.onload = uno; l.onerror = uno; });
  setTimeout(imprimir, 2500); // tope: si no hay internet, imprime igual con la letra de respaldo
}

// Botón "Imprimir" de la ventana de venta registrada
function imprimirTicket() {
  const t = document.querySelector('#ticketContent .tk');
  if (!t) return;
  imprimirTicketHTML(t.outerHTML, t.dataset.ancho || 80);
}

// ========================================
// PANEL DE CONFIGURACIÓN → TICKET
// ========================================
const _TK_CHECKS = ['logo', 'nombre', 'dir', 'contacto', 'correo', 'rus', 'ruc', 'fecha', 'numero', 'cajero', 'cliente', 'negritas', 'totNormal'];
const _tkTamAuto = ancho => (ancho == 58 ? 11 : 12); // tamaño de letra cuando no se ha elegido uno

// Estado del panel que no vive en un <input>: el logo y los textos que se editan
// directamente sobre el ticket de la vista previa.
let _tkLogo = '';
let _tkTxt = { nombre: '', dir: '', tel: '', correo: '', rus: '', ruc: '', boleta: '', mensaje: '', extra: '' };

// Lo que hay en pantalla ahora mismo (aunque no se haya guardado)
function tkCfgLeer() {
  const c = Object.assign({}, TICKET_DEFECTO);
  _TK_CHECKS.forEach(k => { const e = document.getElementById('tk-' + k); if (e) c[k] = e.checked; });
  const on = document.querySelector('#tk-ancho .tk-seg-btn.on');
  c.ancho = on ? parseInt(on.dataset.v) : 80;
  const t = id => { const e = document.getElementById(id); return e ? e.value : ''; };
  // letra: tipo, tamaño (vacío = automático) y columnas
  const fb = document.querySelector('#tk-fuente .tk-seg-btn.on');
  c.fuente = (fb && TK_FUENTES[fb.dataset.v]) ? fb.dataset.v : 'jetbrains';
  const te = document.getElementById('tk-tam');
  c.fuenteTam = (te && te.dataset.auto === '0') ? Math.min(20, Math.max(8, parseInt(te.value) || _tkTamAuto(c.ancho))) : null;
  c.columnas = Math.min(64, Math.max(24, parseInt(t('tk-col')) || 36));
  // textos del ticket (se editan sobre la vista previa)
  c.hNombre = _tkTxt.nombre.trim();
  c.hDir = _tkTxt.dir.trim();
  c.hTel = _tkTxt.tel.trim();
  c.hCorreo = _tkTxt.correo.trim();
  c.hRus = _tkTxt.rus.trim();
  c.hRuc = _tkTxt.ruc.trim();
  c.hLogo = _tkLogo;
  c.hBoleta = _tkTxt.boleta.trim() || TICKET_DEFECTO.hBoleta;
  c.mensaje = _tkTxt.mensaje.trim();
  c.extra = _tkTxt.extra;
  // Espacio en blanco: ya no hay casillas en pantalla, se conserva lo guardado (por defecto 0 al inicio y 2 al final)
  const guardado = (typeof ticketCfg === 'function') ? ticketCfg() : TICKET_DEFECTO;
  const n = (id, prev) => document.getElementById(id) ? Math.min(10, Math.max(0, parseInt(t(id)) || 0)) : prev;
  c.espInicio = n('tk-esp-inicio', guardado.espInicio || 0);
  c.espFin = n('tk-esp-fin', guardado.espFin != null ? guardado.espFin : 2);
  return c;
}

// Pone en pantalla lo guardado. Lo que nunca se editó en el ticket parte de "Datos del Negocio".
function tkCfgCargar(base) {
  const c = base || ticketCfg();
  const neg = (typeof settings !== 'undefined' && settings.negocio) || {};
  _TK_CHECKS.forEach(k => { const e = document.getElementById('tk-' + k); if (e) e.checked = !!c[k]; });
  document.querySelectorAll('#tk-ancho .tk-seg-btn').forEach(b => b.classList.toggle('on', parseInt(b.dataset.v) === (c.ancho == 58 ? 58 : 80)));
  const s = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  const o = (k, fb) => (c[k] !== undefined ? c[k] : (fb || ''));
  _tkTxt = {
    nombre: o('hNombre', neg.nombre),
    dir: o('hDir', neg.dir),
    tel: o('hTel', neg.tel),
    correo: o('hCorreo', neg.email),
    rus: o('hRus', ''),
    ruc: o('hRuc', ''),
    boleta: c.hBoleta || TICKET_DEFECTO.hBoleta,
    mensaje: c.mensaje || '',
    extra: c.extra || ''
  };
  _tkLogo = o('hLogo', neg.logo);
  s('tk-esp-inicio', c.espInicio); s('tk-esp-fin', c.espFin);
  const fam = TK_FUENTES[c.fuente] ? c.fuente : 'jetbrains';
  document.querySelectorAll('#tk-fuente .tk-seg-btn').forEach(b => b.classList.toggle('on', b.dataset.v === fam));
  const te = document.getElementById('tk-tam');
  if (te) { te.dataset.auto = c.fuenteTam ? '0' : '1'; te.value = c.fuenteTam || _tkTamAuto(c.ancho); }
  s('tk-col', c.columnas || 36);
  // Columnas solo sirve al imprimir directo por USB: en los demás modos se oculta
  const cw = document.getElementById('tk-col-wrap');
  if (cw) cw.style.display = (typeof impresoraCfg === 'function' && impresoraCfg().modo === 'directa') ? '' : 'none';
  tkPreviewActualizar();
}

// --- Logo del ticket (se reduce para que no pese) ---
function tkLeerLogo(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, 720 / img.width, 320 / img.height); // se ve a todo el ancho del ticket: más resolución
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(img.width * r));
      cv.height = Math.max(1, Math.round(img.height * r));
      const cx = cv.getContext('2d');
      cx.fillStyle = '#fff';               // el papel es blanco: los fondos transparentes quedan blancos
      cx.fillRect(0, 0, cv.width, cv.height);
      cx.drawImage(img, 0, 0, cv.width, cv.height);
      _tkLogo = cv.toDataURL('image/jpeg', 0.9);
      tkPreviewActualizar();
    };
    img.onerror = () => showToast('No se pudo leer esa imagen', 'error');
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  input.value = '';
}
function tkQuitarLogo() {
  _tkLogo = '';
  tkPreviewActualizar();
}

// --- Edición directa sobre el ticket de la vista previa ---
// Los textos son contenteditable: al escribir solo se actualiza el estado (_tkTxt),
// sin volver a dibujar el ticket, para no perder el cursor.
function tkEditarInit() {
  const box = document.getElementById('tk-preview');
  if (!box || box.dataset.ed) return;
  box.dataset.ed = '1';
  const campo = e => (e.target && e.target.closest) ? e.target.closest('[data-k]') : null;
  // textContent conserva las mayúsculas/minúsculas tal como se escribieron (innerText aplicaría el CSS en mayúsculas).
  // Solo en navegadores sin "plaintext-only" el salto de línea de las líneas adicionales necesita innerText.
  const limpio = el => ((el.dataset.k === 'extra' && _TK_CE !== 'plaintext-only') ? el.innerText : el.textContent).replace(/\u00a0/g, ' ');
  const selLen = () => String(window.getSelection()).length;

  box.addEventListener('input', e => {
    const el = campo(e); if (!el) return;
    const k = el.dataset.k, txt = limpio(el);
    if (k === 'extra') _tkTxt.extra = txt;
    else _tkTxt[k] = txt.replace(/\n/g, ' ');
  });
  box.addEventListener('keydown', e => {
    const el = campo(e); if (!el) return;
    if (e.key === 'Enter' && el.dataset.k !== 'extra') { e.preventDefault(); el.blur(); }
  });
  // respeta el largo máximo de cada texto
  box.addEventListener('beforeinput', e => {
    const el = campo(e); if (!el || e.inputType !== 'insertText') return;
    const max = parseInt(el.dataset.max) || 0;
    if (max && limpio(el).length - selLen() >= max) e.preventDefault();
  });
  box.addEventListener('paste', e => {
    const el = campo(e); if (!el) return;
    e.preventDefault();
    let txt = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (el.dataset.k !== 'extra') txt = txt.replace(/\s*\n\s*/g, ' ');
    const max = parseInt(el.dataset.max) || 0;
    if (max) txt = txt.slice(0, Math.max(0, max - (limpio(el).length - selLen())));
    if (txt) document.execCommand('insertText', false, txt);
  });
  box.addEventListener('click', e => {
    const a = (e.target && e.target.closest) ? e.target.closest('[data-act]') : null;
    if (!a) return;
    if (a.dataset.act === 'logo') { const f = document.getElementById('tk-logo-input'); if (f) f.click(); }
    else if (a.dataset.act === 'logo-quitar') { e.stopPropagation(); tkQuitarLogo(); }
  });
}

function tkPreviewActualizar() {
  const box = document.getElementById('tk-preview');
  if (!box) return;
  tkEditarInit();
  box.innerHTML = ticketEjemplo(tkCfgLeer(), true);
  tkAjustarPreview();
}

// Si el ticket no cabe en el alto disponible, se reduce para verlo completo (sin barra de desplazamiento)
function tkAjustarPreview() {
  const box = document.getElementById('tk-preview');
  const tk = box && box.querySelector('.tk');
  if (!tk || box.offsetParent === null) return;
  tk.style.zoom = '';
  const disp = parseFloat(getComputedStyle(box).maxHeight) - 20;
  if (disp > 0 && tk.offsetHeight > disp) tk.style.zoom = Math.max(0.55, disp / tk.offsetHeight).toFixed(3);
}
window.addEventListener('resize', () => { if (document.getElementById('tk-preview')) tkAjustarPreview(); });

function tkAncho(btn) {
  document.querySelectorAll('#tk-ancho .tk-seg-btn').forEach(b => b.classList.toggle('on', b === btn));
  const te = document.getElementById('tk-tam');
  if (te && te.dataset.auto !== '0') te.value = _tkTamAuto(parseInt(btn.dataset.v)); // el tamaño automático sigue al papel
  tkPreviewActualizar();
}

function tkFuente(btn) {
  document.querySelectorAll('#tk-fuente .tk-seg-btn').forEach(b => b.classList.toggle('on', b === btn));
  tkPreviewActualizar();
}

function tkStep(id, d, min, max) {
  const e = document.getElementById(id);
  if (!e) return;
  if (min === undefined) { min = 0; max = 10; }
  if (id === 'tk-tam') e.dataset.auto = '0';
  e.value = Math.min(max, Math.max(min, (parseInt(e.value) || 0) + d));
  tkPreviewActualizar();
}

// Avisos (toast) del panel Ticket: salen siempre en este panel al guardar, imprimir o reiniciar el diseño,
// aunque el interruptor general de "Mensajes Toast (Avisos)" esté apagado.
function _tkAviso(msg, tipo) {
  if (typeof _showToastSiempre === 'function') _showToastSiempre(msg, tipo || 'success');
  else showToast(msg, tipo || 'success');
}

function guardarTicket() {
  try {
    settings.ticket = tkCfgLeer();
    localStorage.setItem('bodega_settings', JSON.stringify(settings));
    if (typeof sbSyncDebounced === 'function') sbSyncDebounced();
    _tkAviso('Ticket guardado ✓', 'success');
  } catch (e) {
    _tkAviso('No se pudo guardar el ticket', 'error');
  }
}

function restablecerTicket() {
  if (!confirm('¿Volver el ticket a su diseño original? (se guarda al presionar Guardar)')) return;
  tkCfgCargar(TICKET_DEFECTO);
  _tkAviso('Diseño original cargado — presiona Guardar para confirmar', 'success');
}

function probarTicket() {
  // Si el panel Ticket está abierto se prueba lo que hay en pantalla; desde otro panel (Impresora), lo guardado
  const enPanel = typeof _cfgPanelActivo !== 'undefined' && _cfgPanelActivo === 'cfg-ticket';
  const cfg = enPanel ? tkCfgLeer() : ticketCfg();
  _tkAviso('Enviando ticket de prueba a imprimir…', 'success');
  imprimirTicketHTML(ticketEjemplo(cfg), cfg.ancho, cfg);
}
