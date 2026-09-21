// ========================================
// REPORTE DE SALIDAS DE STOCK
// ========================================
function renderRepSalidas() {
  // Construir lista de líneas de salida desde ventasHistorial
  const lineas = [];
  ventasHistorial.forEach(v => {
    (v.items || v.productos || []).forEach(item => {
      const cant = item.cant || item.qty || 1;
      const precio = item.precio || 0;
      lineas.push({
        fecha: v.fecha || '—',
        fechaISO: v.fechaISO || '',
        hora: v.hora || '—',
        nombre: item.nombre || 'Producto',
        cant: cant,
        precio: precio,
        subtotal: precio * cant,
        cliente: v.cliente || 'Público General',
        cat: item.cat || ''
      });
    });
  });

  // KPIs
  const totalUnidades = lineas.reduce((a, l) => a + l.cant, 0);
  const totalMonto = lineas.reduce((a, l) => a + l.subtotal, 0);
  const porProd = {};
  lineas.forEach(l => {
    if (!porProd[l.nombre]) porProd[l.nombre] = { cant: 0, monto: 0 };
    porProd[l.nombre].cant += l.cant;
    porProd[l.nombre].monto += l.subtotal;
  });
  const topProd = Object.entries(porProd).sort((a, b) => b[1].cant - a[1].cant)[0];
  const totalTransacciones = ventasHistorial.length;

  const summaryEl = document.getElementById('repSalidasSummary');
  if (summaryEl) summaryEl.innerHTML = `
    <div class="rep-kpi">
      <div class="rep-kpi-icon" style="background:rgba(239,68,68,0.12);color:var(--danger);"><i class="fa fa-arrow-trend-down"></i></div>
      <div class="rep-kpi-label">Total Unidades Salidas</div>
      <div class="rep-kpi-value" style="color:var(--danger);">${totalUnidades}</div>
      <div class="rep-kpi-sub">en ${totalTransacciones} venta(s)</div>
    </div>
    <div class="rep-kpi">
      <div class="rep-kpi-icon" style="background:rgba(245,158,11,0.12);color:var(--accent);"><i class="fa fa-sack-dollar"></i></div>
      <div class="rep-kpi-label">Valor Total Vendido</div>
      <div class="rep-kpi-value" style="color:var(--accent);">${moneda()} ${totalMonto.toFixed(2)}</div>
      <div class="rep-kpi-sub">todo el historial</div>
    </div>
    <div class="rep-kpi">
      <div class="rep-kpi-icon" style="background:rgba(59,130,246,0.12);color:#3b82f6;"><i class="fa fa-trophy"></i></div>
      <div class="rep-kpi-label">Más Vendido</div>
      <div class="rep-kpi-value" style="color:#3b82f6;font-size:14px;">${topProd ? topProd[0] : 'N/A'}</div>
      <div class="rep-kpi-sub">${topProd ? topProd[1].cant + ' uds. vendidas' : ''}</div>
    </div>
    <div class="rep-kpi">
      <div class="rep-kpi-icon" style="background:rgba(16,185,129,0.12);color:#10b981;"><i class="fa fa-boxes-stacked"></i></div>
      <div class="rep-kpi-label">Productos Distintos</div>
      <div class="rep-kpi-value" style="color:#10b981;">${Object.keys(porProd).length}</div>
      <div class="rep-kpi-sub">referencias movidas</div>
    </div>`;

  const cantEl = document.getElementById('repSalidasCant');
  if (cantEl) cantEl.textContent = `${lineas.length} línea(s)`;

  const tbody = document.getElementById('repSalidasBody');
  if (!lineas.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3);"><i class="fa fa-arrow-trend-down" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.3;"></i>Sin salidas registradas aún</td></tr>`;
    return;
  }
  tbody.innerHTML = lineas.slice().reverse().map(l => `
    <tr>
      <td style="font-size:12px;color:var(--text3);">${l.fecha}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text3);">${l.hora}</td>
      <td style="font-weight:600;font-size:13px;">${l.nombre}</td>
      <td style="text-align:center;"><span class="badge badge-red">-${l.cant} ud${l.cant !== 1 ? 's' : ''}.</span></td>
      <td style="font-size:12px;color:var(--text2);">${l.cliente}</td>
      <td style="text-align:right;font-weight:700;color:var(--danger);font-family:'JetBrains Mono',monospace;">${moneda()} ${l.subtotal.toFixed(2)}</td>
    </tr>`).join('');
}

