// ========================================
// REPORTES — SISTEMA COMPLETO
// ========================================
function showReporte(btn, panelId) {
  // Limpiar filtros de KPI al cambiar de panel
  _filtroMetodoCerveza = 'todos';
  _filtroMetodoYape = 'todos';
  _filtroMetodoEfectivo = 'todos';
  repVendFiltroActivo = null;
  document.querySelectorAll('.rep-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.rep-panel').forEach(p => p.style.display = 'none');
  btn.classList.add('active');
  document.getElementById(panelId).style.display = 'flex';
  renderReportes(panelId);
}

function getRepFecha() {
  const inp = document.getElementById('repFechaInput');
  if (inp && inp.value) return inp.value;
  return new Date().toLocaleDateString('en-CA');
}

function eliminarReporteDia() {
  const fecha = getRepFecha();
  const label = getRepFechaLabel(fecha);
  const ventas = ventasHistorial.filter(v => v.fechaISO === fecha && !v.esPagoPedidoProv);
  if (ventas.length === 0) { showToast('No hay registros para eliminar en este día', 'info'); return; }
  if (!confirm(`¿Eliminar TODOS los registros del ${label}?\n\nSe eliminarán ${ventas.length} venta(s). Esta acción no se puede deshacer.`)) return;
  ventasHistorial = ventasHistorial.filter(v => v.fechaISO !== fecha || v.esPagoPedidoProv);
  guardarTodoEnLocalStorage();
  renderReportes();
  showToast(`Reporte del ${label} eliminado`, 'success');
}

function eliminarVentaIndividual(ventaId) {
  if (!confirm('¿Eliminar este registro del reporte? Esta acción no se puede deshacer.')) return;
  ventasHistorial = ventasHistorial.filter(v => v.id !== ventaId);
  guardarTodoEnLocalStorage();
  actualizarDashboardReal();
  renderReportes(_getPanelActivo());
  showToast('Registro eliminado', 'success');
}

function eliminarLineaVenta(ventaId, itemIndex) {
  if (!confirm('¿Eliminar solo esta línea del reporte? Esta acción no se puede deshacer.')) return;
  const venta = ventasHistorial.find(v => v.id === ventaId);
  if (!venta) { showToast('No se encontró el registro', 'error'); return; }
  const items = venta.items || venta.productos || [];
  const item = items[itemIndex];
  if (!item) return;

  const nombreItem = (item.nombre || '').toLowerCase();
  const cantItem = item.cant || item.qty || 1;

  // 1. Reponer stock
  const prod = productos.find(x => (x.nombre||'').toLowerCase() === nombreItem);
  if (prod) prod.stock = (prod.stock || 0) + cantItem;

  // 2. Sincronizar cuenta del cliente si la venta era fiada
  if (venta.cliente && venta.cliente !== 'Público General') {
    const c = clientes.find(x => x.nombre === venta.cliente);
    if (c) {
      const hMatch = c.historial.find(h =>
        (h.fecha === venta.fecha || h.fechaISO === venta.fechaISO) && h.hora === venta.hora
      );
      if (hMatch) {
        const realIdx = c.historial.indexOf(hMatch);
        c.historial[realIdx].productos = (c.historial[realIdx].productos || [])
          .filter(p => (p.nombre||'').toLowerCase() !== nombreItem);
        const nuevosProds = c.historial[realIdx].productos;
        const totalBruto = nuevosProds.reduce((s, p) => s + (p.precio||0)*(p.qty||1), 0);
        const nuevoTotal = Math.max(0, totalBruto - (c.historial[realIdx].pagadoAlComprar || 0));
        c.historial[realIdx].total = nuevoTotal;
        if (nuevosProds.length === 0 || nuevoTotal <= 0) {
          c.historial[realIdx].pagado = c.historial[realIdx].total;
        }
        c.deuda = c.historial.reduce((s, h2) => s + Math.max(0, h2.total - h2.pagado), 0);
      }
    }
  }

  // 3. Modificar ventasHistorial
  if (items.length <= 1) {
    ventasHistorial = ventasHistorial.filter(v => v.id !== ventaId);
  } else {
    items.splice(itemIndex, 1);
    const nuevoTotal = items.reduce((sum, p) => sum + (p.precio * (p.cant || p.qty || 1)), 0);
    venta.total = nuevoTotal;
    if (venta.pagado !== undefined) venta.pagado = Math.min(venta.pagado, nuevoTotal);
  }

  guardarTodoEnLocalStorage();
  renderProdTable(); renderProdGrid(); renderPOSProducts();
  renderClients();
  actualizarDashboardReal();
  renderReportes(_getPanelActivo());
  showToast('Línea eliminada del reporte', 'success');
}

function _getPanelActivo() {
  const panelVisible = document.querySelector('.rep-panel[style*="flex"], .rep-panel[style*="block"]');
  return panelVisible ? panelVisible.id : null;
}

function eliminarAbonoIndividual(clienteNombre, fechaISO, monto, hora) {
  if (!confirm('¿Eliminar este abono del reporte? Esta acción no se puede deshacer.')) return;
  const c = clientes.find(x => x.nombre === clienteNombre);
  if (!c || !c.pagos) { showToast('No se encontró el abono', 'error'); return; }
  const idx = c.pagos.findIndex(p => p.fechaISO === fechaISO && Math.abs(p.monto - monto) < 0.01 && (p.hora || '—') === hora);
  if (idx === -1) { showToast('No se encontró el abono', 'error'); return; }
  c.pagos.splice(idx, 1);
  guardarTodoEnLocalStorage();
  actualizarDashboardReal();
  renderReportes(_getPanelActivo());
  showToast('Abono eliminado', 'success');
}

