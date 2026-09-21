function actualizarDashboardReal() {
  // 1. Clientes
  if(document.getElementById('dashClientesCount')) 
    document.getElementById('dashClientesCount').textContent = clientes.length;

  // 2. Ventas y Transacciones de hoy desde ventasHistorial
  const hoy = new Date().toLocaleDateString('es-PE');
  const hoyISO = new Date().toLocaleDateString('en-CA');
  let totalHoy = 0;
  let transaccionesHoy = 0;

  ventasHistorial.forEach(v => {
    if (v.fecha === hoy && !v.esPagoPedidoProv) {
      totalHoy += Math.min(v.pagado ?? v.total ?? 0, v.total ?? 0);
      transaccionesHoy++;
    }
  });

  // Sumar abonos del día
  clientes.forEach(c => {
    (c.pagos || []).filter(p => p.fechaISO === hoyISO).forEach(p => {
      totalHoy += p.monto || 0;
    });
  });

  // Restar pagos a proveedores del día
  pagosProveedoresHistorial.filter(pp => pp.fechaISO === hoyISO).forEach(pp => {
    totalHoy -= parseFloat(pp.monto || 0);
  });

  if(document.getElementById('dashVentasHoy')) 
    document.getElementById('dashVentasHoy').textContent = `${moneda()} ${totalHoy.toFixed(2)}`;
  if(document.getElementById('dashTransacciones')) 
    document.getElementById('dashTransacciones').textContent = transaccionesHoy;
  
  updateStockBajoCount();
  actualizarDeudaAltaCount(); // <--- Agrega esta línea
  renderCajaInicialDash();
  renderWeekChartReal();
  renderSalesChart();
  renderRecentSales();
  renderCategoryChart();
}

function renderWeekChartReal(){
  const dias = [];
  const diasISO = [];
  for(let i=6;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    dias.push(d.toLocaleDateString('es-PE'));
    diasISO.push(d.toLocaleDateString('en-CA'));
  }
  const vals = diasISO.map((fechaISO, i) => {
    const fecha = dias[i];
    let total = ventasHistorial.filter(v=>v.fecha===fecha&&!v.esPagoPedidoProv).reduce((a,v)=>a+Math.min(v.pagado??v.total??0,v.total??0),0);
    clientes.forEach(c=>(c.pagos||[]).filter(p=>p.fechaISO===fechaISO).forEach(p=>total+=p.monto||0));
    pagosProveedoresHistorial.filter(pp=>pp.fechaISO===fechaISO).forEach(pp=>total-=parseFloat(pp.monto||0));
    return Math.max(0, total);
  });
  const max = Math.max(...vals,1);
  const c = document.getElementById('weekChart');
  if(c) c.innerHTML = vals.map(v=>`<div class="bar" style="height:${(v/max)*100}%" title="${moneda()} ${v.toFixed(2)}"></div>`).join('');
}

