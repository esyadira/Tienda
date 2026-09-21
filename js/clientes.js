// ========================================
// CLIENTS
// ========================================
function renderClients(filteredList){
  const tb=document.getElementById('clientTbody');
  const data = filteredList !== undefined ? filteredList : clientes;
  const cc=document.getElementById('clientContador');
  if(cc){const t=clientes.length,m=data.length;cc.textContent=m<t?`${m} de ${t} clientes`:`${t} cliente${t!==1?'s':''}`;}
  if(!data.length){tb.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text3);font-size:13px;"><i class="fa fa-users" style="display:block;font-size:28px;margin-bottom:8px;opacity:0.3;"></i>Sin registros</td></tr>`;if(typeof actualizarNotificaciones==='function')actualizarNotificaciones();return;}
  tb.innerHTML=data.map(c=>{
    const pct=Math.min((c.deuda/c.limite)*100,100);
    const limiteDeuda = parseFloat(settings.alertas.montoDeuda) || 100;
    const deudaAlta = c.deuda > limiteDeuda;
    const envases = c.botellas || 0;
    return`<tr style="cursor:pointer;" onclick="verCuentaCliente(${c.id})" onmouseenter="this.style.background='var(--surface2)'" onmouseleave="this.style.background=''">
      <td><div style="display:flex;align-items:center;gap:8px;"><div class="rs-avatar" style="width:32px;height:32px;font-size:11px;">${c.nombre.split(' ').map(x=>x[0]).join('').slice(0,2)}</div><span style="font-weight:500;">${c.nombre}</span></div></td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:12px;">${c.tel}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:600;${deudaAlta?'color:var(--danger)':c.deuda>0?'color:var(--warning)':'color:var(--accent3)'}">${moneda()} ${c.deuda.toFixed(2)}</span>
          <div class="client-debt-bar"><div class="client-debt-fill" style="width:${pct}%"></div></div>
        </div>
      </td>
      <td style="text-align:center;">
        ${envases > 0 ? `<span class="badge badge-red" style="font-size:12px;">🍾 ${envases}</span>` : `<span style="color:var(--text3);font-size:12px;">—</span>`}
      </td>
      <td style="font-size:12px;color:var(--text3);">${c.ultima}</td>
      <td><span class="badge ${deudaAlta?'badge-red':c.deuda>0?'badge-yellow':'badge-green'}">${deudaAlta?'Deuda alta':c.deuda>0?'Con deuda':'Al día'}</span></td>
      <td><div class="action-btns" onclick="event.stopPropagation()">
        <div class="icon-btn" title="Registrar pago" onclick="pagarDeudaCliente(${c.id})" style="color:var(--accent3);border-color:rgba(16,185,129,0.3);${c.deuda<=0?'opacity:0.4;pointer-events:none;':''}"><i class="fa fa-money-bill"></i></div>
        <div class="icon-btn" title="Editar" onclick="editCliente(${c.id})"><i class="fa fa-pen"></i></div>
        <div class="icon-btn del" title="Eliminar" onclick="delClient(${c.id})"><i class="fa fa-trash"></i></div>
      </div></td>
    </tr>`;
  }).join('');
  if(typeof actualizarNotificaciones === 'function') actualizarNotificaciones();
}

function saveCliente(){
  const editId = parseInt(document.getElementById('editClienteId').value)||0;
  const nombre = ((document.getElementById('cNombre').value||'Nuevo')+' '+(document.getElementById('cApellido').value||'')).trim();
  const tel = document.getElementById('cTel').value||'---';
  if(editId){
    const c = clientes.find(x=>x.id===editId);
    if(c){ c.nombre=nombre; c.tel=tel; }
    showToast('Cliente actualizado','success');
  } else {
    clientes.push({id:Date.now(),nombre,tel,deuda:0,limite:200,ultima:new Date().toLocaleDateString('en-CA'),historial:[]});
    showToast('Cliente guardado','success');
  }
  renderClients();closeModal('modalCliente');guardarTodoEnLocalStorage();
}
function addClient(){ saveCliente(); } // backward compat
function editCliente(id){
  const c=clientes.find(x=>x.id===id); if(!c)return;
  document.getElementById('editClienteId').value=c.id;
  document.getElementById('modalClienteTitle').innerHTML='<i class="fa fa-pen" style="color:var(--accent2);margin-right:8px;"></i>Editar Cliente';
  document.getElementById('cNombre').value=c.nombre.split(' ')[0]||c.nombre;
  document.getElementById('cApellido').value=c.nombre.split(' ').slice(1).join(' ')||'';
  document.getElementById('cTel').value=c.tel==='---'?'':c.tel;
  openModal('modalCliente');
}
function openNuevoCliente(){
  document.getElementById('editClienteId').value='';
  document.getElementById('modalClienteTitle').innerHTML='<i class="fa fa-user-plus" style="color:var(--accent2);margin-right:8px;"></i>Nuevo Cliente';
  document.getElementById('cNombre').value='';
  document.getElementById('cApellido').value='';
  document.getElementById('cTel').value='';
  openModal('modalCliente');
}
// ID temporal para el cliente que se va a eliminar
let _pendingDelClienteId = null;

