// ========================================
// REPORTES — RESUMEN DE VENTAS (rep-ventas)
// ========================================
// Pestaña general de Reportes: KPIs + gráfico Ventas/Ganancia + tabla por
// periodo + Ventas por Departamento (donut) + Ventas por Forma de Pago.
// La ganancia se calcula solo sobre productos que tienen "Precio de costo"
// registrado en Productos; si un producto no tiene costo, no suma a la
// ganancia (para no mostrar cifras falsas).

let _repvPeriodo = 'semana';
const _REPV_COLORES_DEPTO = ['#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#f43f5e', '#06b6d4', '#eab308', '#ec4899'];

function cambiarPeriodoVentas(periodo) {
  _repvPeriodo = periodo;
  document.querySelectorAll('.repv-period-btn').forEach(b => b.classList.toggle('active', b.dataset.period === periodo));
  const rango = document.getElementById('repvCustomRange');
  if (rango) rango.classList.toggle('show', periodo === 'custom');
  renderReportes('rep-ventas');
}

// --- Cálculo del rango de fechas según el periodo elegido ---
function repvLunesDeSemana(d) {
  const dt = new Date(d);
  const dia = dt.getDay(); // 0 = domingo
  const diff = (dia === 0) ? -6 : (1 - dia);
  dt.setDate(dt.getDate() + diff);
  return dt;
}

function repvRango() {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  let desde, hasta, groupBy = 'day', label = '';

  if (_repvPeriodo === 'mes') {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    hasta = new Date(hoy);
    label = 'Mes actual';
  } else if (_repvPeriodo === 'mesAnterior') {
    desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    label = 'Mes anterior';
  } else if (_repvPeriodo === 'anio') {
    desde = new Date(hoy.getFullYear(), 0, 1);
    hasta = new Date(hoy);
    groupBy = 'month';
    label = 'Año actual';
  } else if (_repvPeriodo === 'custom') {
    const dEl = document.getElementById('repvFechaDesde');
    const hEl = document.getElementById('repvFechaHasta');
    let dISO = dEl && dEl.value, hISO = hEl && hEl.value;
    if (!dISO || !hISO) {
      hasta = new Date(hoy);
      desde = new Date(hoy); desde.setDate(desde.getDate() - 29);
      if (dEl) dEl.value = desde.toLocaleDateString('en-CA');
      if (hEl) hEl.value = hasta.toLocaleDateString('en-CA');
    } else {
      desde = new Date(dISO + 'T00:00:00');
      hasta = new Date(hISO + 'T00:00:00');
      if (hasta < desde) { const t = desde; desde = hasta; hasta = t; }
    }
    label = 'Periodo personalizado';
    const diffDias = Math.round((hasta - desde) / 86400000) + 1;
    groupBy = diffDias > 45 ? 'month' : 'day';
  } else { // semana (default)
    desde = repvLunesDeSemana(hoy);
    hasta = new Date(desde); hasta.setDate(hasta.getDate() + 6);
    label = 'Semana actual';
  }
  return { desde, hasta, groupBy, label };
}

function repvVentasEnRango(desdeISO, hastaISO) {
  return ventasHistorial.filter(v => !v.esPagoPedidoProv && v.fechaISO && v.fechaISO >= desdeISO && v.fechaISO <= hastaISO);
}

// Busca el costo actual registrado del producto (por nombre). Si no existe o
// no tiene costo cargado, devuelve null (esa línea no aporta a la ganancia).
function repvCostoProducto(nombre) {
  const p = productos.find(x => (x.nombre || '').toLowerCase() === String(nombre || '').toLowerCase());
  return (p && p.costo > 0) ? p.costo : null;
}

function repvMesLabel(numMes) {
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return meses[numMes];
}

