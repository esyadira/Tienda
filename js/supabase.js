
// ========================================
// SUPABASE CLOUD SYNC
// ========================================
let _supabase = null;
let _sbSkipSync = false;
let _sbSyncTimeout = null;
let _sbConectado = false;

function sbGetConfig() {
  try { return JSON.parse(localStorage.getItem('bodega_supabase_cfg') || 'null'); } catch { return null; }
}

async function sbInicializar() {
  const cfg = sbGetConfig();
  if (!cfg || !cfg.url || !cfg.key || !cfg.tienda) return;
  try {
    _supabase = window.supabase.createClient(cfg.url, cfg.key);
    const { error } = await _supabase.from('bodega_sync').select('id').eq('tienda', cfg.tienda).limit(1);
    if (error && error.code !== 'PGRST116' && error.code !== '42P01') throw error;
    _sbConectado = true;
    sbActualizarIndicador(true);
    await sbCargarDesdeNube();
    console.log('Supabase conectado OK');
  } catch(e) {
    _sbConectado = false;
    sbActualizarIndicador(false);
    console.warn('Supabase no disponible:', e.message);
  }
}

function sbActualizarIndicador(conectado) {
  const dot = document.getElementById('sbStatusDot');
  const txt = document.getElementById('sbStatusTxt');
  if (!dot || !txt) return;
  if (conectado) {
    dot.style.background = '#10b981'; dot.style.boxShadow = '0 0 6px #10b981';
    txt.textContent = 'Conectado a la nube ✓'; txt.style.color = '#10b981';
  } else {
    dot.style.background = '#ef4444'; dot.style.boxShadow = '0 0 6px #ef4444';
    txt.textContent = 'Sin conexión a la nube'; txt.style.color = '#ef4444';
  }
}

async function sbGuardarEnNube() {
  if (!_supabase || !_sbConectado) return;
  const cfg = sbGetConfig();
  if (!cfg) return;
  const payload = {
    tienda: cfg.tienda,
    datos: JSON.stringify({ productos, clientes, proveedores, vendedores, ventasHistorial, pagosProveedoresHistorial, categorias, cajasHistorial, ordenesCompra, listaCompras }),
    settings: localStorage.getItem('bodega_settings') || '{}',
    updated_at: new Date().toISOString()
  };
  try {
    const { error } = await _supabase.from('bodega_sync').upsert(payload, { onConflict: 'tienda' });
    if (error) throw error;
    const ind = document.getElementById('sbLastSync');
    if (ind) ind.textContent = 'Última sync: ' + new Date().toLocaleTimeString('es-PE');
  } catch(e) { console.warn('Error guardando en nube:', e.message); }
}

async function sbCargarDesdeNube() {
  if (!_supabase || !_sbConectado) return;
  const cfg = sbGetConfig();
  if (!cfg) return;
  try {
    const { data, error } = await _supabase.from('bodega_sync').select('datos,settings').eq('tienda', cfg.tienda).single();
    if (error || !data) return;
    const d = JSON.parse(data.datos);

    // ── Protección: solo sobrescribir si la nube tiene IGUAL O MÁS datos ──
    // Comparamos la cantidad de productos (el dato más crítico).
    // Si local tiene más productos que la nube, NO pisamos — la nube está desactualizada.
    const prodLocales = productos ? productos.length : 0;
    const prodNube   = (d.productos && Array.isArray(d.productos)) ? d.productos.length : 0;
    if (prodLocales > prodNube) {
      // La nube está desactualizada: guardar local en nube en vez de pisar
      console.warn(`[BodegaPOS] Nube tiene ${prodNube} productos pero local tiene ${prodLocales}. Subiendo local a la nube...`);
      showToast(`Nube desactualizada (${prodNube} vs ${prodLocales} productos). Subiendo datos locales...`, 'warning');
      await sbGuardarEnNube();
      return;
    }

    if (d.productos) productos = d.productos;
    if (d.clientes) clientes = d.clientes;
    if (d.proveedores) proveedores = d.proveedores;
    if (d.ordenesCompra) ordenesCompra = d.ordenesCompra;
    if (d.listaCompras) listaCompras = d.listaCompras;
    if (d.vendedores) vendedores = d.vendedores;
    if (d.ventasHistorial) ventasHistorial = d.ventasHistorial;
    if (d.pagosProveedoresHistorial) pagosProveedoresHistorial = d.pagosProveedoresHistorial;
    if (d.categorias) categorias = d.categorias;
    if (d.cajasHistorial) {
      const ids = new Set(cajasHistorial.map(c => c.id));
      d.cajasHistorial.forEach(c => { if (!ids.has(c.id)) cajasHistorial.push(c); });
    }
    if (data.settings) {
      localStorage.setItem('bodega_settings', data.settings);
      try {
        const remoteSettings = JSON.parse(data.settings);
        if (remoteSettings.alertas) Object.assign(settings.alertas, remoteSettings.alertas);
        if (remoteSettings.negocio) Object.assign(settings.negocio, remoteSettings.negocio);
        if (remoteSettings.apariencia) Object.assign(settings.apariencia, remoteSettings.apariencia);
        if (remoteSettings.sistema) Object.assign(settings.sistema, remoteSettings.sistema);
        if (remoteSettings.pagos) Object.assign(settings.pagos, remoteSettings.pagos);
        if (remoteSettings.ticket) Object.assign(settings.ticket, remoteSettings.ticket);
        inicializarAjustes();
        aplicarCambiosVisuales();
        aplicarMonedaEnDOM();
        aplicarModoOscuro(settings.apariencia.darkMode);
      } catch(e) {}
    }
    // Guardar local sin disparar otro sync (evita bucle infinito)
    _sbSkipSync = true;
    guardarTodoEnLocalStorage();
    _sbSkipSync = false;
    // Refrescar UI sin llamar initApp() (evita destruir el DOM mientras el usuario hace click)
    renderProdTable(); renderProdGrid(); renderPOSProducts();
    renderClients(); renderCompras(); renderVendedores();
    actualizarDashboardReal(); actualizarNotificaciones(); updateStockBajoCount();
    showToast('Datos sincronizados desde la nube ☁️', 'success');
  } catch(e) { console.warn('Error cargando desde nube:', e.message); }
}