function delClient(id){
  const c = clientes.find(x => x.id === id);
  if (!c) return;
  _pendingDelClienteId = id;
  document.getElementById('confirmDelClienteNombre').textContent = c.nombre;
  document.getElementById('confirmDelClienteTel').textContent = c.tel && c.tel !== '---' ? '📞 ' + c.tel : '';
  openModal('modalConfirmDelCliente');
}

function confirmarEliminarCliente(){
  if (!_pendingDelClienteId) return;
  clientes = clientes.filter(c => c.id !== _pendingDelClienteId);
  _pendingDelClienteId = null;
  closeModal('modalConfirmDelCliente');
  renderClients();
  guardarTodoEnLocalStorage();
  showToast('Cliente eliminado', 'success');
}

// Eliminar un producto individual de la cuenta fiada de un cliente
function eliminarProductoDeCuenta(clienteId, histIdx, prodIdx) {
  const c = clientes.find(x => x.id === clienteId);
  if (!c) return;
  // histPendiente es un filtro de c.historial, necesitamos el índice real
  const histPendiente = c.historial.filter(h => h.total > h.pagado);
  const h = histPendiente[histIdx];
  if (!h) return;
  const realHIdx = c.historial.indexOf(h);
  if (realHIdx === -1) return;

  const p = h.productos[prodIdx];
  if (!p) return;
  const nombreProd = (p.nombre || 'este producto').toUpperCase();
  const lineTotal = (p.precio || 0) * (p.qty || 1);

  if (!cfgConfirm(`¿Eliminar "${nombreProd}" (${moneda()} ${lineTotal.toFixed(2)}) de la cuenta?`)) return;

  // Reponer stock del producto eliminado
  const prod = productos.find(x => x.nombre && x.nombre.toLowerCase() === (p.nombre||'').toLowerCase());
  if (prod) prod.stock = (prod.stock || 0) + (p.qty || 1);

  // Quitar el producto
  c.historial[realHIdx].productos.splice(prodIdx, 1);

  // Recalcular total de esa venta
  const nuevosProds = c.historial[realHIdx].productos;
  const nuevoTotal = nuevosProds.reduce((s, pr) => s + (pr.precio||0)*(pr.qty||1), 0) - (c.historial[realHIdx].pagadoAlComprar || 0);
  c.historial[realHIdx].total = Math.max(0, nuevoTotal);

  // Si quedó en 0 productos o deuda 0, marcar como pagado
  if (nuevosProds.length === 0 || c.historial[realHIdx].total <= 0) {
    c.historial[realHIdx].pagado = c.historial[realHIdx].total;
  }

  // Recalcular deuda total del cliente
  c.deuda = c.historial.reduce((s, h2) => s + Math.max(0, h2.total - h2.pagado), 0);

  // Sincronizar ventasHistorial: eliminar el producto de la venta correspondiente
  const nombreBuscar = (p.nombre || '').toLowerCase();
  const ventaMatch = ventasHistorial.find(v =>
    (v.cliente === c.nombre) &&
    (v.fecha === h.fecha || v.fechaISO === h.fechaISO) &&
    (v.hora === h.hora)
  );
  if (ventaMatch) {
    // Quitar de items
    if (ventaMatch.items) ventaMatch.items = ventaMatch.items.filter(i => (i.nombre||'').toLowerCase() !== nombreBuscar);
    // Quitar de productos
    if (ventaMatch.productos) ventaMatch.productos = ventaMatch.productos.filter(i => (i.nombre||'').toLowerCase() !== nombreBuscar);
    // Si la venta quedó sin productos, eliminarla del historial
    if ((!ventaMatch.items || ventaMatch.items.length === 0) && (!ventaMatch.productos || ventaMatch.productos.length === 0)) {
      ventasHistorial = ventasHistorial.filter(v => v !== ventaMatch);
    }
  }

  guardarTodoEnLocalStorage();
  renderProdTable(); renderProdGrid(); renderPOSProducts();
  renderClients();
  if (typeof renderReportes === 'function') renderReportes(_getPanelActivo());
  if (typeof actualizarDashboardReal === 'function') actualizarDashboardReal();
  showToast(`"${nombreProd}" eliminado de la cuenta`, 'success');
  verCuentaCliente(clienteId); // recargar el modal
}

