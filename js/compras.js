// ========================================
// COMPRAS
//   Sugeridas · Lista de compras · Órdenes · Proveedores · Histórico
//
// Datos (se guardan junto al resto en guardarTodoEnLocalStorage):
//   proveedores   [{id, empresa, ruc, contacto, tel, email, notas, img}]
//   ordenesCompra [{id, numero, proveedorId, proveedor, fecha, notas, estado, items, total, ...}]
//                 estado: 'pendiente' | 'recibida' | 'cancelada'
//                 item:   {prodId, nombre, cant, factor, costo}
//                         cant × factor = unidades que entran al stock, costo = precio por presentación
//                         tipo (opcional): 'unid' | 'paq' | 'media' (1/2 docena) | 'doc'
//   listaCompras  [{id, prodId, nombre, cant}]
//   producto.proveedor = nombre del proveedor que lo surte (texto, como ya usaba la app)
// ========================================

const CP_TABS = [
  { id: 'compra', icon: 'fa-cart-shopping',     label: 'Comprar' },
  { id: 'ord',   icon: 'fa-file-invoice',      label: 'Órdenes' },
  { id: 'prov',  icon: 'fa-truck',             label: 'Proveedores' },
  { id: 'hist',  icon: 'fa-clock-rotate-left', label: 'Histórico' }
];

let _cTab = 'compra';
const _cF = {
  sug:  { q: '', cat: '', prov: '' },
  ord:  { estado: 'pendiente', q: '' },
  prov: { q: '' },
  hist: { desde: '', hasta: '', prov: '', q: '' }
};
const _cSel = new Set();   // productos marcados en Sugeridas
const _cQty = {};          // cantidades editadas en la tabla de Comprar
const _cCosto = {};        // precio (por presentación) editado en la tabla de Comprar
const _cTipo = {};         // presentación elegida en la tabla de Comprar: {t:'unid'|'paq'|'media'|'doc', f: unidades por paquete}
const CP_TIPOS = { unid: ['Unid.', 1], paq: ['Paq.', 0], media: ['1/2 Doc.', 6], doc: ['Doc.', 12] };
let _cGrupos = [];         // grupos visibles en Lista de compras
let _cUlt = 0;