// Agrupa las ventas del rango en "buckets" por día o por mes
function repvAgregarPorPeriodo(ventas, groupBy, desde, hasta) {
  const buckets = {};
  const keys = [];

  if (groupBy === 'day') {
    let d = new Date(desde);
    while (d <= hasta) {
      const iso = d.toLocaleDateString('en-CA');
      keys.push(iso);
      buckets[iso] = { ventas: 0, ganancia: 0, cant: 0 };
      d.setDate(d.getDate() + 1);
    }
  } else {
    let d = new Date(desde.getFullYear(), desde.getMonth(), 1);
    const fin = new Date(hasta.getFullYear(), hasta.getMonth(), 1);
    while (d <= fin) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      keys.push(key);
      buckets[key] = { ventas: 0, ganancia: 0, cant: 0 };
      d.setMonth(d.getMonth() + 1);
    }
  }

  ventas.forEach(v => {
    const key = groupBy === 'day' ? v.fechaISO : v.fechaISO.slice(0, 7);
    if (!buckets[key]) { buckets[key] = { ventas: 0, ganancia: 0, cant: 0 }; keys.push(key); }
    buckets[key].ventas += (v.total || 0);
    buckets[key].cant += 1;
    (v.items || v.productos || []).forEach(it => {
      const cant = it.cant || it.qty || 1;
      const costo = repvCostoProducto(it.nombre);
      if (costo != null) buckets[key].ganancia += ((it.precio || 0) - costo) * cant;
    });
  });

  return { keys, buckets };
}

function repvEtiquetaCorta(key, groupBy) {
  if (groupBy === 'month') {
    const [y, m] = key.split('-');
    return repvMesLabel(parseInt(m, 10) - 1);
  }
  const d = new Date(key + 'T00:00:00');
  return String(d.getDate());
}

