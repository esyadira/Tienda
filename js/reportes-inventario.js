// ========================================
// REPORTE DE EFECTIVO (INVENTARIO)
// ========================================
let _invRepData = [];
let _filtroMetodoCerveza = 'todos';
let _filtroMetodoYape = 'todos';
let _filtroMetodoEfectivo = 'todos';
function renderRepInventario(fecha) {
  if (!fecha) fecha = getRepFecha();
  const vendSel = document.getElementById('repEfectivoVendSelect');
  if (vendSel) {
    const currentVal = vendSel.value;
    const todosVends = [...new Set([...ventasHistorial.map(v => v.vendedor || 'Admin'), ...(vendedores||[]).map(v => (v.nombre+(v.apellido?' '+v.apellido:'')).trim()), 'Admin'])].sort();
    vendSel.innerHTML = '<option value="todos">Todos los usuarios</option>';
    todosVends.forEach(v => { const o = document.createElement('option'); o.value=v; o.textContent=v; vendSel.appendChild(o); });
    if ([...vendSel.options].some(o => o.value === currentVal)) vendSel.value = currentVal;
    else vendSel.value = 'todos';
  }
  const vendFiltro = vendSel ? vendSel.value : 'todos';

  const ventasEfectivo = ventasHistorial.filter(v => esVentaDeMetodo(v, 'efectivo') && !v.esPagoPedidoProv && v.fechaISO === fecha && (vendFiltro === 'todos' || (v.vendedor||'Admin') === vendFiltro));
  const totalEfectivo = ventasEfectivo.reduce((a,v)=>a+desgloseVenta(v).efectivo,0);
  const pagosDeuda = [];
  clientes.forEach(c => {
    (c.pagos||[]).filter(p=>p.metodo!=='yape'&&p.fechaISO===fecha&&(vendFiltro==='todos'||(p.vendedor||'Admin')===vendFiltro)).forEach(p=>{
      pagosDeuda.push({cliente:c.nombre,fecha:p.fecha||'—',fechaISO:p.fechaISO||'',hora:p.hora||'—',monto:p.monto});
    });
  });
  const totalAbonos = pagosDeuda.reduce((a,p)=>a+p.monto,0);
  const pagosProveedores = pagosProveedoresHistorial.filter(pp=>pp.metodo!=='yape'&&pp.fechaISO===fecha&&(vendFiltro==='todos'||(pp.vendedor||'Admin')===vendFiltro));
  const totalPagosProv = pagosProveedores.reduce((a,pp)=>a+parseFloat(pp.monto||0),0);
  const totalCaja = totalEfectivo + totalAbonos - totalPagosProv;

  // Calcular fiado/semipagado FIFO
  let totalFiadoEfec = 0, totalSemiEfec = 0;
  ventasEfectivo.forEach(v => {
    if (v.metodoPago === 'mixto') return;
    const pagado = Math.min(v.pagado??v.total??0, v.total??0);
    const esFiadoTotal = pagado===0&&(v.total||0)>0;
    const esFiadoParcial = pagado>0&&pagado<(v.total||0);
    const prods = v.items||v.productos||[];
    prods.forEach((p,pIdx)=>{
      const subtotal = p.precio*(p.cant||p.qty||1);
      if(esFiadoTotal){totalFiadoEfec+=subtotal;return;}
      if(!esFiadoParcial)return;
      let pa=0; for(let i=0;i<pIdx;i++){const pr=prods[i];pa+=pr.precio*(pr.cant||pr.qty||1);}
      const cubierto=Math.min(Math.max(0,pagado-pa),subtotal);
      const pendiente=subtotal-cubierto;
      if(cubierto<=0.004)totalFiadoEfec+=subtotal;
      else if(pendiente>0.004)totalSemiEfec+=pendiente;
    });
  });

  const mkEfec = (fv,bg,ac,ic,lbl,val,sub) => {
    const isA = _filtroMetodoEfectivo===fv;
    return `<div onclick="_filtroMetodoEfectivo='${fv}';renderRepInventario('${fecha}');" style="background:var(--surface);border:2px solid ${isA?ac:'var(--border)'};border-radius:var(--radius);padding:16px;position:relative;overflow:hidden;cursor:pointer;transition:all 0.15s;${isA?`box-shadow:0 0 0 3px ${ac}22;`:''}">
      <div style="position:absolute;inset:0;background:linear-gradient(135deg,${bg},transparent);pointer-events:none;"></div>
      <div style="width:34px;height:34px;border-radius:9px;background:${bg.replace('0.06','0.15')};color:${ac};display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:10px;">${ic}</div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:3px;">${lbl}${isA?' ✓':''}</div>
      <div style="font-size:19px;font-weight:800;color:${ac};font-family:'JetBrains Mono',monospace;">${val}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:3px;">${sub}</div>
    </div>`;
  };
  const kpiPendienteEfec = (totalFiadoEfec>0||totalSemiEfec>0)?`
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;position:relative;overflow:hidden;">
      <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(239,68,68,0.06),transparent);pointer-events:none;"></div>
      <div style="width:34px;height:34px;border-radius:9px;background:rgba(239,68,68,0.15);color:var(--danger);display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:10px;"><i class="fa fa-clock-rotate-left"></i></div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:3px;">Pendiente de Cobro</div>
      <div style="font-size:19px;font-weight:800;color:var(--danger);font-family:'JetBrains Mono',monospace;">${moneda()} ${(totalFiadoEfec+totalSemiEfec).toFixed(2)}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:3px;">Fiado: ${moneda()} ${totalFiadoEfec.toFixed(2)} · Semi: ${moneda()} ${totalSemiEfec.toFixed(2)}</div>
    </div>`:'';
  document.getElementById('repInventarioSummary').innerHTML =
    mkEfec('todos','rgba(16,185,129,0.06)','#10b981','<i class="fa fa-money-bill-wave"></i>','Total Neto Efectivo',`${moneda()} ${totalCaja.toFixed(2)}`,'Ventas + Abonos - Proveedores') +
    mkEfec('ventas','rgba(245,158,11,0.06)','var(--accent)','<i class="fa fa-receipt"></i>','Ventas Efectivo',`${moneda()} ${totalEfectivo.toFixed(2)}`,`${ventasEfectivo.length} venta(s)`) +
    mkEfec('abonos','rgba(59,130,246,0.06)','#3b82f6','<i class="fa fa-hand-holding-dollar"></i>','Abonos de Deuda',`${moneda()} ${totalAbonos.toFixed(2)}`,`${pagosDeuda.length} abono(s)`) +
    mkEfec('proveedores','rgba(249,115,22,0.06)','var(--warning)','<i class="fa fa-truck"></i>','Pagos Proveedores',`${moneda()} ${totalPagosProv.toFixed(2)}`,`${pagosProveedores.length} pago(s)`) +
    kpiPendienteEfec;

  _invRepData = {ventasEfectivo, pagosDeuda, pagosProveedores, totalCaja};
  renderInvTabla(_invRepData);
}

