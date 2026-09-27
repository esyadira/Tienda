// ========================================
// CORTE — Corte de cajero / Corte del día
// ========================================
// Reutiliza los mismos datos que Caja, Reportes y Clientes:
//  - cajasHistorial / cajaActivaDe()   → Fondo de caja
//  - ventasHistorial + desgloseVenta() → Ventas por método (Efectivo/Yape/Tarjeta) y A Crédito
//  - movimientosCaja                   → Entradas y Salidas (las devoluciones se registran ahí
//                                         como salida con motivo "Devolución · ...", se separan
//                                         para mostrarlas en su propia línea)
//  - devolucionesHistorial             → Detalle de lo devuelto (monto + costo, para Ganancia)
//  - clientes[].pagos                  → Abonos a cuenta / Pagos de Créditos
//
// "Corte de cajero": el turno de HOY del usuario que tiene la sesión abierta.
// "Corte del día": TODO el día (todos los usuarios) — solo para Administrador.

let _corteModo = 'cajero';

function _corteHoyISO() { return new Date().toLocaleDateString('en-CA'); }
function _corteEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function corteEsMismaFecha(obj, fechaISO) {
  if (obj.fechaISO === fechaISO) return true;
  if (obj.fecha) {
    const parts = obj.fecha.split('/');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      return d.toLocaleDateString('en-CA') === fechaISO;
    }
  }
  return false;
}

function corteCostoProducto(nombre) {
  if (typeof repvCostoProducto === 'function') return repvCostoProducto(nombre);
  const p = productos.find(x => (x.nombre || '').toLowerCase() === String(nombre || '').toLowerCase());
  return (p && p.costo > 0) ? p.costo : null;
}

// ========================================
// ENTRADA A LA PÁGINA
// ========================================
function corteEntrando() {
  const esAdmin = !!(currentUser && currentUser.esAdmin);
  const btnDia = document.getElementById('corteBtnDia');
  if (btnDia) btnDia.style.display = esAdmin ? '' : 'none';
  if (!esAdmin) _corteModo = 'cajero';

  const inp = document.getElementById('corteFechaInput');
  if (inp) inp.value = _corteHoyISO();

  corteCambiarModo(_corteModo);
}

function corteCambiarModo(modo) {
  const esAdmin = !!(currentUser && currentUser.esAdmin);
  if (modo === 'dia' && !esAdmin) modo = 'cajero';
  _corteModo = modo;

  const btnCajero = document.getElementById('corteBtnCajero');
  const btnDia = document.getElementById('corteBtnDia');
  if (btnCajero) btnCajero.classList.toggle('active', modo === 'cajero');
  if (btnDia) btnDia.classList.toggle('active', modo === 'dia');

  const fechaWrap = document.getElementById('corteFechaWrap');
  if (fechaWrap) fechaWrap.style.display = modo === 'dia' ? 'flex' : 'none';

  renderCorte();
}

function corteGetFecha() {
  if (_corteModo === 'dia') {
    const inp = document.getElementById('corteFechaInput');
    return (inp && inp.value) ? inp.value : _corteHoyISO();
  }
  return _corteHoyISO(); // el corte de cajero siempre es el turno de HOY
}

// ========================================
// ALCANCE DE DATOS (según el modo)
// ========================================
function corteScopeVentas(fecha) {
  const vendedor = currentUser ? currentUser.nombre : null;
  return ventasHistorial.filter(v =>
    !v.esPagoPedidoProv && corteEsMismaFecha(v, fecha) &&
    (_corteModo === 'dia' || v.vendedor === vendedor));
}
function corteScopeMovs(fecha) {
  const usuario = currentUser ? currentUser.nombre : null;
  return movimientosCaja.filter(m =>
    corteEsMismaFecha(m, fecha) && (_corteModo === 'dia' || m.usuario === usuario));
}
function corteScopeDevoluciones(fecha) {
  const usuario = currentUser ? currentUser.nombre : null;
  return devolucionesHistorial.filter(d =>
    corteEsMismaFecha(d, fecha) && (_corteModo === 'dia' || d.usuario === usuario));
}
function corteScopePagos(fecha) {
  const vendedor = currentUser ? currentUser.nombre : null;
  const lista = [];
  clientes.forEach(c => {
    (c.pagos || []).forEach(p => {
      if (!corteEsMismaFecha(p, fecha)) return;
      if (_corteModo !== 'dia' && (p.vendedor || 'Admin') !== vendedor) return;
      lista.push(Object.assign({ cliente: c.nombre }, p));
    });
  });
  return lista;
}