function renderRecentSales(){
  const container = document.getElementById('recentSalesList');
  if(!container) return;
  const recientes = ventasHistorial.slice(-8).reverse();
  if(!recientes.length){
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px;"><i class="fa fa-receipt" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.3;"></i>Sin ventas registradas aún</div>`;
    return;
  }
  container.innerHTML = recientes.map(v => {
    const initials = v.cliente?.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase() || '??';
    const cats = [...new Set((v.productos||[]).map(p=>p.cat||'').filter(Boolean))].join(', ') || 'Varios';
    return `<div class="rs-item">
      <div class="rs-avatar">${initials}</div>
      <div class="rs-info"><strong>${v.cliente || 'Anónimo'}</strong><small>${cats} · ${v.hora || ''}</small></div>
      <span class="rs-amount">${moneda()} ${(v.total||0).toFixed(2)}</span>
    </div>`;
  }).join('');
}

// VERIFICADOR AUTOMÁTICO DE SESIÓN AL RECARGAR
window.addEventListener('DOMContentLoaded', () => {
  const sesionGuardada = localStorage.getItem('bodega_sesion_activa');
  
  if (sesionGuardada) {
    currentUser = JSON.parse(sesionGuardada);
    
    // ... (Tu código existente de UI de usuario) ...
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').classList.add('visible');
    
    initApp();

    // 1. Recuperar la página donde se quedó
    const ultimaPagina = localStorage.getItem('bodega_last_page') || 'dashboard';
    showPage(ultimaPagina);

    // 2. RECUPERAR VISTA DE PRODUCTOS:
    const vistaGuardada = localStorage.getItem('bodega_prod_view_mode');
    if (vistaGuardada === 'list') {
      // Si guardó lista, cambiar a lista (ya arranca en grid)
      prodViewGrid = true; // toggleProductView lo cambia a false (list)
      toggleProductView();
    }
    // Si no hay preferencia o es 'grid', quedarse en grid (default)
  }
});

function renderCategoryChart() {
    const svg = document.getElementById('donutSvg');
    const legend = document.getElementById('donutLegend');
    const topList = document.getElementById('topProductsList');
    if (!svg || !legend || !topList) return;

    // 1. Procesar ventas por Categoría y por Producto
    const ventasPorCat = {};
    const ventasPorProd = {};
    
    ventasHistorial.forEach(venta => {
        const items = venta.items || venta.productos || [];
        items.forEach(item => {
            const cat = item.cat || 'Otros';
            const nombre = item.nombre || 'Desconocido';
            const cantidad = item.cant || item.qty || 0;
            
            ventasPorCat[cat] = (ventasPorCat[cat] || 0) + cantidad;
            ventasPorProd[nombre] = (ventasPorProd[nombre] || 0) + cantidad;
        });
    });

    const totalVendido = Object.values(ventasPorCat).reduce((a, b) => a + b, 0);
    const colores = ['#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#f43f5e', '#06b6d4'];

    // --- RENDER GRÁFICO DE DONA (SOLO TOP 5 CATEGORÍAS) ---
    if (totalVendido === 0) {
        svg.innerHTML = `<circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface3)" stroke-width="14"/>`;
        legend.innerHTML = `<div style="color:var(--text3); font-size:12px;">Sin ventas aún</div>`;
    } else {
        // Ordenar categorías por cantidad vendida
        const catsOrdenadas = Object.keys(ventasPorCat).sort((a,b) => ventasPorCat[b] - ventasPorCat[a]);
        const topCats = catsOrdenadas.slice(0, 5);
        
        // Calcular "Otros" (suma de las categorías no incluidas)
        const otrasCatsTotal = catsOrdenadas.slice(5).reduce((sum, cat) => sum + ventasPorCat[cat], 0);
        
        let finalCats = [...topCats];
        let finalValores = topCats.map(cat => ventasPorCat[cat]);
        
        if (otrasCatsTotal > 0) {
            finalCats.push('Otros');
            finalValores.push(otrasCatsTotal);
        }
        
        let htmlSvg = '';
        let htmlLegend = '';
        let acumulado = 0;
        const perimetro = 263.89; 
        
        finalCats.forEach((cat, i) => {
            const porcentaje = (finalValores[i] / totalVendido) * 100;
            const color = colores[i % colores.length];
            const dashArray = (porcentaje * perimetro) / 100;
            const offset = (acumulado * perimetro) / 100;
            
            htmlSvg += `<circle cx="50" cy="50" r="42" fill="none" stroke="${color}" stroke-width="14" stroke-dasharray="${dashArray} ${perimetro}" stroke-dashoffset="-${offset}" transform="rotate(-90 50 50)" style="transition: all 0.6s;"></circle>`;
            
            htmlLegend += `
                <div class="donut-legend-item" style="font-size:11px; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                    <div class="donut-dot" style="background:${color}; width:8px; height:8px; border-radius:50%;"></div>
                    <span style="white-space:nowrap;">${cat}: <strong>${Math.round(porcentaje)}%</strong></span>
                </div>`;
            acumulado += porcentaje;
        });
        
        svg.innerHTML = htmlSvg;
        legend.innerHTML = htmlLegend;
    }

    // --- RENDER TOP 5 PRODUCTOS MÁS VENDIDOS ---
    const prodsTop = Object.keys(ventasPorProd)
        .sort((a,b) => ventasPorProd[b] - ventasPorProd[a])
        .slice(0, 5);

    topList.innerHTML = prodsTop.length === 0 
        ? `<p style="color:var(--text3); font-size:10px; text-align:center;">-</p>`
        : prodsTop.map((prod, i) => {
            const total = ventasPorProd[prod];
            return `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:4px 8px; background:var(--surface2); border-radius:6px; border:1px solid var(--border); overflow:hidden;">
                <span style="font-size:10px; font-weight:500; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; margin-right:4px;">
                  <span style="color:var(--accent); font-weight:700;">${i+1}º</span> ${prod}
                </span>
                <span style="font-size:10px; font-weight:700; color:var(--accent2); flex-shrink:0;">${total}</span>
            </div>`;
        }).join('');
}

