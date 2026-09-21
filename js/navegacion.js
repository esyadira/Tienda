// ========================================
// INIT
// ========================================
function initApp(){
  resetearStockFijo();
  if(!window._stockFijoTimer) window._stockFijoTimer = setInterval(resetearStockFijo, 60000); // si la app queda abierta pasada la medianoche
  renderProdTable();
  renderProdGrid();
  renderPOSProducts();
  renderClients();
  renderCategorias();
  renderCategoryChart();
  renderCompras();
  renderVendedores();
  startClock();
  updateStockBajoCount();
  renderSalesChart(); 
  renderCategorias();
  actualizarDashboardReal(); 
  actualizarSelectsCategorias();
  inicializarAjustes();
  actualizarNotificaciones();
}

function startClock(){
  const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  function tick(){
    const now = new Date();
    const hora = now.toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit'});
    const fecha = `${dias[now.getDay()]} ${now.getDate()} ${meses[now.getMonth()]}`;
    const clockEl = document.getElementById('headerClock');
    const dateEl = document.getElementById('headerDate');
    if(clockEl) clockEl.textContent = hora;
    if(dateEl) dateEl.textContent = fecha;
  }
  tick(); setInterval(tick, 1000);
}

// ========================================
// NAVIGATION
// ========================================
function showPage(pageId) {
  if (pageId === 'proveedores') pageId = 'compras'; // enlace guardado de la versión anterior
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i => {
    i.classList.remove('active');
    i.style.background = '';
    i.style.color = '';
  });

  const activePage = document.getElementById('page-' + pageId);
  if (activePage) {
    activePage.classList.add('active');
    localStorage.setItem('bodega_last_page', pageId);
  }

  // Cerrar sidebar al navegar (desktop y móvil)
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) {
    if (window.innerWidth <= 1024) {
      sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('show');
    } else {
      sidebar.classList.add('collapsed');
    }
  }

  // Quitar foco de cualquier input al cambiar de página
  if (document.activeElement && document.activeElement !== document.body) {
    document.activeElement.blur();
  }

  // Limpiar carrito de POS al salir de ventas
  if (pageId !== 'ventas') {
    if (typeof carrito !== 'undefined' && carrito.length > 0) {
      carrito = [];
      selectedClientePOS = null;
      bottleOwed = null;
      if (typeof clearClientSel === 'function') clearClientSel();
      if (typeof renderCart === 'function') renderCart();
      const posInput = document.querySelector('#page-ventas .table-search input');
      if (posInput) { posInput.value = ''; if (typeof renderPOSProducts === 'function') renderPOSProducts('',''); }
    }
  }

  // Controlar scroll del main según la página
  const mainEl = document.querySelector('.main');
  if (mainEl) {
    const fixedPages = ['productos','clientes','categorias','vendedores','compras'];
    if (fixedPages.includes(pageId)) {
      mainEl.classList.add('no-scroll');
    } else {
      mainEl.classList.remove('no-scroll');
    }
  }

  // Al entrar a Compras se recalcula lo que hay que reponer (el stock cambia con las ventas)
  if (pageId === 'compras' && typeof renderCompras === 'function') renderCompras();

  // Al entrar a Configuración se muestra siempre el inicio con los accesos
  if (pageId === 'configuracion' && typeof cfgVolver === 'function') cfgVolver();

  // Inicializar fecha y renderizar al entrar a Reportes
  if (pageId === 'reportes') {
    const inp = document.getElementById('repFechaInput');
    if (inp) inp.value = new Date().toLocaleDateString('en-CA');
    _filtroMetodoCerveza = 'todos';
    _filtroMetodoYape = 'todos';
    _filtroMetodoEfectivo = 'todos';
    repVendFiltroActivo = null;
    document.querySelectorAll('.rep-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.rep-panel').forEach(p => p.style.display = 'none');
    const firstTabBtn = document.querySelector('.rep-tab-btn');
    if (firstTabBtn) firstTabBtn.classList.add('active');
    const vendPanel = document.getElementById('rep-vendedores');
    if (vendPanel) vendPanel.style.display = 'flex';
    renderReportes('rep-vendedores');
  } else {
    _filtroMetodoCerveza = 'todos';
    _filtroMetodoYape = 'todos';
    _filtroMetodoEfectivo = 'todos';
    repVendFiltroActivo = null;
  }

  // Limpiar filtros de productos al salir de esa página y re-renderizar
  if (pageId !== 'productos') {
    const prodSearch = document.getElementById('prodSearchInput');
    const catFilter = document.getElementById('filterCatSelect');
    const hadTab = (typeof prodVistaTab !== 'undefined' && prodVistaTab !== 'todos');
    if (hadTab) prodVistaTab = 'todos';
    const hadFilter = (prodSearch && prodSearch.value) || (catFilter && catFilter.value) || hadTab;
    if (prodSearch) prodSearch.value = '';
    if (catFilter) catFilter.value = '';
    if (hadFilter) { renderProdTable(); renderProdGrid(); }
  }

  window._activeSearchSelector = null;

  const color = settings.apariencia.colorAcento || '#f59e0b';
  const hex = color.replace('#','');
  const r = parseInt(hex.substring(0,2),16);
  const g = parseInt(hex.substring(2,4),16);
  const b = parseInt(hex.substring(4,6),16);

  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('onclick')?.includes(`'${pageId}'`)) {
      item.classList.add('active');
      item.style.background = `rgba(${r},${g},${b},0.12)`;
      item.style.color = color;
    }
  });
}

