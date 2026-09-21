// ========================================
// ACCIONES RÁPIDAS DE VENTAS
// Artículo Común · Consultar Precio · Entrada/Salida ·
// Pendiente · Reimprimir Ticket · Ventas del Día · Devoluciones
// ========================================

function _paHoyISO() { return new Date().toLocaleDateString('en-CA'); }
function _paEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function _paUsuario() { return currentUser ? currentUser.nombre : 'Admin'; }

// ========================================
// TOTAL DEL CARRITO
// ========================================
function calcularTotalCarrito() {
  // Los precios del carrito ya incluyen la oferta (ver recalcPrecioItem en pos.js)
  const subtotal = carrito.reduce((a, c) => a + c.precio * c.qty, 0);
  return redondearTotal(subtotal);
}

// ========================================
// 1. ARTÍCULO COMÚN
// ========================================
function abrirArticuloComun() {
  document.getElementById('acNombre').value = '';
  document.getElementById('acPrecio').value = '';
  document.getElementById('acCantidad').value = '1';
  document.getElementById('acMonedaLbl').textContent = moneda();
  openModal('modalArticuloComun');
  setTimeout(() => document.getElementById('acNombre').focus(), 200);
}

function agregarArticuloComun() {
  const nombre = document.getElementById('acNombre').value.trim();
  const precio = parseFloat(document.getElementById('acPrecio').value);
  const cantidad = parseInt(document.getElementById('acCantidad').value) || 1;

  if (!nombre) return showToast('Ingresa el nombre del artículo', 'error');
  if (isNaN(precio) || precio <= 0) return showToast('Ingresa un precio válido', 'error');
  if (cantidad <= 0) return showToast('La cantidad debe ser mayor a 0', 'error');

  carrito.unshift({
    id: 'comun_' + Date.now(),
    nombre: nombre,
    precio: precio,
    qty: cantidad,
    cat: 'Otros',
    esArticuloComun: true
  });
  renderCart();
  closeModal('modalArticuloComun');
  showToast(`"${nombre}" agregado al carrito`, 'success');
}

// ========================================
// 2. CONSULTAR PRECIO
// ========================================
function abrirConsultarPrecio() {
  document.getElementById('consultarPrecioInput').value = '';
  buscarConsultarPrecio('');
  openModal('modalConsultarPrecio');
  setTimeout(() => document.getElementById('consultarPrecioInput').focus(), 200);
}