function clearProductFilters() {
  // 1. Limpiamos el input de texto
  const searchInput = document.getElementById('prodSearchInput');
  if (searchInput) searchInput.value = '';

  // 2. Limpiamos el selector de categorías
  const catSelect = document.getElementById('filterCatSelect');
  if (catSelect) catSelect.value = '';

  // 3. Mostramos todos los productos de nuevo
  renderProdTable(productos);
  
  // Opcional: Si tienes activada la vista de cuadrícula, también la refresca
  if (typeof renderProdGrid === "function") renderProdGrid();
  
  showToast('Filtros limpiados', 'success');
  _enfocarBusquedaProductos();
}

function renderSalesChart() {
  const container = document.getElementById('salesChart');
  const labelContainer = document.getElementById('salesChartLabels');
  const period = document.getElementById('salesPeriodFilter').value;
  if (!container || !labelContainer) return;

  let data = [];
  let labels = [];
  const now = new Date();
  // Normalizar fecha de hoy a las 00:00 para comparaciones precisas
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'week') {
    labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    data = Array(7).fill(0);
    
    // Calcular el lunes de la semana actual
    const diff = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diff);

    ventasHistorial.forEach(v => {
      if (v.esPagoPedidoProv) return;
      let vDayOnly;
      if (v.fechaISO) {
        const [y,m,d] = v.fechaISO.split('-').map(Number);
        vDayOnly = new Date(y, m-1, d);
      } else {
        const vDate = new Date(v.fecha);
        vDayOnly = new Date(vDate.getFullYear(), vDate.getMonth(), vDate.getDate());
      }
      
      if (vDayOnly >= monday && vDayOnly <= today) {
        const dayIdx = vDayOnly.getDay() === 0 ? 6 : vDayOnly.getDay() - 1;
        data[dayIdx] += Math.min(v.pagado ?? v.total ?? 0, v.total ?? 0);
      }
    });
    // Sumar abonos y restar pagos proveedores por día
    clientes.forEach(c => {
      (c.pagos||[]).forEach(p => {
        if (!p.fechaISO) return;
        const [y,m,d] = p.fechaISO.split('-').map(Number);
        const pDay = new Date(y, m-1, d);
        if (pDay >= monday && pDay <= today) {
          const dayIdx = pDay.getDay() === 0 ? 6 : pDay.getDay() - 1;
          data[dayIdx] += p.monto || 0;
        }
      });
    });
    pagosProveedoresHistorial.forEach(pp => {
      if (!pp.fechaISO) return;
      const [y,m,d] = pp.fechaISO.split('-').map(Number);
      const pDay = new Date(y, m-1, d);
      if (pDay >= monday && pDay <= today) {
        const dayIdx = pDay.getDay() === 0 ? 6 : pDay.getDay() - 1;
        data[dayIdx] = Math.max(0, data[dayIdx] - (parseFloat(pp.monto)||0));
      }
    });
  } 
  else if (period === 'month') {
    labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    data = Array(12).fill(0);
    ventasHistorial.forEach(v => {
      if (v.esPagoPedidoProv) return;
      let vDate;
      if (v.fechaISO) { const [y,m] = v.fechaISO.split('-').map(Number); vDate = new Date(y, m-1, 1); }
      else vDate = new Date(v.fecha);
      if (vDate.getFullYear() === now.getFullYear()) {
        data[vDate.getMonth()] += Math.min(v.pagado ?? v.total ?? 0, v.total ?? 0);
      }
    });
    clientes.forEach(c => {
      (c.pagos||[]).forEach(p => {
        if (!p.fechaISO) return;
        const [y,m] = p.fechaISO.split('-').map(Number);
        if (y === now.getFullYear()) data[m-1] += p.monto || 0;
      });
    });
    pagosProveedoresHistorial.forEach(pp => {
      if (!pp.fechaISO) return;
      const [y,m] = pp.fechaISO.split('-').map(Number);
      if (y === now.getFullYear()) data[m-1] = Math.max(0, data[m-1] - (parseFloat(pp.monto)||0));
    });
  }
  else if (period === 'years') {
    const currentYear = now.getFullYear();
    // Generamos etiquetas para los últimos 3 años de forma dinámica
    labels = [currentYear - 2, currentYear - 1, currentYear];
    data = Array(3).fill(0);
    
    ventasHistorial.forEach(v => {
      if (v.esPagoPedidoProv) return;
      let year;
      if (v.fechaISO) { year = parseInt(v.fechaISO.split('-')[0]); }
      else { year = new Date(v.fecha).getFullYear(); }
      const idx = labels.indexOf(year);
      if (idx !== -1) {
        data[idx] += Math.min(v.pagado ?? v.total ?? 0, v.total ?? 0);
      }
    });
    clientes.forEach(c => {
      (c.pagos||[]).forEach(p => {
        if (!p.fechaISO) return;
        const year = parseInt(p.fechaISO.split('-')[0]);
        const idx = labels.indexOf(year);
        if (idx !== -1) data[idx] += p.monto || 0;
      });
    });
    pagosProveedoresHistorial.forEach(pp => {
      if (!pp.fechaISO) return;
      const year = parseInt(pp.fechaISO.split('-')[0]);
      const idx = labels.indexOf(year);
      if (idx !== -1) data[idx] = Math.max(0, data[idx] - (parseFloat(pp.monto)||0));
    });
  }

  // El día/período más alto es la barra de referencia (100% de altura)
  const realMax = Math.max(...data);
  const displayMax = realMax === 0 ? 100 : realMax;