// ---------- Utilidades ----------
function cEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function cVal(v) { return (v && v !== '—') ? String(v) : ''; }
function cNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function cFmt(n) { return String(+(+n || 0).toFixed(2)); }
function cMon(n) { return moneda() + ' ' + (+n || 0).toFixed(2); }
function cHoyISO() { return new Date().toLocaleDateString('en-CA'); }
function cId(id) { return document.getElementById(id); }
function cNuevoId() { _cUlt = Math.max(Date.now(), _cUlt + 1); return _cUlt; }
function cGuardar() { guardarTodoEnLocalStorage(); }
function cProvPorNombre(n) { return proveedores.find(p => p.empresa === n); }
function cProd(id) { return productos.find(p => p.id === id); }
function cFecha(iso) {
  if (!iso) return '—';
  const m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const [y, mo, d] = String(iso).split('-');
  return `${+d} ${m[+mo - 1]} ${y}`;
}
function cMin(p) {
  if (p.stockMin != null && p.stockMin !== '' && !isNaN(+p.stockMin)) return +p.stockMin;
  return (settings.alertas && settings.alertas.minStock) || 3;
}
function cAvatar(nombre, img) {
  if (!nombre) return '<span class="cp-av free"><i class="fa fa-basket-shopping"></i></span>';
  if (img) return `<img class="cp-av" src="${cEsc(img)}" alt="">`;
  const h = [...String(nombre)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const ini = String(nombre).trim().split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
  return `<span class="cp-av" style="background:hsl(${h},70%,92%);color:hsl(${h},60%,30%);">${cEsc(ini)}</span>`;
}
function cVacio(icono, titulo, texto) {
  return `<div class="cp-empty"><i class="fa ${icono}"></i><b>${titulo}</b><p>${texto}</p></div>`;
}
function cNumOrden(o) { return 'OC-' + String(o.numero || 0).padStart(4, '0'); }
function cSiguienteNumero() { return ordenesCompra.reduce((m, o) => Math.max(m, +o.numero || 0), 0) + 1; }
function cTotalItems(items) { return items.reduce((a, i) => a + cNum(i.cant) * cNum(i.costo), 0); }
function cItemDesdeProd(p, cant) { return { prodId: p.id, nombre: p.nombre, cant: cant, factor: 1, costo: +(p.costo || 0) }; }
function cOpcionesProv(sel, vacio) {
  let h = `<option value="">${vacio}</option>`;
  const nombres = proveedores.map(p => p.empresa);
  if (sel && !nombres.includes(sel)) nombres.push(sel);
  nombres.sort((a, b) => a.localeCompare(b)).forEach(n => { h += `<option value="${cEsc(n)}"${n === sel ? ' selected' : ''}>${cEsc(n)}</option>`; });
  return h;
}
function cRefrescarStock() {
  try {
    renderProdTable(); renderProdGrid(); renderPOSProducts();
    updateStockBajoCount(); actualizarNotificaciones();
    if (typeof actualizarDashboardReal === 'function') actualizarDashboardReal();
  } catch (e) { console.warn('Compras: no se pudo refrescar la vista', e); }
}

// Envía un mensaje por WhatsApp (si hay teléfono) o lo copia
function cEnviar(tel, msg) {
  const d = String(tel || '').replace(/\D/g, '');
  if (d.length >= 8) { window.open('https://wa.me/' + (d.length === 9 ? '51' + d : d) + '?text=' + encodeURIComponent(msg), '_blank'); return; }
  const ok = () => showToast('Mensaje copiado. Pégalo en WhatsApp', 'success');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(msg).then(ok, () => prompt('Copia el mensaje:', msg));
  else prompt('Copia el mensaje:', msg);
}
function cMsgPedido(nombreProv, items) {
  const l = items.map(i => `• ${cFmt(i.cant)} x ${i.nombre}${i.factor > 1 ? ` (${cFmt(i.factor)} unid. c/u)` : ''}`).join('\n');
  return `Hola${nombreProv ? ' ' + nombreProv : ''}, quisiera hacer este pedido:\n\n${l}\n\nGracias.`;
}

// ---------- Migración: pedidos antiguos guardados dentro de cada proveedor ----------
function cMigrarPedidosViejos() {
  let cambio = false;
  proveedores.forEach(p => {
    if (!Array.isArray(p.pedidos) || !p.pedidos.length) return;
    p.pedidos.forEach(ped => {
      if (ped.estado === 'pagado' || !ped.items || !ped.items.length || ordenesCompra.some(o => o.id === ped.id)) return;
      const f = String(ped.fecha || '').split('/');
      const fecha = f.length === 3 ? `${f[2]}-${f[1].padStart(2, '0')}-${f[0].padStart(2, '0')}` : cHoyISO();
      const items = ped.items.map(i => ({
        prodId: i.prodId, nombre: i.nombre, cant: i.qty || 1,
        factor: i.tipo === 'docena' ? 12 : i.tipo === 'media_docena' ? 6 : 1,
        costo: (i.qty > 0 ? (i.precioTotal || i.precio || 0) / i.qty : 0)
      }));
      ordenesCompra.push({ id: ped.id, numero: cSiguienteNumero(), proveedorId: p.id, proveedor: p.empresa, fecha, notas: '', estado: 'pendiente', items, total: cTotalItems(items) });
    });
    p.pedidos = [];
    cambio = true;
  });
  if (cambio) cGuardar();
}

// ---------- Ritmo de venta (unidades por día, últimos 30 días) ----------
let _cRC = null;
function cRitmo() {
  const hoy = cHoyISO();
  if (_cRC && _cRC.n === ventasHistorial.length && _cRC.d === hoy) return _cRC.m;
  const d0 = new Date(); d0.setDate(d0.getDate() - 29);
  const desde = d0.toLocaleDateString('en-CA');
  const m = {}; let primera = hoy;
  ventasHistorial.forEach(v => {
    if (v.esPagoPedidoProv || !v.fechaISO || v.fechaISO < desde) return;
    if (v.fechaISO < primera) primera = v.fechaISO;
    const filas = (v.productos && v.productos.length) ? v.productos.map(i => [i.nombre, i.qty]) : (v.items || []).map(i => [i.nombre, i.cant]);
    filas.forEach(([n, q]) => { const k = String(n || '').trim().toLowerCase(); m[k] = (m[k] || 0) + (+q || 0); });
  });
  const dias = Math.min(30, Math.max(7, Math.round((new Date(hoy) - new Date(primera)) / 86400000) + 1));
  Object.keys(m).forEach(k => { m[k] = m[k] / dias; });
  _cRC = { n: ventasHistorial.length, d: hoy, m };
  return m;
}

// Productos que conviene reponer: bajo su mínimo o que, por su ritmo de venta, se agotan en ≤ 3 días
function cSugeridos() {
  const rit = cRitmo(), out = [];
  productos.forEach(p => {
    const stock = +p.stock || 0, min = cMin(p);
    const rate = rit[String(p.nombre || '').trim().toLowerCase()] || 0;
    const dias = rate > 0 ? stock / rate : Infinity;
    const bajo = stock <= min;
    if (!bajo && !(rate > 0 && dias <= 3)) return;
    const objetivo = Math.max(min * 2, Math.ceil(rate * 14), 1);   // alcanzar ~2 semanas de venta
    out.push({ p, stock, min, rate, dias, estado: stock <= 0 ? 'agotado' : bajo ? 'bajo' : 'pronto', sug: Math.max(1, Math.ceil(objetivo - stock)) });
  });
  const o = { agotado: 0, bajo: 1, pronto: 2 };
  return out.sort((a, b) => o[a.estado] - o[b.estado] || a.dias - b.dias || String(a.p.nombre).localeCompare(String(b.p.nombre)));
}

// ========================================
// PÁGINA: pestañas y panel
// ========================================
function renderCompras() {
  cMigrarPedidosViejos();
  if (!cId('cpTabs')) return;
  cRefrescarTabs();
  cRenderPanel();
}

function cRefrescarTabs() {
  const c = {
    compra: listaCompras.length,
    ord: ordenesCompra.filter(o => o.estado === 'pendiente').length,
    prov: proveedores.length
  };
  cId('cpTabs').innerHTML = CP_TABS.map(t =>
    `<button class="cp-tab${t.id === _cTab ? ' on' : ''}" onclick="cIrTab('${t.id}')"><i class="fa ${t.icon}"></i><span>${t.label}</span>` +
    (c[t.id] != null ? `<b class="cp-count${c[t.id] === 0 ? ' zero' : ''}">${c[t.id]}</b>` : '') + `</button>`).join('');
  const on = document.querySelector('#cpTabs .cp-tab.on');   // en el celular, deja visible la pestaña activa
  if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function cIrTab(id) { _cTab = id; cRefrescarTabs(); cRenderPanel(); }

function cRenderPanel() {
  cId('cpFoot').innerHTML = '';
  const panel = cId('cpPanel');
  if (panel) panel.classList.toggle('cp-flat', _cTab === 'compra');
  ({ compra: cPanelCompra, ord: cPanelOrd, prov: cPanelProv, hist: cPanelHist })[_cTab]();
}

// ========================================
// 1) COMPRAR — tabla de productos (derecha) + lista de compras (izquierda)
// ========================================
function cListaAgregar(prodId, cant, costo, factor, tipo) {
  const p = cProd(prodId);
  factor = factor > 0 ? factor : 1; tipo = tipo || 'unid';
  const ex = listaCompras.find(x => x.prodId === prodId);
  if (ex) {
    if ((ex.factor || 1) === factor) ex.cant = cNum(ex.cant) + cant; else ex.cant = cant;   // otra presentación: no se suman peras con manzanas
    ex.factor = factor; ex.tipo = tipo;
    if (costo != null) ex.costo = costo;
  }
  else listaCompras.push({ id: cNuevoId(), prodId, nombre: p ? p.nombre : '', cant, factor, tipo, costo: costo != null ? costo : (p ? (+p.costo || 0) * factor : 0) });
}
function cItCosto(f) { return f.it.costo != null ? cNum(f.it.costo) : (f.p ? +f.p.costo || 0 : 0); }

function cBuscarProductos(q, prefProv) {
  q = q.trim().toLowerCase(); if (!q) return [];
  return productos.filter(p => String(p.nombre || '').toLowerCase().includes(q) || String(p.codigo || '').toLowerCase().includes(q))
    .sort((a, b) => (prefProv ? (b.proveedor === prefProv) - (a.proveedor === prefProv) : 0) || String(a.nombre).localeCompare(String(b.nombre))).slice(0, 8);
}
function cDdHtml(res, fn) {
  if (!res.length) return '<div class="cp-dd-empty">Sin resultados</div>';
  return res.map(p => `<div class="cp-dd-item" onmousedown="${fn}(${p.id})"><b>${cEsc(p.nombre)}</b><span>Stock ${cFmt(p.stock || 0)}${p.proveedor ? ' · ' + cEsc(p.proveedor) : ''}</span></div>`).join('');
}

function cPanelCompra() {
  const f = _cF.sug;
  const cats = [...new Set([...(categorias || []), ...productos.map(p => p.cat).filter(Boolean)])].sort((a, b) => String(a).localeCompare(String(b)));
  cId('cpToolbar').innerHTML = '';
  cId('cpBody').innerHTML = `<div class="cp-compra">
    <div class="cp-ctbl">
      <div class="cp-ct-toolbar">
        <div class="cp-search" style="max-width:320px;"><i class="fa fa-magnifying-glass"></i><input type="text" placeholder="Buscar producto o código..." value="${cEsc(f.q)}" oninput="_cF.sug.q=this.value;cCompraTablaRender()"></div>
        <select class="cp-select" onchange="_cF.sug.cat=this.value;cCompraTablaRender()"><option value="">Todas las categorías</option>${cats.map(c => `<option value="${cEsc(c)}"${c === f.cat ? ' selected' : ''}>${cEsc(c)}</option>`).join('')}</select>
      </div>
      <div class="cp-ct-head"><span>Producto</span><span>Stock</span><span>Costo</span><span>Precio</span><span>Cant.</span><span>Tipo</span><span></span></div>
      <div class="cp-ct-rows" id="cpCtRows"></div>
    </div>
    <aside class="cp-cl" id="cpCl"></aside>
  </div>`;
  cCompraListaRender();
  cCompraTablaRender();
}

// ---- Tabla de productos (derecha) ----
function cCompraFuente() {
  const f = _cF.sug, q = f.q.trim().toLowerCase();
  const sugMap = {}; cSugeridos().forEach(s => { sugMap[s.p.id] = s; });
  let base = productos.filter(p => {
    if (f.cat && (p.cat || '') !== f.cat) return false;
    if (q && !(String(p.nombre || '').toLowerCase().includes(q) || String(p.codigo || '').toLowerCase().includes(q))) return false;
    return true;
  });
  if (!q && !f.cat) base = base.filter(p => sugMap[p.id]);   // sin filtros: solo lo sugerido, para no abrumar
  const orden = { agotado: 0, bajo: 1, pronto: 2 };
  return base.map(p => sugMap[p.id] || { p, stock: +p.stock || 0, min: cMin(p), rate: 0, dias: Infinity, estado: null, sug: 1 })
    .sort((a, b) => {
      const ea = a.estado ? orden[a.estado] : 3, eb = b.estado ? orden[b.estado] : 3;
      return ea - eb || (a.estado && b.estado ? a.dias - b.dias : 0) || String(a.p.nombre).localeCompare(String(b.p.nombre));
    });
}
function cCompraQtyDe(s) { return _cQty[s.p.id] !== undefined ? _cQty[s.p.id] : s.sug; }

function cCompraTablaRender() {
  const rows = cId('cpCtRows'); if (!rows) return;
  const lista = cCompraFuente();
  rows.innerHTML = !lista.length
    ? cVacio('fa-magnifying-glass', 'Sin resultados', 'Prueba con otra búsqueda o quita los filtros. Todo lo demás está en orden.')
    : lista.map(cCompraFila).join('');
}

function cCompraFila(s) {
  const p = s.p, id = p.id;
  const chip = s.estado === 'agotado' ? ['red', 'Agotado'] : s.estado === 'bajo' ? ['orange', 'Bajo mínimo'] : s.estado === 'pronto' ? ['yellow', 'Se agota pronto'] : null;
  const img = p.img ? `<img src="${cEsc(p.img)}" alt="">` : '<i class="fa fa-image"></i>';
  const costoAnt = +p.costo || 0;
  const tp = cTipoDe(id);
  const costoVal = _cCosto[id] !== undefined ? _cCosto[id] : '';
  return `<div class="cp-ct-row" id="cpCr_${id}">
    <div class="cp-prod"><div class="cp-thumb">${img}</div><div class="cp-prod-t"><b>${cEsc(p.nombre)}</b><span>${chip ? `<em class="cp-chip ${chip[0]}">${chip[1]}</em>` : ''}${p.codigo ? cEsc(p.codigo) : ''}</span></div></div>
    <span class="cp-ct-stock${chip ? ' ' + chip[0] : ''}">${cFmt(s.stock)}</span>
    <span class="cp-ct-costo-ant" title="Costo con el que está registrado ahora">${costoAnt > 0 ? cMon(costoAnt) : '—'}</span>
    <div class="cp-ct-costo">
      <input type="number" min="0" step="0.01" value="${costoVal === '' ? '' : cFmt(costoVal)}" placeholder="0.00" id="cpCc_${id}" onchange="cCompraCosto(${id},this.value)" title="Precio de lo que estás comprando: si es Unidad, el precio de una; si es Paquete/Docena/1&#47;2 Docena, el precio de todo el paquete/docena. Tú lo escribes, no se calcula solo.">
    </div>
    <input class="cp-qty sm" type="number" min="1" step="1" value="${cCompraQtyDe(s)}" id="cpCq_${id}" onchange="cCompraQty(${id},this.value)">
    <div class="cp-ct-tipo">
      <select class="cp-select sm" onchange="cCompraTipo(${id},this.value)" title="Cómo te lo venden">${Object.keys(CP_TIPOS).map(k => `<option value="${k}"${k === tp.t ? ' selected' : ''}>${CP_TIPOS[k][0]}</option>`).join('')}</select>
      <input class="cp-qty sm cp-ct-fac" type="number" min="1" step="1" placeholder="unid." id="cpCf_${id}" value="${tp.t === 'paq' ? cEsc(tp.f) : ''}" style="${tp.t === 'paq' ? '' : 'display:none;'}" oninput="cCompraFactor(${id},this.value)" title="Unidades que trae cada paquete">
    </div>
    <button class="cp-ct-add" title="Añadir a la lista de compras" onclick="cCompraAgregar(${id})"><i class="fa fa-plus"></i></button>
  </div>`;
}
function cTipoDe(id) { return _cTipo[id] || { t: 'unid', f: '' }; }
function cFactorDe(id) {
  const t = cTipoDe(id);
  return t.t === 'paq' ? Math.max(0, Math.floor(cNum(t.f))) : CP_TIPOS[t.t][1];
}
// El precio nunca se calcula solo: ella lo escribe a mano (depende del tipo elegido — ver arriba).
function cCompraTipo(id, t) {
  _cTipo[id] = { t, f: cTipoDe(id).f };
  const w = cId('cpCf_' + id);
  if (w) { w.style.display = t === 'paq' ? '' : 'none'; if (t === 'paq') w.focus(); }
}
function cCompraFactor(id, v) { _cTipo[id] = { t: 'paq', f: v }; }
function cCompraQty(id, v) { _cQty[id] = Math.max(1, Math.ceil(cNum(v)) || 1); }
function cCompraCosto(id, v) { _cCosto[id] = Math.max(0, cNum(v)); }
function cCompraProv(id, v) {
  const p = cProd(id); if (!p) return;
  p.proveedor = v; cGuardar(); cCompraTablaRender();
}
function cCompraAgregar(id) {
  const p = cProd(id); if (!p) return;
  const qi = cId('cpCq_' + id), ci = cId('cpCc_' + id);
  const cant = Math.max(1, Math.ceil(cNum(qi ? qi.value : 1)) || 1);
  const tipo = cTipoDe(id).t, factor = cFactorDe(id);
  if (tipo === 'paq' && factor < 1) {
    showToast('Indica cuántas unidades trae el paquete', 'error');
    const w = cId('cpCf_' + id); if (w) w.focus();
    return;
  }
  if (!ci || ci.value === '') {
    showToast('Escribe el precio antes de añadir', 'error');
    if (ci) ci.focus();
    return;
  }
  const costo = Math.max(0, cNum(ci.value));
  cListaAgregar(id, cant, costo, factor || 1, tipo);
  delete _cQty[id]; delete _cCosto[id];
  cGuardar(); cRefrescarTabs(); cCompraListaRender();
  const row = cId('cpCr_' + id);
  if (row) { row.classList.add('added'); setTimeout(() => row.classList.remove('added'), 500); }
}

// ---- Lista de compras (izquierda) ----
function cCompraListaRender() {
  const col = cId('cpCl'); if (!col) return;
  if (!listaCompras.length) {
    col.innerHTML = `<div class="cp-cl-head"><b><i class="fa fa-list-check"></i> Lista de compras</b></div>
      <div class="cp-cl-body">${cVacio('fa-basket-shopping', 'Tu lista está vacía', 'Busca un producto en la tabla y presiona + para añadirlo aquí.')}</div>`;
    return;
  }
  const g = {};
  listaCompras.forEach(it => { const p = cProd(it.prodId); const k = (p && p.proveedor) || ''; (g[k] = g[k] || []).push({ it, p }); });
  _cGrupos = Object.keys(g).sort((a, b) => !a ? 1 : !b ? -1 : a.localeCompare(b)).map(k => ({ prov: k, filas: g[k] }));
  const totalGeneral = _cGrupos.reduce((a, gr) => a + gr.filas.reduce((s, f) => s + cNum(f.it.cant) * cItCosto(f), 0), 0);
  const multi = _cGrupos.length > 1;
  col.innerHTML = `
    <div class="cp-cl-head"><b><i class="fa fa-list-check"></i> Lista de compras</b><span>${listaCompras.length} producto${listaCompras.length !== 1 ? 's' : ''}</span><button class="cp-cl-clear" onclick="cListaVaciar()" title="Vaciar lista"><i class="fa fa-broom"></i></button></div>
    <div class="cp-cl-body">${_cGrupos.map((gr, gi) => {
      return `<section class="cp-group">
        ${(gr.prov || multi) ? `<header><span class="cp-group-name">${gr.prov ? cEsc(gr.prov) : ''}</span>
          ${multi ? `<div class="cp-group-a"><div class="icon-btn" title="Enviar por WhatsApp" onclick="cListaWA(${gi})"><i class="fa-brands fa-whatsapp"></i></div><div class="icon-btn" title="Crear orden" onclick="cListaOrden(${gi})"><i class="fa fa-file-invoice"></i></div></div>` : ''}</header>` : ''}
        ${gr.filas.map(f => `<div class="cp-lrow">
          <div class="cp-lname"><b>${cEsc(f.p ? f.p.nombre : f.it.nombre)}</b><small>${f.p ? 'Stock ' + cFmt(f.p.stock || 0) : 'Producto eliminado'}${cItCosto(f) > 0 ? ' · ' + cMon(cItCosto(f)) + (cNum(f.it.factor) > 1 ? ' por ' + CP_TIPOS[f.it.tipo || 'paq'][0].toLowerCase() + ' (' + cFmt(f.it.factor) + ' unid.)' : ' c/u') : ''}</small></div>
          <div class="cp-step"><button onclick="cListaCant(${f.it.id},-1)"><i class="fa fa-minus"></i></button><input type="number" min="1" value="${cFmt(f.it.cant)}" onchange="cListaCantVal(${f.it.id},this.value)"><button onclick="cListaCant(${f.it.id},1)"><i class="fa fa-plus"></i></button></div>
          <div class="icon-btn del" title="Quitar de la lista" onclick="cListaQuitar(${f.it.id})"><i class="fa fa-xmark"></i></div>
          <input type="text" class="cp-lnota" placeholder="Agregar nota (ej: promoción 3x1, viene con regalo...)" value="${cEsc(f.it.nota || '')}" onchange="cListaNota(${f.it.id},this.value)"></div>`).join('')}
      </section>`;
    }).join('')}</div>
    <div class="cp-cl-foot">
      <div class="cp-cl-total"><span>Total estimado</span><b>${cMon(totalGeneral)}</b></div>
      <button class="btn btn-primary cp-cl-btn" onclick="cCompraCrearOrden()"><i class="fa fa-file-invoice"></i> ${multi ? 'Crear órdenes' : 'Crear orden'}</button>
    </div>`;
}

// ---------- Modal: Asignar proveedor (búsqueda + creación rápida, estilo POS) ----------
let _cApProdId = null;

function cAbrirAsignarProv(prodId) {
  const p = cProd(prodId); if (!p) return;
  _cApProdId = prodId;
  cId('cpApProd').innerHTML = `Producto: <b>${cEsc(p.nombre)}</b>`;
  cId('cpApBuscar').value = '';
  cAsignarProvRenderLista(proveedores.slice().sort((a, b) => a.empresa.localeCompare(b.empresa)), '');
  openModal('modalAsignarProv');
  setTimeout(() => cId('cpApBuscar').focus(), 50);
}

function cAsignarProvBuscar(q) {
  q = q.trim();
  const ql = q.toLowerCase();
  const lista = !ql ? proveedores.slice() : proveedores.filter(p => p.empresa.toLowerCase().includes(ql));
  cAsignarProvRenderLista(lista.sort((a, b) => a.empresa.localeCompare(b.empresa)), q);
}

function cAsignarProvRenderLista(lista, q) {
  const cont = cId('cpApLista');
  if (lista.length) {
    cont.innerHTML = lista.map(p => `<div class="cp-ap-row" onclick="cAsignarProvElegir(${p.id})">${cAvatar(p.empresa, p.img)}
      <div class="cp-ap-row-t"><b>${cEsc(p.empresa)}</b><small>${cVal(p.contacto) || cVal(p.tel) || 'Sin datos adicionales'}</small></div></div>`).join('');
    return;
  }
  if (q) {
    cont.innerHTML = `<div class="cp-ap-row nuevo" onclick="cAsignarProvNuevo('${q.replace(/'/g, "\\'")}')"><i class="fa fa-plus"></i>
      <div class="cp-ap-row-t"><b>Agregar proveedor "${cEsc(q)}"</b><small>No tienes ningún proveedor con ese nombre</small></div></div>`;
    return;
  }
  cont.innerHTML = cVacio('fa-truck', 'Aún no tienes proveedores', 'Escribe un nombre arriba para crear el primero.');
}

function cAsignarProvAsignar(nombreProv, mensaje) {
  const p = cProd(_cApProdId); if (!p) return;
  p.proveedor = nombreProv;
  cGuardar(); closeModal('modalAsignarProv');
  try { renderProdTable(); renderProdGrid(); } catch (e) { }
  cCompraListaRender(); cRefrescarTabs();
  showToast(mensaje, 'success');
}

function cAsignarProvElegir(id) {
  const p = proveedores.find(x => x.id === id); if (!p) return;
  cAsignarProvAsignar(p.empresa, 'Proveedor asignado');
}

function cAsignarProvNuevo(nombre) {
  nombre = nombre.trim(); if (!nombre) return;
  if (proveedores.some(p => p.empresa.trim().toLowerCase() === nombre.toLowerCase())) return cAsignarProvElegir(proveedores.find(p => p.empresa.trim().toLowerCase() === nombre.toLowerCase()).id);
  const p = { id: cNuevoId(), empresa: nombre, ruc: '', contacto: '', tel: '', email: '', notas: '', emoji: '🏭', img: '', pedidos: [], fechaCreacion: new Date().toISOString() };
  proveedores.push(p);
  cAsignarProvAsignar(nombre, 'Proveedor creado y asignado');
}
function cListaCant(id, d) { const it = listaCompras.find(x => x.id === id); if (!it) return; it.cant = Math.max(1, cNum(it.cant) + d); cGuardar(); cCompraListaRender(); }
function cListaCantVal(id, v) { const it = listaCompras.find(x => x.id === id); if (!it) return; it.cant = Math.max(1, cNum(v) || 1); cGuardar(); cCompraListaRender(); }
function cListaNota(id, v) { const it = listaCompras.find(x => x.id === id); if (!it) return; it.nota = v.trim(); cGuardar(); }
function cListaQuitar(id) { listaCompras = listaCompras.filter(x => x.id !== id); cGuardar(); cRefrescarTabs(); cCompraListaRender(); }
function cListaVaciar() {
  if (!listaCompras.length) return;
  if (!cfgConfirm('¿Vaciar toda la lista de compras?')) return;
  listaCompras = []; cGuardar(); cRefrescarTabs(); cCompraListaRender();
}
function cItemsDeGrupo(gr) {
  return gr.filas.map(f => {
    const costo = cItCosto(f);
    return f.p
      ? { prodId: f.p.id, nombre: f.p.nombre, cant: cNum(f.it.cant), factor: cNum(f.it.factor) || 1, tipo: f.it.tipo || 'unid', costo, nota: f.it.nota || '' }
      : { prodId: f.it.prodId, nombre: f.it.nombre, cant: cNum(f.it.cant), factor: cNum(f.it.factor) || 1, tipo: f.it.tipo || 'unid', costo, nota: f.it.nota || '' };
  });
}
function cListaOrden(gi) {
  const gr = _cGrupos[gi]; if (!gr) return;
  cAbrirOrden({ prov: gr.prov, items: cItemsDeGrupo(gr), desdeLista: gr.filas.map(f => f.it.id) });
}
function cListaWA(gi) {
  const gr = _cGrupos[gi]; if (!gr) return;
  const pv = cProvPorNombre(gr.prov);
  cEnviar(pv && pv.tel, cMsgPedido(gr.prov, cItemsDeGrupo(gr)));
}
function cCompraCrearOrden() {
  if (!_cGrupos.length) return;
  if (_cGrupos.length === 1) { cListaOrden(0); return; }
  if (!confirm(`Tu lista tiene productos de ${_cGrupos.length} proveedores distintos.\n\nSe creará una orden por cada proveedor (los que no tienen proveedor van en una orden de compra libre). ¿Continuar?`)) return;
  const grupos = _cGrupos;
  grupos.forEach(gr => cCrearOrden(gr.prov, cItemsDeGrupo(gr)));
  listaCompras = [];
  _cTab = 'ord'; _cF.ord.estado = 'pendiente';
  cGuardar(); renderCompras();
  showToast(`${grupos.length} órdenes creadas`, 'success');
}

// ========================================
// 3) ÓRDENES DE COMPRA
// ========================================
function cCrearOrden(provNombre, items, extra) {
  const pv = cProvPorNombre(provNombre);
  const o = Object.assign({
    id: cNuevoId(), numero: cSiguienteNumero(), proveedorId: pv ? pv.id : null, proveedor: provNombre || '',
    fecha: cHoyISO(), hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    creadoPor: currentUser ? currentUser.nombre : 'Admin',
    notas: '', estado: 'pendiente', items: items.map(i => ({ ...i })), total: cTotalItems(items)
  }, extra || {});
  ordenesCompra.push(o);
  return o;
}

function cPanelOrd() {
  const f = _cF.ord;
  const cuenta = e => ordenesCompra.filter(o => o.estado === e).length;
  const chips = [['pendiente', 'Pendientes'], ['recibida', 'Recibidas'], ['cancelada', 'Canceladas'], ['todas', 'Todas']]
    .map(([k, l]) => `<button class="cp-fchip${f.estado === k ? ' on' : ''}" onclick="_cF.ord.estado='${k}';cPanelOrd()">${l}${k !== 'todas' ? ` <b>${cuenta(k)}</b>` : ''}</button>`).join('');
  cId('cpToolbar').innerHTML = `<div class="cp-fchips">${chips}</div>
    <div class="cp-search"><i class="fa fa-magnifying-glass"></i><input type="text" placeholder="Buscar por N° o proveedor..." value="${cEsc(f.q)}" oninput="_cF.ord.q=this.value;cOrdRender()"></div>`;
  cOrdRender();
}

function cOrdRender() {
  const f = _cF.ord, q = f.q.trim().toLowerCase();
  const lista = ordenesCompra.filter(o => (f.estado === 'todas' || o.estado === f.estado) &&
    (!q || cNumOrden(o).toLowerCase().includes(q) || String(o.proveedor || 'compra libre').toLowerCase().includes(q)))
    .sort((a, b) => b.id - a.id);
  const body = cId('cpBody');
  if (!lista.length) { body.innerHTML = cVacio('fa-file-invoice', 'No hay órdenes aquí', f.estado === 'pendiente' ? 'Crea una desde la pestaña Comprar o con “Nueva orden”.' : 'Prueba con otro filtro.'); return; }
  body.innerHTML = `<div class="cp-list">${lista.map(o => {
    const pv = cProvPorNombre(o.proveedor) || proveedores.find(p => p.id === o.proveedorId);
    const unid = o.items.reduce((a, i) => a + cNum(i.cant) * cNum(i.factor || 1), 0);
    const acc = o.estado === 'pendiente'
      ? `<button class="btn btn-success btn-sm" onclick="cAbrirRecibir(${o.id})"><i class="fa fa-box-open"></i> Recibir</button>
         <div class="icon-btn" title="Editar" onclick="cAbrirOrden({id:${o.id}})"><i class="fa fa-pen"></i></div>
         <div class="icon-btn" title="Enviar, imprimir o guardar" onclick="cOrdMenu(event,${o.id})"><i class="fa fa-share-nodes"></i></div>
         <div class="icon-btn del" title="Cancelar orden" onclick="cOrdCancelar(${o.id})"><i class="fa fa-ban"></i></div>`
      : `<div class="icon-btn" title="Ver detalle" onclick="cAbrirOrden({id:${o.id}})"><i class="fa fa-eye"></i></div>` +
        `<div class="icon-btn" title="Enviar, imprimir o guardar" onclick="cOrdMenu(event,${o.id})"><i class="fa fa-share-nodes"></i></div>` +
        (o.estado === 'cancelada' ? `<div class="icon-btn del" title="Eliminar" onclick="cOrdEliminar(${o.id})"><i class="fa fa-trash"></i></div>` : '');
    return `<div class="cp-ord">
      <div class="cp-ord-num"><b>${cNumOrden(o)}</b><small>${cFecha(o.estado === 'recibida' ? (o.fechaRecepcion || o.fecha) : o.fecha)}${(o.estado === 'recibida' ? (o.horaRecepcion || o.hora) : o.hora) ? ' · ' + cEsc(o.estado === 'recibida' ? (o.horaRecepcion || o.hora) : o.hora) : ''}</small>${o.creadoPor ? `<small class="cp-ord-por" title="Pedido realizado por ${cEsc(o.creadoPor)}"><i class="fa fa-user"></i> ${cEsc(o.creadoPor)}</small>` : ''}</div>
      <div class="cp-ord-prov">${cAvatar(o.proveedor, pv && pv.img)}<div><b>${o.proveedor ? cEsc(o.proveedor) : 'Compra libre'}</b><small>${o.items.length} producto${o.items.length !== 1 ? 's' : ''} · ${cFmt(unid)} unid.</small></div></div>
      <div class="cp-ord-total">${cMon(o.total != null ? o.total : cTotalItems(o.items))}</div>
      <span class="cp-st ${o.estado}">${o.estado === 'pendiente' ? 'Pendiente' : o.estado === 'recibida' ? 'Recibida' : 'Cancelada'}</span>
      <div class="cp-ord-act">${acc}</div></div>`;
  }).join('')}</div>`;
}

function cOrdWA(id) {
  const o = ordenesCompra.find(x => x.id === id); if (!o) return;
  const pv = cProvPorNombre(o.proveedor) || proveedores.find(p => p.id === o.proveedorId);
  cEnviar(pv && pv.tel, cMsgPedido(o.proveedor, o.items));
}
// ---------- Enviar / imprimir / guardar una orden ----------
function cOrdDatos(id) {
  const o = ordenesCompra.find(x => x.id === id); if (!o) return null;
  const pv = cProvPorNombre(o.proveedor) || proveedores.find(p => p.id === o.proveedorId) || null;
  return { o, pv, neg: (settings && settings.negocio) || {} };
}
function cOrdFechaHora(o) { return cFecha(o.fecha) + (o.hora ? ' ' + o.hora : ''); }
function cOrdTexto(id) {
  const d = cOrdDatos(id); if (!d) return '';
  const { o, pv } = d;
  const l = o.items.map(i => `• ${cFmt(i.cant)} x ${i.nombre}${i.factor > 1 ? ` (${cFmt(i.factor)} unid. c/u)` : ''} — ${cMon(i.costo)} c/u = ${cMon(cNum(i.cant) * cNum(i.costo))}${i.nota ? ` [${i.nota}]` : ''}`).join('\n');
  return `ORDEN DE COMPRA ${cNumOrden(o)}\nFecha: ${cOrdFechaHora(o)}${o.creadoPor ? '\nPedido por: ' + o.creadoPor : ''}\nProveedor: ${o.proveedor || 'Compra libre'}\n\n${l}\n\nTOTAL: ${cMon(o.total != null ? o.total : cTotalItems(o.items))}${o.notas ? '\n\nNota: ' + o.notas : ''}\n\nGracias.${d.neg.nombre ? '\n' + d.neg.nombre : ''}`;
}
function cOrdCorreo(id) {
  const d = cOrdDatos(id); if (!d) return;
  const { o, pv } = d;
  const asunto = `Pedido ${cNumOrden(o)}${d.neg.nombre ? ' - ' + d.neg.nombre : ''}`;
  location.href = `mailto:${encodeURIComponent((pv && pv.email) || '')}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cOrdTexto(id))}`;
  if (!(pv && pv.email)) showToast('El proveedor no tiene correo guardado; elige el destinatario en tu correo', 'info');
}
function cOrdHtml(id) {
  const d = cOrdDatos(id); if (!d) return '';
  const { o, pv, neg } = d;
  const fila = i => `<tr><td class="l">${cEsc(i.nombre)}${i.nota ? `<br><small>${cEsc(i.nota)}</small>` : ''}</td><td>${cFmt(i.cant)}</td><td>${cFmt(i.factor || 1)}</td><td>${cMon(i.costo)}</td><td class="r">${cMon(cNum(i.cant) * cNum(i.costo))}</td></tr>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${cNumOrden(o)}</title><style>
    @page{size:A4;margin:16mm}
    body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:13px;margin:0}
    .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px}
    h1{font-size:20px;margin:0}h2{font-size:15px;margin:0;text-align:right}
    .g{color:#666;font-size:12px}.info{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse}th{background:#f0f0f0;font-size:11px;text-transform:uppercase;padding:7px 8px;text-align:center}
    td{padding:7px 8px;border-bottom:1px solid #ddd;text-align:center}td.l,th.l{text-align:left}td.r,th.r{text-align:right}
    small{color:#666}.tot{text-align:right;font-size:16px;font-weight:700;margin-top:14px}
  </style></head><body>
  <div class="top"><div><h1>${cEsc(neg.nombre || 'BodegaPOS')}</h1><div class="g">${[neg.dir, neg.tel, neg.email].filter(Boolean).map(cEsc).join(' · ')}</div></div>
  <div><h2>ORDEN DE COMPRA</h2><h2>${cNumOrden(o)}</h2></div></div>
  <div class="info"><div><span class="g">Fecha:</span> ${cOrdFechaHora(o)}</div><div><span class="g">Proveedor:</span> <b>${cEsc(o.proveedor || 'Compra libre')}</b></div>
  <div><span class="g">Pedido por:</span> ${cEsc(o.creadoPor || '—')}</div><div><span class="g">Contacto:</span> ${cEsc(cVal(pv && pv.tel) || cVal(pv && pv.email) || '—')}</div></div>
  <table><thead><tr><th class="l">Producto</th><th>Cant.</th><th>Unid. c/u</th><th>Costo c/u</th><th class="r">Subtotal</th></tr></thead><tbody>${o.items.map(fila).join('')}</tbody></table>
  <div class="tot">Total: ${cMon(o.total != null ? o.total : cTotalItems(o.items))}</div>
  ${o.notas ? `<p class="g">Nota: ${cEsc(o.notas)}</p>` : ''}
  </body></html>`;
}
function cOrdImprimir(id) {
  const html = cOrdHtml(id); if (!html) return;
  const fr = document.createElement('iframe');
  fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(fr);
  fr.contentDocument.open(); fr.contentDocument.write(html); fr.contentDocument.close();
  setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { showToast('No se pudo abrir la impresión', 'error'); } setTimeout(() => fr.remove(), 2000); }, 300);
}