function eliminarPagoProvIndividual(fechaISO, proveedor, monto, hora) {
  if (!confirm('¿Eliminar este pago a proveedor del reporte? Esta acción no se puede deshacer.')) return;
  const idx = pagosProveedoresHistorial.findIndex(pp => pp.fechaISO === fechaISO && pp.proveedor === proveedor && Math.abs(parseFloat(pp.monto) - monto) < 0.01 && (pp.hora || '—') === hora);
  if (idx === -1) { showToast('No se encontró el pago', 'error'); return; }
  pagosProveedoresHistorial.splice(idx, 1);
  guardarTodoEnLocalStorage();
  actualizarDashboardReal();
  renderReportes(_getPanelActivo());
  showToast('Pago a proveedor eliminado', 'success');
}



function getRepFechaLabel(fechaISO) {
  const d = new Date(fechaISO + 'T00:00:00');
  const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function renderReportes(panelId) {
  const fecha = getRepFecha();
  const label = document.getElementById('repFechaLabel');
  if (label) label.textContent = getRepFechaLabel(fecha);
  if (!panelId) panelId = 'rep-vendedores';
  if (panelId === 'rep-dia') renderRepDia(fecha);
  else if (panelId === 'rep-cerveza') renderRepProducto(fecha, 'cerveza');
  else if (panelId === 'rep-helado') renderRepProducto(fecha, 'helado');
  else if (panelId === 'rep-yape') renderRepYape(fecha);
  else if (panelId === 'rep-inventario') renderRepInventario(fecha);
  else if (panelId === 'rep-vendedores') renderRepVendedores();
  else if (panelId === 'rep-salidas') renderRepSalidas();
}

function renderRepDia(fecha) {
  const ventaDelDia = v => {
    if (v.fechaISO === fecha) return true;
    if (v.fecha) {
      const parts = v.fecha.split('/');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
        return d.toLocaleDateString('en-CA') === fecha;
      }
    }
    return false;
  };
  
  // Filtrar ventas del día (excluir pagos a proveedores para evitar duplicados)
  const ventas = ventasHistorial.filter(v => ventaDelDia(v) && !v.esPagoPedidoProv);

  // ── CÁLCULOS PARA KPI ──
  const cobradoDia = ventas.reduce((a,v) => a + Math.min(v.pagado ?? v.total ?? 0, v.total ?? 0), 0);
  const fiadoDia = ventas.reduce((a,v) => { 
    const f = (v.total||0) - Math.min(v.pagado ?? v.total ?? 0, v.total||0); 
    return a + (f>0 ? f : 0); 
  }, 0);
  
  const abonosDia = [];
  clientes.forEach(c => { 
    (c.pagos || []).filter(p => p.fechaISO === fecha).forEach(p => abonosDia.push(p)); 
  });
  const totalAbonosDia = abonosDia.reduce((a,p) => a + p.monto, 0);
  
  const pagosProvHoy = pagosProveedoresHistorial.filter(pp => pp.fechaISO === fecha);
  const totalPagosProv = pagosProvHoy.reduce((a, pp) => a + parseFloat(pp.monto || 0), 0);
  const totalNeto = cobradoDia + totalAbonosDia - totalPagosProv;

  // ── RENDER KPI CARDS ──
  document.getElementById('repDiaSummary').innerHTML = `
    <div class="rep-kpi">
      <div class="rep-kpi-icon" style="background:rgba(245,158,11,0.12);color:var(--accent);"><i class="fa fa-sack-dollar"></i></div>
      <div class="rep-kpi-label">💰 CAJA DEL DÍA</div>
      <div class="rep-kpi-value" style="color:var(--accent);">${moneda()} ${totalNeto.toFixed(2)}</div>
      <div class="rep-kpi-sub">Ventas + Abonos - Pagos Proveedores</div>
    </div>
    <div class="rep-kpi">
      <div class="rep-kpi-icon" style="background:rgba(239,68,68,0.12);color:var(--danger);"><i class="fa fa-clock-rotate-left"></i></div>
      <div class="rep-kpi-label">📋 FIADOS DEL DÍA</div>
      <div class="rep-kpi-value" style="color:var(--danger);">${moneda()} ${fiadoDia.toFixed(2)}</div>
      <div class="rep-kpi-sub">${ventas.filter(v => (v.pagado ?? v.total ?? 0) < (v.total ?? 0)).length} venta(s) pendiente(s)</div>
    </div>
    <div class="rep-kpi">
      <div class="rep-kpi-icon" style="background:rgba(59,130,246,0.12);color:#3b82f6;"><i class="fa fa-hand-holding-dollar"></i></div>
      <div class="rep-kpi-label">💵 ABONOS COBRADOS</div>
      <div class="rep-kpi-value" style="color:#3b82f6;">${moneda()} ${totalAbonosDia.toFixed(2)}</div>
      <div class="rep-kpi-sub">${abonosDia.length} pago(s) de deuda</div>
    </div>
    <div class="rep-kpi">
      <div class="rep-kpi-icon" style="background:rgba(249,115,22,0.12);color:var(--warning);"><i class="fa fa-truck"></i></div>
      <div class="rep-kpi-label">🚚 PAGOS PROVEEDORES</div>
      <div class="rep-kpi-value" style="color:var(--warning);">- ${moneda()} ${totalPagosProv.toFixed(2)}</div>
      <div class="rep-kpi-sub">${pagosProvHoy.length} pago(s) realizados</div>
    </div>`;

  // ── RENDER TABLA ──
  const filasTabla = [];
  
  // 1. Ventas normales (un producto por fila)
  ventas.forEach(v => {
    const pagado = Math.min(v.pagado ?? v.total ?? 0, v.total ?? 0);
    const esFiadoTotal = pagado === 0 && v.total > 0;
    const esFiadoParcial = pagado > 0 && pagado < v.total;
    const vendedor = v.vendedor || 'Admin';
    
    let metodoBadge = '';
    if (esFiadoTotal) {
      metodoBadge = '<span class="badge badge-red"><i class="fa fa-clock"></i> Fiado Total</span>';
    } else if (esFiadoParcial) {
      metodoBadge = '<span class="badge badge-yellow"><i class="fa fa-hand-holding-dollar"></i> Parcial</span>';
    } else {
      metodoBadge = metodoBadgeHTML(v.metodoPago);
    }
    
    (v.items || v.productos || []).forEach(item => {
      const cantidad = item.cant || item.qty || 1;
      const precioUnitario = item.precio || 0;
      const subtotal = precioUnitario * cantidad;
      
      filasTabla.push({
        hora: v.hora || '—',
        timestamp: _tsVenta(v.fechaISO, v.hora),
        vendedor: vendedor,
        cliente: v.cliente || 'Público General',
        producto: item.nombre || 'Producto',
        cantidad: cantidad,
        metodo: metodoBadge,
        metodoRaw: v.metodoPago,
        subtotal: subtotal,
        esFiadoTotal: esFiadoTotal,
        esFiadoParcial: esFiadoParcial,
        montoPagado: pagado,
        montoTotal: v.total,
        esAbono: false,
        esPagoProv: false,
        ventaId: v.id
      });
    });
  });
  
    // 2. Abonos de deuda (cada abono es una fila)
    abonosDia.forEach(ab => {
      filasTabla.push({
        hora: ab.hora || '—',
        timestamp: _tsVenta(ab.fechaISO, ab.hora),
        vendedor: 'Cobro',
        cliente: ab.cliente,
        producto: `<i class="fa fa-hand-holding-dollar" style="margin-right:6px; color:#7c3aed;"></i> Abono de deuda`,
        cantidad: 1,
        metodo: ab.metodo === 'yape' 
          ? '<span class="badge" style="background:rgba(124,58,237,0.15);color:#7c3aed;"><i class="fa fa-mobile-screen"></i> Yape</span>'
          : '<span class="badge badge-green"><i class="fa fa-money-bill"></i> Efectivo</span>',
        metodoRaw: ab.metodo,
        subtotal: ab.monto,
        esFiadoTotal: false,
        esFiadoParcial: false,
        esAbono: true,
        esPagoProv: false,
        metodoTexto: ab.metodo === 'yape' ? 'Yape' : 'Efectivo',
        ventaId: null
      });
    });
  
  // 3. Pagos a proveedores
  pagosProvHoy.forEach(pp => {
    if (pp.items && pp.items.length > 0) {
      pp.items.forEach(it => {
        filasTabla.push({
          hora: pp.hora || '—',
          timestamp: _tsVenta(pp.fechaISO, pp.hora),
          vendedor: 'Proveedor',
          cliente: pp.proveedor,
          producto: `📦 ${it.nombre} (pedido)`,
          cantidad: it.qty || 1,
          metodo: pp.metodo === 'yape'
            ? '<span class="badge" style="background:rgba(124,58,237,0.15);color:#7c3aed;"><i class="fa fa-mobile-screen"></i> Yape</span>'
            : '<span class="badge badge-green"><i class="fa fa-money-bill"></i> Efectivo</span>',
          metodoRaw: pp.metodo,
          subtotal: -(parseFloat(pp.monto) || 0) / (pp.items.length || 1),
          esFiadoTotal: false,
          esFiadoParcial: false,
          esAbono: false,
          esPagoProv: true
        });
      });
    } else {
      filasTabla.push({
        hora: pp.hora || '—',
        timestamp: _tsVenta(pp.fechaISO, pp.hora),
        vendedor: 'Proveedor',
        cliente: pp.proveedor,
        producto: '🚚 PAGO A PROVEEDOR',
        cantidad: 1,
        metodo: pp.metodo === 'yape'
          ? '<span class="badge" style="background:rgba(124,58,237,0.15);color:#7c3aed;"><i class="fa fa-mobile-screen"></i> Yape</span>'
          : '<span class="badge badge-green"><i class="fa fa-money-bill"></i> Efectivo</span>',
        metodoRaw: pp.metodo,
        subtotal: -(parseFloat(pp.monto) || 0),
        esFiadoTotal: false,
        esFiadoParcial: false,
        esAbono: false,
        esPagoProv: true
      });
    }
  });
  
  // Ordenar por timestamp descendente
  filasTabla.sort((a, b) => b.timestamp - a.timestamp);
  
  const tbody = document.getElementById('repDiaTbody');
  const cantEl = document.getElementById('repDiaCantVentas');
  if (cantEl) cantEl.textContent = `${filasTabla.length} registro(s)`;
  
  if (filasTabla.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text3);"><i class="fa fa-receipt" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.3;"></i>Sin movimientos para esta fecha</td></tr>`;
    return;
  }
  
  // Generar HTML con separadores visuales
  let htmlParts = [];
  let lastTipo = '';
  
  filasTabla.forEach(f => {
    // Determinar el tipo de fila para agrupar
    let tipoActual = '';
    if (f.esAbono) tipoActual = 'abono';
    else if (f.esPagoProv) tipoActual = 'pago_prov';
    else tipoActual = 'venta';
    
    // Si cambia el tipo y no es el primero, agregar separador
    if (tipoActual !== lastTipo && lastTipo !== '') {
      if (tipoActual === 'abono') {
        htmlParts.push(`<tr style="background:rgba(59,130,246,0.08);"><td colspan="8" style="padding:10px 18px;border-top:2px solid var(--border);border-bottom:1px solid var(--border);font-size:12px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:1px;"><i class="fa fa-hand-holding-dollar" style="margin-right:8px;"></i> ABONOS DE DEUDA</td></tr>`);
      } else if (tipoActual === 'pago_prov') {
        htmlParts.push(`<tr style="background:rgba(249,115,22,0.08);"><td colspan="8" style="padding:10px 18px;border-top:2px solid var(--border);border-bottom:1px solid var(--border);font-size:12px;font-weight:700;color:var(--warning);text-transform:uppercase;letter-spacing:1px;"><i class="fa fa-truck" style="margin-right:8px;"></i> PAGOS A PROVEEDORES</td></tr>`);
      }
    }
    
    // Construir el HTML del monto
    let montoHTML = '';
    const montoAbs = Math.abs(f.subtotal);
    
    if (f.esPagoProv) {
      montoHTML = `<span style="font-weight:700; color:var(--warning);">- ${moneda()} ${montoAbs.toFixed(2)}</span>`;
    } 
    else if (f.esAbono) {
      montoHTML = `<span style="font-weight:700; color:#3b82f6;">+ ${moneda()} ${montoAbs.toFixed(2)}</span>`;
    }
    else if (f.esFiadoTotal) {
      montoHTML = `<span style="color: rgba(239, 68, 68, 0.7); text-decoration: line-through; font-weight: 600;">${moneda()} ${montoAbs.toFixed(2)}</span>`;
    }
    else if (f.esFiadoParcial) {
      const pagado = Math.min(f.montoPagado, f.montoTotal);
      const total = f.montoTotal;
      montoHTML = `
        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
          <span style="font-weight: 700; color: var(--accent);">${moneda()} ${pagado.toFixed(2)}</span>
          <span style="color: var(--text3); text-decoration: line-through; font-size: 12px;">${moneda()} ${total.toFixed(2)}</span>
        </div>`;
    }
    else {
      const color = metodoColorMonto(f.metodoRaw);
      montoHTML = `<span style="font-weight:700; color:${color};">${moneda()} ${montoAbs.toFixed(2)}</span>`;
    }
    
    let deleteBtn = '—';
    if (f.ventaId) {
      deleteBtn = `<button onclick="eliminarVentaIndividual(${f.ventaId})" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--danger);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;" title="Eliminar registro"><i class="fa fa-trash"></i></button>`;
    } else if (f.esAbono) {
      deleteBtn = `<button onclick="eliminarAbonoIndividual(${JSON.stringify(f.cliente)}, ${JSON.stringify(fecha)}, ${f.subtotal}, ${JSON.stringify(f.hora)})" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--danger);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;" title="Eliminar abono"><i class="fa fa-trash"></i></button>`;
    } else if (f.esPagoProv) {
      deleteBtn = `<button onclick="eliminarPagoProvIndividual(${JSON.stringify(fecha)}, ${JSON.stringify(f.cliente)}, ${Math.abs(f.subtotal)}, ${JSON.stringify(f.hora)})" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--danger);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;" title="Eliminar pago proveedor"><i class="fa fa-trash"></i></button>`;
    }
    htmlParts.push(`<tr>
      <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text3);">${f.hora}</td>
      <td><span class="badge badge-yellow" style="font-size:10px;background:rgba(245,158,11,0.15);">${f.vendedor}</span></td>
      <td>${f.cliente}</td>
      <td style="font-weight:500; font-size:13px;">${f.producto}${f.cantidad > 1 && !f.producto.includes('ABONO') && !f.producto.includes('PAGO') ? ` x${f.cantidad}` : ''}</td>
      <td style="text-align:center;">${f.cantidad > 1 && !f.producto.includes('ABONO') && !f.producto.includes('PAGO') ? `<span class="badge badge-blue">${f.cantidad} uds.</span>` : (f.producto.includes('ABONO') || f.producto.includes('PAGO') ? '—' : '<span class="badge badge-blue">1 ud.</span>')}</td>
      <td>${f.metodo}</td>
      <td style="text-align:right;">${montoHTML}</td>
      <td style="text-align:center;">${deleteBtn}</td>
    </tr>`);
    
    lastTipo = tipoActual;
  });
  
  tbody.innerHTML = htmlParts.join('');
}