function buscarConsultarPrecio(q) {
  const ql = (q || '').toLowerCase().trim();
  const cont = document.getElementById('consultarPrecioResultados');
  let lista = productos;
  if (ql) lista = lista.filter(p => p.nombre.toLowerCase().includes(ql) || (p.codigo || '').toLowerCase().includes(ql));
  lista = lista.slice(0, 40);

  if (!lista.length) {
    cont.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px;">${ql ? 'No se encontraron productos' : 'Escribe para buscar un producto'}</div>`;
    return;
  }
  cont.innerHTML = lista.map(p => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 6px;border-bottom:1px solid var(--border);">
      <div style="width:36px;height:36px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        ${p.img ? `<img src="${p.img}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;">` : `<i class="fa fa-box" style="color:var(--text3);"></i>`}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_paEsc(p.nombre)}</div>
        <div style="font-size:11px;color:var(--text3);">${p.stock > 0 ? `Stock: ${p.stock}` : 'Sin stock'}${unidadDe(p) === 'kg' ? ' · por kg' : unidadDe(p) === 'paquete' ? ' · por paquete' : ''}${promoVigente(p) ? ` · <span style="color:#f97316;font-weight:700;">${promoEtiqueta(p, true)}</span>` : ''}</div>
      </div>
      <div style="font-size:15px;font-weight:800;color:var(--accent);white-space:nowrap;">${precioHTML(p)}</div>
    </div>
  `).join('');
}

// ========================================
// 3. ENTRADA / SALIDA DE EFECTIVO
// ========================================
let _tipoMovCaja = 'entrada';

function abrirEntradaSalida() {
  document.getElementById('esMonto').value = '';
  document.getElementById('esMotivo').value = '';
  document.getElementById('esMonedaLbl').textContent = moneda();
  setTipoMovCaja('entrada');
  renderMovCajaLista();
  openModal('modalEntradaSalida');
}

function setTipoMovCaja(tipo) {
  _tipoMovCaja = tipo;
  document.getElementById('esBtnEntrada').classList.toggle('selected', tipo === 'entrada');
  document.getElementById('esBtnSalida').classList.toggle('selected', tipo === 'salida');
}

function registrarMovimientoCaja() {
  const monto = parseFloat(document.getElementById('esMonto').value);
  const motivo = document.getElementById('esMotivo').value.trim();
  if (isNaN(monto) || monto <= 0) return showToast('Ingresa un monto válido', 'error');

  const now = new Date();
  movimientosCaja.push({
    id: Date.now(),
    tipo: _tipoMovCaja,
    monto: Math.round(monto * 100) / 100,
    motivo: motivo || (_tipoMovCaja === 'entrada' ? 'Entrada de efectivo' : 'Salida de efectivo'),
    fecha: now.toLocaleDateString('es-PE'),
    fechaISO: _paHoyISO(),
    hora: now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    usuario: _paUsuario()
  });
  guardarTodoEnLocalStorage();

  document.getElementById('esMonto').value = '';
  document.getElementById('esMotivo').value = '';
  renderMovCajaLista();
  showToast(`${_tipoMovCaja === 'entrada' ? 'Entrada' : 'Salida'} registrada correctamente`, 'success');
}

function renderMovCajaLista() {
  const cont = document.getElementById('movCajaLista');
  if (!cont) return;
  const hoy = _paHoyISO();
  const lista = movimientosCaja.filter(m => m.fechaISO === hoy).slice().reverse();

  if (!lista.length) {
    cont.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px;">Sin movimientos registrados hoy</div>`;
    return;
  }
  cont.innerHTML = lista.map(m => {
    const esEntrada = m.tipo === 'entrada';
    const color = esEntrada ? '#10b981' : '#ef4444';
    const signo = esEntrada ? '+' : '-';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border);">
      <i class="fa ${esEntrada ? 'fa-arrow-down' : 'fa-arrow-up'}" style="color:${color};width:16px;"></i>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_paEsc(m.motivo)}</div>
        <div style="font-size:11px;color:var(--text3);">${m.hora} · ${_paEsc(m.usuario)}</div>
      </div>
      <div style="font-size:13px;font-weight:800;color:${color};white-space:nowrap;">${signo}${moneda()} ${m.monto.toFixed(2)}</div>
    </div>`;
  }).join('');
}

// ========================================
// 4. AHORRO POR PROMOCIÓN (fila del carrito con lo que se ahorra el cliente)
// ========================================
function actualizarFilaMayoreo() {
  const row = document.getElementById('cartMayoreoRow');
  const desc = document.getElementById('cartMayoreoDesc');
  if (!row || !desc) return;
  // Ahorro = lo que costaría a precio normal menos lo que se cobra por las promociones
  let ahorro = 0;
  carrito.forEach(c => {
    if (!c.tarifa) return;
    const normal = c.esPesoItem ? c.precioKgOrig * c.pesoKg : c.precioBase;
    ahorro += (normal - c.precio) * c.qty;
  });
  if (ahorro <= 0.004) { row.style.display = 'none'; return; }
  row.style.display = 'flex';
  desc.textContent = `-${moneda()} ${ahorro.toFixed(2)}`;
}

// ========================================
// 5. PENDIENTE (dejar el carrito en espera y recuperarlo luego)
// ========================================
function abrirPendientes() {
  const zona = document.getElementById('pendienteGuardarZona');
  zona.style.display = carrito.length ? 'block' : 'none';
  document.getElementById('pendienteNombre').value = '';
  renderPendientesLista();
  openModal('modalPendientes');
}

function guardarComoPendiente() {
  if (!carrito.length) return showToast('El carrito está vacío', 'error');
  const nombre = document.getElementById('pendienteNombre').value.trim();
  const now = new Date();
  ventasPendientes.push({
    id: Date.now(),
    nombre: nombre || `Venta ${now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`,
    carrito: carrito.map(c => ({ ...c })),
    cliente: selectedClientePOS ? selectedClientePOS.nombre : null,
    clienteId: selectedClientePOS ? selectedClientePOS.id : null,
    fecha: now.toLocaleDateString('es-PE'),
    hora: now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    total: calcularTotalCarrito()
  });
  guardarTodoEnLocalStorage();

  carrito = [];
  clearClientSel();
  renderCart();

  document.getElementById('pendienteGuardarZona').style.display = 'none';
  renderPendientesLista();
  actualizarBadgePendientes();
  showToast('Venta guardada como pendiente', 'success');
}

function renderPendientesLista() {
  const cont = document.getElementById('pendientesLista');
  if (!cont) return;
  if (!ventasPendientes.length) {
    cont.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">No hay ventas pendientes</div>`;
    return;
  }
  cont.innerHTML = ventasPendientes.slice().reverse().map(v => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:8px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_paEsc(v.nombre)}</div>
        <div style="font-size:11px;color:var(--text3);">${v.hora} · ${v.carrito.length} artículo(s)${v.cliente ? ' · ' + _paEsc(v.cliente) : ''}</div>
      </div>
      <div style="font-size:13px;font-weight:800;color:var(--accent);white-space:nowrap;">${moneda()} ${v.total.toFixed(2)}</div>
      <button class="btn btn-primary btn-sm" onclick="recuperarPendiente(${v.id})"><i class="fa fa-rotate-left"></i></button>
      <i class="fa fa-trash" style="color:var(--danger);cursor:pointer;font-size:13px;" onclick="eliminarPendiente(${v.id})"></i>
    </div>
  `).join('');
}

function recuperarPendiente(id) {
  const v = ventasPendientes.find(x => x.id === id);
  if (!v) return;
  if (carrito.length && !confirm('Ya tienes artículos en el carrito actual. ¿Reemplazarlos con esta venta pendiente?')) return;

  carrito = v.carrito.map(c => ({ ...c }));
  if (v.clienteId) {
    const c = clientes.find(x => x.id === v.clienteId);
    if (c) selectClientePOS(c.id);
  } else {
    clearClientSel();
  }
  ventasPendientes = ventasPendientes.filter(x => x.id !== id);
  guardarTodoEnLocalStorage();
  renderCart();
  actualizarBadgePendientes();
  closeModal('modalPendientes');
  showToast('Venta pendiente recuperada', 'success');
}

function eliminarPendiente(id) {
  if (!confirm('¿Eliminar esta venta pendiente? Esta acción no se puede deshacer.')) return;
  ventasPendientes = ventasPendientes.filter(x => x.id !== id);
  guardarTodoEnLocalStorage();
  renderPendientesLista();
  actualizarBadgePendientes();
  showToast('Venta pendiente eliminada', 'success');
}

function actualizarBadgePendientes() {
  const badge = document.getElementById('pendientesBadge');
  if (!badge) return;
  if (ventasPendientes.length > 0) {
    badge.style.display = 'flex';
    badge.textContent = ventasPendientes.length;
  } else {
    badge.style.display = 'none';
  }
}

// ========================================
// 6. REIMPRIMIR ÚLTIMO TICKET
// ========================================
function reimprimirUltimoTicket() {
  if (!ventasHistorial.length) return showToast('Todavía no hay ninguna venta registrada', 'error');
  const v = ventasHistorial[ventasHistorial.length - 1];
  const items = (v.items || v.productos || []).map(it => ({
    nombre: it.nombre,
    qty: it.cant != null ? it.cant : it.qty,
    precio: it.precio,
    kg: null,
    promo: it.promo || '',
    precioOrig: it.precioOrig != null ? it.precioOrig : null
  }));
  const dado = v.pagado != null ? v.pagado : v.total;
  const vuelto = dado > v.total ? dado - v.total : 0;
  const fiado = dado < v.total ? v.total - dado : 0;
  const desglose = v.desglose
    ? ['efectivo', 'yape', 'tarjeta'].filter(k => v.desglose[k] > 0).map(k => ({ label: metodoInfo(k).label, monto: v.desglose[k] }))
    : [];

  const ticket = ticketHTML({
    fecha: v.fecha,
    hora: v.hora,
    numero: String(ventasHistorial.indexOf(v) + 1).padStart(4, '0'),
    items,
    total: v.total,
    dado, vuelto, fiado,
    cliente: v.cliente,
    vendedor: v.vendedor,
    pagoLabel: v.desglose ? 'Mixto' : metodoInfo(v.metodoPago).label,
    pagoDetalle: desglose,
    referencia: v.referenciaPago || '',
    notaVenta: v.notaVenta || ''
  }, ticketCfg(), (settings && settings.negocio) || {});

  document.getElementById('ticketContent').innerHTML = ticket;
  openModal('modalTicket');
}

// ========================================
// 7-8. HISTORIAL DE VENTAS (Ventas del día + Devoluciones en un solo panel)
// ========================================
let _histVentaSel = null;
let _histItemsSel = new Set(); // índices de los artículos marcados en el detalle del ticket

const _histVacio = `
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text3);">
    <i class="fa fa-receipt" style="font-size:32px;display:block;margin-bottom:10px;opacity:0.3;"></i>
    <p style="font-size:13px;">Selecciona un ticket para ver el detalle</p>
  </div>`;

function abrirHistorialVentas() {
  document.getElementById('histBuscarInput').value = '';
  document.getElementById('histFechaInput').value = _paHoyISO();
  _histLlenarCajeros();
  document.getElementById('histCajeroInput').value = '';
  _histVentaSel = null;
  _histSeleccionarUltimaODejarVacio();
  openModal('modalHistorialVentas');
  setTimeout(() => document.getElementById('histBuscarInput').focus(), 200);
}

function histIrHoy() {
  document.getElementById('histFechaInput').value = _paHoyISO();
  _histSeleccionarUltimaODejarVacio();
}

// Selecciona automáticamente el último ticket del día visible (según los filtros actuales);
// si no hay ninguno, deja el panel de detalle vacío.
function _histSeleccionarUltimaODejarVacio() {
  const fecha = document.getElementById('histFechaInput').value || _paHoyISO();
  const cajero = document.getElementById('histCajeroInput').value;
  let lista = ventasHistorial.filter(v => !v.esPagoPedidoProv && v.fechaISO === fecha);
  if (cajero) lista = lista.filter(v => (v.vendedor || 'Admin') === cajero);
  const ultima = lista[lista.length - 1];
  if (ultima) {
    histSeleccionarVenta(ultima.id); // ya refresca la lista y el detalle
  } else {
    _histVentaSel = null;
    document.getElementById('histDetalle').innerHTML = _histVacio;
    histRenderLista();
  }
}

function _histLlenarCajeros() {
  const sel = document.getElementById('histCajeroInput');
  sel.innerHTML = '<option value="">Todos</option>';
  const nombres = [...new Set(ventasHistorial.filter(v => !v.esPagoPedidoProv).map(v => v.vendedor || 'Admin'))];
  nombres.forEach(n => sel.insertAdjacentHTML('beforeend', `<option value="${_paEsc(n)}">${_paEsc(n)}</option>`));
}

function histRenderLista() {
  const q = (document.getElementById('histBuscarInput').value || '').toLowerCase().trim();
  const fecha = document.getElementById('histFechaInput').value || _paHoyISO();
  const cajero = document.getElementById('histCajeroInput').value;

  let lista = ventasHistorial.filter(v => !v.esPagoPedidoProv && v.fechaISO === fecha);
  if (cajero) lista = lista.filter(v => (v.vendedor || 'Admin') === cajero);
  if (q) lista = lista.filter((v, i) => v.cliente.toLowerCase().includes(q) || String(i + 1).padStart(4, '0').includes(q));
  lista = lista.slice().reverse();

  // Las ventas canceladas se muestran en la lista (para tener registro) pero no cuentan en el resumen
  const activas = lista.filter(v => !v.cancelada);
  const total = activas.reduce((a, v) => a + v.total, 0);
  document.getElementById('histResumen').innerHTML = `
    <div style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px;text-align:center;">
      <div style="font-size:10px;color:var(--text3);">Ventas</div>
      <div style="font-size:16px;font-weight:800;">${activas.length}</div>
    </div>
    <div style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px;text-align:center;">
      <div style="font-size:10px;color:var(--text3);">Total</div>
      <div style="font-size:16px;font-weight:800;color:var(--accent);">${moneda()} ${total.toFixed(2)}</div>
    </div>`;

  const cont = document.getElementById('histLista');
  if (!lista.length) {
    cont.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px;">No hay ventas en esta fecha</div>`;
    return;
  }
  cont.innerHTML = `
    <div style="margin:0 8px;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:var(--surface2);">
            <th style="position:sticky;top:0;background:var(--surface2);padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);">N° Ticket</th>
            <th style="position:sticky;top:0;background:var(--surface2);padding:8px 6px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);">Arts</th>
            <th style="position:sticky;top:0;background:var(--surface2);padding:8px 6px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);">Hora</th>
            <th style="position:sticky;top:0;background:var(--surface2);padding:8px 10px;text-align:right;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);">Total</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(v => {
            const ticketNum = String(ventasHistorial.indexOf(v) + 1).padStart(4, '0');
            const cancelada = !!v.cancelada;
            // Una venta cancelada ya no tiene artículos "activos": se muestra en 0
            const arts = cancelada ? 0 : (v.items || v.productos || []).reduce((a, it) => a + (it.cant != null ? it.cant : (it.qty || 1)), 0);
            const activo = _histVentaSel && _histVentaSel.id === v.id;
            const filaStyle = activo
              ? 'background:var(--danger);color:#fff;'
              : (cancelada ? 'color:var(--text3);font-style:italic;' : '');
            return `<tr onclick="histSeleccionarVenta(${v.id})"
                style="cursor:pointer;${filaStyle}"
                ${activo ? '' : `onmouseenter="this.style.background='var(--surface2)'" onmouseleave="this.style.background=''"`}>
              <td style="padding:9px 10px;font-size:12px;font-weight:700;border-bottom:1px solid var(--border);">${ticketNum}${cancelada ? ' <span style="font-size:9px;font-weight:600;">(Cancelado)</span>' : ''}</td>
              <td style="padding:9px 6px;font-size:12px;border-bottom:1px solid var(--border);">${arts}</td>
              <td style="padding:9px 6px;font-size:11px;${activo ? '' : 'color:var(--text3);'}border-bottom:1px solid var(--border);">${v.hora || '—'}</td>
              <td style="padding:9px 10px;font-size:12px;font-weight:700;text-align:right;border-bottom:1px solid var(--border);${cancelada && !activo ? 'text-decoration:line-through;' : ''}">${moneda()} ${v.total.toFixed(2)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function histSeleccionarVenta(ventaId) {
  const v = ventasHistorial.find(x => x.id === ventaId);
  if (!v) return;
  _histVentaSel = v;
  _histItemsSel = new Set();
  histRenderLista(); // resalta la fila elegida

  const ticketNum = String(ventasHistorial.indexOf(v) + 1).padStart(4, '0');
  const items = v.items || v.productos || [];
  const dado = v.pagado != null ? v.pagado : v.total;
  const metodo = v.desglose ? 'mixto' : (v.metodoPago || 'efectivo');
  const mi = metodoInfo(metodo);
  const cancelada = !!v.cancelada;
  const tieneNota = !!(v.notaVenta && v.notaVenta.trim());

  document.getElementById('histDetalle').innerHTML = `
    ${cancelada ? `
      <div style="position:absolute;top:38%;left:50%;transform:translate(-50%,-50%) rotate(-16deg);font-size:34px;font-weight:900;color:var(--danger);border:5px solid var(--danger);border-radius:10px;padding:2px 16px;opacity:0.55;pointer-events:none;z-index:5;letter-spacing:2px;white-space:nowrap;">CANCELADO</div>
    ` : ''}

    <div style="flex-shrink:0;padding:20px 20px 0;">
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:800;color:var(--accent);margin-bottom:14px;">
        <span>Ticket ${ticketNum}</span>
        <span title="${_paEsc(mi.label)}" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${mi.bg};color:${mi.color};font-size:11px;flex-shrink:0;"><i class="fa ${mi.icon}"></i></span>
      </div>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px;">
        <div style="min-width:0;">
          <div style="font-size:12px;color:var(--text2);margin-bottom:4px;"><strong>Cajero:</strong> ${_paEsc(v.vendedor || 'Admin')}</div>
          <div style="font-size:12px;color:var(--text2);"><strong>Cliente:</strong> ${_paEsc(v.cliente)}</div>
        </div>
        ${tieneNota ? `<div title="${_paEsc(v.notaVenta)}" style="max-width:52%;max-height:64px;overflow-y:auto;padding:6px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;font-size:11px;color:var(--text2);word-break:break-word;">
          <i class="fa fa-note-sticky" style="margin-right:4px;color:var(--text3);"></i><strong>Nota:</strong> ${_paEsc(v.notaVenta)}
        </div>` : ''}
      </div>
      <div style="font-size:11px;color:var(--text3);text-align:center;margin-bottom:14px;">${v.fecha} ${v.hora}</div>
    </div>

    <div style="flex:1;min-height:0;overflow-y:auto;padding:0 20px;">
      <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:12px;">
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
          <thead>
            <tr style="background:var(--surface2);">
              <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);">Cant.</th>
              <th style="padding:8px 6px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);">Descripción</th>
              <th style="padding:8px 6px;text-align:right;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);">Importe</th>
              <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);">Devolver</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it, idx) => {
              const cant = it.cant != null ? it.cant : it.qty;
              return `<tr class="hist-item-row" id="histItemRow_${idx}" ${cancelada ? '' : `onclick="histToggleItem(${idx})"`} style="${cancelada ? '' : 'cursor:pointer;'}">
                <td style="padding:8px 10px;font-size:12px;border-bottom:1px solid var(--border);">${cant}</td>
                <td style="padding:8px 6px;font-size:12px;border-bottom:1px solid var(--border);max-width:0;">
                  <div style="display:flex;align-items:center;gap:6px;min-width:0;">
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_paEsc(it.nombre)}</span>
                    ${it.devuelto > 0 ? `<span class="hist-dev-badge" title="Devuelto: ${it.devuelto} und."><i class="fa fa-rotate-left"></i></span>` : ''}
                  </div>
                </td>
                <td style="padding:8px 6px;font-size:12px;text-align:right;border-bottom:1px solid var(--border);white-space:nowrap;">${moneda()} ${(+it.precio).toFixed(2)}</td>
                <td style="padding:6px 10px;text-align:center;border-bottom:1px solid var(--border);">
                  <input type="number" id="histDevolQty_${idx}" min="0" onclick="event.stopPropagation()" max="${cant}" value="0" step="1" title="Cantidad a devolver"
                    ${cancelada ? 'disabled' : ''}
                    style="width:48px;padding:5px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:'Sora',sans-serif;font-size:12px;text-align:center;${cancelada ? 'opacity:0.5;cursor:not-allowed;' : ''}">
                </td>
              </tr>`;
            }).join('')}
            ${(v.itemsDevueltos || []).map(it => `<tr style="color:var(--text3);">
                <td style="padding:8px 10px;font-size:12px;border-bottom:1px solid var(--border);text-decoration:line-through;">${it.devuelto}</td>
                <td style="padding:8px 6px;font-size:12px;border-bottom:1px solid var(--border);max-width:0;">
                  <div style="display:flex;align-items:center;gap:6px;min-width:0;">
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-decoration:line-through;">${_paEsc(it.nombre)}</span>
                    <span class="hist-dev-badge" title="Devuelto: ${it.devuelto} und. (todo)"><i class="fa fa-rotate-left"></i></span>
                  </div>
                </td>
                <td style="padding:8px 6px;font-size:12px;text-align:right;border-bottom:1px solid var(--border);white-space:nowrap;text-decoration:line-through;">${moneda()} ${(+it.precio).toFixed(2)}</td>
                <td style="padding:6px 10px;text-align:center;border-bottom:1px solid var(--border);font-size:11px;">Devuelto</td>
              </tr>`).join('')}
            ${(!items.length && !(v.itemsDevueltos || []).length) ? `<tr><td colspan="4" style="padding:14px;text-align:center;font-size:12px;color:var(--text3);">Todos los artículos de este ticket fueron devueltos.</td></tr>` : ''}
          </tbody>
        </table>
      </div>

      ${v.referenciaPago ? `<div style="padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;font-size:11px;color:var(--text2);margin-bottom:4px;">
        <i class="fa fa-credit-card" style="margin-right:4px;color:var(--text3);"></i><strong>Referencia:</strong> ${_paEsc(v.referenciaPago)}
      </div>` : ''}
    </div>

    <div style="flex-shrink:0;padding:14px 20px 20px;">
      <button class="btn btn-secondary" style="width:100%;justify-content:center;margin-bottom:14px;${cancelada ? 'opacity:0.5;cursor:not-allowed;' : ''}"
        ${cancelada ? 'disabled' : `onclick="histDevolverSeleccion(${v.id})"`}>
        <i class="fa fa-rotate-left"></i> Devolver artículo(s) seleccionado(s)
      </button>

      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text2);padding-top:12px;border-top:1px solid var(--border);">
        <span>Pago con:</span><span style="font-weight:700;">${moneda()} ${dado.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:17px;font-weight:800;margin-top:6px;margin-bottom:14px;">
        <span>Total:</span><span>${moneda()} ${v.total.toFixed(2)}</span>
      </div>

      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary" style="flex:1;justify-content:center;${cancelada ? 'opacity:0.5;cursor:not-allowed;' : ''}" ${cancelada ? 'disabled' : `onclick="histCancelarVenta(${v.id})"`}><i class="fa fa-ban"></i> Cancelar Venta</button>
        <button class="btn btn-primary" style="flex:1;justify-content:center;" onclick="histImprimirCopia(${v.id})"><i class="fa fa-print"></i> Imprimir copia</button>
      </div>
    </div>
  `;
}