// PDF sencillo hecho a mano (sin librerías): A4, Helvetica, con varias páginas si hace falta
function cPdfOrden(o, pv, neg) {
  const W = 595, H = 842, M = 40;
  const pages = []; let ops = [], y = M;
  const wid = (t, s, b) => { let w = 0; for (const ch of String(t)) w += /[0-9]/.test(ch) ? .556 : ch === ' ' ? .278 : /[mwMW]/.test(ch) ? .8 : /[.,:;'|!ilj]/.test(ch) ? .26 : /[A-Z]/.test(ch) ? .68 : .52; return w * s * (b ? 1.06 : 1); };
  const enc = t => String(t == null ? '' : t).replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2022]/g, '-').replace(/[^\x20-\x7e\xa1-\xff]/g, '?');
  const esc = t => enc(t).replace(/([\\()])/g, '\\$1');
  const txt = (t, x, yy, s, op) => {
    op = op || {}; const w = wid(enc(t), s, op.b); const px = op.al === 'c' ? x - w / 2 : op.al === 'r' ? x - w : x;
    ops.push(`BT ${op.col || '0 g'} /${op.b ? 'F2' : 'F1'} ${s} Tf ${px.toFixed(1)} ${(H - yy).toFixed(1)} Td (${esc(t)}) Tj ET`);
  };
  const linea = (yy, x1, x2, g, w) => ops.push(`${g || '0.8'} G ${w || 0.5} w ${x1} ${H - yy} m ${x2} ${H - yy} l S`);
  const GRIS = '0.4 g';
  const wrap = (t, maxW, s) => { const out = []; let cur = ''; String(t).split(/\s+/).forEach(pal => { const p = cur ? cur + ' ' + pal : pal; if (wid(enc(p), s) > maxW && cur) { out.push(cur); cur = pal; } else cur = p; }); if (cur) out.push(cur); return out.length ? out : ['']; };
  const cab = () => {
    ops.push(`0.94 g ${M} ${H - y - 20} ${W - 2 * M} 20 re f`);
    txt('PRODUCTO', M + 8, y + 14, 8, { b: 1, col: GRIS }); txt('CANT.', 285, y + 14, 8, { b: 1, col: GRIS, al: 'c' });
    txt('UNID. C/U', 350, y + 14, 8, { b: 1, col: GRIS, al: 'c' }); txt('COSTO C/U', 425, y + 14, 8, { b: 1, col: GRIS, al: 'c' });
    txt('SUBTOTAL', W - M - 8, y + 14, 8, { b: 1, col: GRIS, al: 'r' });
    y += 20;
  };
  txt(neg.nombre || 'BodegaPOS', M, y + 14, 16, { b: 1 });
  txt('ORDEN DE COMPRA', W - M, y + 12, 10, { b: 1, al: 'r', col: GRIS }); txt(cNumOrden(o), W - M, y + 30, 15, { b: 1, al: 'r' });
  const sub = [neg.dir, neg.tel, neg.email].filter(Boolean).join('  |  '); if (sub) txt(sub, M, y + 30, 9, { col: GRIS });
  y += 44; linea(y, M, W - M, '0', 1.2); y += 18;
  const dato = (et, val, x, yy) => { txt(et, x, yy, 9, { col: GRIS }); txt(val, x + 62, yy, 10, { b: 1 }); };
  dato('Fecha:', cOrdFechaHora(o), M, y); dato('Proveedor:', o.proveedor || 'Compra libre', 300, y); y += 16;
  dato('Pedido por:', o.creadoPor || '-', M, y); dato('Contacto:', (pv && (cVal(pv.tel) || cVal(pv.email))) || '-', 300, y); y += 26;
  cab();
  o.items.forEach(i => {
    const nl = wrap(i.nombre, 200, 10), h = nl.length * 13 + (i.nota ? 11 : 0) + 10;
    if (y + h > H - 90) { pages.push(ops.join('\n')); ops = []; y = M; cab(); }
    nl.forEach((l, k) => txt(l, M + 8, y + 15 + k * 13, 10, { b: 1 }));
    if (i.nota) txt(i.nota, M + 8, y + 15 + nl.length * 13 - 1, 8, { col: GRIS });
    const my = y + 15;
    txt(cFmt(i.cant), 285, my, 10, { al: 'c' }); txt(cFmt(i.factor || 1), 350, my, 10, { al: 'c' });
    txt(cMon(i.costo), 425, my, 10, { al: 'c' }); txt(cMon(cNum(i.cant) * cNum(i.costo)), W - M - 8, my, 10, { b: 1, al: 'r' });
    y += h; linea(y, M, W - M, '0.85');
  });
  y += 22;
  if (y > H - 70) { pages.push(ops.join('\n')); ops = []; y = M + 10; }
  txt('TOTAL', 400, y, 10, { b: 1, col: GRIS, al: 'r' }); txt(cMon(o.total != null ? o.total : cTotalItems(o.items)), W - M - 8, y, 15, { b: 1, al: 'r' });
  if (o.notas) { y += 26; wrap('Nota: ' + o.notas, W - 2 * M, 9).forEach((l, k) => txt(l, M, y + k * 12, 9, { col: GRIS })); }
  pages.push(ops.join('\n'));
  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => (5 + i * 2) + ' 0 R').join(' ')}] /Count ${pages.length} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  pages.forEach((c, i) => {
    objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
    objs[6 + i * 2] = `<< /Length ${c.length} >>\nstream\n${c}\nendstream`;
  });
  let out = '%PDF-1.4\n'; const off = [];
  for (let i = 1; i < objs.length; i++) { off[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xr = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + off.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;
  const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return new Blob([bytes], { type: 'application/pdf' });
}
function cOrdGuardarPC(id) {
  const d = cOrdDatos(id); if (!d) return;
  const blob = cPdfOrden(d.o, d.pv, d.neg);
  const nombre = (cNumOrden(d.o) + (d.o.proveedor ? ' - ' + d.o.proveedor : '')).replace(/[\\/:*?"<>|]/g, '') + '.pdf';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  showToast('Orden guardada como PDF', 'success');
}

// Menú flotante de cada orden
function cOrdMenuCerrar() { const m = cId('cpPop'); if (m) m.remove(); }
function cOrdMenu(ev, id) {
  ev.stopPropagation();
  const abierto = cId('cpPop'); cOrdMenuCerrar(); if (abierto && abierto.dataset.id == id) return;
  const r = ev.currentTarget.getBoundingClientRect();
  const m = document.createElement('div'); m.className = 'cp-pop'; m.id = 'cpPop'; m.dataset.id = id;
  m.innerHTML = `<button onclick="cOrdMenuCerrar();cOrdWA(${id})"><i class="fa-brands fa-whatsapp"></i> WhatsApp</button>
    <button onclick="cOrdMenuCerrar();cOrdCorreo(${id})"><i class="fa fa-envelope"></i> Correo</button>
    <button onclick="cOrdMenuCerrar();cOrdImprimir(${id})"><i class="fa fa-print"></i> Imprimir</button>
    <button onclick="cOrdMenuCerrar();cOrdGuardarPC(${id})"><i class="fa fa-download"></i> Guardar en mi PC (PDF)</button>`;
  document.body.appendChild(m);
  const h = m.offsetHeight, w = m.offsetWidth;
  m.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4) + 'px';
  m.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
}
document.addEventListener('click', cOrdMenuCerrar);
window.addEventListener('resize', cOrdMenuCerrar);

function cOrdCancelar(id) {
  const o = ordenesCompra.find(x => x.id === id); if (!o) return;
  if (!cfgConfirm(`¿Cancelar la orden ${cNumOrden(o)}?`)) return;
  o.estado = 'cancelada'; cGuardar(); renderCompras(); showToast('Orden cancelada', 'success');
}
function cOrdEliminar(id) {
  if (!cfgConfirm('¿Eliminar esta orden cancelada?')) return;
  ordenesCompra = ordenesCompra.filter(x => x.id !== id); cGuardar(); renderCompras(); showToast('Orden eliminada', 'success');
}

// ---------- Editor de orden (nueva / editar / ver) ----------
let _cOrd = null;

function cAbrirOrden(o) {
  o = o || {};
  const ord = o.id ? ordenesCompra.find(x => x.id === o.id) : null;
  if (o.id && !ord) return;
  _cOrd = ord
    ? { id: ord.id, ro: ord.estado !== 'pendiente', numero: ord.numero, prov: ord.proveedor || '', fecha: ord.fecha, notas: ord.notas || '', items: ord.items.map(i => ({ ...i })), desdeLista: [], estado: ord.estado }
    : { id: null, ro: false, numero: cSiguienteNumero(), prov: o.prov || '', fecha: cHoyISO(), notas: '', items: (o.items || []).map(i => ({ ...i })), desdeLista: o.desdeLista || [], estado: 'pendiente' };
  const ro = _cOrd.ro;
  cId('cpOrdTitulo').innerHTML = `<i class="fa fa-file-invoice" style="color:var(--accent);margin-right:8px;"></i>${_cOrd.id ? cNumOrden(ord) + (ro ? ' · ' + (ord.estado === 'recibida' ? 'Recibida' : 'Cancelada') : '') : 'Nueva orden de compra'}`;
  cId('cpOrdProvInput').value = _cOrd.prov;
  cId('cpOrdProvInput').disabled = ro;
  cId('cpOrdProvDd').style.display = 'none';
  cId('cpOrdFecha').value = _cOrd.fecha; cId('cpOrdFecha').disabled = ro;
  cId('cpOrdNotas').value = _cOrd.notas; cId('cpOrdNotas').disabled = ro;
  cId('cpOrdGuardar').style.display = ro ? 'none' : '';
  cOrdRenderItems();
  openModal('modalCompOrden');
}

// ---------- Proveedor: buscador con creación rápida (mismo patrón que "Asignar proveedor") ----------
function cOrdProvBuscar(q) {
  const dd = cId('cpOrdProvDd');
  const ql = q.trim().toLowerCase();
  const lista = (!ql ? proveedores.slice() : proveedores.filter(p => p.empresa.toLowerCase().includes(ql))).sort((a, b) => a.empresa.localeCompare(b.empresa));
  const esc = t => t.replace(/'/g, "\\'");
  const exacto = lista.some(p => p.empresa.trim().toLowerCase() === ql);
  let html = lista.map(p => `<div class="cp-dd-item" onmousedown="cOrdProvElegir('${esc(p.empresa)}')"><b>${cEsc(p.empresa)}</b></div>`).join('');
  if (ql && !exacto) html += `<div class="cp-dd-item cp-dd-add" onmousedown="cOrdProvNuevo('${esc(q.trim())}')"><i class="fa fa-plus"></i>Agregar proveedor "${cEsc(q.trim())}"</div>`;
  if (!html) html = '<div class="cp-dd-empty">Aún no tienes proveedores</div>';
  dd.innerHTML = html;
  dd.style.display = 'block';
}
function cOrdProvElegir(nombre) {
  _cOrd.prov = nombre;
  cId('cpOrdProvInput').value = nombre;
  cId('cpOrdProvDd').style.display = 'none';
}
function cOrdProvNuevo(nombre) {
  nombre = nombre.trim(); if (!nombre) return;
  if (!proveedores.some(p => p.empresa.trim().toLowerCase() === nombre.toLowerCase())) {
    proveedores.push({ id: cNuevoId(), empresa: nombre, ruc: '', contacto: '', tel: '', email: '', notas: '', emoji: '🏭', img: '', pedidos: [], fechaCreacion: new Date().toISOString() });
    cGuardar();
  }
  cOrdProvElegir(nombre);
  showToast('Proveedor creado', 'success');
}

// ---------- Ítems: solo lectura (se cargan desde la Lista de compras, ya no se editan aquí) ----------
function cOrdRenderItems() {
  const ro = _cOrd.ro, its = _cOrd.items;
  if (!its.length) { cId('cpOrdItems').innerHTML = cVacio('fa-basket-shopping', 'Sin productos', 'Agrega productos desde la pestaña Comprar y crea la orden desde ahí.'); cOrdTotal(); return; }
  cId('cpOrdItems').innerHTML = `<table class="cp-otbl cp-otbl-ord"><thead><tr><th>Producto</th><th>Notas</th><th>Cant.</th><th title="Unidades que trae cada presentación (caja, docena...)">Unid. c/u</th><th title="Precio de cada presentación">Costo c/u</th><th>Subtotal</th></tr></thead><tbody>
    ${its.map(i => `<tr><td class="n">${cEsc(i.nombre)}</td>
      <td class="nt">${i.nota ? cEsc(i.nota) : '<span class="nt-vacio">—</span>'}</td>
      <td class="q">${cFmt(i.cant)}</td>
      <td><span class="cp-pill">${cFmt(i.factor || 1)}</span></td>
      <td class="m">${cMon(i.costo)}</td>
      <td class="s">${cMon(cNum(i.cant) * cNum(i.costo))}</td></tr>`).join('')}
    </tbody></table>`;
  cOrdTotal();
}
function cOrdTotal() { cId('cpOrdTotal').textContent = cMon(cTotalItems(_cOrd.items)); }
function cOrdQuitar(x) { _cOrd.items.splice(x, 1); cOrdRenderItems(); }

function cOrdGuardar() {
  const items = _cOrd.items.filter(i => cNum(i.cant) > 0);
  if (!items.length) return showToast('La orden no tiene productos', 'error');
  const prov = cId('cpOrdProvInput').value.trim(), fecha = cId('cpOrdFecha').value || cHoyISO(), notas = cId('cpOrdNotas').value.trim();
  if (prov) cOrdProvNuevoSilencioso(prov);
  const pv = cProvPorNombre(prov);
  if (_cOrd.id) {
    const o = ordenesCompra.find(x => x.id === _cOrd.id); if (!o) return;
    Object.assign(o, { proveedor: prov, proveedorId: pv ? pv.id : null, fecha, notas, items, total: cTotalItems(items) });
  } else {
    cCrearOrden(prov, items, { fecha, notas });
    if (_cOrd.desdeLista.length) listaCompras = listaCompras.filter(x => !_cOrd.desdeLista.includes(x.id));
    items.forEach(i => { _cSel.delete(i.prodId); delete _cQty[i.prodId]; });
  }
  cGuardar(); closeModal('modalCompOrden');
  _cTab = 'ord'; _cF.ord.estado = 'pendiente';
  renderCompras(); showToast('Orden guardada', 'success');
}
// Crea el proveedor si escribieron un nombre nuevo sin elegirlo del listado (sin toast, para no duplicar el de Guardar)
function cOrdProvNuevoSilencioso(nombre) {
  if (!proveedores.some(p => p.empresa.trim().toLowerCase() === nombre.toLowerCase())) {
    proveedores.push({ id: cNuevoId(), empresa: nombre, ruc: '', contacto: '', tel: '', email: '', notas: '', emoji: '🏭', img: '', pedidos: [], fechaCreacion: new Date().toISOString() });
  }
}

// ---------- Recibir una orden ----------
let _cRec = null;

function cAbrirRecibir(id) {
  const o = ordenesCompra.find(x => x.id === id); if (!o || o.estado !== 'pendiente') return;
  _cRec = {
    id, metodo: 'efectivo', montoManual: false,
    items: o.items.map(i => {
      const it = { ...i, pedida: i.cant, costoTotal: Math.round(cNum(i.cant) * cNum(i.costo) * 100) / 100 };
      cRecRecalcular(it);
      return it;
    })
  };
  cId('cpRecHead').innerHTML = `${cAvatar(o.proveedor, (cProvPorNombre(o.proveedor) || {}).img)}<div><b>${cNumOrden(o)} · ${o.proveedor ? cEsc(o.proveedor) : 'Compra libre'}</b><small>Confirma lo que llegó y lo que pagaste. El stock se actualiza al confirmar.</small></div>`;
  cId('cpRecCosto').checked = true;
  cRecMetodo('efectivo');
  cRecRender();
  openModal('modalCompRecibir');
}

// Cómo fue pedido: "2 Doc.", "2 Unid.", "2 Paq."...
function cRecEtiquetaOrdenado(i) {
  const t = i.tipo || 'unid';
  const nombre = (CP_TIPOS[t] || CP_TIPOS.unid)[0];
  return `${cFmt(i.pedida)} ${nombre}`;
}

function cRecRender() {
  cId('cpRecItems').innerHTML = `<table class="cp-otbl"><thead><tr><th>Código</th><th style="text-align:left">Producto</th><th>Ordenado</th><th>Recibido</th><th>Costo</th><th>Costo unit.</th><th>Diferencia</th><th>P.Venta</th><th>Importe</th></tr></thead><tbody>
    ${_cRec.items.map((i, x) => {
      const p = cProd(i.prodId);
      return `<tr><td class="m">${p && p.codigo ? cEsc(p.codigo) : '—'}</td>
      <td class="n">${cEsc(i.nombre)}${!p ? ' <em class="cp-chip red">eliminado</em>' : ''}<small class="cp-warn" id="cpRecW_${x}">${cRecAlerta(i)}</small></td>
      <td class="m">${cEsc(cRecEtiquetaOrdenado(i))}</td>
      <td><input type="number" min="0" step="any" value="${cFmt(i.cant)}" oninput="cRecEdit(${x},'cant',this.value)"></td>
      <td><input type="number" min="0" step="0.01" value="${cFmt(i.costoTotal)}" oninput="cRecEdit(${x},'costoTotal',this.value)" title="Lo que pagaste en total por lo que recibiste de este producto"></td>
      <td class="m" id="cpRecCU_${x}" title="Se calcula solo: costo ÷ cantidad recibida">${cMon(i.costoUnit)}</td>
      <td id="cpRecDif_${x}">${cRecDiferencia(i)}</td>
      <td class="m" id="cpRecPV_${x}" title="Se calcula solo, según tu % de ganancia configurado">${cMon(i.precioVenta)}</td>
      <td class="s" id="cpRecSub_${x}">${cMon(i.costoTotal)}</td></tr>`;
    }).join('')}</tbody></table>`;
  cRecTotal();
}
// Recalcula costo unitario, costo por presentación y precio de venta sugerido a partir de lo recibido y el costo total pagado
function cRecRecalcular(i) {
  const p = cProd(i.prodId);
  const baseUnid = cNum(i.cant) * cNum(i.factor || 1);
  i.costoUnit = baseUnid > 0 ? Math.round((cNum(i.costoTotal) / baseUnid) * 100) / 100 : 0;
  i.costo = Math.round(i.costoUnit * cNum(i.factor || 1) * 100) / 100;
  i.precioVenta = cRecPrecioSugerido(i, p);
}
function cRecEdit(x, campo, v) {
  const i = _cRec.items[x]; if (!i) return;
  if (campo === 'costoTotal') i.costoTotal = Math.max(0, cNum(v));
  else i[campo] = Math.max(campo === 'factor' ? 1 : 0, cNum(v));
  cRecRecalcular(i);
  const cu = cId('cpRecCU_' + x); if (cu) cu.textContent = cMon(i.costoUnit);
  const pv = cId('cpRecPV_' + x); if (pv) pv.textContent = cMon(i.precioVenta);
  const s = cId('cpRecSub_' + x); if (s) s.textContent = cMon(i.costoTotal);
  const w = cId('cpRecW_' + x); if (w) w.innerHTML = cRecAlerta(i);
  const d = cId('cpRecDif_' + x); if (d) d.innerHTML = cRecDiferencia(i);
  cRecTotal();
}
// Compara el costo unitario ya registrado del producto contra el nuevo costo unitario, en %
function cRecDiferencia(i) {
  const p = cProd(i.prodId); if (!p) return '—';
  const anterior = +p.costo || 0, nuevo = cNum(i.costoUnit);
  if (anterior <= 0 || Math.abs(nuevo - anterior) < 0.005) return '<span class="cp-rec-dif eq">=</span>';
  const pct = ((nuevo - anterior) / anterior) * 100;
  return `<span class="cp-rec-dif ${pct > 0 ? 'up' : 'down'}"><i class="fa fa-arrow-${pct > 0 ? 'up' : 'down'}"></i> ${Math.abs(pct).toFixed(1)}%</span>`;
}
// Precio de venta sugerido: nuevo costo unitario + el % de ganancia que tiene configurado el producto,
// redondeado igual que en Productos (al décimo más cercano). Si el producto no tiene % configurado,
// se deja el precio de venta que ya tenía.
function cRecPrecioSugerido(i, p) {
  const costo = cNum(i.costoUnit);
  const pct = (p && p.gananciaPct != null && p.gananciaPct !== '') ? +p.gananciaPct : null;
  if (costo <= 0 || pct == null) return p ? (+p.precio || 0) : 0;
  return typeof _redondear10 === 'function' ? _redondear10(costo * (1 + pct / 100)) : Math.round(costo * (1 + pct / 100) * 100) / 100;
}
// Aviso si lo que pagas por unidad iguala o supera el precio al que lo vendes
function cRecAlerta(i) {
  const p = cProd(i.prodId); if (!p) return '';
  const cu = cNum(i.costoUnit);
  return (cu > 0 && (+p.precio || 0) > 0 && cu >= +p.precio)
    ? `<i class="fa fa-triangle-exclamation"></i> Cuesta ${cMon(cu)} c/u y lo vendes a ${cMon(p.precio)}` : '';
}
function cRecTotal() {
  const t = cTotalItems(_cRec.items);
  cId('cpRecTotal').textContent = cMon(t);
  if (!_cRec.montoManual) cId('cpRecMonto').value = t.toFixed(2);
}
function cRecMetodo(m) {
  _cRec.metodo = m;
  document.querySelectorAll('#cpRecMetodo button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  cId('cpRecMontoBox').style.display = m === 'ninguno' ? 'none' : '';
  cRecTotal();
}

function cRecConfirmar() {
  const o = ordenesCompra.find(x => x.id === _cRec.id); if (!o || o.estado !== 'pendiente') return;
  const items = _cRec.items.filter(i => cNum(i.cant) > 0);
  if (!items.length) return showToast('Indica al menos un producto recibido', 'error');
  const total = cTotalItems(items), metodo = _cRec.metodo;
  const monto = metodo === 'ninguno' ? 0 : cNum(cId('cpRecMonto').value);
  if (metodo !== 'ninguno' && monto <= 0) return showToast('Ingresa el monto pagado', 'error');
  const actualizarCosto = cId('cpRecCosto').checked;

  // 1) Stock, costo y precio de venta de los productos
  items.forEach(i => {
    const p = cProd(i.prodId); if (!p) return;
    p.stock = (+p.stock || 0) + cNum(i.cant) * cNum(i.factor || 1);
    if (actualizarCosto && cNum(i.costoUnit) > 0) {
      p.costo = Math.round(cNum(i.costoUnit) * 100) / 100;
      if (cNum(i.precioVenta) > 0) p.precio = Math.round(cNum(i.precioVenta) * 100) / 100;
      p.gananciaPct = (p.costo > 0 && p.precio > 0) ? +(((p.precio - p.costo) / p.costo) * 100).toFixed(2) : 0;
    }
    if (!p.proveedor && o.proveedor) p.proveedor = o.proveedor;   // la próxima vez ya sale con su proveedor
  });

  // 2) La orden
  const ahora = new Date();
  const fechaISO = ahora.toLocaleDateString('en-CA'), fecha = ahora.toLocaleDateString('es-PE');
  const hora = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  const etiqueta = o.proveedor || 'Compra libre';
  o.items = items.map(i => ({ prodId: i.prodId, nombre: i.nombre, cant: cNum(i.cant), cantPedida: i.pedida, factor: cNum(i.factor || 1), costo: cNum(i.costo) }));
  Object.assign(o, { estado: 'recibida', total, fechaRecepcion: fechaISO, horaRecepcion: hora, pago: { metodo, monto } });

  // 3) Salida de dinero: mismo registro que ya leen Reportes y Dashboard
  if (metodo !== 'ninguno') {
    const snap = items.map(i => { const u = cNum(i.cant) * cNum(i.factor || 1); return { nombre: i.nombre, qty: u, tipo: 'unid.', cant: u, precio: 0 }; });
    const nuevoPago = { id: Date.now(), fechaISO, fecha, hora, proveedor: etiqueta, monto, metodo, items: snap };
    const nuevaVenta = { id: Date.now() + 1, fechaISO, fecha, hora, cliente: etiqueta, vendedor: currentUser ? currentUser.nombre : 'Admin', metodoPago: metodo, total: monto, pagado: monto, esPagoPedidoProv: true, items: snap, productos: snap };
    pagosProveedoresHistorial.push(nuevoPago);
    ventasHistorial.push(nuevaVenta);
    if (typeof sbGuardarRegistro === 'function') {
      sbGuardarRegistro('pagosProveedoresHistorial', nuevoPago);
      sbGuardarRegistro('ventasHistorial', nuevaVenta);
    }
  }

  cGuardar(); closeModal('modalCompRecibir');
  cRefrescarStock(); renderCompras();
  showToast(`Orden ${cNumOrden(o)} recibida — stock actualizado ✓`, 'success');
}

// ========================================
// 4) PROVEEDORES
// ========================================
function cPanelProv() {
  cId('cpToolbar').innerHTML = `
    <div class="cp-search"><i class="fa fa-magnifying-glass"></i><input type="text" placeholder="Buscar proveedor..." value="${cEsc(_cF.prov.q)}" oninput="_cF.prov.q=this.value;cProvRender()"></div>
    <button class="btn btn-primary btn-sm" onclick="cAbrirProv()"><i class="fa fa-plus"></i> Nuevo proveedor</button>
    <span class="cp-hint"><i class="fa fa-circle-info"></i> Asigna a cada proveedor los productos que te vende para que las compras salgan ordenadas</span>`;
  cProvRender();
}

function cProvStats(p) {
  const recib = ordenesCompra.filter(o => o.estado === 'recibida' && (o.proveedorId === p.id || o.proveedor === p.empresa));
  return {
    prods: productos.filter(x => x.proveedor === p.empresa).length,
    pend: ordenesCompra.filter(o => o.estado === 'pendiente' && (o.proveedorId === p.id || o.proveedor === p.empresa)).length,
    comprado: recib.reduce((a, o) => a + cNum(o.total), 0),
    ultima: recib.reduce((m, o) => (o.fechaRecepcion || o.fecha) > m ? (o.fechaRecepcion || o.fecha) : m, '')
  };
}

function cProvRender() {
  const q = _cF.prov.q.trim().toLowerCase();
  const lista = proveedores.filter(p => !q || String(p.empresa).toLowerCase().includes(q) || cVal(p.ruc).includes(q) || cVal(p.contacto).toLowerCase().includes(q))
    .sort((a, b) => a.empresa.localeCompare(b.empresa));
  const body = cId('cpBody');
  if (!proveedores.length) { body.innerHTML = cVacio('fa-truck', 'Aún no tienes proveedores', 'Registra a quienes te surten (BEES, DiaDía, Merkao, el mayorista del mercado...).'); return; }
  if (!lista.length) { body.innerHTML = cVacio('fa-magnifying-glass', 'Sin resultados', 'Ningún proveedor coincide con la búsqueda.'); return; }
  body.innerHTML = `<div class="cp-provs">${lista.map(p => {
    const s = cProvStats(p);
    return `<article class="cp-prov">
      <div class="cp-prov-top">${cAvatar(p.empresa, p.img)}<div><b>${cEsc(p.empresa)}</b><small>${cVal(p.contacto) ? cEsc(p.contacto) : 'Sin contacto'}</small></div></div>
      <div class="cp-prov-info">
        ${cVal(p.tel) ? `<span><i class="fa fa-phone"></i>${cEsc(p.tel)}</span>` : ''}${cVal(p.ruc) ? `<span><i class="fa fa-id-card"></i>${cEsc(p.ruc)}</span>` : ''}${cVal(p.email) ? `<span><i class="fa fa-envelope"></i>${cEsc(p.email)}</span>` : ''}
        ${cVal(p.notas) ? `<span class="nota"><i class="fa fa-note-sticky"></i>${cEsc(p.notas)}</span>` : ''}
      </div>
      <div class="cp-prov-stats"><div><b>${s.prods}</b><small>productos</small></div><div><b>${s.pend}</b><small>pendientes</small></div><div><b>${s.comprado > 0 ? cMon(s.comprado) : '—'}</b><small>${s.ultima ? 'últ. ' + cFecha(s.ultima) : 'comprado'}</small></div></div>
      <div class="cp-prov-act"><button class="btn btn-primary btn-sm" onclick="cProvOrden(${p.id})"><i class="fa fa-file-invoice"></i> Pedir</button>
        ${String(p.tel || '').replace(/\D/g, '').length >= 8 ? `<div class="icon-btn" title="Abrir WhatsApp" onclick="cEnviar('${String(p.tel).replace(/\D/g, '')}','')"><i class="fa-brands fa-whatsapp"></i></div>` : ''}
        <div class="icon-btn" title="Editar" onclick="cAbrirProv(${p.id})"><i class="fa fa-pen"></i></div>
        <div class="icon-btn del" title="Eliminar" onclick="cProvEliminar(${p.id})"><i class="fa fa-trash"></i></div></div>
    </article>`;
  }).join('')}</div>`;
}

// Nueva orden para este proveedor, ya con sus productos que están por reponer
function cProvOrden(id) {
  const p = proveedores.find(x => x.id === id); if (!p) return;
  const items = cSugeridos().filter(s => s.p.proveedor === p.empresa).map(s => cItemDesdeProd(s.p, s.sug));
  cAbrirOrden({ prov: p.empresa, items });
}

// ---------- Ficha de proveedor ----------
let _cPv = null;

function cAbrirProv(id) {
  const p = id ? proveedores.find(x => x.id === id) : null;
  _cPv = { id: p ? p.id : null, sel: new Set(p ? productos.filter(x => x.proveedor === p.empresa).map(x => x.id) : []), img: p ? (p.img || '') : '' };
  cId('cpPvTitulo').innerHTML = `<i class="fa fa-truck" style="color:var(--accent);margin-right:8px;"></i>${p ? 'Editar proveedor' : 'Nuevo proveedor'}`;
  cId('cpPvNombre').value = p ? p.empresa : '';
  cId('cpPvRuc').value = p ? cVal(p.ruc) : '';
  cId('cpPvContacto').value = p ? cVal(p.contacto) : '';
  cId('cpPvTel').value = p ? cVal(p.tel) : '';
  cId('cpPvEmail').value = p ? cVal(p.email) : '';
  cId('cpPvNotas').value = p ? (p.notas || '') : '';
  cId('cpPvBuscar').value = '';
  cPvRenderProds();
  openModal('modalCompProv');
}

function cPvRenderProds() {
  const q = cId('cpPvBuscar').value.trim().toLowerCase();
  const propio = _cPv.id ? (proveedores.find(x => x.id === _cPv.id) || {}).empresa : '';
  const todos = productos.filter(p => !q || String(p.nombre || '').toLowerCase().includes(q))
    .sort((a, b) => (_cPv.sel.has(b.id) - _cPv.sel.has(a.id)) || String(a.nombre).localeCompare(String(b.nombre)));
  const vista = todos.slice(0, 150);
  cId('cpPvCount').textContent = `${_cPv.sel.size} seleccionado${_cPv.sel.size !== 1 ? 's' : ''}`;
  cId('cpPvProds').innerHTML = !productos.length ? '<div class="cp-dd-empty">Aún no tienes productos registrados</div>' :
    vista.map(p => `<label class="cp-pv-row"><input type="checkbox" ${_cPv.sel.has(p.id) ? 'checked' : ''} onchange="cPvToggle(${p.id},this.checked)"><span>${cEsc(p.nombre)}</span>${p.proveedor && p.proveedor !== propio ? `<em>de ${cEsc(p.proveedor)}</em>` : ''}</label>`).join('') +
    (todos.length > vista.length ? `<div class="cp-dd-empty">Mostrando ${vista.length} de ${todos.length}. Usa el buscador para encontrar más.</div>` : '');
}
function cPvToggle(id, on) { if (on) _cPv.sel.add(id); else _cPv.sel.delete(id); cId('cpPvCount').textContent = `${_cPv.sel.size} seleccionado${_cPv.sel.size !== 1 ? 's' : ''}`; }

function cPvGuardar() {
  const nombre = cId('cpPvNombre').value.trim();
  if (!nombre) return showToast('Ingresa el nombre del proveedor', 'error');
  if (proveedores.some(p => p.id !== _cPv.id && p.empresa.trim().toLowerCase() === nombre.toLowerCase())) return showToast('Ya tienes un proveedor con ese nombre', 'error');
  const datos = { ruc: cId('cpPvRuc').value.trim(), contacto: cId('cpPvContacto').value.trim(), tel: cId('cpPvTel').value.trim(), email: cId('cpPvEmail').value.trim(), notas: cId('cpPvNotas').value.trim() };
  let p;
  if (_cPv.id) {
    p = proveedores.find(x => x.id === _cPv.id); if (!p) return;
    const viejo = p.empresa;
    p.empresa = nombre;
    if (viejo !== nombre) {
      productos.forEach(x => { if (x.proveedor === viejo) x.proveedor = nombre; });
      ordenesCompra.forEach(o => { if (o.proveedorId === p.id || o.proveedor === viejo) o.proveedor = nombre; });
    }
    Object.assign(p, datos);
  } else {
    p = { id: cNuevoId(), empresa: nombre, emoji: '🏭', img: '', pedidos: [], fechaCreacion: new Date().toISOString(), ...datos };
    proveedores.push(p);
  }
  productos.forEach(x => { if (_cPv.sel.has(x.id)) x.proveedor = nombre; else if (x.proveedor === nombre) x.proveedor = ''; });
  cGuardar(); closeModal('modalCompProv');
  try { renderProdTable(); renderProdGrid(); } catch (e) { }
  renderCompras(); showToast('Proveedor guardado', 'success');
}

function cProvEliminar(id) {
  const p = proveedores.find(x => x.id === id); if (!p) return;
  const pend = ordenesCompra.filter(o => o.estado === 'pendiente' && (o.proveedorId === id || o.proveedor === p.empresa)).length;
  if (!cfgConfirm(`¿Eliminar a ${p.empresa}?` + (pend ? `\n\nTiene ${pend} orden(es) pendiente(s); se conservarán con su nombre.` : '') + '\nSus productos quedarán sin proveedor.')) return;
  productos.forEach(x => { if (x.proveedor === p.empresa) x.proveedor = ''; });
  proveedores = proveedores.filter(x => x.id !== id);
  cGuardar(); renderCompras(); showToast('Proveedor eliminado', 'success');
}

// ========================================
// 5) HISTÓRICO
// ========================================
function cPanelHist() {
  const f = _cF.hist, hoy = new Date();
  if (!f.desde) f.desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toLocaleDateString('en-CA');
  if (!f.hasta) f.hasta = cHoyISO();
  const nombres = [...new Set(ordenesCompra.filter(o => o.estado === 'recibida').map(o => o.proveedor || ''))];
  cId('cpToolbar').innerHTML = `
    <label class="cp-date">Desde <input type="date" value="${f.desde}" onchange="_cF.hist.desde=this.value;cHistRender()"></label>
    <label class="cp-date">Hasta <input type="date" value="${f.hasta}" onchange="_cF.hist.hasta=this.value;cHistRender()"></label>
    <select class="cp-select" onchange="_cF.hist.prov=this.value;cHistRender()"><option value="">Todos los proveedores</option>${nombres.map(n => `<option value="${cEsc(n || '__libre')}"${(n || '__libre') === f.prov ? ' selected' : ''}>${cEsc(n || 'Compra libre')}</option>`).join('')}</select>
    <div class="cp-search"><i class="fa fa-magnifying-glass"></i><input type="text" placeholder="Producto o N° de orden..." value="${cEsc(f.q)}" oninput="_cF.hist.q=this.value;cHistRender()"></div>`;
  cHistRender();
}

function cHistRender() {
  const f = _cF.hist, q = f.q.trim().toLowerCase();
  const lista = ordenesCompra.filter(o => {
    if (o.estado !== 'recibida') return false;
    const d = o.fechaRecepcion || o.fecha;
    if (f.desde && d < f.desde) return false;
    if (f.hasta && d > f.hasta) return false;
    if (f.prov && (o.proveedor || '__libre') !== f.prov) return false;
    if (q && !(cNumOrden(o).toLowerCase().includes(q) || o.items.some(i => String(i.nombre).toLowerCase().includes(q)))) return false;
    return true;
  }).sort((a, b) => ((b.fechaRecepcion || b.fecha) + (b.horaRecepcion || '')).localeCompare((a.fechaRecepcion || a.fecha) + (a.horaRecepcion || '')) || b.id - a.id);
  const body = cId('cpBody');
  if (!lista.length) { body.innerHTML = cVacio('fa-clock-rotate-left', 'Sin compras en este periodo', 'Cuando recibas una orden aparecerá aquí con su detalle.'); return; }
  const total = lista.reduce((a, o) => a + cNum(o.total), 0);
  const porProv = {};
  lista.forEach(o => { const k = o.proveedor || 'Compra libre'; porProv[k] = (porProv[k] || 0) + cNum(o.total); });
  const top = Object.entries(porProv).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const pago = { efectivo: 'Efectivo', yape: 'Yape', ninguno: 'Sin registrar en caja' };
  body.innerHTML = `
    <div class="cp-kpis">
      <div class="cp-kpi"><small>Total comprado</small><b>${cMon(total)}</b></div>
      <div class="cp-kpi"><small>Compras</small><b>${lista.length}</b></div>
      <div class="cp-kpi"><small>Promedio por compra</small><b>${cMon(total / lista.length)}</b></div>
      <div class="cp-kpi wide"><small>Dónde más compras</small>${top.map(([n, v]) => `<div class="cp-bar-row"><span>${cEsc(n)}</span><div><i style="width:${Math.max(4, v / top[0][1] * 100)}%"></i></div><em>${cMon(v)}</em></div>`).join('')}</div>
    </div>
    <div class="cp-hist">${lista.map(o => `<details class="cp-hrow"><summary>
      <span class="d">${cFecha(o.fechaRecepcion || o.fecha)}</span><span class="n">${cNumOrden(o)}</span>
      <span class="p">${o.proveedor ? cEsc(o.proveedor) : 'Compra libre'}</span><span class="c">${o.items.length} producto${o.items.length !== 1 ? 's' : ''}</span>
      <span class="t">${cMon(o.total)}</span><i class="fa fa-chevron-down"></i></summary>
      <div class="cp-hdet"><table class="cp-otbl"><thead><tr><th>Producto</th><th>Cant.</th><th>Unid. c/u</th><th>Costo c/u</th><th>Subtotal</th></tr></thead><tbody>
        ${o.items.map(i => `<tr><td class="n">${cEsc(i.nombre)}</td><td class="m">${cFmt(i.cant)}</td><td class="m">${cFmt(i.factor || 1)}</td><td class="m">${cMon(i.costo)}</td><td class="s">${cMon(cNum(i.cant) * cNum(i.costo))}</td></tr>`).join('')}</tbody></table>
        <p class="cp-note">Pago: ${pago[(o.pago || {}).metodo] || '—'}${o.pago && o.pago.metodo !== 'ninguno' ? ' · ' + cMon(o.pago.monto) : ''}${o.horaRecepcion ? ' · recibida a las ' + o.horaRecepcion : ''}${o.notas ? ' · ' + cEsc(o.notas) : ''}</p></div></details>`).join('')}</div>`;
}