container.innerHTML = data.map((v, i) => {
  const isMax = v === realMax && realMax > 0;
  const height = v === 0 ? 0 : Math.max(4, (v / displayMax) * 100);
  const barColor = isMax
    ? 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)'
    : v > 0
      ? 'linear-gradient(180deg, rgba(245,158,11,0.7) 0%, rgba(217,119,6,0.5) 100%)'
      : 'transparent';

  return `
    <div style="flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; gap:4px;">
      <span style="font-size:9px; color:${isMax ? 'var(--accent)' : 'var(--accent3)'}; font-weight:700; min-height:12px;">
        ${v > 0 ? moneda() + v.toFixed(2) : ''}
      </span>
      <div style="
        height:${height}%;
        width:72%;
        min-width:12px;
        background:${barColor};
        border-radius:4px 4px 0 0;
        transition: height 0.5s cubic-bezier(0.34,1.56,0.64,1);
        ${isMax ? 'box-shadow: 0 0 10px rgba(245,158,11,0.4);' : ''}
        position:relative;"
        title="${moneda()} ${v.toFixed(2)}${isMax ? ' ★ Día más alto' : ''}">
      </div>
    </div>
  `;
}).join('');

  labelContainer.innerHTML = labels.map(l => `<span style="font-size:9px; color:var(--text3); flex:1; text-align:center;">${l}</span>`).join('');
}