// Marca/desmarca un artículo del ticket (mismo resaltado rojo que la lista de tickets).
// Al marcarlo se propone devolver todas sus unidades; al desmarcarlo vuelve a 0.
function histToggleItem(idx) {
  const v = _histVentaSel;
  if (!v || v.cancelada) return;
  const it = (v.items || v.productos || [])[idx];
  const row = document.getElementById('histItemRow_' + idx);
  const inp = document.getElementById('histDevolQty_' + idx);
  if (!it || !row) return;
  const activo = !_histItemsSel.has(idx);
  if (activo) _histItemsSel.add(idx); else _histItemsSel.delete(idx);
  row.classList.toggle('hist-item-sel', activo);
  if (inp) inp.value = activo ? (it.cant != null ? it.cant : it.qty) : 0;
}

function histDevolverSeleccion(ventaId) {
  const v = ventasHistorial.find(x => x.id === ventaId);
  if (!v || v.cancelada) return;
  const items = v.items || v.productos || [];
  let montoDevuelto = 0;
  const itemsDevueltos = [];
  const cantidadesADevolver = [];

  items.forEach((it, idx) => {
    const cant = it.cant != null ? it.cant : it.qty;
    const inp = document.getElementById('histDevolQty_' + idx);
    const qtyDevolver = inp ? Math.max(0, Math.min(cant, parseInt(inp.value) || 0)) : 0;
    cantidadesADevolver.push(qtyDevolver);
    if (qtyDevolver > 0) {
      montoDevuelto += qtyDevolver * (+it.precio);
      itemsDevueltos.push({ nombre: it.nombre, qty: qtyDevolver, precio: it.precio });
      const prod = productos.find(p => p.nombre === it.nombre);
      if (prod) prod.stock = (prod.stock || 0) + qtyDevolver;
    }
  });

  if (!itemsDevueltos.length) return showToast('Selecciona al menos un artículo a devolver', 'error');

  montoDevuelto = Math.round(montoDevuelto * 100) / 100;

  // Actualiza el propio ticket: baja la cantidad de cada artículo devuelto y descuenta el total
  items.forEach((it, idx) => {
    const qtyDevolver = cantidadesADevolver[idx];
    if (qtyDevolver > 0) {
      it.devuelto = (it.devuelto || 0) + qtyDevolver; // para mostrar el icono de "devuelto" en el ticket
      if (it.cant != null) it.cant -= qtyDevolver; else it.qty -= qtyDevolver;
    }
  });
  // Los artículos devueltos por completo salen de la lista activa, pero se guardan aparte
  // para que el ticket siga mostrándolos marcados como devueltos.
  const devueltosCompletos = items.filter(it => (it.cant != null ? it.cant : it.qty) <= 0);
  if (devueltosCompletos.length) {
    v.itemsDevueltos = (v.itemsDevueltos || []).concat(
      devueltosCompletos.map(it => ({ nombre: it.nombre, precio: it.precio, devuelto: it.devuelto }))
    );
  }
  const itemsRestantes = items.filter(it => (it.cant != null ? it.cant : it.qty) > 0);
  if (v.items) v.items = itemsRestantes; else v.productos = itemsRestantes;
  v.total = Math.max(0, Math.round((v.total - montoDevuelto) * 100) / 100);

  // Si ya no queda ningún artículo en el ticket, queda como cancelado
  if (!itemsRestantes.length) v.cancelada = true;

  // Si la venta era fiada, la deuda del cliente también baja
  if (v.cliente && v.cliente !== 'Público General') {
    const c = clientes.find(x => x.nombre === v.cliente);
    if (c && c.historial) {
      const hMatch = c.historial.find(h => (h.fecha === v.fecha || h.fechaISO === v.fechaISO) && h.hora === v.hora);
      if (hMatch) {
        hMatch.total = v.total;
        c.deuda = c.historial.reduce((s, h2) => s + Math.max(0, h2.total - h2.pagado), 0);
      }
    }
  }

  const now = new Date();
  devolucionesHistorial.push({
    id: Date.now(),
    ventaId: v.id,
    cliente: v.cliente,
    items: itemsDevueltos,
    monto: Math.round(montoDevuelto * 100) / 100,
    fecha: now.toLocaleDateString('es-PE'),
    fechaISO: _paHoyISO(),
    hora: now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    usuario: _paUsuario()
  });

  movimientosCaja.push({
    id: Date.now() + 1,
    tipo: 'salida',
    monto: Math.round(montoDevuelto * 100) / 100,
    motivo: `Devolución · ${v.cliente}`,
    fecha: now.toLocaleDateString('es-PE'),
    fechaISO: _paHoyISO(),
    hora: now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    usuario: _paUsuario()
  });

  guardarTodoEnLocalStorage();
  updateStockBajoCount();
  actualizarDashboardReal();
  renderProdTable();
  renderProdGrid();
  renderPOSProducts();
  renderClients();

  showToast(`Devolución registrada por ${moneda()} ${montoDevuelto.toFixed(2)}`, 'success');
  histSeleccionarVenta(ventaId); // refresca el detalle con las nuevas cantidades y el total actualizado
}