function filterClients(){
  const q=document.getElementById('clientSearchBox').value.toLowerCase();
  const f=document.getElementById('clientFilterDeuda').value;
  let data=clientes.filter(c=>{
    const matchQ=!q||c.nombre.toLowerCase().includes(q)||c.tel.includes(q);
    const matchF=!f||(f==='deuda'&&c.deuda>0)||(f==='sindeuda'&&c.deuda===0);
    return matchQ&&matchF;
  });
  renderClients(data);
}

function clearClientFilter(){
  document.getElementById('clientSearchBox').value='';
  document.getElementById('clientFilterDeuda').value='';
  renderClients();
}

let currentCuentaClienteId=null;
let currentClientePago=null;

function verCuentaCliente(id) {
  currentCuentaClienteId = id;
  const c = clientes.find(x => x.id === id);
  if (!c) return;
  
  const histPendiente = c.historial.filter(h => h.total > h.pagado);
  const subtotalActual = histPendiente.reduce((a, h) => a + (h.total - h.pagado), 0);
  const deudaAnterior = Math.max(0, c.deuda - subtotalActual);

  // Asegurar que las propiedades existan para evitar errores
  const botellas = c.botellas || 0;
  const listaNotas = c.notas || [];

  // 1. CABECERA MODIFICADA: Ahora incluye los envases junto a la deuda
  let html = `<div style="margin-bottom:16px;padding:14px;background:var(--surface2);border-radius:10px;display:flex;align-items:center;gap:12px;">
    <div class="rs-avatar" style="width:42px;height:42px;font-size:14px;">${c.nombre.split(' ').map(x => x[0]).join('').slice(0,2)}</div>
    <div>
      <strong style="font-size:15px;">${c.nombre}</strong><br>
      <span style="font-size:12px;color:var(--text3);">Tel: ${c.tel}</span>
    </div>
    
    <div style="margin-left:auto; display:flex; gap:20px; align-items:center;">
      <div style="text-align:right; padding-right:15px; border-right:1px solid var(--border);">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Envases</div>
        <div style="display:flex; align-items:center; gap:8px; justify-content:flex-end;">
          <span style="font-size:18px; font-weight:700; color:var(--accent);">${botellas}</span>
          ${botellas > 0 ? `<button onclick="restarEnvases(${c.id})" style="background:none; border:none; color:var(--danger); cursor:pointer; padding:0; font-size:14px;"><i class="fa fa-minus-circle"></i></button>` : ''}
        </div>
      </div>
    </div>
  </div>`;

 // SECCIÓN DE NOTAS: Ahora con diseño horizontal (una al costado de otra)
  html += `
  <div style="background:rgba(245,158,11,0.05); border:1px solid rgba(245,158,11,0.15); padding:12px; border-radius:10px; margin-bottom:15px;">
    <div style="font-size:10px; color:var(--text2); text-transform:uppercase; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
        <i class="fa fa-sticky-note" style="color:var(--accent);"></i> Historial de Notas del Cliente
    </div>
    
    <div style="display:flex; flex-wrap:wrap; gap:8px; max-height:120px; overflow-y:auto;">
        ${listaNotas.length > 0 ? listaNotas.map((n, idx) => `
            <div style="display:flex; align-items:center; gap:10px; background:var(--surface3); padding:8px 12px; border-radius:8px; border:1px solid var(--border); min-width: 140px; flex: 1 1 auto; max-width: calc(50% - 8px);">
                <div style="display:flex; flex-direction:column; flex:1; overflow:hidden;">
                  <span style="font-size:11px; color:var(--text); font-style:italic; line-height:1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${n.nota}">
                    "${n.nota}"
                  </span>
                  <small style="font-size:8px; color:var(--text3); margin-top:2px;">${n.fecha || ''}</small>
                </div>
                <button onclick="eliminarNotaIndividual(${c.id}, ${idx})" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:12px; padding:2px; flex-shrink:0;">
                    <i class="fa fa-trash-can"></i>
                </button>
            </div>
        `).join('') : '<div style="font-size:11px; color:var(--text3); width:100%; text-align:center; padding:10px;">No hay notas registradas</div>'}
    </div>
  </div>`;

  // Tabla de deuda: una fila por producto, pago aplicado secuencialmente (FIFO)
  html += `<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;margin-bottom:8px;">Detalle de Cuenta Nueva</div>
    
    <div style="background:var(--surface2); border:1px solid var(--border); border-radius:12px; overflow:hidden; max-height: 250px; overflow-y: auto; margin-bottom:12px;">
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:var(--surface3); color:var(--text3); position: sticky; top: 0; z-index: 10;">
            <th style="padding:10px; text-align:left;">FECHA</th>
            <th style="padding:10px; text-align:left;">PRODUCTO</th>
            <th style="padding:10px; text-align:center;">CANT.</th>
            <th style="padding:10px; text-align:right;">PENDIENTE</th>
            <th style="padding:10px; text-align:center; width:40px;"></th>
          </tr>
        </thead>
        <tbody>`;

  if (histPendiente.length === 0) {
    html += `<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--text3);">No hay productos nuevos</td></tr>`;
  } else {
    histPendiente.forEach((h, hIdx) => {
      const prods = h.productos || [];
      // Calcular el total bruto real de los productos
      const totalBruto = prods.reduce((s, p) => s + (p.precio || 0) * (p.qty || 1), 0);
      // pagadoAlComprar: lo que el cliente pagó en el momento de la compra
      // Para registros nuevos: guardado en pagadoAlComprar
      // Para registros viejos: inferir como totalBruto - h.total (ya que total = fiar = lo que faltó)
      let pagadoVenta;
      if (h.pagadoAlComprar !== undefined) {
        pagadoVenta = h.pagadoAlComprar;
      } else {
        pagadoVenta = Math.max(0, totalBruto - (h.total || 0));
      }
      // Aplicar el pago secuencialmente: primero cubre el primer producto, luego el siguiente, etc.
      let restoPagado = pagadoVenta;
      prods.forEach((p, pIdx) => {
        const lineTotal = (p.precio || 0) * (p.qty || 1);
        const cubierto = Math.min(restoPagado, lineTotal);
        restoPagado = Math.max(0, restoPagado - lineTotal);
        const linePendiente = lineTotal - cubierto;
        // Solo mostrar el producto si tiene algo pendiente
        if (linePendiente > 0.004) {
          // Si fue cubierto parcialmente, mostrar precio tachado + pendiente en rojo
          const esParcial = cubierto > 0;
          const celdaPendiente = esParcial
            ? `<td style="padding:10px;text-align:right;">
                <span style="color:var(--accent);font-weight:700;">${moneda()} ${linePendiente.toFixed(2)}</span>
                <span style="color:var(--text3);text-decoration:line-through;font-size:11px;margin-left:6px;">${moneda()} ${lineTotal.toFixed(2)}</span>
               </td>`
            : `<td style="padding:10px;color:var(--danger);font-weight:700;text-align:right;">${moneda()} ${linePendiente.toFixed(2)}</td>`;
          html += `<tr style="border-bottom:1px solid rgba(42,58,82,0.3);">
            <td style="padding:10px;color:var(--text3);white-space:nowrap;">${h.fecha}</td>
            <td style="padding:10px;font-weight:500;">${(p.nombre||'').toUpperCase()}</td>
            <td style="padding:10px;text-align:center;">x${p.qty || 1}</td>
            ${celdaPendiente}
            <td style="padding:6px;text-align:center;">
              <button onclick="eliminarProductoDeCuenta(${c.id}, ${hIdx}, ${pIdx})" title="Eliminar este producto de la cuenta"
                style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--danger);border-radius:6px;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;transition:all 0.15s;"
                onmouseenter="this.style.background='rgba(239,68,68,0.22)'" onmouseleave="this.style.background='rgba(239,68,68,0.1)'">
                <i class="fa fa-trash-can"></i>
              </button>
            </td>
          </tr>`;
        }
      });
    });
  }
  html += `</tbody></table></div>`;
  
  html += `<div style="margin-top:12px;padding:15px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;">
    <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:12px;"><span style="color:var(--text2);">SUBTOTAL PRODUCTOS:</span><span style="color:var(--text);">${moneda()} ${subtotalActual.toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:12px;"><span style="color:var(--text2);">DEUDA ANTERIOR:</span><span style="color:var(--danger); font-weight:600;">${moneda()} ${deudaAnterior.toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;color:var(--accent);border-top:1px solid var(--border);padding-top:10px;"><span>TOTAL CUENTA:</span><span>${moneda()} ${c.deuda.toFixed(2)}</span></div>
  </div>`;
  
  document.getElementById('verCuentaBody').innerHTML = html;
  openModal('modalVerCuenta');
}

