
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

// ========================================
// IMÁGENES EN SUPABASE STORAGE
// En vez de guardar las fotos como texto base64 dentro de bodega_sync.datos
// (lo que hace que CADA sincronización reenvíe todas las fotos de nuevo),
// se sube el archivo a un bucket de Storage y solo se guarda el link corto.
// Requiere crear en el proyecto de Supabase un bucket público llamado "imagenes".
// ========================================
const SB_BUCKET_IMAGENES = 'imagenes';

// Sube una imagen (dataURL "data:image/...") a Storage y devuelve la URL pública.
// Si no hay nube conectada, o si algo falla, devuelve la misma dataURL tal cual
// (se guarda localmente como antes, no se pierde la foto).
async function sbSubirImagen(dataUrl, carpeta) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl; // ya es un link o está vacío
  if (!_supabase || !_sbConectado) return dataUrl;
  const cfg = sbGetConfig();
  if (!cfg) return dataUrl;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const ruta = `${cfg.tienda}/${carpeta}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await _supabase.storage.from(SB_BUCKET_IMAGENES).upload(ruta, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    const { data } = _supabase.storage.from(SB_BUCKET_IMAGENES).getPublicUrl(ruta);
    return data.publicUrl;
  } catch (e) {
    console.warn('No se pudo subir la imagen a Storage, se guarda solo en este dispositivo:', e.message);
    return dataUrl;
  }
}

// Borra del Storage una imagen anterior cuando se reemplaza o se quita, para no dejar basura acumulándose.
async function sbBorrarImagenAnterior(url) {
  if (!url || !url.startsWith('http') || !_supabase || !_sbConectado) return;
  const cfg = sbGetConfig();
  if (!cfg || !url.includes('/' + SB_BUCKET_IMAGENES + '/')) return;
  try {
    const marcador = '/object/public/' + SB_BUCKET_IMAGENES + '/';
    const idx = url.indexOf(marcador);
    if (idx === -1) return;
    const ruta = decodeURIComponent(url.substring(idx + marcador.length));
    await _supabase.storage.from(SB_BUCKET_IMAGENES).remove([ruta]);
  } catch (e) { /* no es crítico si falla el borrado */ }
}

// ========================================
// HISTORIAL EN TABLAS SEPARADAS (ventas, cajas, movimientos, devoluciones, pagos a proveedores)
// Antes, CADA vez que se guardaba cualquier cosa, se reenviaba TODO el historial completo
// dentro de bodega_sync.datos. Ahora cada venta/caja/movimiento/devolución/pago vive como
// una FILA independiente en su propia tabla: al agregar uno nuevo, solo se sube ESE registro.
// Requiere crear estas tablas en el proyecto de Supabase (ver instrucciones aparte).
// ========================================
const SB_TABLA_HISTORIAL = {
  ventasHistorial: 'bodega_ventas',
  cajasHistorial: 'bodega_cajas',
  movimientosCaja: 'bodega_movimientos',
  devolucionesHistorial: 'bodega_devoluciones',
  pagosProveedoresHistorial: 'bodega_pagos_proveedores'
};

// Sube o actualiza UN registro del historial en su propia tabla (no toca el resto).
function sbEncolarPendienteHistorial(clave, registro, borrar) {
  let cola = [];
  try { cola = JSON.parse(localStorage.getItem('bodega_historial_pendiente') || '[]'); } catch(e) {}
  cola = cola.filter(x => !(x.clave === clave && x.registro && registro && x.registro.id === registro.id));
  cola.push({ clave, registro, borrar: !!borrar });
  localStorage.setItem('bodega_historial_pendiente', JSON.stringify(cola));
}

async function sbGuardarRegistro(clave, registro, _sinReintento) {
  const tabla = SB_TABLA_HISTORIAL[clave];
  if (!tabla || !registro || registro.id == null) return false;
  if (!_supabase || !_sbConectado) { if (!_sinReintento) sbEncolarPendienteHistorial(clave, registro); return false; }
  const cfg = sbGetConfig();
  if (!cfg) return false;
  try {
    const { error } = await _supabase.from(tabla).upsert({ tienda: cfg.tienda, id: registro.id, datos: registro }, { onConflict: 'tienda,id' });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn(`No se pudo subir el registro a ${tabla}:`, e.message);
    if (!_sinReintento) sbEncolarPendienteHistorial(clave, registro);
    return false;
  }
}

// Borra UN registro de su tabla (ej: se eliminó una venta o un movimiento de caja)
async function sbBorrarRegistro(clave, id) {
  const tabla = SB_TABLA_HISTORIAL[clave];
  if (!tabla || id == null) return;
  if (!_supabase || !_sbConectado) { sbEncolarPendienteHistorial(clave, { id }, true); return; }
  const cfg = sbGetConfig();
  if (!cfg) return;
  try { await _supabase.from(tabla).delete().eq('tienda', cfg.tienda).eq('id', id); }
  catch (e) { console.warn(`No se pudo borrar de ${tabla}:`, e.message); }
}

// Sube lo que quedó pendiente por falta de internet (se llama al reconectar)
async function sbSubirPendientesHistorial() {
  if (!_supabase || !_sbConectado) return;
  let cola = [];
  try { cola = JSON.parse(localStorage.getItem('bodega_historial_pendiente') || '[]'); } catch(e) {}
  if (!cola.length) return;
  const restantes = [];
  for (const item of cola) {
    if (item.borrar) { await sbBorrarRegistro(item.clave, item.registro && item.registro.id); continue; }
    const ok = await sbGuardarRegistro(item.clave, item.registro, true);
    if (!ok) restantes.push(item);
  }
  localStorage.setItem('bodega_historial_pendiente', JSON.stringify(restantes));
  if (cola.length && restantes.length === 0) showToast('Historial pendiente subido a la nube ☁️', 'success');
}

// Trae TODO el historial de una tabla (se usa al abrir la app, no en cada guardado)
async function sbCargarHistorial(clave) {
  const tabla = SB_TABLA_HISTORIAL[clave];
  const cfg = sbGetConfig();
  if (!tabla || !cfg) return null;
  try {
    const { data, error } = await _supabase.from(tabla).select('datos').eq('tienda', cfg.tienda).order('id', { ascending: true });
    if (error) throw error;
    return (data || []).map(r => r.datos);
  } catch (e) { console.warn(`No se pudo cargar ${tabla}:`, e.message); return null; }
}

async function sbCargarTodoElHistorial() {
  for (const clave of Object.keys(SB_TABLA_HISTORIAL)) {
    const datos = await sbCargarHistorial(clave);
    if (datos === null) continue; // error de red: se deja lo local, no se borra nada
    if (clave === 'ventasHistorial') ventasHistorial = datos;
    else if (clave === 'cajasHistorial') cajasHistorial = datos;
    else if (clave === 'movimientosCaja') movimientosCaja = datos;
    else if (clave === 'devolucionesHistorial') devolucionesHistorial = datos;
    else if (clave === 'pagosProveedoresHistorial') pagosProveedoresHistorial = datos;
  }
}

// Borra todas las filas de una tabla para esta tienda (solo se usa al limpiar historial a propósito)
async function sbVaciarTablaHistorial(clave) {
  const tabla = SB_TABLA_HISTORIAL[clave];
  if (!tabla || !_supabase || !_sbConectado) return;
  const cfg = sbGetConfig();
  if (!cfg) return;
  try { await _supabase.from(tabla).delete().eq('tienda', cfg.tienda); }
  catch (e) { console.warn(`No se pudo vaciar ${tabla}:`, e.message); }
}

// Reemplaza TODO el historial en la nube por el que hay localmente ahora mismo.
// Solo se usa al restaurar un backup completo (acción rara y explícita del usuario);
// para el uso normal del día a día están sbGuardarRegistro/sbBorrarRegistro, que
// solo suben o borran el registro puntual que cambió.
async function sbResincronizarHistorialCompleto() {
  if (!_supabase || !_sbConectado) return;
  const cfg = sbGetConfig();
  if (!cfg) return;
  const fuentes = { ventasHistorial, cajasHistorial, movimientosCaja, devolucionesHistorial, pagosProveedoresHistorial };
  try {
    for (const clave of Object.keys(fuentes)) {
      const tabla = SB_TABLA_HISTORIAL[clave];
      await _supabase.from(tabla).delete().eq('tienda', cfg.tienda);
      const lista = (fuentes[clave] || []).filter(r => r);
      for (let i = 0; i < lista.length; i += 200) {
        const tanda = lista.slice(i, i + 200).map((r, j) => ({ tienda: cfg.tienda, id: r.id != null ? r.id : (Date.now() + i + j), datos: r }));
        if (tanda.length) await _supabase.from(tabla).upsert(tanda, { onConflict: 'tienda,id' });
      }
    }
  } catch (e) { console.warn('No se pudo resincronizar el historial completo:', e.message); }
}

// Migración única: la primera vez que se conecta con este código nuevo, si las tablas
// de historial están vacías, copia lo que había en bodega_sync.datos (ventas, cajas y
// pagos a proveedores viejos) y lo que hay en localStorage (movimientos y devoluciones,
// que antes nunca se subían a la nube) hacia las tablas nuevas. Después de esto, ya no
// se vuelve a reenviar todo junto.
async function sbMigrarHistorialSiHaceFalta() {
  if (!_supabase || !_sbConectado) return;
  if (localStorage.getItem('bodega_historial_migrado_v2') === '1') return;
  const cfg = sbGetConfig();
  if (!cfg) return;
  try {
    const { count } = await _supabase.from('bodega_ventas').select('id', { count: 'exact', head: true }).eq('tienda', cfg.tienda);
    if (count && count > 0) { localStorage.setItem('bodega_historial_migrado_v2', '1'); return; }

    const { data } = await _supabase.from('bodega_sync').select('datos').eq('tienda', cfg.tienda).single();
    let viejo = {};
    try { viejo = data && data.datos ? JSON.parse(data.datos) : {}; } catch(e) {}

    const fuentes = {
      ventasHistorial: (viejo.ventasHistorial && viejo.ventasHistorial.length ? viejo.ventasHistorial : ventasHistorial) || [],
      cajasHistorial: (viejo.cajasHistorial && viejo.cajasHistorial.length ? viejo.cajasHistorial : cajasHistorial) || [],
      pagosProveedoresHistorial: (viejo.pagosProveedoresHistorial && viejo.pagosProveedoresHistorial.length ? viejo.pagosProveedoresHistorial : pagosProveedoresHistorial) || [],
      movimientosCaja: movimientosCaja || [],
      devolucionesHistorial: devolucionesHistorial || []
    };

    for (const clave of Object.keys(fuentes)) {
      const tabla = SB_TABLA_HISTORIAL[clave];
      const lista = fuentes[clave].filter(r => r);
      for (let i = 0; i < lista.length; i += 200) {
        const tanda = lista.slice(i, i + 200).map((r, j) => ({ tienda: cfg.tienda, id: r.id != null ? r.id : (Date.now() + i + j), datos: r }));
        if (tanda.length) await _supabase.from(tabla).upsert(tanda, { onConflict: 'tienda,id' });
      }
    }
    localStorage.setItem('bodega_historial_migrado_v2', '1');
    console.log('[BodegaPOS] Historial migrado a tablas separadas ✓');
  } catch (e) { console.warn('No se pudo migrar el historial:', e.message); }
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
    await sbMigrarHistorialSiHaceFalta(); // solo la primera vez con este código nuevo
    await sbCargarDesdeNube(false); // arranque automático: respeta lo que se hizo sin internet
    await sbSubirPendientesHistorial(); // sube ventas/cajas/etc. que quedaron pendientes sin internet
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
  // El historial (ventas, cajas, movimientos, devoluciones, pagos a proveedores) YA NO va aquí:
  // cada uno se sube solo (una fila) apenas se crea, con sbGuardarRegistro. Aquí solo va lo que
  // cambia por edición completa (catálogo y ajustes), que es mucho más liviano.
  const payload = {
    tienda: cfg.tienda,
    datos: JSON.stringify({ productos, clientes, proveedores, vendedores, categorias, ordenesCompra, listaCompras }),
    settings: localStorage.getItem('bodega_settings') || '{}',
    updated_at: new Date().toISOString()
  };
  try {
    const { error } = await _supabase.from('bodega_sync').upsert(payload, { onConflict: 'tienda' });
    if (error) throw error;
    localStorage.removeItem('bodega_sb_pendiente');
    const ind = document.getElementById('sbLastSync');
    if (ind) ind.textContent = 'Última sync: ' + new Date().toLocaleTimeString('es-PE');
  } catch(e) { console.warn('Error guardando en nube:', e.message); }
}

async function sbCargarDesdeNube(forzar = true) {
  if (!_supabase || !_sbConectado) return;
  const cfg = sbGetConfig();
  if (!cfg) return;
  // Trabajaste sin internet: lo local es lo más nuevo. Se sube a la nube en vez de bajar y pisarlo.
  if (!forzar && localStorage.getItem('bodega_sb_pendiente') === '1') {
    console.warn('[BodegaPOS] Hay cambios hechos sin internet. Subiendo a la nube...');
    await sbGuardarEnNube();
    if (localStorage.getItem('bodega_sb_pendiente') !== '1') showToast('Cambios hechos sin internet subidos a la nube ☁️', 'success');
    return;
  }
  try {
    const { data, error } = await _supabase.from('bodega_sync').select('datos,settings,updated_at').eq('tienda', cfg.tienda).single();
    if (error || !data) return;
    const d = JSON.parse(data.datos);

    // ── Protección: solo sobrescribir si la nube es MÁS NUEVA que lo local ──
    // Antes se comparaba solo la CANTIDAD de productos, lo que podía pisar cambios
    // reales sin avisar (ej: si borrabas 2 productos y agregabas 2 nuevos el mismo
    // día, la cantidad total no cambiaba y la nube igual pisaba lo local).
    // Ahora comparamos POR FECHA: cuándo se guardó por última vez en este
    // dispositivo vs. cuándo se guardó por última vez en la nube.
    const ultimaLocal = localStorage.getItem('bodega_ultima_modificacion_local');
    const ultimaNube = data.updated_at;
    if (ultimaLocal && ultimaNube && new Date(ultimaLocal) > new Date(ultimaNube)) {
      // Lo local es más nuevo que la nube: NO pisar, subir en vez de bajar
      console.warn(`[BodegaPOS] Local (${ultimaLocal}) es más nuevo que la nube (${ultimaNube}). Subiendo local a la nube...`);
      showToast('Tenías cambios más recientes en este dispositivo. Subiendo a la nube...', 'warning');
      await sbGuardarEnNube();
      return;
    }

    if (d.productos) productos = d.productos;
    if (d.clientes) clientes = d.clientes;
    if (d.proveedores) proveedores = d.proveedores;
    if (d.ordenesCompra) ordenesCompra = d.ordenesCompra;
    if (d.listaCompras) listaCompras = d.listaCompras;
    if (d.vendedores) vendedores = d.vendedores;
    if (d.categorias) categorias = d.categorias;
    // El historial ya no viaja dentro de este blob: cada tabla se trae por separado
    // (no pesa el guardado normal, solo se descarga completo al abrir la app).
    await sbCargarTodoElHistorial();
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
  if (sbGetConfig()) localStorage.setItem('bodega_sb_pendiente', '1'); // queda pendiente hasta que se suba con éxito
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

// Al volver el internet, reconecta y sube lo que se hizo sin conexión
window.addEventListener('online', () => {
  if (sbGetConfig() && !_sbConectado) sbInicializar();
  else if (_sbConectado) sbSubirPendientesHistorial();
});