function histCancelarVenta(ventaId) {
  const v = ventasHistorial.find(x => x.id === ventaId);
  if (!v || v.cancelada) return;
  const folio = String(ventasHistorial.indexOf(v) + 1).padStart(4, '0');
  if (!confirm(`¿Cancelar la venta del ticket ${folio}? Se repondrá el stock de los productos. Esta acción no se puede deshacer.`)) return;

  const items = v.items || v.productos || [];
  items.forEach(it => {
    const cant = it.cant != null ? it.cant : it.qty;
    const prod = productos.find(p => p.nombre === it.nombre);
    if (prod) prod.stock = (prod.stock || 0) + cant;
  });

  // Si la venta estaba fiada, también se limpia del historial de deuda del cliente
  if (v.cliente && v.cliente !== 'Público General') {
    const c = clientes.find(x => x.nombre === v.cliente);
    if (c) {
      const hMatch = c.historial.find(h => (h.fecha === v.fecha || h.fechaISO === v.fechaISO) && h.hora === v.hora);
      if (hMatch) {
        c.historial.splice(c.historial.indexOf(hMatch), 1);
        c.deuda = c.historial.reduce((s, h2) => s + Math.max(0, h2.total - h2.pagado), 0);
      }
    }
  }

  // La venta se conserva en el historial (para tener registro) pero queda marcada como cancelada:
  // en la tabla aparece en gris/tachada y en el detalle se muestra el sello "CANCELADO".
  v.cancelada = true;

  guardarTodoEnLocalStorage();
  updateStockBajoCount();
  actualizarDashboardReal();
  renderProdTable();
  renderProdGrid();
  renderPOSProducts();
  renderClients();

  histSeleccionarVenta(ventaId); // refresca el detalle mostrando el sello CANCELADO
  showToast('Venta cancelada y stock repuesto', 'success');
}