function sbSyncDebounced() {
  if (_sbSkipSync) return; // No sincronizar si estamos cargando desde la nube
  clearTimeout(_sbSyncTimeout);
  _sbSyncTimeout = setTimeout(() => sbGuardarEnNube(), 1500);
}

async function sbConectarManual() {
  const url = document.getElementById('sbUrl').value.trim();
  const key = document.getElementById('sbKey').value.trim();
  const tienda = document.getElementById('sbTienda').value.trim();
  if (!url || !key || !tienda) { showToast('Completa todos los campos', 'error'); return; }
  localStorage.setItem('bodega_supabase_cfg', JSON.stringify({ url, key, tienda }));
  await sbInicializar();
  if (_sbConectado) { showToast('Conectado y sincronizando', 'success'); sbRenderCfgPanel(); }
  else { showToast('No se pudo conectar. Verifica los datos', 'error'); }
}

function sbDesconectar() {
  if (!confirm('¿Desconectar la nube? Tus datos locales se mantendrán.')) return;
  localStorage.removeItem('bodega_supabase_cfg');
  _supabase = null; _sbConectado = false;
  sbActualizarIndicador(false);
  sbRenderCfgPanel();
  showToast('Desconectado de la nube', 'success');
}

function sbRenderCfgPanel() {
  const panel = document.getElementById('cfg-supabase-body');
  if (!panel) return;
  const cfg = sbGetConfig();
  if (cfg && _sbConectado) {
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:14px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:10px;margin-bottom:16px;">
        <div id="sbStatusDot" style="width:10px;height:10px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981;animation:pulse-dot 2s infinite;flex-shrink:0;"></div>
        <div>
          <div id="sbStatusTxt" style="font-size:13px;font-weight:600;color:#10b981;">Conectado a la nube ✓</div>
          <div id="sbLastSync" style="font-size:11px;color:var(--text3);">Sincronizando automáticamente</div>
        </div>
        <button class="btn btn-danger btn-sm" style="margin-left:auto;" onclick="sbDesconectar()"><i class="fa fa-plug-circle-xmark"></i> Desconectar</button>
      </div>
      <div style="font-size:12px;color:var(--text3);padding:12px 14px;background:var(--surface2);border-radius:8px;line-height:1.7;">
        <strong style="color:var(--text);">Tienda ID:</strong> ${cfg.tienda}<br>
        <strong style="color:var(--text);">Proyecto:</strong> ${cfg.url.substring(0,45)}...<br><br>
        ✅ Los datos se sincronizan automáticamente con cada cambio.
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" onclick="sbCargarDesdeNube()"><i class="fa fa-cloud-arrow-down"></i> Cargar desde nube</button>
        <button class="btn btn-primary btn-sm" onclick="sbGuardarEnNube()"><i class="fa fa-cloud-arrow-up"></i> Guardar en nube ahora</button>
      </div>`;
  } else {
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:10px;margin-bottom:16px;">
        <div id="sbStatusDot" style="width:10px;height:10px;border-radius:50%;background:#ef4444;flex-shrink:0;"></div>
        <div id="sbStatusTxt" style="font-size:13px;font-weight:600;color:#ef4444;">Sin conexión a la nube</div>
      </div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px;line-height:1.7;padding:12px;background:var(--surface2);border-radius:8px;">
        Conecta con <strong style="color:var(--text);">Supabase</strong> para guardar tus datos en la nube de forma automática.
        Completamente <strong style="color:var(--accent3);">gratis</strong> hasta 500 MB de datos.<br>
        <a href="https://supabase.com" target="_blank" style="color:var(--accent);font-weight:600;">→ Crear cuenta gratis en supabase.com</a>
      </div>
      <div class="form-field" style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">URL del Proyecto</label>
        <input type="text" id="sbUrl" placeholder="https://xxxxxxxxxxxx.supabase.co" value="${cfg?.url||''}" style="width:100%;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:'Sora',sans-serif;font-size:13px;outline:none;">
      </div>
      <div class="form-field" style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">API Key (anon public)</label>
        <input type="text" id="sbKey" placeholder="eyJhbGciOiJIUzI1NiIs..." value="${cfg?.key||''}" style="width:100%;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:'Sora',sans-serif;font-size:13px;outline:none;">
      </div>
      <div class="form-field" style="margin-bottom:16px;"><label style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">Nombre de tu Tienda (ID único)</label>
        <input type="text" id="sbTienda" placeholder="mi-bodega-2024" value="${cfg?.tienda||''}" style="width:100%;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:'Sora',sans-serif;font-size:13px;outline:none;">
        <small style="font-size:11px;color:var(--text3);margin-top:4px;display:block;">Sin espacios. Ej: bodega-don-jose-lima</small>
      </div>
      <button class="btn btn-primary" onclick="sbConectarManual()" style="width:100%;"><i class="fa fa-cloud-arrow-up"></i> Conectar con Supabase</button>`;
  }
}