function exportCuentaJPG(){
  try {
    const c = clientes.find(x => x.id === currentCuentaClienteId);
    if(!c){ showToast('No se encontró el cliente', 'error'); return; }

    // ===== USAR LA MISMA LÓGICA QUE verCuentaCliente =====
    // Filtrar historial pendiente: igual que el modal (h.total > h.pagado)
    const histPendiente = c.historial.filter(h => h.total > h.pagado);
    const subtotalActual = histPendiente.reduce((a, h) => a + (h.total - h.pagado), 0);
    const deudaAnterior = Math.max(0, c.deuda - subtotalActual);

    const now = new Date();
    const colorAcento = (settings && settings.apariencia && settings.apariencia.colorAcento) || '#f59e0b';
    const nombreNegocio = (settings && settings.negocio && settings.negocio.nombre) || 'BODEGA POS';

    // ===== CONSTRUIR FILAS DE LA TABLA CON SALDOS PENDIENTES (FIFO) =====
    let rows = [];

    histPendiente.forEach(h => {
      const totalBruto = (h.productos || []).reduce((s, p) => s + (p.precio || 0) * (p.qty || 1), 0);
      // pagadoAlComprar: lo que pagó al comprar; pagadoTotal = pagadoAlComprar + abonos posteriores (h.pagado)
      const pagadoVenta = h.pagadoAlComprar !== undefined ? h.pagadoAlComprar : Math.max(0, totalBruto - (h.total || 0));
      // El total real pagado incluye abonos posteriores
      const pagadoTotal = pagadoVenta + (h.pagado || 0);
      let restoPorPagar = Math.max(0, totalBruto - pagadoTotal);
      
      // Calcular FIFO por producto dentro de esta venta
      const prods = h.productos || [];
      for (let i = 0; i < prods.length; i++) {
        const p = prods[i];
        const precio = p.precio || 0;
        const qty = p.qty || 1;
        const lineaTotal = precio * qty;
        
        // Cuánto de esta línea queda por pagar
        const pendienteLinea = Math.min(restoPorPagar, lineaTotal);
        
        if (pendienteLinea > 0.004) {
          const esParcial = pendienteLinea < lineaTotal - 0.004;
          rows.push({
            fecha: h.fecha || h.fechaISO?.split('-').reverse().join('/') || new Date().toLocaleDateString('es-PE'),
            nombre: p.nombre || 'Producto',
            qty: qty,
            total: pendienteLinea,
            esParcial: esParcial,
            totalOriginal: lineaTotal
          });
        }
        restoPorPagar -= lineaTotal;
        if (restoPorPagar <= 0.004) break;
      }
    });
    const envasesCliente = c.botellas || 0;

    // ===== COLORES SEGÚN MODO (OSCURO / CLARO) =====
    const isDark = (settings && settings.apariencia && settings.apariencia.darkMode) !== false
      ? !!(settings && settings.apariencia && settings.apariencia.darkMode)
      : false;

    const col = isDark ? {
      bg:       '#0a0e1a',
      surface:  '#111827',
      surface2: '#1a2235',
      border:   '#2a3a52',
      text:     '#e2e8f0',
      text2:    '#94a3b8',
      text3:    '#64748b',
      sepLine:  '#1e293b',
      rowAlt:   'rgba(255,255,255,0.02)',
      rowLine:  '#1a2235',
      totalBg:  '#111827',
    } : {
      bg:       '#f0f2f5',
      surface:  '#ffffff',
      surface2: '#e8edf3',
      border:   '#d1d5db',
      text:     '#1f2937',
      text2:    '#4b5563',
      text3:    '#9ca3af',
      sepLine:  '#d1d5db',
      rowAlt:   'rgba(0,0,0,0.03)',
      rowLine:  '#e5e7eb',
      totalBg:  '#f1f5f9',
    };

    const canvas = document.createElement('canvas');
    const scale = 2;
    const width = 600 * scale;

    // Calcular headerH dinámicamente sin espacio extra
    // Líneas ocupadas: título(55) + subtítulo(78) + cliente(110) + [tel(128) si hay] + envases(148 o 128 si no hay tel) + separador
    const hasTel = c.tel && c.tel !== '---';
    const envasesY = hasTel ? 148 : 128;
    const sepLineY = envasesY + 14;
    const headerH = (sepLineY + 14) * scale; // espacio justo hasta la línea separadora

    const lineH = 32 * scale;
    const footerH = 200 * scale;
    const contentH = Math.max(rows.length, 1) * lineH + 60 * scale;
    canvas.width = width;
    canvas.height = headerH + contentH + footerH;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h_canvas = canvas.height;

    // Fondo
    ctx.fillStyle = col.bg;
    ctx.fillRect(0, 0, w, h_canvas);

    // Línea superior decorativa
    ctx.fillStyle = colorAcento;
    ctx.fillRect(0, 0, w, 6 * scale);

    // 1. NOMBRE DEL NEGOCIO
    ctx.textAlign = 'center';
    ctx.fillStyle = colorAcento;
    ctx.font = `bold ${28 * scale}px Arial`;
    ctx.fillText(nombreNegocio.toUpperCase(), w / 2, 55 * scale);

    // Subtítulo
    ctx.fillStyle = col.text3;
    ctx.font = `${11 * scale}px Arial`;
    ctx.fillText('ESTADO DE CUENTA', w / 2, 78 * scale);

    // 2. DATOS DEL CLIENTE
    ctx.textAlign = 'left';
    ctx.fillStyle = col.text;
    ctx.font = `bold ${13 * scale}px Arial`;
    ctx.fillText(`CLIENTE: ${c.nombre.toUpperCase()}`, 24 * scale, 110 * scale);

    if(hasTel){
      ctx.fillStyle = col.text3;
      ctx.font = `${10 * scale}px Arial`;
      ctx.fillText(`TEL: ${c.tel}`, 24 * scale, 128 * scale);
    }

    // ENVASES — siempre visible
    ctx.fillStyle = envasesCliente > 0 ? colorAcento : col.text3;
    ctx.font = `bold ${11 * scale}px Arial`;
    ctx.fillText(`ENVASES: ${envasesCliente}`, 24 * scale, envasesY * scale);

    ctx.textAlign = 'right';
    ctx.fillStyle = col.text2;
    ctx.font = `${11 * scale}px Arial`;
    ctx.fillText(`FECHA: ${now.toLocaleDateString('es-PE')}`, w - 24 * scale, 110 * scale);

    // Línea separadora
    ctx.strokeStyle = col.sepLine;
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(24 * scale, sepLineY * scale);
    ctx.lineTo(w - 24 * scale, sepLineY * scale);
    ctx.stroke();

    // 3. TABLA
    const startY = headerH + 10 * scale;

    // Encabezado tabla
    ctx.fillStyle = col.surface2;
    ctx.fillRect(24 * scale, startY, w - 48 * scale, 36 * scale);

    ctx.textAlign = 'left';
    ctx.fillStyle = colorAcento;
    ctx.font = `bold ${10 * scale}px Arial`;
    ctx.fillText('FECHA', 35 * scale, startY + 23 * scale);
    ctx.fillText('PRODUCTO', 138 * scale, startY + 23 * scale);
    ctx.fillText('CANT.', 398 * scale, startY + 23 * scale);
    ctx.textAlign = 'right';
    ctx.fillText('TOTAL', w - 35 * scale, startY + 23 * scale);

    if(rows.length === 0){
      // Sin detalle de productos pendientes
      ctx.textAlign = 'center';
      ctx.fillStyle = col.text3;
      ctx.font = `italic ${11 * scale}px Arial`;
      ctx.fillText('✓ Cliente sin deuda pendiente', w / 2, startY + 36 * scale + 22 * scale);
    } else {
      rows.forEach((r, i) => {
        const y = startY + 36 * scale + (i * lineH);
        // Fila alterna
        if(i % 2 === 0){
          ctx.fillStyle = col.rowAlt;
          ctx.fillRect(24 * scale, y, w - 48 * scale, lineH);
        }
        // Línea divisoria
        ctx.strokeStyle = col.rowLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(24 * scale, y + lineH);
        ctx.lineTo(w - 24 * scale, y + lineH);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = col.text3;
        ctx.font = `${10 * scale}px Arial`;
        ctx.fillText(r.fecha, 35 * scale, y + 21 * scale);

        ctx.fillStyle = col.text;
        ctx.font = `${11 * scale}px Arial`;
        
        // Si es pago parcial, mostrar el nombre seguido de "(pend.)"
        let nombreDisplay = r.nombre.toUpperCase().substring(0, 26);
        if (r.esParcial) {
          nombreDisplay = nombreDisplay + " (pend.)";
        }
        ctx.fillText(nombreDisplay, 138 * scale, y + 21 * scale);

        ctx.fillStyle = col.text2;
        ctx.fillText('x' + r.qty, 405 * scale, y + 21 * scale);

        ctx.textAlign = 'right';
        ctx.fillStyle = colorAcento;
        ctx.font = `bold ${11 * scale}px Arial`;
        ctx.fillText(moneda() + ' ' + r.total.toFixed(2), w - 35 * scale, y + 21 * scale);
      });
    }

    // 4. TOTALES
    const totalY = startY + 36 * scale + (Math.max(rows.length, 1) * lineH) + 30 * scale;

    // Fondo totales
    ctx.fillStyle = col.totalBg;
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(24 * scale, totalY - 10 * scale, w - 48 * scale, 110 * scale, 8 * scale);
    else ctx.rect(24 * scale, totalY - 10 * scale, w - 48 * scale, 110 * scale);
    ctx.fill();

    ctx.textAlign = 'right';
    ctx.font = `${12 * scale}px Arial`;

    ctx.fillStyle = col.text2;
    ctx.fillText('NUEVAS COMPRAS:', w - 190 * scale, totalY + 14 * scale);
    ctx.fillStyle = col.text;
    ctx.fillText(`${moneda()} ${subtotalActual.toFixed(2)}`, w - 30 * scale, totalY + 14 * scale);

    ctx.fillStyle = col.text2;
    ctx.fillText('DEUDA PREVIA:', w - 190 * scale, totalY + 44 * scale);
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`${moneda()} ${deudaAnterior.toFixed(2)}`, w - 30 * scale, totalY + 44 * scale);

    // Línea total
    ctx.strokeStyle = col.border;
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(24 * scale, totalY + 56 * scale);
    ctx.lineTo(w - 24 * scale, totalY + 56 * scale);
    ctx.stroke();

    ctx.font = `bold ${15 * scale}px Arial`;
    ctx.fillStyle = colorAcento;
    ctx.fillText('TOTAL A PAGAR:', w - 190 * scale, totalY + 80 * scale);
    ctx.fillText(`${moneda()} ${c.deuda.toFixed(2)}`, w - 30 * scale, totalY + 80 * scale);

    // Footer
    ctx.textAlign = 'center';
    ctx.fillStyle = col.text3;
    ctx.font = `${10 * scale}px Arial`;
    ctx.fillText('Comprobante de control interno — BodegaPOS', w / 2, h_canvas - 20 * scale);

    // DESCARGA
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    const sanitizedNombre = c.nombre.replace(/\s+/g, '_');
    link.setAttribute('download', `Cuenta_${sanitizedNombre}_${now.toLocaleDateString('es-PE').replace(/\//g,'-')}.jpg`);
    link.setAttribute('href', dataUrl);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { document.body.removeChild(link); }, 100);

    showToast('✓ Imagen exportada correctamente', 'success');
  } catch(err) {
    console.error('exportCuentaJPG error:', err);
    showToast('Error al exportar: ' + err.message, 'error');
  }
}