// ========================================
// AYUDAS DE RENDER
// ========================================
function corteListaVacia(msg) { return `<div class="corte-lista-vacio">${msg}</div>`; }

function corteFila(icon, color, titulo, sub, monto, signo) {
  return `<div class="corte-lista-fila">
    <div class="cl-icon" style="background:${color}22;color:${color};"><i class="fa ${icon}"></i></div>
    <div class="cl-info"><strong>${_corteEsc(titulo)}</strong>${sub ? `<small>${_corteEsc(sub)}</small>` : ''}</div>
    <div class="cl-monto" style="color:${color};">${signo || ''}${moneda()} ${(monto || 0).toFixed(2)}</div>
  </div>`;
}

function corteFechaLabel(fechaISO) {
  if (typeof getRepFechaLabel === 'function') return getRepFechaLabel(fechaISO);
  return fechaISO;
}

// ========================================
// RENDER PRINCIPAL
// ========================================
function renderCorte() {
  if (!document.getElementById('corteScopeTitulo')) return;
  const fecha = corteGetFecha();
  const m = moneda();

  // ── Encabezado de alcance ──
  const tituloEl = document.getElementById('corteScopeTitulo');
  const rangoEl = document.getElementById('corteScopeRango');
  const ahoraTxt = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

  if (_corteModo === 'cajero') {
    const nombre = currentUser ? currentUser.nombre : '—';
    tituloEl.textContent = `Corte de cajero — ${nombre}`;
    const apertura = currentUser ? cajaActivaDe(currentUser) : null;
    rangoEl.textContent = `De las ${apertura ? apertura.hora : '—'} a las ${ahoraTxt}`;
  } else {
    tituloEl.textContent = 'Corte del día — Todos los usuarios';
    rangoEl.textContent = fecha === _corteHoyISO()
      ? `${corteFechaLabel(fecha)} · 00:00 a las ${ahoraTxt}`
      : `${corteFechaLabel(fecha)} · Día completo`;
  }

  const ventas = corteScopeVentas(fecha);
  const movs = corteScopeMovs(fecha);
  const devoluciones = corteScopeDevoluciones(fecha);
  const pagos = corteScopePagos(fecha);

  // ── Ventas por método + a crédito ──
  let efectivo = 0, yape = 0, tarjeta = 0, credito = 0;
  ventas.forEach(v => {
    const d = desgloseVenta(v);
    efectivo += d.efectivo; yape += d.yape; tarjeta += d.tarjeta;
    const pagado = Math.min(v.pagado ?? v.total ?? 0, v.total ?? 0);
    const fiado = (v.total || 0) - pagado;
    if (fiado > 0) credito += fiado;
  });
  const devolucionesMonto = devoluciones.reduce((a, d) => a + (d.monto || 0), 0);
  const ventasTotales = Math.max(0, efectivo + yape + tarjeta + credito - devolucionesMonto);
  document.getElementById('corteVentasTotales').textContent = `${m} ${ventasTotales.toFixed(2)}`;

  // ── Ganancia (precio - costo, solo productos con costo cargado) ──
  let gananciaBruta = 0;
  ventas.forEach(v => {
    (v.items || v.productos || []).forEach(it => {
      const cant = it.cant || it.qty || 1;
      const costo = corteCostoProducto(it.nombre);
      if (costo != null) gananciaBruta += ((it.precio || 0) - costo) * cant;
    });
  });
  let gananciaDevuelta = 0;
  devoluciones.forEach(d => {
    (d.items || []).forEach(it => {
      const costo = corteCostoProducto(it.nombre);
      if (costo != null) gananciaDevuelta += ((it.precio || 0) - costo) * (it.qty || 1);
    });
  });
  const ganancia = gananciaBruta - gananciaDevuelta;
  document.getElementById('corteGanancia').textContent = `${m} ${ganancia.toFixed(2)}`;

  // ── Abonos de clientes, por método ──
  const abonosEfectivo = pagos.filter(p => p.metodo === 'efectivo').reduce((a, p) => a + (p.monto || 0), 0);

  // ── Fondo de caja ──
  let fondoCaja = 0;
  if (_corteModo === 'cajero') {
    const apertura = currentUser ? cajaActivaDe(currentUser) : null;
    fondoCaja = apertura ? (apertura.monto || 0) : 0;
  } else {
    fondoCaja = cajasHistorial.filter(c => c.fechaISO === fecha).reduce((a, c) => a + (c.monto || 0), 0);
  }

  // ── Movimientos de caja: entradas / salidas / devoluciones ──
  const entradas = movs.filter(mv => mv.tipo === 'entrada');
  const totalEntradas = entradas.reduce((a, mv) => a + (mv.monto || 0), 0);
  const salidasTodas = movs.filter(mv => mv.tipo === 'salida');
  const salidasDevolucion = salidasTodas.filter(mv => (mv.motivo || '').startsWith('Devolución'));
  const salidasOtras = salidasTodas.filter(mv => !(mv.motivo || '').startsWith('Devolución'));
  const totalSalidasOtras = salidasOtras.reduce((a, mv) => a + (mv.monto || 0), 0);
  const totalDevolucionesEfectivo = salidasDevolucion.reduce((a, mv) => a + (mv.monto || 0), 0);

  const dineroEnCaja = fondoCaja + efectivo + abonosEfectivo + totalEntradas - totalSalidasOtras - totalDevolucionesEfectivo;

  // ── Render: Dinero en Caja ──
  document.getElementById('corteDineroCajaLineas').innerHTML = `
    <div class="corte-linea"><span>Fondo de caja</span><strong>${m} ${fondoCaja.toFixed(2)}</strong></div>
    <div class="corte-linea positiva"><span>Ventas en Efectivo</span><strong>+ ${m} ${efectivo.toFixed(2)}</strong></div>
    <div class="corte-linea positiva"><span>Abonos en efectivo</span><strong>+ ${m} ${abonosEfectivo.toFixed(2)}</strong></div>
    <div class="corte-linea positiva"><span>Entradas</span><strong>+ ${m} ${totalEntradas.toFixed(2)}</strong></div>
    <div class="corte-linea negativa"><span>Salidas</span><strong>- ${m} ${totalSalidasOtras.toFixed(2)}</strong></div>
    <div class="corte-linea negativa"><span>Devoluciones en efectivo</span><strong>- ${m} ${totalDevolucionesEfectivo.toFixed(2)}</strong></div>
    <div class="corte-linea corte-linea-total"><span>Dinero en Caja</span><strong>${m} ${dineroEnCaja.toFixed(2)}</strong></div>
  `;

  // ── Render: Ventas (columna derecha) ──
  document.getElementById('corteVentasLineas').innerHTML = `
    <div class="corte-linea positiva"><span>En Efectivo</span><strong>+ ${m} ${efectivo.toFixed(2)}</strong></div>
    <div class="corte-linea positiva"><span>Con Yape</span><strong>+ ${m} ${yape.toFixed(2)}</strong></div>
    <div class="corte-linea positiva"><span>Con Tarjeta</span><strong>+ ${m} ${tarjeta.toFixed(2)}</strong></div>
    <div class="corte-linea positiva"><span>A Crédito</span><strong>+ ${m} ${credito.toFixed(2)}</strong></div>
    <div class="corte-linea negativa"><span>Devoluciones de Ventas</span><strong>- ${m} ${devolucionesMonto.toFixed(2)}</strong></div>
    <div class="corte-linea corte-linea-total"><span>Ventas</span><strong>${m} ${ventasTotales.toFixed(2)}</strong></div>
  `;

  // ── Render: Entradas de efectivo (detalle) ──
  document.getElementById('corteEntradasLista').innerHTML = entradas.length
    ? entradas.slice().reverse().map(mv =>
        corteFila('fa-arrow-down', '#10b981', mv.motivo || 'Entrada de efectivo', `${mv.hora || ''} · ${mv.usuario || ''}`, mv.monto, '+ ')
      ).join('')
    : corteListaVacia('- No hubo Entradas en Efectivo -');

  // ── Render: Ventas por Categoría ──
  const porDepto = {};
  ventas.forEach(v => (v.items || v.productos || []).forEach(it => {
    const depto = it.cat || 'Sin Categoría';
    porDepto[depto] = (porDepto[depto] || 0) + (it.precio || 0) * (it.cant || it.qty || 1);
  }));
  const deptoKeys = Object.keys(porDepto).sort((a, b) => porDepto[b] - porDepto[a]);
  const coloresDepto = (typeof _REPV_COLORES_DEPTO !== 'undefined') ? _REPV_COLORES_DEPTO : ['#f59e0b','#3b82f6','#10b981','#a855f7'];
  document.getElementById('corteDeptoLista').innerHTML = deptoKeys.length
    ? deptoKeys.map((k, i) => corteFila('fa-tag', coloresDepto[i % coloresDepto.length], k, '', porDepto[k], '')).join('')
    : corteListaVacia('- No se registró ninguna venta -');

  // ── Render: Ingresos de contado (Yape + Tarjeta: cobros inmediatos que no son efectivo) ──
  const totalContado = yape + tarjeta;
  document.getElementById('corteContadoLista').innerHTML = totalContado > 0
    ? corteFila('fa-mobile-screen', '#7c3aed', 'Con Yape', '', yape, '')
      + corteFila('fa-credit-card', '#0ea5e9', 'Con Tarjeta', '', tarjeta, '')
      + `<div class="corte-linea corte-linea-total" style="padding:9px 16px;"><span>Total</span><strong>${m} ${totalContado.toFixed(2)}</strong></div>`
    : corteListaVacia('- No hubo ingresos de contado -');

  // ── Render: Salidas de Efectivo (detalle, sin devoluciones) ──
  document.getElementById('corteSalidasLista').innerHTML = salidasOtras.length
    ? salidasOtras.slice().reverse().map(mv =>
        corteFila('fa-arrow-up', '#ef4444', mv.motivo || 'Salida de efectivo', `${mv.hora || ''} · ${mv.usuario || ''}`, mv.monto, '- ')
      ).join('')
    : corteListaVacia('- No hubo Salidas en Efectivo -');

  // ── Render: Clientes con más ventas / más ganancia ──
  const porClienteVentas = {}, porClienteGanancia = {};
  ventas.forEach(v => {
    const cliente = v.cliente;
    if (!cliente || cliente === 'Público General') return;
    porClienteVentas[cliente] = (porClienteVentas[cliente] || 0) + (v.total || 0);
    let gan = 0;
    (v.items || v.productos || []).forEach(it => {
      const costo = corteCostoProducto(it.nombre);
      if (costo != null) gan += ((it.precio || 0) - costo) * (it.cant || it.qty || 1);
    });
    porClienteGanancia[cliente] = (porClienteGanancia[cliente] || 0) + gan;
  });
  const topVentas = Object.keys(porClienteVentas).sort((a, b) => porClienteVentas[b] - porClienteVentas[a]).slice(0, 5);
  const topGanancia = Object.keys(porClienteGanancia).sort((a, b) => porClienteGanancia[b] - porClienteGanancia[a]).slice(0, 5);

  document.getElementById('corteTopVentasLista').innerHTML = topVentas.length
    ? topVentas.map(c => corteFila('fa-user', '#3b82f6', c, '', porClienteVentas[c], '')).join('')
    : corteListaVacia('- No hubo ventas -');

  document.getElementById('corteTopGananciaLista').innerHTML = topGanancia.length
    ? topGanancia.map(c => corteFila('fa-user', '#10b981', c, '', porClienteGanancia[c], '')).join('')
    : corteListaVacia('- No hubo ventas -');
}
