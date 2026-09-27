// ========================================
// EFECTIVO EN CAJA (apertura de turno por cajero)
// ========================================
// Cada cajero registra con cuánto efectivo empieza al iniciar sesión.
// Se guarda en cajasHistorial: { id, usuario, cajero, monto, fecha, fechaISO, hora }
// 'bodega_caja_activa' guarda la apertura de la sesión actual.

let _cajaCallback = null;
let _cajaUsuario = null;

function _cajaHoyISO() { return new Date().toLocaleDateString('en-CA'); }
function _cajaEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Apertura de hoy de este usuario en la sesión actual (o null)
function cajaActivaDe(user) {
  const id = localStorage.getItem('bodega_caja_activa');
  if (!id || !user) return null;
  const rec = cajasHistorial.find(c => String(c.id) === id);
  return rec && rec.usuario === user.user && rec.fechaISO === _cajaHoyISO() ? rec : null;
}

// Última apertura de hoy de este usuario (para ofrecer "continuar con ese monto")
function _cajaPrevioHoy(user) {
  const hoy = _cajaHoyISO();
  const lista = cajasHistorial.filter(c => c.usuario === user.user && c.fechaISO === hoy);
  return lista.length ? lista[lista.length - 1] : null;
}

function solicitarCajaInicial(user, alContinuar) {
  _cajaUsuario = user;
  _cajaCallback = alContinuar || null;

  const primerNombre = (user.nombre || '').split(' ')[0];
  document.getElementById('cajaSubtitulo').textContent = `${primerNombre}, ¿con cuánto efectivo empiezas?`;
  document.getElementById('cajaMoneda').textContent = moneda();
  const input = document.getElementById('cajaMontoInput');
  input.value = '';
  document.getElementById('cajaError').style.display = 'none';

  const previo = _cajaPrevioHoy(user);
  const boxPrevio = document.getElementById('cajaPrevio');
  if (previo) {
    document.getElementById('cajaPrevioTxt').textContent =
      `Hoy ya abriste caja con ${moneda()} ${Number(previo.monto).toFixed(2)} (${previo.hora})`;
    boxPrevio.style.display = 'block';
  } else {
    boxPrevio.style.display = 'none';
  }

  document.getElementById('modalCajaInicial').classList.add('show');
  setTimeout(() => input.focus(), 50);
}

function _cajaCerrarYContinuar() {
  document.getElementById('modalCajaInicial').classList.remove('show');
  const cb = _cajaCallback;
  _cajaCallback = null;
  if (cb) cb();
  renderCajaInicialDash();
}

function confirmarCajaInicial() {
  const monto = parseFloat(document.getElementById('cajaMontoInput').value);
  if (isNaN(monto) || monto < 0) {
    document.getElementById('cajaError').style.display = 'block';
    return;
  }
  const now = new Date();
  const rec = {
    id: Date.now(),
    usuario: _cajaUsuario.user,
    cajero: _cajaUsuario.nombre,
    monto: Math.round(monto * 100) / 100,
    fecha: now.toLocaleDateString('es-PE'),
    fechaISO: _cajaHoyISO(),
    hora: now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  };
  cajasHistorial.push(rec);
  if (typeof sbGuardarRegistro === 'function') sbGuardarRegistro('cajasHistorial', rec);
  localStorage.setItem('bodega_caja_activa', String(rec.id));
  guardarTodoEnLocalStorage();
  _cajaCerrarYContinuar();
}

function mantenerCajaPrevia() {
  const previo = _cajaPrevioHoy(_cajaUsuario);
  if (!previo) return;
  localStorage.setItem('bodega_caja_activa', String(previo.id));
  _cajaCerrarYContinuar();
}

function cancelarCajaInicial() {
  document.getElementById('modalCajaInicial').classList.remove('show');
  _cajaCallback = null;
  doLogout();
}

// Sesión restaurada al recargar: si no hay caja abierta hoy para este usuario, la pide
function cajaVerificarSesion(user) {
  if (!cajaActivaDe(user)) solicitarCajaInicial(user, null);
}

// ========================================
// DASHBOARD
// ========================================
// El administrador ve las aperturas de todos los cajeros; un vendedor, solo las suyas.
function _cajasDeHoyVisibles() {
  const hoy = _cajaHoyISO();
  return cajasHistorial.filter(c =>
    c.fechaISO === hoy && (!currentUser || currentUser.esAdmin || c.usuario === currentUser.user));
}

function renderCajaInicialDash() {
  const el = document.getElementById('dashCajaInicial');
  if (!el) return;
  const total = _cajasDeHoyVisibles().reduce((a, c) => a + (c.monto || 0), 0);
  el.textContent = `${moneda()} ${total.toFixed(2)}`;
}

// ========================================
// CIERRE DE TURNO (al tocar "Cerrar Sesión")
// ========================================
// Muestra cuánto se vendió por cada método (efectivo, yape, tarjeta; el pago
// mixto ya viene repartido entre los tres gracias a desgloseVenta, ver js/pagos.js)
// y cuánto efectivo debería haber físicamente en caja: lo que había al abrir el
// turno + lo vendido en efectivo + entradas de caja - salidas de caja.
let _cierreEsperado = 0;
let _cierreDesglose = { efectivo: 0, yape: 0, tarjeta: 0 };