function esCerveza(nombre) {
  const n = (nombre||'').toLowerCase();
  return n.includes('cerveza')||n.includes('pilsen')||n.includes('cusqueña')||n.includes('cristal')||n.includes('arequipeña')||n.includes('barena')||n.includes('tres cruces')||n.includes('corona')||n.includes('heineken')||n.includes('porter')||n.includes('trujillo');
}
function esHelado(nombre) {
  const n = (nombre||'').toLowerCase();
  return n.includes('helado')||n.includes('paleta')||n.includes('sublime')||n.includes('florida')||n.includes('artika')||n.includes('donofrio')||n.includes('eskimo');
}

// Detectar si un item de venta es cerveza o helado (por categoría del producto o por nombre)
function itemEsCerveza(itemNombre) {
  const prod = productos.find(p => p.nombre === itemNombre);
  if (prod && prod.cat) {
    const cat = prod.cat.toLowerCase();
    if (cat.includes('cerveza')) return true;
  }
  return esCerveza(itemNombre);
}
function itemEsHelado(itemNombre) {
  const prod = productos.find(p => p.nombre === itemNombre);
  if (prod && prod.cat) {
    const cat = prod.cat.toLowerCase();
    if (cat.includes('helado')) return true;
  }
  return esHelado(itemNombre);
}