function repvEtiquetaLarga(key, groupBy) {
  if (groupBy === 'month') {
    const [y, m] = key.split('-');
    return `${repvMesLabel(parseInt(m, 10) - 1)} ${y}`;
  }
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const d = new Date(key + 'T00:00:00');
  return `${dias[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

// ========================================
// RENDER PRINCIPAL
// ========================================
function renderRepVentas() {
  const { desde, hasta, groupBy, label } = repvRango();
  const desdeISO = desde.toLocaleDateString('en-CA');
  const hastaISO = hasta.toLocaleDateString('en-CA');

  const rangoLabelEl = document.getElementById('repvRangoLabel');
  if (rangoLabelEl) {
    const fmt = iso => { const d = new Date(iso + 'T00:00:00'); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };
    rangoLabelEl.innerHTML = `<i class="fa fa-calendar"></i> ${label}: ${fmt(desdeISO)} — ${fmt(hastaISO)}`;
  }

  const ventas = repvVentasEnRango(desdeISO, hastaISO);

  // ── KPIs ──
  const ventasTotales = ventas.reduce((a, v) => a + (v.total || 0), 0);
  const numVentas = ventas.length;
  const ventaPromedio = numVentas > 0 ? ventasTotales / numVentas : 0;

  let ganancia = 0;
  let hayProductosSinCosto = false;
  ventas.forEach(v => {
    (v.items || v.productos || []).forEach(it => {
      const cant = it.cant || it.qty || 1;
      const costo = repvCostoProducto(it.nombre);
      if (costo != null) ganancia += ((it.precio || 0) - costo) * cant;
      else hayProductosSinCosto = true;
    });
  });
  const margen = ventasTotales > 0 ? (ganancia / ventasTotales) * 100 : 0;

  const kpiHTML = `
    <div class="rep-kpi">
      <div class="rep-kpi-icon" style="background:rgba(245,158,11,0.12);color:var(--accent);"><i class="fa fa-sack-dollar"></i></div>
      <div class="rep-kpi-label">Ventas Totales</div>
      <div class="rep-kpi-value" style="color:var(--accent);">${moneda()} ${ventasTotales.toFixed(2)}</div>
      <div class="rep-kpi-sub">${label}</div>
    </div>
    <div class="rep-kpi">
      <div class="rep-kpi-icon" style="background:rgba(59,130,246,0.12);color:#3b82f6;"><i class="fa fa-receipt"></i></div>
      <div class="rep-kpi-label">Número de Ventas</div>
      <div class="rep-kpi-value" style="color:#3b82f6;">${numVentas}</div>
      <div class="rep-kpi-sub">venta${numVentas !== 1 ? 's' : ''} registrada${numVentas !== 1 ? 's' : ''}</div>
    </div>
    <div class="rep-kpi">
      <div class="rep-kpi-icon" style="background:rgba(168,85,247,0.12);color:#a855f7;"><i class="fa fa-calculator"></i></div>
      <div class="rep-kpi-label">Venta Promedio</div>
      <div class="rep-kpi-value" style="color:#a855f7;">${moneda()} ${ventaPromedio.toFixed(2)}</div>
      <div class="rep-kpi-sub">por venta</div>
    </div>
    <div class="rep-kpi">
      <div class="rep-kpi-icon" style="background:rgba(16,185,129,0.12);color:var(--accent3);"><i class="fa fa-chart-line"></i></div>
      <div class="rep-kpi-label">Ganancia</div>
      <div class="rep-kpi-value" style="color:var(--accent3);">${moneda()} ${ganancia.toFixed(2)}</div>
      <div class="rep-kpi-sub">${hayProductosSinCosto ? 'solo productos con costo registrado' : 'según costo registrado'}</div>
    </div>
    <div class="rep-kpi">
      <div class="rep-kpi-icon" style="background:rgba(249,115,22,0.12);color:var(--warning);"><i class="fa fa-percent"></i></div>
      <div class="rep-kpi-label">Margen de Utilidad</div>
      <div class="rep-kpi-value" style="color:var(--warning);">${margen.toFixed(1)}%</div>
      <div class="rep-kpi-sub">promedio del periodo</div>
    </div>`;
  const kpiEl = document.getElementById('repvKpis');
  if (kpiEl) kpiEl.innerHTML = kpiHTML;

  // ── Gráfico Ventas / Ganancia ──
  const { keys, buckets } = repvAgregarPorPeriodo(ventas, groupBy, desde, hasta);
  const legendEl = document.getElementById('repvChartLegend');
  if (legendEl) {
    legendEl.innerHTML = `
      <span class="repv-legend-item"><span class="repv-legend-dot" style="background:var(--accent);"></span>Ventas</span>
      <span class="repv-legend-item"><span class="repv-legend-dot" style="background:var(--accent3);"></span>Ganancia</span>`;
  }

  const chartWrap = document.getElementById('repvChartWrap');
  if (chartWrap) {
    if (ventasTotales === 0) {
      chartWrap.innerHTML = `<div class="repv-chart-empty"><i class="fa fa-chart-column" style="font-size:20px;opacity:0.35;"></i> Sin ventas registradas en este periodo</div>`;
    } else {
      const maxVal = Math.max(1, ...keys.map(k => Math.max(buckets[k].ventas, buckets[k].ganancia)));
      // Escala "bonita" para las líneas guía (redondeada hacia arriba)
      const pasoBruto = maxVal / 4;
      const magnitud = Math.pow(10, Math.floor(Math.log10(pasoBruto || 1)));
      const pasoOpciones = [1, 2, 2.5, 5, 10];
      let paso = magnitud * 10;
      for (const opt of pasoOpciones) { if (pasoBruto <= opt * magnitud) { paso = opt * magnitud; break; } }
      const techo = paso * 4;

      const gridLines = [4, 3, 2, 1, 0].map(i => `
        <div class="repv-chart-grid-line"><span class="repv-grid-y-label">${moneda()} ${(paso * i).toFixed(0)}</span></div>`).join('');

      const cols = keys.map(k => {
        const b = buckets[k];
        const hv = techo > 0 ? Math.min(100, (b.ventas / techo) * 100) : 0;
        const hg = techo > 0 ? Math.min(100, (b.ganancia / techo) * 100) : 0;
        const tip = `${repvEtiquetaLarga(k, groupBy)}: Ventas ${moneda()} ${b.ventas.toFixed(2)} · Ganancia ${moneda()} ${b.ganancia.toFixed(2)} (${b.cant} venta${b.cant !== 1 ? 's' : ''})`;
        return `
          <div class="repv-col" title="${tip.replace(/"/g, '&quot;')}">
            <div class="repv-bars">
              <div class="repv-bar repv-bar-ventas" style="height:${hv}%"></div>
              <div class="repv-bar repv-bar-ganancia" style="height:${hg}%"></div>
            </div>
            <div class="repv-col-label">${repvEtiquetaCorta(k, groupBy)}</div>
          </div>`;
      }).join('');

      chartWrap.innerHTML = `
        <div class="repv-chart">
          <div class="repv-chart-grid">${gridLines}</div>
          <div class="repv-chart-plot">${cols}</div>
        </div>`;
    }
  }

  // ── Tabla Ventas por Periodo ──
  const tbody = document.getElementById('repvTablaBody');
  const cantEl = document.getElementById('repvTablaCant');
  if (cantEl) cantEl.textContent = `${keys.length} ${groupBy === 'month' ? 'mes(es)' : 'día(s)'}`;
  if (tbody) {
    if (ventasTotales === 0) {
      tbody.innerHTML = `<tr><td colspan="2" class="repv-vacio"><i class="fa fa-calendar-xmark" style="display:block;font-size:20px;margin-bottom:6px;opacity:0.3;"></i>Sin ventas en este periodo</td></tr>`;
    } else {
      const filas = keys.map(k => `
        <tr>
          <td style="font-size:12px;">${repvEtiquetaLarga(k, groupBy)}</td>
          <td style="text-align:right;font-family:'JetBrains Mono',monospace;font-weight:600;${buckets[k].ventas > 0 ? '' : 'color:var(--text3);'}">${moneda()} ${buckets[k].ventas.toFixed(2)}</td>
        </tr>`).join('');
      tbody.innerHTML = filas + `
        <tr class="repv-row-total">
          <td>TOTAL</td>
          <td style="text-align:right;font-family:'JetBrains Mono',monospace;">${moneda()} ${ventasTotales.toFixed(2)}</td>
        </tr>`;
    }
  }

  // ── Ventas por Departamento (donut) ──
  renderRepvDonutDepartamento(ventas, ventasTotales);

  // ── Ventas por Forma de Pago ──
  renderRepvFormasPago(ventas);
}

function renderRepvDonutDepartamento(ventas, ventasTotales) {
  const svg = document.getElementById('repvDonutSvg');
  const legend = document.getElementById('repvDonutLegend');
  if (!svg || !legend) return;

  const porDepto = {};
  ventas.forEach(v => {
    (v.items || v.productos || []).forEach(it => {
      const depto = it.cat || 'Sin Categoría';
      const monto = (it.precio || 0) * (it.cant || it.qty || 1);
      porDepto[depto] = (porDepto[depto] || 0) + monto;
    });
  });

  const total = Object.values(porDepto).reduce((a, b) => a + b, 0);
  if (total === 0) {
    svg.innerHTML = `<circle cx="50" cy="50" r="40" fill="none" stroke="var(--surface3)" stroke-width="13"/>`;
    legend.innerHTML = `<div class="repv-donut-empty">Sin ventas en este periodo</div>`;
    return;
  }

  const ordenados = Object.keys(porDepto).sort((a, b) => porDepto[b] - porDepto[a]);
  const top = ordenados.slice(0, 6);
  const restoTotal = ordenados.slice(6).reduce((s, k) => s + porDepto[k], 0);
  const finalKeys = [...top];
  const finalVals = top.map(k => porDepto[k]);
  if (restoTotal > 0) { finalKeys.push('Otros'); finalVals.push(restoTotal); }

  const perimetro = 2 * Math.PI * 40; // r=40
  let acumulado = 0, svgHTML = '', legendHTML = '';
  finalKeys.forEach((depto, i) => {
    const valor = finalVals[i];
    const pct = (valor / total) * 100;
    const color = _REPV_COLORES_DEPTO[i % _REPV_COLORES_DEPTO.length];
    const dash = (pct * perimetro) / 100;
    const offset = (acumulado * perimetro) / 100;
    svgHTML += `<circle cx="50" cy="50" r="40" fill="none" stroke="${color}" stroke-width="13" stroke-dasharray="${dash} ${perimetro}" stroke-dashoffset="-${offset}" transform="rotate(-90 50 50)"/>`;
    legendHTML += `
      <div class="repv-donut-legend-item">
        <div class="repv-donut-dot" style="background:${color};"></div>
        <div class="repv-donut-name">${depto} <span style="color:var(--text3);">(${pct.toFixed(0)}%)</span></div>
        <div class="repv-donut-value">${moneda()} ${valor.toFixed(2)}</div>
      </div>`;
    acumulado += pct;
  });

  svg.innerHTML = svgHTML;
  legend.innerHTML = legendHTML;
}

function renderRepvFormasPago(ventas) {
  const wrap = document.getElementById('repvPagosChart');
  if (!wrap) return;

  const metodos = ['efectivo', 'yape', 'tarjeta'];
  const montos = { efectivo: 0, yape: 0, tarjeta: 0 };
  ventas.forEach(v => {
    const d = desgloseVenta(v);
    metodos.forEach(m => montos[m] += (d[m] || 0));
  });

  const total = metodos.reduce((a, m) => a + montos[m], 0);
  const max = Math.max(1, ...metodos.map(m => montos[m]));

  const barsHTML = metodos.map(m => {
    const info = metodoInfo(m);
    const h = total > 0 ? (montos[m] / max) * 100 : 0;
    return `
      <div class="repv-pagos-col" title="${info.label}: ${moneda()} ${montos[m].toFixed(2)}">
        <span class="repv-pagos-bar-val" style="color:${info.color};">${moneda()} ${montos[m].toFixed(2)}</span>
        <div class="repv-pagos-bar-track">
          <div class="repv-pagos-bar" style="height:${h}%;background:${info.color};"></div>
        </div>
      </div>`;
  }).join('');

  const legendHTML = metodos.map(m => {
    const info = metodoInfo(m);
    const pct = total > 0 ? (montos[m] / total) * 100 : 0;
    return `
      <div class="repv-pagos-item">
        <span class="repv-pagos-dot" style="background:${info.color};"></span>
        <span class="repv-pagos-name"><i class="fa ${info.icon}" style="margin-right:5px;color:${info.color};"></i>${info.label}</span>
        <span class="repv-pagos-amt" style="color:${info.color};">${moneda()} ${montos[m].toFixed(2)}</span>
        <span class="repv-pagos-pct">${pct.toFixed(0)}%</span>
      </div>`;
  }).join('');

  wrap.innerHTML = total === 0
    ? `<div class="repv-donut-empty">Sin cobros registrados en este periodo</div>`
    : `<div class="repv-pagos-bars">${barsHTML}</div><div class="repv-pagos-legend">${legendHTML}</div>`;
}

// ========================================
// EXPORTAR (Excel)
// ========================================
function repvExportar() {
  const { desde, hasta, groupBy, label } = repvRango();
  const desdeISO = desde.toLocaleDateString('en-CA');
  const hastaISO = hasta.toLocaleDateString('en-CA');
  const ventas = repvVentasEnRango(desdeISO, hastaISO);
  const { keys, buckets } = repvAgregarPorPeriodo(ventas, groupBy, desde, hasta);

  const ventasTotales = ventas.reduce((a, v) => a + (v.total || 0), 0);
  const now = new Date().toLocaleDateString('es-PE');

  const thead = `<th>Periodo</th><th>N° Ventas</th><th>Ventas</th><th>Ganancia</th>`;
  const rows = keys.map(k => `<tr><td>${repvEtiquetaLarga(k, groupBy)}</td><td style="text-align:center;">${buckets[k].cant}</td><td style="text-align:right;">${moneda()} ${buckets[k].ventas.toFixed(2)}</td><td style="text-align:right;">${moneda()} ${buckets[k].ganancia.toFixed(2)}</td></tr>`).join('');
  const ganTotal = keys.reduce((a, k) => a + buckets[k].ganancia, 0);
  const totales = `<tr class="total-row"><td colspan="2" style="text-align:right;">TOTAL</td><td>${moneda()} ${ventasTotales.toFixed(2)}</td><td>${moneda()} ${ganTotal.toFixed(2)}</td></tr>`;

  _descargarXls(_xlsBase(`📊 Resumen de Ventas — ${label}`, `Exportado: ${now} · ${ventas.length} ventas registradas`, thead, rows, totales), `Resumen_Ventas_${desdeISO}_a_${hastaISO}.xls`);
}