let _metodoPagoDeuda = 'efectivo';

function seleccionarMetodoPago(metodo) {
  _metodoPagoDeuda = metodo;
  const ef = document.getElementById('pagarMetodoEfectivo');
  const yp = document.getElementById('pagarMetodoYape');
  if (metodo === 'efectivo') {
    ef.style.background = 'rgba(16,185,129,0.12)';
    ef.style.borderColor = '#10b981';
    ef.querySelector('i').style.color = '#10b981';
    ef.querySelector('span').style.color = '#10b981';
    yp.style.background = 'var(--surface2)';
    yp.style.borderColor = 'var(--border)';
    yp.querySelector('i').style.color = 'var(--text3)';
    yp.querySelector('span').style.color = 'var(--text3)';
  } else {
    yp.style.background = 'rgba(124,58,237,0.12)';
    yp.style.borderColor = '#7c3aed';
    yp.querySelector('i').style.color = '#7c3aed';
    yp.querySelector('span').style.color = '#7c3aed';
    ef.style.background = 'var(--surface2)';
    ef.style.borderColor = 'var(--border)';
    ef.querySelector('i').style.color = 'var(--text3)';
    ef.querySelector('span').style.color = 'var(--text3)';
  }
}

function pagarDeudaCliente(id){
  const c=clientes.find(x=>x.id===id);if(!c||c.deuda<=0)return;
  currentClientePago=c;
  document.getElementById('pagarDeudaNombre').textContent=c.nombre;
  document.getElementById('pagarDeudaTotal').textContent=`${moneda()} ${c.deuda.toFixed(2)}`;
  document.getElementById('pagarMonto').value='';
  document.getElementById('deudaRestanteInfo').style.display='none';
  // Resetear método a efectivo por defecto
  _metodoPagoDeuda = 'efectivo';
  seleccionarMetodoPago('efectivo');
  openModal('modalPagarDeuda');
  setTimeout(()=>document.getElementById('pagarMonto').focus(),300);
}

