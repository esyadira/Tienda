// ========================================
// MÉTODOS DE PAGO: efectivo, yape, tarjeta y mixto
// ========================================
// Cada venta guarda metodoPago ('efectivo' | 'yape' | 'tarjeta' | 'mixto').
// Si es mixto, además guarda desglose: { efectivo, yape, tarjeta } (montos netos, sin el vuelto).
// Las ventas antiguas (solo efectivo/yape) siguen funcionando igual.

const METODOS_PAGO = {
  efectivo: { label: 'Efectivo', icon: 'fa-money-bill',    color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  yape:     { label: 'Yape',     icon: 'fa-mobile-screen', color: '#7c3aed', bg: 'rgba(124,58,237,0.15)' },
  tarjeta:  { label: 'Tarjeta',  icon: 'fa-credit-card',   color: '#0ea5e9', bg: 'rgba(14,165,233,0.15)' },
  mixto:    { label: 'Mixto',    icon: 'fa-shuffle',       color: '#f97316', bg: 'rgba(249,115,22,0.15)' }
};

function metodoInfo(m) { return METODOS_PAGO[m] || METODOS_PAGO.efectivo; }

function metodoBadgeHTML(m) {
  if (!m || m === 'efectivo' || !METODOS_PAGO[m]) return '<span class="badge badge-green"><i class="fa fa-money-bill"></i> Efectivo</span>';
  const i = METODOS_PAGO[m];
  return `<span class="badge" style="background:${i.bg};color:${i.color};"><i class="fa ${i.icon}"></i> ${i.label}</span>`;
}

// Color del monto en las tablas (efectivo conserva el acento de siempre)
function metodoColorMonto(m) {
  return (m === 'yape' || m === 'tarjeta' || m === 'mixto') ? METODOS_PAGO[m].color : 'var(--accent)';
}

// Cuánto se cobró realmente por cada método (sin vuelto ni fiado)
function desgloseVenta(v) {
  const d = { efectivo: 0, yape: 0, tarjeta: 0 };
  if (v.metodoPago === 'mixto' && v.desglose) {
    d.efectivo = Number(v.desglose.efectivo) || 0;
    d.yape     = Number(v.desglose.yape) || 0;
    d.tarjeta  = Number(v.desglose.tarjeta) || 0;
    return d;
  }
  const neto = Math.min(v.pagado ?? v.total ?? 0, v.total ?? 0);
  if (v.metodoPago === 'yape') d.yape = neto;
  else if (v.metodoPago === 'tarjeta') d.tarjeta = neto;
  else d.efectivo = neto; // efectivo y ventas antiguas
  return d;
}

// ¿Esta venta pertenece al reporte de ese método?
// (las mixtas aparecen en cada método que usaron)
function esVentaDeMetodo(v, m) {
  if (v.metodoPago === 'mixto') return desgloseVenta(v)[m] > 0;
  if (m === 'efectivo') return v.metodoPago !== 'yape' && v.metodoPago !== 'tarjeta';
  return v.metodoPago === m;
}

// Métodos usados en la venta, para filtros (ej. "efectivo yape")
function componentesVenta(v) {
  if (v.metodoPago === 'mixto') {
    const d = desgloseVenta(v);
    return ['efectivo', 'yape', 'tarjeta'].filter(k => d[k] > 0).join(' ');
  }
  return v.metodoPago || 'efectivo';
}

// Fila (una por venta) para las tablas de Yape / Efectivo cuando el pago fue mixto
function filaMixtoHTML(v, comp) {
  const info = metodoInfo(comp);
  const monto = desgloseVenta(v)[comp];
  const prods = (v.items || v.productos || []).map(p => `${p.nombre} x${p.cant || p.qty || 1}`).join(', ');
  return `<tr style="background:var(--surface);">
    <td style="font-size:12px;color:var(--text3);">${v.fecha || '—'}</td>
    <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text3);">${v.hora || '—'}</td>
    <td style="font-weight:500;">${v.cliente || 'Público General'}</td>
    <td style="font-size:12px;color:var(--text2);">${prods}</td>
    <td>${metodoBadgeHTML('mixto')} <span style="font-size:11px;color:${info.color};font-weight:600;">${info.label}</span></td>
    <td style="text-align:right;"><span style="font-weight:700;color:${info.color};">${moneda()} ${monto.toFixed(2)}</span></td>
    <td style="text-align:center;"><button onclick="eliminarVentaIndividual(${v.id})" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--danger);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;" title="Eliminar"><i class="fa fa-trash"></i></button></td>
  </tr>`;
}

// Monto y etiqueta de una venta en las exportaciones a Excel de Yape / Efectivo
function montoMetodoExport(v, m) { return v.metodoPago === 'mixto' ? desgloseVenta(v)[m] : (v.total || 0); }
function etiquetaMetodoExport(v, m) { return v.metodoPago === 'mixto' ? `Mixto (${metodoInfo(m).label})` : metodoInfo(m).label; }


// ========================================
// FORMAS DE PAGO ACTIVAS (Configuración → Formas de Pago)
// ========================================
// Efectivo siempre está activo. Yape, Tarjeta y Mixto se pueden apagar desde Configuración.
// El pago Mixto solo tiene sentido si hay al menos otro método además del efectivo.

function pagoActivo(m) {
  if (m === 'efectivo') return true;
  const p = (typeof settings !== 'undefined' && settings.pagos) ? settings.pagos : {};
  const on = k => p[k] !== false; // si no existe la opción, se considera activa
  if (m === 'mixto') return on('mixto') && (on('yape') || on('tarjeta'));
  return on(m);
}

function metodosActivos() {
  return ['efectivo', 'yape', 'tarjeta', 'mixto'].filter(pagoActivo);
}

// Muestra u oculta los botones de método en la pantalla de venta y en la ventana de cobro
function aplicarFormasPago() {
  const visibles = [];
  document.querySelectorAll('.pay-method, .cobro-metodo').forEach(b => {
    const on = pagoActivo(b.dataset.metodo);
    b.style.display = on ? '' : 'none';
    if (b.classList.contains('pay-method')) {
      b.style.gridColumn = '';
      if (on) visibles.push(b);
    }
  });
  // Si queda un número impar de botones, el último ocupa todo el ancho
  if (visibles.length % 2 === 1) visibles[visibles.length - 1].style.gridColumn = '1 / -1';

  // Filas del pago mixto: solo los métodos activos
  const ry = document.getElementById('mixtoRowYape');
  const rt = document.getElementById('mixtoRowTarjeta');
  if (ry) ry.style.display = pagoActivo('yape') ? '' : 'none';
  if (rt) rt.style.display = pagoActivo('tarjeta') ? '' : 'none';

  // Si el método seleccionado se apagó, volver a efectivo
  if (typeof selectedPayMethod !== 'undefined' && !pagoActivo(selectedPayMethod)) selectedPayMethod = 'efectivo';
}

// --- Panel de configuración ---
// Lee cómo están los interruptores (todavía sin guardar)
function cfgPagosLeer() {
  const v = id => { const e = document.getElementById(id); return e ? e.checked : true; };
  return { yape: v('cfg-pago-yape'), tarjeta: v('cfg-pago-tarjeta'), mixto: v('cfg-pago-mixto') };
}

// Actualiza la vista previa y bloquea "Mixto" si no hay con qué combinar el efectivo
function cfgPagosActualizar() {
  const p = cfgPagosLeer();
  const puedeMixto = p.yape || p.tarjeta;
  const chkMixto = document.getElementById('cfg-pago-mixto');
  const wrapMixto = document.getElementById('cfg-pago-mixto-card');
  const aviso = document.getElementById('cfg-pago-mixto-aviso');
  if (chkMixto) chkMixto.disabled = !puedeMixto;
  if (wrapMixto) wrapMixto.style.opacity = puedeMixto ? '1' : '0.5';
  if (aviso) aviso.style.display = puedeMixto ? 'none' : 'block';

  const prev = document.getElementById('cfg-pagos-preview');
  if (!prev) return;
  const activos = ['efectivo', 'yape', 'tarjeta', 'mixto'].filter(m =>
    m === 'efectivo' || (m === 'mixto' ? (p.mixto && puedeMixto) : p[m]));
  prev.innerHTML = activos.map(m => {
    const i = METODOS_PAGO[m];
    return `<span class="cfg-pago-chip" style="--mc:${i.color};--mcbg:${i.bg};"><i class="fa ${i.icon}"></i> ${i.label}</span>`;
  }).join('');
}

function guardarPagos() {
  const p = cfgPagosLeer();
  settings.pagos.yape = p.yape;
  settings.pagos.tarjeta = p.tarjeta;
  settings.pagos.mixto = p.mixto;
  localStorage.setItem('bodega_settings', JSON.stringify(settings));
  if (typeof sbSyncDebounced === 'function') sbSyncDebounced();
  aplicarFormasPago();
  showToast('Formas de pago guardadas ✓', 'success');
}

// ========================================
// TERMINAL DE COBRO CON TARJETA (Izipay / Mercado Pago)
// ========================================
// Guarda en settings.terminal: { activo, proveedor: 'izipay'|'mercadopago', izipay:{}, mercadopago:{} }
let _terminalSeleccion = null;

// Activa/desactiva visualmente el bloque de selección de pasarela
function cfgTerminalToggle(activo) {
  const wrap = document.getElementById('cfg-terminal-wrap');
  if (wrap) {
    wrap.style.opacity = activo ? '1' : '0.45';
    wrap.style.pointerEvents = activo ? 'auto' : 'none';
  }
  actualizarStatusTerminal();
}

// Elige la pasarela activa (solo una a la vez) y muestra su formulario de credenciales
function cfgTerminalElegir(proveedor) {
  _terminalSeleccion = proveedor;
  ['izipay', 'mercadopago'].forEach(p => {
    const card = document.getElementById('cfg-terminal-' + p);
    const badge = document.getElementById('cfg-terminal-' + p + '-badge');
    const form = document.getElementById('cfg-terminal-form-' + p);
    if (card) card.style.borderColor = (p === proveedor) ? 'var(--accent)' : 'transparent';
    if (badge) badge.style.display = (p === proveedor) ? 'inline-flex' : 'none';
    if (form) form.style.display = (p === proveedor) ? 'block' : 'none';
  });
  actualizarStatusTerminal();
}

function actualizarStatusTerminal() {
  const el = document.getElementById('cfg-terminal-status');
  if (!el) return;
  const chk = document.getElementById('cfg-terminal-activo');
  const activo = chk ? chk.checked : false;
  if (!activo) { el.innerHTML = '⚪ Terminal de cobro desactivada.'; return; }
  if (!_terminalSeleccion) { el.innerHTML = '🟡 Elige una pasarela: Izipay o Mercado Pago.'; return; }
  const nombre = _terminalSeleccion === 'izipay' ? 'Izipay' : 'Mercado Pago';
  el.innerHTML = `🟢 Terminal configurada con <strong>${nombre}</strong>. Recuerda pulsar «Guardar Terminal».`;
}

// Rellena el panel con lo que ya está guardado en settings.terminal
function cargarTerminalPanel() {
  const t = settings.terminal || {};
  const chk = document.getElementById('cfg-terminal-activo');
  if (chk) chk.checked = !!t.activo;
  cfgTerminalToggle(!!t.activo);

  _terminalSeleccion = t.proveedor || null;
  ['izipay', 'mercadopago'].forEach(p => {
    const card = document.getElementById('cfg-terminal-' + p);
    const badge = document.getElementById('cfg-terminal-' + p + '-badge');
    const form = document.getElementById('cfg-terminal-form-' + p);
    if (card) card.style.borderColor = 'transparent';
    if (badge) badge.style.display = 'none';
    if (form) form.style.display = 'none';
  });
  if (_terminalSeleccion) cfgTerminalElegir(_terminalSeleccion);

  const safe = (id, val) => { const e = document.getElementById(id); if (e) e.value = val || ''; };
  safe('cfg-izipay-key', t.izipay && t.izipay.key);
  safe('cfg-izipay-secret', t.izipay && t.izipay.secret);
  safe('cfg-izipay-comercio', t.izipay && t.izipay.comercio);
  safe('cfg-mp-token', t.mercadopago && t.mercadopago.token);
  safe('cfg-mp-public', t.mercadopago && t.mercadopago.public);
  safe('cfg-mp-terminal', t.mercadopago && t.mercadopago.terminalId);
  actualizarStatusTerminal();
}

function guardarTerminal() {
  const v = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
  const chk = document.getElementById('cfg-terminal-activo');

  if (chk && chk.checked && !_terminalSeleccion) {
    showToast('Elige Izipay o Mercado Pago antes de guardar', 'error');
    return;
  }

  settings.terminal = settings.terminal || {};
  settings.terminal.activo = chk ? chk.checked : false;
  settings.terminal.proveedor = settings.terminal.activo ? _terminalSeleccion : null;
  settings.terminal.izipay = { key: v('cfg-izipay-key'), secret: v('cfg-izipay-secret'), comercio: v('cfg-izipay-comercio') };
  settings.terminal.mercadopago = { token: v('cfg-mp-token'), public: v('cfg-mp-public'), terminalId: v('cfg-mp-terminal') };

  localStorage.setItem('bodega_settings', JSON.stringify(settings));
  if (typeof sbSyncDebounced === 'function') sbSyncDebounced();
  actualizarStatusTerminal();
  showToast('Terminal de cobro guardada ✓', 'success');
}

function probarTerminal() {
  if (!_terminalSeleccion) { showToast('Elige Izipay o Mercado Pago primero', 'error'); return; }
  const nombre = _terminalSeleccion === 'izipay' ? 'Izipay' : 'Mercado Pago';
  showToast(`Probando conexión con ${nombre}...`, 'success');
  setTimeout(() => {
    showToast(`Credenciales de ${nombre} guardadas. La conexión real con la terminal requiere integrar su API/SDK.`, 'success');
  }, 1000);
}