function renderInvTabla(data) {
  const {ventasEfectivo, pagosDeuda, pagosProveedores, totalCaja} = data;
  const tbody = document.getElementById('repInventarioBody');
  const totalEl = document.getElementById('repInvTotalAmt');
  if (totalEl) totalEl.textContent = `${moneda()} ${totalCaja.toFixed(2)}`;

  const ventasConPagoReal = ventasEfectivo.filter(v=>Math.min(v.pagado??v.total??0,v.total??0)>0);
  if (!ventasConPagoReal.length && !pagosDeuda.length && !pagosProveedores.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3);"><i class="fa fa-money-bill-wave" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.3;"></i>Sin movimientos en efectivo registrados</td></tr>`;
    const c=document.getElementById('repInventarioCant'); if(c)c.textContent='0 registros';
    return;
  }

  // Filas por producto con FIFO
  const filasVentas = [];
  ventasConPagoReal.forEach(v => {
    if (v.metodoPago === 'mixto') { filasVentas.push({tipo:'venta',timestamp:_tsVenta(v.fechaISO, v.hora),html:filaMixtoHTML(v,'efectivo')}); return; }
    const pagado = Math.min(v.pagado??v.total??0, v.total??0);
    const esFiadoTotal = pagado===0&&(v.total||0)>0;
    const esFiadoParcial = pagado>0&&pagado<(v.total||0);
    const prods = v.items||v.productos||[];
    prods.forEach((p,pIdx)=>{
      const subtotal = p.precio*(p.cant||p.qty||1);
      let cubierto=subtotal;
      if(esFiadoParcial){
        let pa=0; for(let i=0;i<pIdx;i++){const pr=prods[i];pa+=pr.precio*(pr.cant||pr.qty||1);}
        cubierto=Math.min(Math.max(0,pagado-pa),subtotal);
      }
      const pendiente=subtotal-cubierto;
      let rowBg,montoHTML;
      if(esFiadoTotal){
        rowBg='background:rgba(100,116,139,0.12);';
        montoHTML=`<span style="color:var(--text3);text-decoration:line-through;font-weight:600;">${moneda()} ${subtotal.toFixed(2)}</span>`;
      } else if(esFiadoParcial&&cubierto<subtotal-0.004&&cubierto>0.004){
        rowBg='background:rgba(59,130,246,0.08);';
        montoHTML=`<div style="display:flex;justify-content:flex-end;align-items:center;gap:6px;"><span style="font-weight:700;color:#10b981;">${moneda()} ${cubierto.toFixed(2)}</span><span style="color:var(--text3);text-decoration:line-through;font-size:12px;">${moneda()} ${subtotal.toFixed(2)}</span></div>`;
      } else if(esFiadoParcial&&cubierto<=0.004){
        rowBg='background:rgba(100,116,139,0.12);';
        montoHTML=`<span style="color:var(--text3);text-decoration:line-through;font-weight:600;">${moneda()} ${subtotal.toFixed(2)}</span>`;
      } else {
        rowBg='background:var(--surface);';
        montoHTML=`<span style="font-weight:700;color:#10b981;">${moneda()} ${subtotal.toFixed(2)}</span>`;
      }
      filasVentas.push({tipo:'venta',timestamp:_tsVenta(v.fechaISO, v.hora),
        html:`<tr style="${rowBg}">
          <td style="font-size:12px;color:var(--text3);">${v.fecha||'—'}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text3);">${v.hora||'—'}</td>
          <td style="font-weight:500;">${v.cliente||'Público General'}</td>
          <td style="font-size:12px;color:var(--text2);">${p.nombre} x${p.cant||p.qty||1}</td>
          <td><span class="badge badge-green">Efectivo</span></td>
          <td style="text-align:right;">${montoHTML}</td>
          <td style="text-align:center;"><button onclick="eliminarVentaIndividual(${v.id})" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--danger);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;" title="Eliminar"><i class="fa fa-trash"></i></button></td>
        </tr>`
      });
    });
  });

  const filasAbonos=[];
  if(pagosDeuda.length>0){
    filasAbonos.push({tipo:'separador_abonos',timestamp:0,html:`<tr style="background:rgba(59,130,246,0.06);"><td colspan="7" style="padding:8px 18px;border-top:2px dashed var(--border);border-bottom:1px solid var(--border);font-size:11px;color:var(--accent3);font-weight:700;text-transform:uppercase;letter-spacing:1px;"><i class="fa fa-hand-holding-dollar" style="margin-right:8px;"></i> ABONOS DE DEUDA</td></tr>`});
    pagosDeuda.forEach(p=>filasAbonos.push({tipo:'abono',timestamp:_tsVenta(p.fechaISO, p.hora),
      html:`<tr style="background:rgba(59,130,246,0.03);">
        <td style="font-size:12px;color:var(--text3);">${p.fecha}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text3);">${p.hora}</td>
        <td style="font-weight:500;">${p.cliente}</td>
        <td style="font-size:12px;color:var(--accent3);"><i class="fa fa-hand-holding-dollar"></i> Abono de deuda</td>
        <td><span class="badge badge-green">Efectivo</span></td>
        <td style="text-align:right;"><span style="font-weight:700;color:var(--accent3);">+ ${moneda()} ${p.monto.toFixed(2)}</span></td>
        <td style="text-align:center;"><button onclick="eliminarAbonoIndividual(${JSON.stringify(p.cliente)}, ${JSON.stringify(p.fechaISO)}, ${p.monto}, ${JSON.stringify(p.hora)})" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--danger);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;" title="Eliminar abono"><i class="fa fa-trash"></i></button></td>
      </tr>`
    }));
  }

  const filasProveedores=[];
  if(pagosProveedores.length>0){
    filasProveedores.push({tipo:'separador_prov',timestamp:0,html:`<tr style="background:rgba(249,115,22,0.06);"><td colspan="7" style="padding:8px 18px;border-top:2px dashed var(--border);border-bottom:1px solid var(--border);font-size:11px;color:var(--warning);font-weight:700;text-transform:uppercase;letter-spacing:1px;"><i class="fa fa-truck" style="margin-right:8px;"></i> PAGOS A PROVEEDORES</td></tr>`});
    pagosProveedores.forEach(pp=>{
      const itemsTxt=(pp.items||[]).map(it=>`${it.nombre} x${it.qty}`).join(', ')||'Pedido';
      filasProveedores.push({tipo:'pago_prov',timestamp:_tsVenta(pp.fechaISO, pp.hora),
        html:`<tr style="background:rgba(249,115,22,0.03);">
          <td style="font-size:12px;color:var(--text3);">${pp.fecha||'—'}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text3);">${pp.hora||'—'}</td>
          <td style="font-weight:500;">${pp.proveedor}</td>
          <td style="font-size:12px;color:var(--warning);"><i class="fa fa-truck"></i> ${itemsTxt}</td>
          <td><span class="badge" style="background:rgba(249,115,22,0.15);color:var(--warning);">Pago</span></td>
          <td style="text-align:right;"><span style="font-weight:700;color:var(--warning);">- ${moneda()} ${parseFloat(pp.monto).toFixed(2)}</span></td>
          <td style="text-align:center;"><button onclick="eliminarPagoProvIndividual(${JSON.stringify(pp.fechaISO)}, ${JSON.stringify(pp.proveedor)}, ${parseFloat(pp.monto)}, ${JSON.stringify(pp.hora||'—')})" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--danger);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;" title="Eliminar pago proveedor"><i class="fa fa-trash"></i></button></td>
        </tr>`
      });
    });
  }

  let todasLasFilas=[...filasVentas,...filasAbonos,...filasProveedores];
  if(_filtroMetodoEfectivo!=='todos'){
    todasLasFilas=todasLasFilas.filter(f=>{
      if(_filtroMetodoEfectivo==='ventas')return f.tipo==='venta';
      if(_filtroMetodoEfectivo==='abonos')return f.tipo==='abono';
      if(_filtroMetodoEfectivo==='proveedores')return f.tipo==='pago_prov';
      return true;
    });
  }
  const contables=todasLasFilas.filter(f=>!f.tipo.startsWith('separador'));
  const c2=document.getElementById('repInventarioCant'); if(c2)c2.textContent=`${contables.length} registro${contables.length!==1?'s':''}`;
  tbody.innerHTML=todasLasFilas.sort((a,b)=>b.timestamp-a.timestamp).map(f=>f.html).join('');
}

function limpiarFiltrosReportes() {
  // Restaura la fecha al día de hoy y vuelve al tab principal
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('repFechaInput').value = hoy;
  renderReportes('rep-cerveza');
  // Activa visualmente el primer tab
  document.querySelectorAll('.rep-tab-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === 0);
  });
  showToast('Filtros restablecidos', 'success');
}

function limpiarHistorialVentas() {
  if(!cfgConfirm('¿Limpiar todo el historial de ventas? Esta acción no se puede deshacer.')) return;
  ventasHistorial = [];
  guardarTodoEnLocalStorage();
  actualizarDashboardReal();
  renderReportes('rep-cerveza');
  showToast('Historial limpiado', 'success');
}

function exportarReporteDia() { exportarReporteActivo(); }

function _xlsBase(titulo, subtitulo, thead, rows, totalesHTML) {
  const estilos = `body{font-family:Arial,sans-serif;}h2{color:#0a0e1a;margin-bottom:4px;}p{color:#64748b;font-size:12px;margin-top:0;}table{border-collapse:collapse;width:100%;}th{background:#111827;color:#f59e0b;padding:10px 14px;text-align:left;font-size:12px;border:1px solid #2a3a52;}td{padding:9px 14px;font-size:12px;border:1px solid #e2e8f0;}tr:nth-child(even) td{background:#f8fafc;}.total-row td{background:#1a2235;color:#f59e0b;font-weight:bold;font-size:14px;}`;
  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='UTF-8'><style>${estilos}</style></head><body><h2>${titulo}</h2><p>${subtitulo}</p><table><thead><tr>${thead}</tr></thead><tbody>${rows}${totalesHTML}</tbody></table></body></html>`;
}

function _descargarXls(html, nombre) {
  const blob = new Blob([html], {type:'application/vnd.ms-excel;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  showToast('Reporte exportado ✓', 'success');
}

function exportarReporteActivo() {
  const tabActivo = document.querySelector('.rep-tab-btn.active');
  if (!tabActivo) return;
  const match = tabActivo.getAttribute('onclick').match(/'([^']+)'/);
  const panel = match ? match[1] : 'rep-cerveza';
  const fecha = getRepFecha();
  const now = new Date().toLocaleDateString('es-PE');
  const fechaLabel = getRepFechaLabel(fecha);

  if (panel === 'rep-cerveza' || panel === 'rep-helado') {
    const tipo = panel === 'rep-cerveza' ? 'cerveza' : 'helado';
    const emoji = panel === 'rep-cerveza' ? '🍺' : '🍦';
    const esFn = n => tipo === 'cerveza'
      ? /cerv|pilsen|cusqueña|corona|inca\s*kola|cristal|trujillo/i.test(n)
      : /helado|gelato|paleta|ice\s*cream/i.test(n);
    const lineas = [];
    ventasHistorial.forEach(v => {
      (v.items||v.productos||[]).forEach(item => {
        if (esFn(item.nombre||'')) lineas.push({fecha:v.fecha||'—',nombre:item.nombre,cant:item.cant||item.qty||1,precio:item.precio||0,metodo:v.metodoPago||'efectivo'});
      });
    });
    const total = lineas.reduce((a,l)=>a+l.cant*l.precio,0);
    const thead = '<th>Fecha</th><th>Producto</th><th>Cantidad</th><th>Método</th><th>Total</th>';
    const rows = lineas.slice().reverse().map(l=>`<tr><td>${l.fecha}</td><td>${l.nombre}</td><td style="text-align:center;">${l.cant} uds.</td><td>${metodoInfo(l.metodo).label}</td><td style="text-align:right;">${moneda()} ${(l.cant*l.precio).toFixed(2)}</td></tr>`).join('');
    const totales = `<tr class="total-row"><td colspan="4" style="text-align:right;">TOTAL</td><td>${moneda()} ${total.toFixed(2)}</td></tr>`;
    _descargarXls(_xlsBase(`${emoji} Reporte ${tipo.charAt(0).toUpperCase()+tipo.slice(1)}s`, `Exportado: ${now} · ${lineas.length} registros`, thead, rows, totales), `Reporte_${tipo}_${fecha}.xls`);

  } else if (panel === 'rep-yape') {
    const ventasYape = ventasHistorial.filter(v => esVentaDeMetodo(v, 'yape'));
    const abonosYape = [];
    clientes.forEach(cl => (cl.pagos||[]).filter(p=>p.metodo==='yape').forEach(p=>abonosYape.push({cliente:cl.nombre,hora:p.hora||'—',monto:p.monto||0})));
    const allRows = [
      ...ventasYape.map(v=>{const prods=(v.items||v.productos||[]).map(p=>`${p.nombre} x${p.cant||p.qty||1}`).join(', ');return `<tr><td>${v.hora||'—'}</td><td>${v.cliente||'—'}</td><td>${prods}</td><td>${etiquetaMetodoExport(v,'yape')}</td><td style="text-align:right;">${moneda()} ${montoMetodoExport(v,'yape').toFixed(2)}</td></tr>`;}),
      ...abonosYape.map(ab=>`<tr><td>${ab.hora}</td><td>${ab.cliente}</td><td>Abono de deuda</td><td>Yape</td><td style="text-align:right;color:#3b82f6;">${moneda()} ${ab.monto.toFixed(2)}</td></tr>`)
    ].join('');
    const total = ventasYape.reduce((a,v)=>a+montoMetodoExport(v,'yape'),0) + abonosYape.reduce((a,ab)=>a+ab.monto,0);
    const thead = '<th>Hora</th><th>Cliente</th><th>Productos</th><th>Método</th><th>Total</th>';
    const totales = `<tr class="total-row"><td colspan="4" style="text-align:right;">TOTAL YAPE</td><td>${moneda()} ${total.toFixed(2)}</td></tr>`;
    _descargarXls(_xlsBase('📱 Reporte Yape', `Exportado: ${now} · ${ventasYape.length} ventas + ${abonosYape.length} abonos`, thead, allRows, totales), `Reporte_Yape_${fecha}.xls`);

  } else if (panel === 'rep-inventario') {
    const ventasEf = ventasHistorial.filter(v => esVentaDeMetodo(v, 'efectivo') && !v.esPagoPedidoProv);
    const pagosDeuda = [];
    clientes.forEach(cl => (cl.pagos||[]).filter(p=>p.metodo!=='yape').forEach(p=>pagosDeuda.push({cliente:cl.nombre,hora:p.hora||'—',monto:p.monto||0})));
    const allRows = [
      ...ventasEf.map(v=>{const prods=(v.items||v.productos||[]).map(p=>`${p.nombre} x${p.cant||p.qty||1}`).join(', ');return `<tr><td>${v.hora||'—'}</td><td>${v.cliente||'—'}</td><td>${prods}</td><td>${etiquetaMetodoExport(v,'efectivo')}</td><td style="text-align:right;">${moneda()} ${montoMetodoExport(v,'efectivo').toFixed(2)}</td></tr>`;}),
      ...pagosDeuda.map(ab=>`<tr><td>${ab.hora}</td><td>${ab.cliente}</td><td>Abono de deuda</td><td>Efectivo</td><td style="text-align:right;color:#3b82f6;">${moneda()} ${ab.monto.toFixed(2)}</td></tr>`)
    ].join('');
    const total = ventasEf.reduce((a,v)=>a+montoMetodoExport(v,'efectivo'),0) + pagosDeuda.reduce((a,ab)=>a+ab.monto,0);
    const thead = '<th>Hora</th><th>Cliente</th><th>Productos</th><th>Método</th><th>Total</th>';
    const totales = `<tr class="total-row"><td colspan="4" style="text-align:right;">TOTAL EFECTIVO</td><td>${moneda()} ${total.toFixed(2)}</td></tr>`;
    _descargarXls(_xlsBase('💵 Reporte Efectivo', `Exportado: ${now} · ${ventasEf.length} ventas + ${pagosDeuda.length} abonos`, thead, allRows, totales), `Reporte_Efectivo_${fecha}.xls`);

  } else if (panel === 'rep-vendedores') {
    const vendSelect = document.getElementById('repVendSelect');
    const vendFiltro = vendSelect ? vendSelect.value : 'todos';
    const vendLabel = vendFiltro === 'todos' ? 'Todos los vendedores' : vendFiltro;
    const ventasFiltradas = ventasHistorial.filter(v => vendFiltro === 'todos' || (v.vendedor || 'Admin') === vendFiltro);
    const thead = '<th>Hora</th><th>Vendedor</th><th>Cliente</th><th>Producto</th><th>Cant.</th><th>Método</th><th>Total</th>';
    const rows = [];
    ventasFiltradas.forEach(v => {
      const vendName = v.vendedor || 'Admin';
      const esFiadoTotal = (v.pagado===0 && v.total>0);
      const metodo = esFiadoTotal ? 'Fiado' : metodoInfo(v.metodoPago).label;
      (v.items||v.productos||[]).forEach(p => {
        rows.push(`<tr><td>${v.hora||'—'}</td><td>${vendName}</td><td>${v.cliente||'—'}</td><td>${p.nombre}</td><td style="text-align:center;">${p.cant||p.qty||1}</td><td>${metodo}</td><td style="text-align:right;">${moneda()} ${((p.precio||0)*(p.cant||p.qty||1)).toFixed(2)}</td></tr>`);
      });
    });
    const total = ventasFiltradas.reduce((a,v)=>a+(v.pagado??v.total??0),0);
    const totales = `<tr class="total-row"><td colspan="6" style="text-align:right;">TOTAL COBRADO</td><td>${moneda()} ${total.toFixed(2)}</td></tr>`;
    _descargarXls(_xlsBase(`👤 Reporte Vendedores — ${vendLabel}`, `Exportado: ${now} · ${ventasFiltradas.length} ventas`, thead, rows.join(''), totales), `Reporte_Vendedores_${vendFiltro}_${fecha}.xls`);
  }
}