function calcDeudaRestante(){
  if(!currentClientePago)return;
  const pago=parseFloat(document.getElementById('pagarMonto').value)||0;
  const restante=currentClientePago.deuda-pago;
  const el=document.getElementById('deudaRestanteInfo');
  el.style.display='block';
  if(pago<=0){el.style.cssText='display:block;padding:12px;border-radius:10px;text-align:center;font-size:14px;font-weight:700;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--danger);';el.innerHTML='<i class="fa fa-exclamation-circle"></i> Ingresa un monto válido';}
  else if(pago>=currentClientePago.deuda){el.style.cssText='display:block;padding:12px;border-radius:10px;text-align:center;font-size:14px;font-weight:700;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:var(--accent3);';el.innerHTML=`<i class="fa fa-check-circle"></i> ¡Deuda saldada! Sin saldo pendiente`;}
  else{el.style.cssText='display:block;padding:12px;border-radius:10px;text-align:center;font-size:14px;font-weight:700;background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);color:var(--warning);';el.innerHTML=`<i class="fa fa-clock"></i> Queda por pagar: <strong>${moneda()} ${restante.toFixed(2)}</strong>`;}
}

function confirmarPagoDeuda() {
  if (!currentClientePago) return;
  const pago = parseFloat(document.getElementById('pagarMonto').value) || 0;
  if (pago <= 0) return showToast('Ingresa un monto válido', 'error');

  const c = clientes.find(x => x.id === currentClientePago.id);
  const nuevaDeuda = Math.max(0, c.deuda - pago);
  c.deuda = nuevaDeuda;
  c.ultima = new Date().toLocaleDateString('en-CA');

  // Registrar el pago en el historial del cliente con método y VENDEDOR
  if (!c.pagos) c.pagos = [];
  c.pagos.push({
    id: Date.now() + Math.floor(Math.random()*1000),
    fecha: new Date().toLocaleDateString('es-PE'),
    fechaISO: new Date().toLocaleDateString('en-CA'),
    hora: new Date().toLocaleTimeString('es-PE', {hour:'2-digit',minute:'2-digit'}),
    monto: pago,
    metodo: _metodoPagoDeuda,
    vendedor: currentUser ? currentUser.nombre : 'Admin'  // ✅ AGREGAR ESTO
  });

  c.historial.forEach(h => { h.pagado = h.total; });

  const metodoLabel = _metodoPagoDeuda === 'yape' ? 'Yape 📱' : 'Efectivo 💵';
  renderClients();
  closeModal('modalPagarDeuda');
  guardarTodoEnLocalStorage();
  actualizarNotificaciones();
  actualizarDeudaAltaCount();
  showToast(`Pago ${metodoLabel} registrado. Saldo: ${moneda()} ${nuevaDeuda.toFixed(2)}`, 'success');
}