function solicitarCierreTurno() {
  if (!currentUser) { doLogout(); return; }

  const hoy = _cajaHoyISO();
  const apertura = cajaActivaDe(currentUser);
  const montoInicial = apertura ? (apertura.monto || 0) : 0;

  const ventasHoy = (ventasHistorial || []).filter(v => v.fechaISO === hoy && v.vendedor === currentUser.nombre);
  const desglose = ventasHoy.reduce((a, v) => {
    const d = desgloseVenta(v);
    a.efectivo += d.efectivo; a.yape += d.yape; a.tarjeta += d.tarjeta;
    return a;
  }, { efectivo: 0, yape: 0, tarjeta: 0 });

  const movsHoy = (movimientosCaja || []).filter(m => m.fechaISO === hoy && m.usuario === currentUser.nombre);
  const entradas = movsHoy.filter(m => m.tipo === 'entrada').reduce((a, m) => a + (m.monto || 0), 0);
  const salidas = movsHoy.filter(m => m.tipo === 'salida').reduce((a, m) => a + (m.monto || 0), 0);

  _cierreDesglose = desglose;
  _cierreEsperado = Math.round((montoInicial + desglose.efectivo + entradas - salidas) * 100) / 100;

  const m = moneda();
  document.getElementById('cierreEfectivoVenta').textContent = `${m} ${desglose.efectivo.toFixed(2)}`;
  document.getElementById('cierreYapeVenta').textContent = `${m} ${desglose.yape.toFixed(2)}`;
  document.getElementById('cierreTarjetaVenta').textContent = `${m} ${desglose.tarjeta.toFixed(2)}`;
  document.getElementById('cierreTotalVenta').textContent = `${m} ${(desglose.efectivo + desglose.yape + desglose.tarjeta).toFixed(2)}`;
  document.getElementById('cierreEsperado').textContent = `${m} ${_cierreEsperado.toFixed(2)}`;

  const input = document.getElementById('cierreContadoInput');
  input.value = _cierreEsperado.toFixed(2);
  _cierreCalcularDiferencia();

  openModal('modalCierreTurno');
}

function _cierreCalcularDiferencia() {
  const input = document.getElementById('cierreContadoInput');
  const contado = parseFloat(input.value);
  const difEl = document.getElementById('cierreDiferencia');
  const okEl = document.getElementById('cierreVerdict');
  if (isNaN(contado)) {
    difEl.textContent = `${moneda()} 0.00`;
    difEl.style.color = '';
    okEl.style.display = 'none';
    return;
  }
  const dif = Math.round((contado - _cierreEsperado) * 100) / 100;
  difEl.textContent = `${dif < 0 ? '-' : ''}${moneda()} ${Math.abs(dif).toFixed(2)}`;
  difEl.style.color = Math.abs(dif) < 0.005 ? '#10b981' : '#ef4444';
  okEl.style.display = 'flex';
  if (Math.abs(dif) < 0.005) {
    okEl.className = 'cierre-verdict ok';
    okEl.innerHTML = '<i class="fa fa-circle-check"></i> ¡Excelente! Todo en orden';
  } else {
    okEl.className = 'cierre-verdict warn';
    okEl.innerHTML = dif > 0
      ? '<i class="fa fa-triangle-exclamation"></i> Hay más efectivo del esperado'
      : '<i class="fa fa-triangle-exclamation"></i> Falta efectivo respecto a lo esperado';
  }
}

function confirmarCierreTurno() {
  const input = document.getElementById('cierreContadoInput');
  const contado = parseFloat(input.value);
  if (isNaN(contado) || contado < 0) { showToast('Ingresa el efectivo contado', 'error'); return; }

  const now = new Date();
  const rec = {
    id: Date.now(),
    usuario: currentUser.user,
    cajero: currentUser.nombre,
    fecha: now.toLocaleDateString('es-PE'),
    fechaISO: _cajaHoyISO(),
    hora: now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    efectivoVentas: _cierreDesglose.efectivo,
    yapeVentas: _cierreDesglose.yape,
    tarjetaVentas: _cierreDesglose.tarjeta,
    efectivoEsperado: _cierreEsperado,
    efectivoContado: Math.round(contado * 100) / 100,
    diferencia: Math.round((contado - _cierreEsperado) * 100) / 100
  };
  cierresTurno.push(rec);
  guardarTodoEnLocalStorage();

  closeModal('modalCierreTurno');
  doLogout();
}

function cancelarCierreTurno() {
  closeModal('modalCierreTurno');
}

function abrirModalCajaInicial() {
  const lista = _cajasDeHoyVisibles();
  const cont = document.getElementById('cajaDetalleLista');
  if (!lista.length) {
    cont.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px;">Aún no hay cajas abiertas hoy</div>`;
  } else {
    const total = lista.reduce((a, c) => a + (c.monto || 0), 0);
    cont.innerHTML = lista.map(c => {
      const ini = (c.cajero || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
      return `<div class="caja-fila">
        <div class="rs-avatar">${_cajaEsc(ini)}</div>
        <div class="rs-info"><strong>${_cajaEsc(c.cajero)}</strong><small>Inicio de turno · ${_cajaEsc(c.hora)}</small></div>
        <span class="rs-amount">${moneda()} ${Number(c.monto).toFixed(2)}</span>
      </div>`;
    }).join('') + `<div class="caja-total"><span>Total con el que iniciaron</span><span style="color:#10b981;">${moneda()} ${total.toFixed(2)}</span></div>`;
  }
  openModal('modalCajaDetalle');
}