function histImprimirCopia(ventaId) {
  const v = ventasHistorial.find(x => x.id === ventaId);
  if (!v) return;
  const items = (v.items || v.productos || []).map(it => ({
    nombre: it.nombre,
    qty: it.cant != null ? it.cant : it.qty,
    precio: it.precio,
    kg: null,
    promo: it.promo || '',
    precioOrig: it.precioOrig != null ? it.precioOrig : null
  }));
  const dado = v.pagado != null ? v.pagado : v.total;
  const vuelto = dado > v.total ? dado - v.total : 0;
  const fiado = dado < v.total ? v.total - dado : 0;
  const desglose = v.desglose
    ? ['efectivo', 'yape', 'tarjeta'].filter(k => v.desglose[k] > 0).map(k => ({ label: metodoInfo(k).label, monto: v.desglose[k] }))
    : [];

  const ticket = ticketHTML({
    fecha: v.fecha,
    hora: v.hora,
    numero: String(ventasHistorial.indexOf(v) + 1).padStart(4, '0'),
    items,
    total: v.total,
    dado, vuelto, fiado,
    cliente: v.cliente,
    vendedor: v.vendedor,
    pagoLabel: v.desglose ? 'Mixto' : metodoInfo(v.metodoPago).label,
    pagoDetalle: desglose,
    referencia: v.referenciaPago || '',
    notaVenta: v.notaVenta || ''
  }, ticketCfg(), (settings && settings.negocio) || {});

  document.getElementById('ticketContent').innerHTML = ticket;
  openModal('modalTicket');
}

// Al iniciar, refleja si ya había ventas pendientes guardadas de una sesión anterior
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(actualizarBadgePendientes, 300);
});