// Convierte hora en formato "05:15 p. m." o "05:15" a minutos desde medianoche
function _horaAMinutos(hora) {
  if (!hora || hora === '—') return 0;
  const clean = hora.replace(/\s/g, '').toLowerCase();
  const esPM = clean.includes('p.m') || clean.includes('pm');
  const esAM = clean.includes('a.m') || clean.includes('am');
  const nums = clean.replace(/[^0-9:]/g, '');
  const [h, m] = nums.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  let hh = h;
  if (esPM && hh < 12) hh += 12;
  if (esAM && hh === 12) hh = 0;
  return hh * 60 + m;
}
// Devuelve un timestamp comparable para ordenar: usa fechaISO + hora parseada
function _tsVenta(fechaISO, hora) {
  const base = fechaISO ? new Date(fechaISO + 'T00:00:00').getTime() : 0;
  return base + _horaAMinutos(hora) * 60000;
}

function renderRepProducto(fecha, tipo) {
  const esFn = tipo==='cerveza' ? itemEsCerveza : itemEsHelado;
  const emoji = tipo==='cerveza' ? '🍺' : '🍦';
  const color = tipo==='cerveza' ? '#f59e0b' : '#06b6d4';
  const summaryId = `rep${tipo.charAt(0).toUpperCase()+tipo.slice(1)}Summary`;
  const tbodyId = `rep${tipo.charAt(0).toUpperCase()+tipo.slice(1)}Body`;
  const totalAmtId = `rep${tipo.charAt(0).toUpperCase()+tipo.slice(1)}TotalAmt`;
  const vendSelectId = tipo==='cerveza' ? 'repCervezaVendSelect' : null;

  // Poblar select de vendedor
  const vendSel = vendSelectId ? document.getElementById(vendSelectId) : null;
  if (vendSel) {
    const currentVal = vendSel.value;
    const todosVends = [...new Set([
      ...ventasHistorial.map(v => v.vendedor || 'Admin'),
      ...(vendedores||[]).map(v => (v.nombre + (v.apellido?' '+v.apellido:'')).trim()),
      'Admin'
    ])].sort();
    vendSel.innerHTML = '<option value="todos">Todos los usuarios</option>';
    todosVends.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      vendSel.appendChild(opt);
    });
    if ([...vendSel.options].some(o => o.value === currentVal)) vendSel.value = currentVal;
    else vendSel.value = 'todos';
  }
  const vendFiltro = vendSel ? vendSel.value : 'todos';

  const lineas = [];
  ventasHistorial.forEach(v => {
    if (vendFiltro !== 'todos' && (v.vendedor || 'Admin') !== vendFiltro) return;
    (v.items||v.productos||[]).forEach(item => {
      if (esFn(item.nombre||'')) {
        lineas.push({
          fecha: v.fecha||'—',
          fechaISO: v.fechaISO||'',
          hora: v.hora||'00:00',
          nombre: item.nombre,
          cant: item.cant||item.qty||1,
          precio: item.precio||0,
          metodo: v.metodoPago||'efectivo',
          vendedor: v.vendedor || 'Admin'
        });
      }
    });
  });

  const totalCant = lineas.reduce((a,l)=>a+l.cant,0);
  const totalMonto = lineas.reduce((a,l)=>a+l.cant*l.precio,0);
  const _esEf = l => l.metodo!=='yape' && l.metodo!=='tarjeta' && l.metodo!=='mixto';
  const _esOtro = l => l.metodo==='tarjeta' || l.metodo==='mixto';
  const totalEfectivo = lineas.filter(_esEf).reduce((a,l)=>a+l.cant*l.precio,0);
  const totalOtros = lineas.filter(_esOtro).reduce((a,l)=>a+l.cant*l.precio,0);
  const totalYape = lineas.filter(l=>l.metodo==='yape').reduce((a,l)=>a+l.cant*l.precio,0);
  const porProd = {};
  lineas.forEach(l=>{ if(!porProd[l.nombre]) porProd[l.nombre]={cant:0,monto:0}; porProd[l.nombre].cant+=l.cant; porProd[l.nombre].monto+=l.cant*l.precio; });
  const topProd = Object.entries(porProd).sort((a,b)=>b[1].monto-a[1].monto)[0];

  if (tipo === 'cerveza') _filtroMetodoCerveza = _filtroMetodoCerveza || 'todos';
  const filtroActivo = tipo === 'cerveza' ? _filtroMetodoCerveza : 'todos';
  const mkCard = (filtroVal, bg, accentC, iconHtml, label, valor, sub, activeColor) => {
    const isActive = filtroActivo === filtroVal;
    return `<div onclick="${tipo==='cerveza'?`_filtroMetodoCerveza='${filtroVal}';renderReportes('rep-${tipo}');`:''}" 
      style="background:var(--surface);border:2px solid ${isActive&&tipo==='cerveza'?activeColor:'var(--border)'};border-radius:var(--radius);padding:16px;position:relative;overflow:hidden;cursor:${tipo==='cerveza'?'pointer':'default'};transition:all 0.15s;${isActive&&tipo==='cerveza'?`box-shadow:0 0 0 3px ${activeColor}22;`:''}">
      <div style="position:absolute;inset:0;background:linear-gradient(135deg,${bg},transparent);pointer-events:none;"></div>
      <div style="width:34px;height:34px;border-radius:9px;background:${bg.replace('0.06','0.15')};color:${accentC};display:flex;align-items:center;justify-content:center;font-size:${iconHtml.startsWith('<')?'14px':'16px'};margin-bottom:10px;">${iconHtml}</div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:3px;">${label}${isActive&&tipo==='cerveza'?' ✓':''}</div>
      <div style="font-size:19px;font-weight:800;color:${accentC};font-family:'JetBrains Mono',monospace;">${valor}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:3px;">${sub}</div>
    </div>`;
  };

  document.getElementById(summaryId).innerHTML = 
    mkCard('todos', 'rgba(245,158,11,0.06)', color, emoji, 'Total Vendido', `${moneda()} ${totalMonto.toFixed(2)}`, 'Todo el historial', color) +
    mkCard('efectivo', 'rgba(16,185,129,0.06)', '#10b981', '<i class="fa fa-money-bill-wave"></i>', 'En Efectivo', `${moneda()} ${totalEfectivo.toFixed(2)}`, `${lineas.filter(_esEf).length} linea(s)`, '#10b981') +
    mkCard('yape', 'rgba(124,58,237,0.06)', '#7c3aed', '<i class="fa fa-mobile-screen"></i>', 'En Yape', `${moneda()} ${totalYape.toFixed(2)}`, `${lineas.filter(l=>l.metodo==='yape').length} linea(s)`, '#7c3aed') +
    mkCard('otros', 'rgba(14,165,233,0.06)', '#0ea5e9', '<i class="fa fa-credit-card"></i>', 'Tarjeta / Mixto', `${moneda()} ${totalOtros.toFixed(2)}`, `${lineas.filter(_esOtro).length} linea(s)`, '#0ea5e9') +
    mkCard('todos_unidades', 'rgba(59,130,246,0.06)', '#3b82f6', '<i class="fa fa-cubes"></i>', 'Unidades Vendidas', `${totalCant}`, `Más vendido: ${topProd?topProd[0]:'N/A'}`, '#3b82f6');

  const tbody = document.getElementById(tbodyId);
  const totalEl = document.getElementById(totalAmtId);
  if (totalEl) totalEl.textContent = `${moneda()} ${totalMonto.toFixed(2)}`;
  // Aplicar filtro de método para cerveza
  const lineasFiltradas = tipo === 'cerveza' && _filtroMetodoCerveza !== 'todos' && _filtroMetodoCerveza !== 'todos_unidades'
    ? lineas.filter(l => _filtroMetodoCerveza === 'yape' ? l.metodo === 'yape' : (_filtroMetodoCerveza === 'otros' ? _esOtro(l) : _esEf(l)))
    : lineas;
  const cantId = tipo === 'cerveza' ? 'repCervezaCant' : 'repHeladoCant';
  const cantEl2 = document.getElementById(cantId);
  if (cantEl2) cantEl2.textContent = `${lineasFiltradas.length} registro${lineasFiltradas.length !== 1 ? 's' : ''}`;
  if (!lineasFiltradas.length) {
    tbody.innerHTML = `<tr><td colspan="${tipo==='cerveza'?6:5}" style="text-align:center;padding:32px;color:var(--text3);">${emoji} Sin registros de ${tipo}s aún</td></tr>`;
    return;
  }
  tbody.innerHTML = lineasFiltradas.slice().sort((a,b)=>{
    const ta = _tsVenta(a.fechaISO, a.hora);
    const tb = _tsVenta(b.fechaISO, b.hora);
    return tb - ta;
  }).map(l=>{
    const metodoBadge = metodoBadgeHTML(l.metodo);
    const vendBadge = `<span class="badge badge-yellow" style="font-size:10px;background:rgba(245,158,11,0.15);">${l.vendedor||'Admin'}</span>`;
    if (tipo === 'cerveza') {
      return `<tr>
        <td style="font-size:12px;color:var(--text3);">${l.fecha}</td>
        <td>${vendBadge}</td>
        <td style="font-weight:500;">${l.nombre}</td>
        <td style="text-align:center;"><span class="badge badge-blue">${l.cant} uds.</span></td>
        <td>${metodoBadge}</td>
        <td style="text-align:right;font-weight:700;color:${color};font-family:'JetBrains Mono',monospace;">${moneda()} ${(l.cant*l.precio).toFixed(2)}</td>
      </tr>`;
    }
    return `<tr>
      <td style="font-size:12px;color:var(--text3);">${l.fecha}</td>
      <td style="font-weight:500;">${l.nombre}</td>
      <td style="text-align:center;"><span class="badge badge-blue">${l.cant} uds.</span></td>
      <td>${metodoBadge}</td>
      <td style="text-align:right;font-weight:700;color:${color};font-family:'JetBrains Mono',monospace;">${moneda()} ${(l.cant*l.precio).toFixed(2)}</td>
    </tr>`;
  }).join('');
}

function renderRepYape(fecha) {
  const vendSel = document.getElementById('repYapeVendSelect');
  if (vendSel) {
    const currentVal = vendSel.value;
    const todosVends = [...new Set([...ventasHistorial.map(v => v.vendedor || 'Admin'), ...(vendedores||[]).map(v => (v.nombre + (v.apellido?' '+v.apellido:'')).trim()), 'Admin'])].sort();
    vendSel.innerHTML = '<option value="todos">Todos los usuarios</option>';
    todosVends.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; vendSel.appendChild(o); });
    if ([...vendSel.options].some(o => o.value === currentVal)) vendSel.value = currentVal;
    else vendSel.value = 'todos';
  }
  const vendFiltro = vendSel ? vendSel.value : 'todos';

  // ✅ FIX: función de comparación de fecha con fallback (igual que renderRepDia)
  const esMismaFecha = v => {
    if (v.fechaISO === fecha) return true;
    if (v.fecha) {
      const parts = v.fecha.split('/');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
        return d.toLocaleDateString('en-CA') === fecha;
      }
    }
    return false;
  };
  const esMismaFechaP = p => {
    if (p.fechaISO === fecha) return true;
    if (p.fecha) {
      const parts = p.fecha.split('/');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
        return d.toLocaleDateString('en-CA') === fecha;
      }
    }
    return false;
  };

  const ventasYape = ventasHistorial.filter(v => esVentaDeMetodo(v, 'yape') && !v.esPagoPedidoProv && esMismaFecha(v) && (vendFiltro === 'todos' || (v.vendedor || 'Admin') === vendFiltro));
  const abonosYape = [];
  clientes.forEach(c => {
    (c.pagos || []).filter(p => p.metodo === 'yape' && esMismaFechaP(p) && (vendFiltro === 'todos' || (p.vendedor || 'Admin') === vendFiltro)).forEach(p => {
      abonosYape.push({ cliente: c.nombre, fecha: p.fecha||'—', fechaISO: p.fechaISO||'', hora: p.hora||'—', monto: p.monto, tipo: 'abono' });
    });
  });
  const pagosProveedoresYape = pagosProveedoresHistorial.filter(pp => pp.metodo === 'yape' && esMismaFechaP(pp) && (vendFiltro === 'todos' || (pp.vendedor || 'Admin') === vendFiltro));

  const totalVentasYape = ventasYape.reduce((a, v) => a + desgloseVenta(v).yape, 0);
  const totalAbonosYape = abonosYape.reduce((a, p) => a + p.monto, 0);
  const totalPagosProvYape = pagosProveedoresYape.reduce((a, pp) => a + parseFloat(pp.monto || 0), 0);
  const totalNetoYape = totalVentasYape + totalAbonosYape - totalPagosProvYape;

  // Calcular fiado/semipagado por producto (FIFO)
  let totalFiadoYape = 0, totalSemiYape = 0;
  ventasYape.forEach(v => {
    if (v.metodoPago === 'mixto') return;
    const pagado = Math.min(v.pagado ?? v.total ?? 0, v.total ?? 0);
    const esFiadoTotal = pagado === 0 && (v.total||0) > 0;
    const esFiadoParcial = pagado > 0 && pagado < (v.total||0);
    const prods = v.items || v.productos || [];
    prods.forEach((p, pIdx) => {
      const subtotal = p.precio * (p.cant || p.qty || 1);
      if (esFiadoTotal) { totalFiadoYape += subtotal; return; }
      if (!esFiadoParcial) return;
      let pagadoAntes = 0;
      for (let i = 0; i < pIdx; i++) { const pr = prods[i]; pagadoAntes += pr.precio * (pr.cant||pr.qty||1); }
      const cubierto = Math.min(Math.max(0, pagado - pagadoAntes), subtotal);
      const pendiente = subtotal - cubierto;
      if (cubierto <= 0.004) totalFiadoYape += subtotal;
      else if (pendiente > 0.004) totalSemiYape += pendiente;
    });
  });

  const mkYape = (fv, bg, ac, ic, lbl, val, sub) => {
    const isA = _filtroMetodoYape === fv;
    return `<div onclick="_filtroMetodoYape='${fv}';renderReportes('rep-yape');" style="background:var(--surface);border:2px solid ${isA?ac:'var(--border)'};border-radius:var(--radius);padding:16px;position:relative;overflow:hidden;cursor:pointer;transition:all 0.15s;${isA?`box-shadow:0 0 0 3px ${ac}22;`:''}">
      <div style="position:absolute;inset:0;background:linear-gradient(135deg,${bg},transparent);pointer-events:none;"></div>
      <div style="width:34px;height:34px;border-radius:9px;background:${bg.replace('0.06','0.15')};color:${ac};display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:10px;">${ic}</div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:3px;">${lbl}${isA?' ✓':''}</div>
      <div style="font-size:19px;font-weight:800;color:${ac};font-family:'JetBrains Mono',monospace;">${val}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:3px;">${sub}</div>
    </div>`;
  };
  const kpiPendienteYape = (totalFiadoYape > 0 || totalSemiYape > 0) ? `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;position:relative;overflow:hidden;">
      <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(239,68,68,0.06),transparent);pointer-events:none;"></div>
      <div style="width:34px;height:34px;border-radius:9px;background:rgba(239,68,68,0.15);color:var(--danger);display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:10px;"><i class="fa fa-clock-rotate-left"></i></div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:3px;">Pendiente de Cobro</div>
      <div style="font-size:19px;font-weight:800;color:var(--danger);font-family:'JetBrains Mono',monospace;">${moneda()} ${(totalFiadoYape + totalSemiYape).toFixed(2)}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:3px;">Fiado: ${moneda()} ${totalFiadoYape.toFixed(2)} · Semi: ${moneda()} ${totalSemiYape.toFixed(2)}</div>
    </div>` : '';
  document.getElementById('repYapeSummary').innerHTML =
    mkYape('todos','rgba(124,58,237,0.06)','#7c3aed','<i class="fa fa-mobile-screen"></i>','Total Neto Yape',`${moneda()} ${totalNetoYape.toFixed(2)}`,'Ventas + Abonos - Proveedores') +
    mkYape('ventas','rgba(245,158,11,0.06)','#f59e0b','<i class="fa fa-receipt"></i>','Ventas Yape',`${moneda()} ${totalVentasYape.toFixed(2)}`,`${ventasYape.length} venta(s)`) +
    mkYape('abonos','rgba(59,130,246,0.06)','#3b82f6','<i class="fa fa-hand-holding-dollar"></i>','Abonos de Deuda',`${moneda()} ${totalAbonosYape.toFixed(2)}`,`${abonosYape.length} abono(s)`) +
    mkYape('proveedores','rgba(249,115,22,0.06)','var(--warning)','<i class="fa fa-truck"></i>','Pagos Proveedores',`${moneda()} ${totalPagosProvYape.toFixed(2)}`,`${pagosProveedoresYape.length} pago(s)`) +
    kpiPendienteYape;

  const tbody = document.getElementById('repYapeBody');
  const totalEl = document.getElementById('repYapeTotalAmt');
  if (totalEl) totalEl.textContent = `${moneda()} ${totalNetoYape.toFixed(2)}`;

  if (!ventasYape.length && !abonosYape.length && !pagosProveedoresYape.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3);"><i class="fa fa-mobile-screen" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.3;"></i>Sin movimientos Yape registrados</td></tr>`;
    const yapeCountEl = document.getElementById('repYapeCant');
    if (yapeCountEl) yapeCountEl.textContent = '0 registros';
    return;
  }

  // Filas por producto con FIFO
  const filasVentas = [];
  ventasYape.forEach(v => {
    if (v.metodoPago === 'mixto') { filasVentas.push({ tipo:'venta', timestamp: _tsVenta(v.fechaISO, v.hora), html: filaMixtoHTML(v, 'yape') }); return; }
    const pagado = Math.min(v.pagado ?? v.total ?? 0, v.total ?? 0);
    const esFiadoTotal = pagado === 0 && (v.total||0) > 0;
    const esFiadoParcial = pagado > 0 && pagado < (v.total||0);
    const prods = v.items || v.productos || [];
    prods.forEach((p, pIdx) => {
      const subtotal = p.precio * (p.cant || p.qty || 1);
      let cubierto = subtotal;
      if (esFiadoParcial) {
        let pagadoAntes = 0;
        for (let i = 0; i < pIdx; i++) { const pr = prods[i]; pagadoAntes += pr.precio*(pr.cant||pr.qty||1); }
        cubierto = Math.min(Math.max(0, pagado - pagadoAntes), subtotal);
      }
      const pendiente = subtotal - cubierto;
      let rowBg, montoHTML;
      if (esFiadoTotal) {
        rowBg = 'background:rgba(100,116,139,0.12);';
        montoHTML = `<span style="color:var(--text3);text-decoration:line-through;font-weight:600;">${moneda()} ${subtotal.toFixed(2)}</span>`;
      } else if (esFiadoParcial && cubierto < subtotal - 0.004 && cubierto > 0.004) {
        rowBg = 'background:rgba(59,130,246,0.08);';
        montoHTML = `<div style="display:flex;justify-content:flex-end;align-items:center;gap:6px;"><span style="font-weight:700;color:#7c3aed;">${moneda()} ${cubierto.toFixed(2)}</span><span style="color:var(--text3);text-decoration:line-through;font-size:12px;">${moneda()} ${subtotal.toFixed(2)}</span></div>`;
      } else if (esFiadoParcial && cubierto <= 0.004) {
        rowBg = 'background:rgba(100,116,139,0.12);';
        montoHTML = `<span style="color:var(--text3);text-decoration:line-through;font-weight:600;">${moneda()} ${subtotal.toFixed(2)}</span>`;
      } else {
        rowBg = 'background:var(--surface);';
        montoHTML = `<span style="font-weight:700;color:#7c3aed;">${moneda()} ${subtotal.toFixed(2)}</span>`;
      }
      filasVentas.push({ tipo:'venta', timestamp: _tsVenta(v.fechaISO, v.hora),
        html:`<tr style="${rowBg}">
          <td style="font-size:12px;color:var(--text3);">${v.fecha||'—'}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text3);">${v.hora||'—'}</td>
          <td style="font-weight:500;">${v.cliente||'Público General'}</td>
          <td style="font-size:12px;color:var(--text2);">${p.nombre} x${p.cant||p.qty||1}</td>
          <td><span class="badge" style="background:rgba(124,58,237,0.15);color:#7c3aed;">Yape</span></td>
          <td style="text-align:right;">${montoHTML}</td>
          <td style="text-align:center;"><button onclick="eliminarVentaIndividual(${v.id})" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--danger);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;" title="Eliminar"><i class="fa fa-trash"></i></button></td>
        </tr>`
      });
    });
  });

  const filasAbonos = [];
  if (abonosYape.length > 0) {
    filasAbonos.push({ tipo:'separador_abonos', timestamp:0, html:`<tr style="background:rgba(59,130,246,0.06);"><td colspan="7" style="padding:8px 18px;border-top:2px dashed var(--border);border-bottom:1px solid var(--border);font-size:11px;color:#7c3aed;font-weight:700;text-transform:uppercase;letter-spacing:1px;"><i class="fa fa-hand-holding-dollar" style="margin-right:8px;"></i> ABONOS DE DEUDA</td></tr>` });
    abonosYape.forEach(p => filasAbonos.push({ tipo:'abono', timestamp: _tsVenta(p.fechaISO, p.hora),
      html:`<tr style="background:rgba(124,58,237,0.04);">
        <td style="font-size:12px;color:var(--text3);">${p.fecha}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text3);">${p.hora}</td>
        <td style="font-weight:500;">${p.cliente}</td>
        <td style="font-size:12px;color:#7c3aed;"><i class="fa fa-hand-holding-dollar"></i> Abono de deuda</td>
        <td><span class="badge" style="background:rgba(124,58,237,0.15);color:#7c3aed;">Yape</span></td>
        <td style="text-align:right;"><span style="font-weight:700;color:#7c3aed;">+ ${moneda()} ${p.monto.toFixed(2)}</span></td>
        <td style="text-align:center;"><button onclick="eliminarAbonoIndividual(${JSON.stringify(p.cliente)}, ${JSON.stringify(p.fechaISO)}, ${p.monto}, ${JSON.stringify(p.hora)})" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--danger);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;" title="Eliminar abono"><i class="fa fa-trash"></i></button></td>
      </tr>`
    }));
  }

  const filasProveedores = [];
  if (pagosProveedoresYape.length > 0) {
    filasProveedores.push({ tipo:'separador_prov', timestamp:0, html:`<tr style="background:rgba(249,115,22,0.06);"><td colspan="7" style="padding:8px 18px;border-top:2px dashed var(--border);border-bottom:1px solid var(--border);font-size:11px;color:var(--warning);font-weight:700;text-transform:uppercase;letter-spacing:1px;"><i class="fa fa-truck" style="margin-right:8px;"></i> PAGOS A PROVEEDORES</td></tr>` });
    pagosProveedoresYape.forEach(pp => {
      const itemsTxt = (pp.items||[]).map(it=>`${it.nombre} x${it.qty}`).join(', ')||'Pedido';
      filasProveedores.push({ tipo:'pago_prov', timestamp: _tsVenta(pp.fechaISO, pp.hora),
        html:`<tr style="background:rgba(249,115,22,0.04);">
          <td style="font-size:12px;color:var(--text3);">${pp.fecha||'—'}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text3);">${pp.hora||'—'}</td>
          <td style="font-weight:500;">${pp.proveedor}</td>
          <td style="font-size:12px;color:var(--warning);"><i class="fa fa-truck"></i> ${itemsTxt}</td>
          <td><span class="badge" style="background:rgba(124,58,237,0.15);color:#7c3aed;">Yape</span></td>
          <td style="text-align:right;"><span style="font-weight:700;color:var(--warning);">- ${moneda()} ${parseFloat(pp.monto).toFixed(2)}</span></td>
          <td style="text-align:center;"><button onclick="eliminarPagoProvIndividual(${JSON.stringify(pp.fechaISO)}, ${JSON.stringify(pp.proveedor)}, ${parseFloat(pp.monto)}, ${JSON.stringify(pp.hora||'—')})" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--danger);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;" title="Eliminar pago proveedor"><i class="fa fa-trash"></i></button></td>
        </tr>`
      });
    });
  }

  let todasLasFilas = [...filasVentas, ...filasAbonos, ...filasProveedores];
  if (_filtroMetodoYape !== 'todos') {
    todasLasFilas = todasLasFilas.filter(f => {
      if (_filtroMetodoYape === 'ventas') return f.tipo === 'venta';
      if (_filtroMetodoYape === 'abonos') return f.tipo === 'abono';
      if (_filtroMetodoYape === 'proveedores') return f.tipo === 'pago_prov';
      return true;
    });
  }
  const yapeCountEl2 = document.getElementById('repYapeCant');
  const countableFilas = todasLasFilas.filter(f => !f.tipo.startsWith('separador'));
  if (yapeCountEl2) yapeCountEl2.textContent = `${countableFilas.length} registro${countableFilas.length!==1?'s':''}`;
  tbody.innerHTML = todasLasFilas.sort((a,b)=>b.timestamp-a.timestamp).map(f=>f.html).join('');
}


