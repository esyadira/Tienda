// --- SISTEMA DE CONFIGURACIÓN UNIFICADO ---
const _settingsDefault = {
    negocio:    { nombre: "BodegaPOS", tel: "", email: "", dir: "", logo: "" },
    apariencia: { darkMode: false, colorAcento: "#f59e0b" },
    alertas:    { stock: true, minStock: 3, deuda: true, montoDeuda: 100 },
    sistema:    { moneda: "S/.", ticket: true, mensajes: true, confirmDel: true, margenAuto: true, margenPct: 20 },
    funciones:  { fiar: true }, // Funciones opcionales del sistema que se pueden apagar/prender desde Preferencias
    pagos:      { yape: true, tarjeta: true, mixto: true },  // Efectivo siempre está activo
    ticket:     {},  // el diseño completo y sus valores por defecto están en ticket.js
    terminal:   { activo: false, proveedor: null, izipay: {}, mercadopago: {} }, // Terminal de cobro: Izipay / Mercado Pago
    impresora:  { modo: 'navegador', columnas: 36, nombre: '' } // Impresora de tickets
};
let _settingsRaw = {};
try { _settingsRaw = JSON.parse(localStorage.getItem('bodega_settings')) || {}; } catch(e) { _settingsRaw = {}; }
// Merge profundo: garantiza que cada sub-objeto exista aunque el localStorage esté incompleto
let settings = {
    negocio:    Object.assign({}, _settingsDefault.negocio,    _settingsRaw.negocio    || {}),
    apariencia: Object.assign({}, _settingsDefault.apariencia, _settingsRaw.apariencia || {}),
    alertas:    Object.assign({}, _settingsDefault.alertas,    _settingsRaw.alertas    || {}),
    sistema:    Object.assign({}, _settingsDefault.sistema,    _settingsRaw.sistema    || {}),
    funciones:  Object.assign({}, _settingsDefault.funciones,  _settingsRaw.funciones  || {}),
    pagos:      Object.assign({}, _settingsDefault.pagos,      _settingsRaw.pagos      || {}),
    ticket:     Object.assign({}, _settingsDefault.ticket,     _settingsRaw.ticket     || {}),
    terminal:   Object.assign({}, _settingsDefault.terminal,   _settingsRaw.terminal   || {}),
    impresora:  Object.assign({}, _settingsDefault.impresora,  _settingsRaw.impresora  || {})
};

// Guarda cuál era el logo ya guardado, para poder borrarlo de Storage cuando se reemplaza o se quita
let _cfgLogoAnterior = settings.negocio.logo || '';

// HELPER: símbolo de moneda actual
function moneda() { return settings.sistema.moneda || 'S/.'; }

// HELPER: confirm respetando confirmDel (solo para eliminaciones)
function cfgConfirm(msg) {
    if (!settings.sistema.confirmDel) return true;
    return confirm(msg);
}

// HELPER: aplicar moneda en todos los elementos estáticos del DOM
function aplicarMonedaEnDOM() {
    const sym = moneda();
    // Actualiza el total del carrito
    const cartTotal = document.getElementById('cartTotal');
    if (cartTotal && cartTotal.textContent.includes('.')) {
        cartTotal.textContent = cartTotal.textContent.replace(/^[^\d]*/, sym + ' ');
    }
    // Actualiza el dashboard stat de ventas hoy
    const dashVentas = document.getElementById('dashVentasHoy');
    if (dashVentas) {
        const num = dashVentas.textContent.replace(/[^\d.]/g, '');
        if (num) dashVentas.textContent = `${sym} ${parseFloat(num).toFixed(2)}`;
    }
    // Re-renderiza tablas si están visibles
    if (typeof renderProdTable === 'function') renderProdTable();
    if (typeof renderProdGrid === 'function') renderProdGrid();
    if (typeof renderClients === 'function') renderClients();
    if (typeof renderCart === 'function') renderCart();
    if (typeof renderPOSProducts === 'function') renderPOSProducts();
    if (typeof actualizarDashboardReal === 'function') actualizarDashboardReal();
    // Actualiza el preview de moneda en configuración
    const prev = document.getElementById('cfg-moneda-preview');
    if (prev) prev.textContent = `Vista previa de precio: ${sym} 25.50`;
}

// 1. FUNCIÓN PRINCIPAL DE APLICACIÓN VISUAL (NOMBRE Y LOGO)
function aplicarCambiosVisuales() {
    // Actualiza el nombre en el Header
    const nombreHeader = document.getElementById('header-nombre-negocio');
    if (nombreHeader) nombreHeader.textContent = settings.negocio.nombre || 'BodegaPOS';

    // Actualiza también el nombre en la pantalla de login
    const loginNombre = document.getElementById('loginNombreNegocio');
    if (loginNombre) loginNombre.textContent = settings.negocio.nombre || 'BodegaPOS';

    // Actualiza el subtítulo (dirección o tel si existen)
    const subtitulo = document.getElementById('header-subtitulo-negocio');
    if (subtitulo) {
        if (settings.negocio.dir) subtitulo.textContent = settings.negocio.dir;
        else if (settings.negocio.tel) subtitulo.textContent = settings.negocio.tel;
        else subtitulo.textContent = 'v2.0 Pro';
    }

    // Actualiza el logo en el Header
    const logoContainer = document.getElementById('header-logo-container');
    if (logoContainer) {
        if (settings.negocio.logo) {
            logoContainer.innerHTML = `<img src="${settings.negocio.logo}" style="width:100%; height:100%; object-fit:cover; border-radius:9px;">`;
            logoContainer.style.background = 'transparent';
            logoContainer.style.padding = '0';
        } else {
            logoContainer.innerHTML = '🏪';
            logoContainer.style.background = 'linear-gradient(135deg, var(--accent), #d97706)';
            logoContainer.style.padding = '';
        }
    }

    // Actualiza también el logo en la pantalla de login
    const loginLogo = document.getElementById('loginLogoIcon');
    if (loginLogo) {
        if (settings.negocio.logo) {
            loginLogo.innerHTML = `<img src="${settings.negocio.logo}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`;
            loginLogo.style.background = 'transparent';
            loginLogo.style.padding = '0';
            loginLogo.style.overflow = 'hidden';
        } else {
            loginLogo.innerHTML = '🏪';
            loginLogo.style.background = '';
            loginLogo.style.padding = '';
        }
    }

    // Aplicar Color de Acento
    const color = settings.apariencia.colorAcento;
    const root = document.documentElement;
    root.style.setProperty('--accent', color);

    // Derivar --accent2 como versión más fría/oscura del acento (para íconos, badges, links secundarios)
    // Usamos el mismo color con menos saturación para que combine sin ser idéntico
    root.style.setProperty('--accent2', color);

    // Derivar --accent-rgb para usar en rgba() dentro de CSS
    const hex = color.replace('#','');
    const r = parseInt(hex.substring(0,2),16);
    const g = parseInt(hex.substring(2,4),16);
    const b = parseInt(hex.substring(4,6),16);
    root.style.setProperty('--accent-rgb', `${r},${g},${b}`);

    // Actualizar todos los elementos inline que usan rgba(59,130,246,...) hardcodeado — los de badge-blue ya usan var(--accent)
    // Actualizar iconos de modales que usan color:var(--accent2) inline (ya apuntan a --accent2 = --accent)

    // Actualizar nav-item activo: el marcador lateral y fondo
    document.querySelectorAll('.nav-item.active').forEach(el => {
        el.style.background = `rgba(${r},${g},${b},0.12)`;
        el.style.color = color;
    });
    document.querySelectorAll('.nav-item.active::before').forEach(el => {
        el.style.background = color;
    });

    // Actualizar config-nav-item activo
    document.querySelectorAll('.config-nav-item.active').forEach(el => {
        el.style.color = color;
    });

    // Aplicar Modo Oscuro
    aplicarModoOscuro(settings.apariencia.darkMode);
}

// 2. INICIALIZAR AJUSTES AL CARGAR LA PÁGINA
function inicializarAjustes() {
    // Aplicar cambios visuales SIEMPRE (header nombre + logo + color)
    aplicarCambiosVisuales();
    aplicarFunciones();
    
    // Recordar cuál es el logo ya guardado (para poder borrarlo de Storage si se reemplaza)
    _cfgLogoAnterior = settings.negocio.logo || '';

    // Cargar previsualización del logo en el panel de configuración (si existe)
    if(settings.negocio.logo) {
        const preview = document.getElementById('preview-logo');
        if(preview) preview.innerHTML = `<img src="${settings.negocio.logo}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    // Llenar campos — con guard para que no falle si el panel no está montado
    const safe = (id, val) => { const el = document.getElementById(id); if(el) { if(el.type === 'checkbox') el.checked = !!val; else el.value = val ?? ''; } };

    safe('cfg-nombre-negocio', settings.negocio.nombre);
    safe('cfg-tel-negocio', settings.negocio.tel);
    safe('cfg-email-negocio', settings.negocio.email);
    safe('cfg-dir-negocio', settings.negocio.dir);
    safe('cfg-dark-mode', settings.apariencia.darkMode);
    safe('cfg-color-acento', settings.apariencia.colorAcento);
    safe('cfg-alerta-stock', settings.alertas.stock);
    safe('cfg-min-stock', settings.alertas.minStock);
    safe('cfg-alerta-deuda', settings.alertas.deuda);
    safe('cfg-monto-deuda', settings.alertas.montoDeuda);
    safe('cfg-moneda', settings.sistema.moneda);
    safe('cfg-margen-auto', settings.sistema.margenAuto);
    safe('cfg-margen-pct', settings.sistema.margenPct);
    document.getElementById('cfg-margen-pct-wrap') && (document.getElementById('cfg-margen-pct-wrap').style.opacity = settings.sistema.margenAuto ? '1' : '.45');
    safe('cfg-mostrar-mensajes', settings.sistema.mensajes);
    safe('cfg-confirm-del', settings.sistema.confirmDel);
    safe('cfg-pago-yape', settings.pagos.yape);
    safe('cfg-pago-tarjeta', settings.pagos.tarjeta);
    safe('cfg-pago-mixto', settings.pagos.mixto);
    safe('cfg-funcion-fiar', settings.funciones.fiar);
    if (typeof aplicarFormasPago === 'function') aplicarFormasPago();

    // Actualizar preview del nombre si está visible
    const prevNombre = document.getElementById('cfg-preview-nombre-text');
    if(prevNombre) prevNombre.textContent = settings.negocio.nombre || 'BodegaPOS';
}

// 3. GUARDAR CONFIGURACIÓN
let _cfgPanelActivo = 'cfg-negocio';

// Cada botón guardar llama a su propia función específica — sin depender de _cfgPanelActivo
// Re-renderiza la página actualmente visible para reflejar cambios de config
function refrescarPaginaActiva() {
    const lastPage = localStorage.getItem('bodega_last_page') || 'dashboard';
    try {
        if (lastPage === 'dashboard') renderDashboard && renderDashboard();
        else if (lastPage === 'productos') { renderProdTable && renderProdTable(); renderProdGrid && renderProdGrid(); }
        else if (lastPage === 'ventas') renderPOSProducts && renderPOSProducts();
        else if (lastPage === 'clientes') renderClientes && renderClientes();
        else if (lastPage === 'compras') renderCompras && renderCompras();
        else if (lastPage === 'vendedores') renderVendedores && renderVendedores();
        else if (lastPage === 'reportes') renderReportes && renderReportes();
    } catch(e) { /* silencioso */ }
}

async function guardarNegocio() {
    const v = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    settings.negocio.nombre = v('cfg-nombre-negocio') || 'BodegaPOS';
    settings.negocio.tel    = v('cfg-tel-negocio');
    settings.negocio.email  = v('cfg-email-negocio');
    settings.negocio.dir    = v('cfg-dir-negocio');
    // Logo nuevo: se sube a Storage y se guarda solo el link (si no hay nube, se queda local como antes)
    if (settings.negocio.logo && settings.negocio.logo.startsWith('data:')) {
        const logoAnterior = _cfgLogoAnterior || '';
        settings.negocio.logo = await sbSubirImagen(settings.negocio.logo, 'negocio');
        if (logoAnterior && logoAnterior !== settings.negocio.logo) sbBorrarImagenAnterior(logoAnterior);
    }
    _cfgLogoAnterior = settings.negocio.logo || '';
    localStorage.setItem('bodega_settings', JSON.stringify(settings));
    if (typeof sbSyncDebounced === 'function') sbSyncDebounced();
    aplicarCambiosVisuales();
    refrescarPaginaActiva();
    showToast('Negocio guardado ✓', 'success');
}

function aplicarColorPreview(color) {
    // Solo aplica visualmente — NO guarda en settings ni localStorage
    const input = document.getElementById('cfg-color-acento');
    if (input) input.value = color;
    const root = document.documentElement;
    root.style.setProperty('--accent', color);
    root.style.setProperty('--accent2', color);
    // Actualizar presets highlight
    document.querySelectorAll('#colorPresets > div').forEach(d => {
        const match = d.getAttribute('onclick')?.match(/'(#[^']+)'/);
        d.style.outline = (match && match[1] === color) ? '2px solid white' : 'none';
    });
}

function aplicarColorPreset(color) {
    aplicarColorPreview(color);
}

function guardarApariencia() {
    const chk = document.getElementById('cfg-dark-mode');
    const col = document.getElementById('cfg-color-acento');
    if (chk) settings.apariencia.darkMode    = chk.checked;
    if (col) settings.apariencia.colorAcento = col.value;
    localStorage.setItem('bodega_settings', JSON.stringify(settings));
    if (typeof sbSyncDebounced === 'function') sbSyncDebounced();
    aplicarCambiosVisuales();
    aplicarModoOscuro(settings.apariencia.darkMode);
    refrescarPaginaActiva();
    showToast('Apariencia guardada ✓', 'success');
}

function guardarAlertas() {
    const chk = id => { const e = document.getElementById(id); return e ? e.checked : false; };
    const num = (id, def) => { const e = document.getElementById(id); const v = parseFloat(e ? e.value : ''); return isNaN(v) || v <= 0 ? def : v; };
    settings.alertas.stock      = chk('cfg-alerta-stock');
    settings.alertas.minStock   = num('cfg-min-stock', 3);
    settings.alertas.deuda      = chk('cfg-alerta-deuda');
    settings.alertas.montoDeuda = num('cfg-monto-deuda', 100);
    localStorage.setItem('bodega_settings', JSON.stringify(settings));
    if (typeof sbSyncDebounced === 'function') sbSyncDebounced();
    actualizarStatusAlertas();
    actualizarNotificaciones();
    renderProdTable();
    renderProdGrid();
    updateStockBajoCount();
    actualizarDeudaAltaCount();
    actualizarDashboardReal();
    showToast('Alertas guardadas ✓', 'success');
}

function guardarSistema() {
    const chk = id => { const e = document.getElementById(id); return e ? e.checked : false; };
    const val = id => { const e = document.getElementById(id); return e ? e.value : ''; };
    settings.sistema.moneda     = val('cfg-moneda');
    settings.sistema.margenAuto = chk('cfg-margen-auto');
    settings.sistema.margenPct  = (()=>{ const v=parseFloat(val('cfg-margen-pct')); return (isNaN(v)||v<0) ? 20 : v; })();
    settings.sistema.mensajes   = chk('cfg-mostrar-mensajes');
    settings.sistema.confirmDel = chk('cfg-confirm-del');
    localStorage.setItem('bodega_settings', JSON.stringify(settings));
    if (typeof sbSyncDebounced === 'function') sbSyncDebounced();
    aplicarCambiosVisuales();
    aplicarMonedaEnDOM();
    refrescarPaginaActiva();
    showToast('Sistema guardado ✓', 'success');
}

// Compatibilidad: guardarConfigGeneral redirige a la función correcta según panel activo
function guardarConfigGeneral() {
    if (_cfgPanelActivo === 'cfg-negocio')    return guardarNegocio();
    if (_cfgPanelActivo === 'cfg-apariencia') return guardarApariencia();
    if (_cfgPanelActivo === 'cfg-notif')      return guardarAlertas();
    if (_cfgPanelActivo === 'cfg-sistema')    return guardarSistema();
    if (_cfgPanelActivo === 'cfg-pagos')      return guardarPagos();
    if (_cfgPanelActivo === 'cfg-ticket')     return guardarTicket();
    // fallback: guardar todo
    guardarNegocio(); guardarApariencia(); guardarAlertas(); guardarSistema(); guardarPagos(); guardarTicket();
}

// 4. FUNCIONES DE APOYO (Imagen, Modo Oscuro, etc)
function leerImagenLogo(input) {
    if (input.files && input.files[0]) {
        // Se reduce y comprime igual que las demás fotos; se sube a Storage recién al presionar "Guardar" en Negocio
        comprimirImagenArchivo(input.files[0], 500, 0.8).then(dataUrl => {
            settings.negocio.logo = dataUrl;
            document.getElementById('preview-logo').innerHTML = `<img src="${dataUrl}" style="width:100%; height:100%; object-fit:contain;">`;
        });
    }
}

function aplicarModoOscuro(isDark) {
    const root = document.documentElement;
    const loginScreen = document.getElementById('loginScreen');
    const setupScreen = document.getElementById('setupScreen');
    const splashScreen = document.getElementById('splashScreen');
    if (isDark) {
        // Modo OSCURO (toggle encendido)
        root.style.setProperty('--bg',       '#0a0e1a');
        root.style.setProperty('--surface',  '#111827');
        root.style.setProperty('--surface2', '#1a2235');
        root.style.setProperty('--surface3', '#1f2d42');
        root.style.setProperty('--border',   '#2a3a52');
        root.style.setProperty('--text',     '#e2e8f0');
        root.style.setProperty('--text2',    '#94a3b8');
        root.style.setProperty('--text3',    '#64748b');
        if (loginScreen) loginScreen.style.background = 'linear-gradient(135deg, #0a0e1a 0%, #111827 50%, #1a1a2e 100%)';
        if (setupScreen) setupScreen.style.background = 'linear-gradient(135deg, #0a0e1a 0%, #111827 50%, #1a1a2e 100%)';
        if (splashScreen) splashScreen.style.background = 'linear-gradient(135deg, #0a0e1a 0%, #111827 50%, #1a1a2e 100%)';
    } else {
        // Modo CLARO (toggle apagado)
        root.style.setProperty('--bg',       '#f0f2f5');
        root.style.setProperty('--surface',  '#ffffff');
        root.style.setProperty('--surface2', '#f1f5f9');
        root.style.setProperty('--surface3', '#e2e8f0');
        root.style.setProperty('--border',   '#d1d5db');
        root.style.setProperty('--text',     '#1f2937');
        root.style.setProperty('--text2',    '#4b5563');
        root.style.setProperty('--text3',    '#9ca3af');
        if (loginScreen) loginScreen.style.background = 'linear-gradient(135deg, #f0f4ff 0%, #fafafa 50%, #fff7ed 100%)';
        if (setupScreen) setupScreen.style.background = 'linear-gradient(135deg, #f0f4ff 0%, #fafafa 50%, #fff7ed 100%)';
        if (splashScreen) splashScreen.style.background = 'linear-gradient(135deg, #f0f4ff 0%, #fafafa 50%, #fff7ed 100%)';
    }
}

function cambiarColorTema(color) {
    settings.apariencia.colorAcento = color;
    aplicarCambiosVisuales();
}

function restaurarConfigDefecto() {
    if(confirm("¿Restaurar valores de fábrica?")) {
        localStorage.removeItem('bodega_settings');
        location.reload();
    }
}

// 5. SOBRESCRIBIR TOAST (Solo si los mensajes están activos)
window.showToast = function(msg, type) {
    if (settings.sistema.mensajes) {
        const toast = document.createElement('div');
        toast.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;font-weight:600;animation:fadeIn 0.3s ease;box-shadow:0 8px 24px rgba(0,0,0,0.4);display:flex;align-items:center;gap:8px;`;
        if(type==='success'){
            toast.style.background='rgba(16,185,129,0.15)';
            toast.style.border='1px solid rgba(16,185,129,0.4)';
            toast.style.color='#10b981';
            toast.innerHTML=`<i class="fa fa-check-circle"></i> ${msg}`;
        } else {
            toast.style.background='rgba(239,68,68,0.15)';
            toast.style.border='1px solid rgba(239,68,68,0.4)';
            toast.style.color='#ef4444';
            toast.innerHTML=`<i class="fa fa-circle-xmark"></i> ${msg}`;
        }
        document.body.appendChild(toast);
        setTimeout(()=>toast.remove(),3000);
    }
};

// EJECUTAR AL CARGAR
window.addEventListener('DOMContentLoaded', () => {
    inicializarAjustes();
    // Aplicar moneda guardada en todo el DOM tras renderizar
    setTimeout(aplicarMonedaEnDOM, 100);
});

// =============================================
// FUNCIONES ADICIONALES DE CONFIGURACIÓN
// =============================================

// --- NEGOCIO ---
function cfgPreviewNombre(val) {
    const el = document.getElementById('cfg-preview-nombre-text');
    if (el) el.textContent = val || settings.negocio.nombre || 'BodegaPOS';
}

function eliminarLogoNegocio() {
    if (!confirm('¿Quitar el logo del negocio y usar el ícono por defecto?')) return;
    const logoAnterior = settings.negocio.logo;
    settings.negocio.logo = '';
    _cfgLogoAnterior = '';
    if (logoAnterior) sbBorrarImagenAnterior(logoAnterior);
    const preview = document.getElementById('preview-logo');
    if (preview) preview.innerHTML = '<i class="fa fa-image" style="font-size:24px;color:var(--text3);"></i>';
    localStorage.setItem('bodega_settings', JSON.stringify(settings));
    if (typeof sbSyncDebounced === 'function') sbSyncDebounced();
    aplicarCambiosVisuales();
    showToast('Logo eliminado', 'success');
}

// --- APARIENCIA ---
function aplicarColorPreset(color) {
    const input = document.getElementById('cfg-color-acento');
    if(input) input.value = color;
    settings.apariencia.colorAcento = color;
    aplicarCambiosVisuales();
    // Reaplicar color al nav activo después del cambio
    const lastPage = localStorage.getItem('bodega_last_page') || 'dashboard';
    showPage(lastPage);
    document.querySelectorAll('#colorPresets > div').forEach(d => {
        d.style.outline = d.getAttribute('onclick')?.includes(color) ? `2px solid white` : 'none';
    });
    showToast('Color de acento actualizado', 'success');
}

function resetearApariencia() {
    if (!confirm('¿Restablecer colores y modo al valor predeterminado?')) return;
    aplicarColorPreview('#f59e0b');
    const chk = document.getElementById('cfg-dark-mode');
    if (chk) chk.checked = false;
    aplicarModoOscuro(false);
    showToast('Vista previa restablecida — presiona Guardar para confirmar', 'success');
}

// --- SEGURIDAD ---
function exportarBackup() {
    try {
        const backup = {
            version: 'BodegaPOS-v1',
            fecha: new Date().toISOString(),
            datos: {
                productos, clientes, proveedores, vendedores, categorias,
                ordenesCompra, listaCompras,
                ventas: ventasHistorial
            },
            settings: settings
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const d = new Date();
        a.download = `backup-bodegapos-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        const info = document.getElementById('cfgBackupInfo');
        if(info) { info.style.display='block'; info.innerHTML=`<i class="fa fa-check-circle"></i> Backup descargado: ${a.download}`; setTimeout(()=>info.style.display='none',5000); }
        showToast('Backup exportado correctamente', 'success');
    } catch(e) {
        showToast('Error al exportar backup', 'error');
    }
}

function importarBackup(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.datos) throw new Error('Archivo inválido');
            if (!confirm(`¿Restaurar datos del backup ${data.fecha ? new Date(data.fecha).toLocaleDateString('es-PE') : ''}?\n\nSe importarán todos los datos. El administrador del backup será reemplazado por el administrador actual.`)) return;
            
            // Guardar el admin actual COMPLETO (nombre, usuario, contraseña, etc.)
            const adminActual = vendedores.find(v => v.esAdmin);

            if (data.datos.productos) { productos.length=0; data.datos.productos.forEach(p=>productos.push(p)); }
            if (data.datos.clientes) { clientes.length=0; data.datos.clientes.forEach(c=>clientes.push(c)); }
            if (data.datos.proveedores) { proveedores.length=0; data.datos.proveedores.forEach(p=>proveedores.push(p)); }
            ordenesCompra = data.datos.ordenesCompra || [];
            listaCompras = data.datos.listaCompras || [];
            if (data.datos.vendedores) {
                vendedores.length = 0;
                // Cargar vendedores del backup EXCEPTO cualquier esAdmin
                data.datos.vendedores
                    .filter(v => !v.esAdmin)
                    .forEach(v => vendedores.push(v));
                // Poner el admin actual al principio (siempre se conserva tal cual)
                if (adminActual) vendedores.unshift(adminActual);
            }
            if (data.datos.ventas) {
                ventasHistorial.length = 0;
                // Si hay admin anterior y admin actual, renombrar en historial
                const adminBackup = (data.datos.vendedores || []).find(v => v.esAdmin);
                const nombreAdminBackup = adminBackup ? (adminBackup.nombre + (adminBackup.apellido ? ' ' + adminBackup.apellido : '')).trim() : null;
                const nombreAdminActual = adminActual ? (adminActual.nombre + (adminActual.apellido ? ' ' + adminActual.apellido : '')).trim() : null;
                data.datos.ventas.forEach(v => {
                    // Renombrar vendedor en ventas si coincide con el admin del backup
                    if (nombreAdminBackup && nombreAdminActual && (v.vendedor === nombreAdminBackup || v.vendedor === 'Admin')) {
                        v.vendedor = nombreAdminActual;
                    }
                    ventasHistorial.push(v);
                });
                // También renombrar en pagos de clientes
                if (nombreAdminBackup && nombreAdminActual) {
                    (data.datos.clientes || []).forEach(c => {
                        (c.pagos || []).forEach(p => {
                            if (p.vendedor === nombreAdminBackup || p.vendedor === 'Admin') {
                                p.vendedor = nombreAdminActual;
                            }
                        });
                    });
                }
            }
            if (data.datos.categorias) { categorias.length=0; data.datos.categorias.forEach(c=>categorias.push(c)); }
            if (data.settings) { Object.assign(settings, data.settings); }
            
            guardarTodoEnLocalStorage();
            localStorage.setItem('bodega_settings', JSON.stringify(settings));
            if (typeof sbResincronizarHistorialCompleto === 'function') sbResincronizarHistorialCompleto(); // restaurar backup reemplaza todo, incluida la nube
            
            const info = document.getElementById('cfgBackupInfo');
            if(info) { info.style.display='block'; info.innerHTML=`<i class="fa fa-check-circle"></i> Datos restaurados correctamente. El Administrador actual se conservó.`; setTimeout(()=>info.style.display='none',6000); }
            showToast('Backup restaurado — Administrador conservado ✓', 'success');
            
            setTimeout(() => {
                aplicarCambiosVisuales();
                inicializarAjustes();
                renderProdTable();
                renderProdGrid();
                renderPOSProducts();
                renderClients();
                renderCategorias();
                renderCompras();
                renderVendedores();
                actualizarSelectsCategorias();
                actualizarDashboardReal();
                updateStockBajoCount();
                actualizarNotificaciones();
                renderSalesChart();
            }, 300);
        } catch(err) {
            showToast('Archivo de backup inválido o corrupto', 'error');
        }
    };
    reader.readAsText(file);
    input.value = '';
}

function reiniciarSistemaCompleto() {
    const confirm1 = confirm('⚠️ ATENCIÓN: Esta acción eliminará TODOS los datos del sistema.\n\nProductos, clientes, ventas, proveedores... todo será borrado permanentemente.\n\n¿Estás seguro?');
    if (!confirm1) return;
    const confirmText = prompt('Para confirmar, escribe exactamente: BORRAR TODO');
    if (confirmText !== 'BORRAR TODO') { showToast('Operación cancelada', 'error'); return; }
    
    localStorage.clear();
    showToast('Sistema reiniciado. Recargando...', 'success');
    setTimeout(() => location.reload(), 1500);
}

function cfgCheckPassStrength(val) {
    const bar = document.getElementById('cfg-pass-strength-bar');
    if (!bar) return;
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const widths = ['0%','20%','40%','60%','80%','100%'];
    const colors = ['transparent','#ef4444','#f97316','#f59e0b','#10b981','#3b82f6'];
    bar.style.width = widths[score];
    bar.style.background = colors[score];
}

function cambiarContrasena() {
    const actual = document.getElementById('cfg-pass-actual').value;
    const nueva = document.getElementById('cfg-pass-nueva').value;
    const confirmar = document.getElementById('cfg-pass-confirm').value;
    
    // Verificar contra el usuario actual
    const usuarioActivo = usuarios.find(u => u.user === (currentUser?.user));
    if (!usuarioActivo || usuarioActivo.pass !== actual) {
        showToast('La contraseña actual es incorrecta', 'error');
        return;
    }
    if (nueva.length < 6) {
        showToast('La nueva contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    if (nueva !== confirmar) {
        showToast('Las contraseñas nuevas no coinciden', 'error');
        return;
    }
    
    usuarioActivo.pass = nueva;
    document.getElementById('cfg-pass-actual').value = '';
    document.getElementById('cfg-pass-nueva').value = '';
    document.getElementById('cfg-pass-confirm').value = '';
    document.getElementById('cfg-pass-strength-bar').style.width = '0%';
    showToast('Contraseña cambiada correctamente', 'success');
}

// --- ALERTAS ---
function toggleAlertaStock(checked) {
    const wrap = document.getElementById('cfg-stock-min-wrap');
    if (wrap) wrap.style.opacity = checked ? '1' : '0.4';
    settings.alertas.stock = checked;
    localStorage.setItem('bodega_settings', JSON.stringify(settings));
    actualizarStatusAlertas();
    updateStockBajoCount();
    actualizarNotificaciones();
    actualizarDashboardReal();
}

// Activa/desactiva el cálculo automático del precio de venta según el margen de ganancia por defecto.
// Solo afecta el valor que se PRE-LLENA al crear/editar un producto; cambiarlo en un producto puntual
// no modifica este ajuste general.
function toggleMargenAuto(checked) {
    const wrap = document.getElementById('cfg-margen-pct-wrap');
    if (wrap) wrap.style.opacity = checked ? '1' : '.45';
    settings.sistema.margenAuto = checked;
    localStorage.setItem('bodega_settings', JSON.stringify(settings));
    if (typeof sbSyncDebounced === 'function') sbSyncDebounced();
}

// --- FUNCIONES DEL SISTEMA (Preferencias > qué le muestra el sistema al usuario) ---
// Cada función opcional oculta/muestra sus propios elementos en el menú, dashboard y demás pantallas.
function aplicarFunciones() {
    const on = settings.funciones.fiar;

    // Menú lateral: "Clientes"
    const navCli = document.getElementById('navClientes');
    if (navCli) navCli.style.display = on ? '' : 'none';

    // Dashboard: tarjeta "Deuda Alta"
    const cardDeuda = document.getElementById('dashCardDeudaAlta');
    if (cardDeuda) cardDeuda.style.display = on ? '' : 'none';

    // Punto de venta: buscador de cliente + badge del cliente seleccionado
    const posCli = document.getElementById('posClienteBuscarWrap');
    if (posCli) posCli.style.display = on ? '' : 'none';

    // Si estaban en la página de Clientes y se apagó la función, saca al usuario de ahí
    if (!on && document.getElementById('page-clientes')?.classList.contains('active') && typeof showPage === 'function') {
        showPage('dashboard');
    }
}

// Handler del checkbox "Fiar a clientes" en Preferencias > Sistema
function toggleFuncionFiar(checked) {
    settings.funciones.fiar = checked;
    localStorage.setItem('bodega_settings', JSON.stringify(settings));
    if (typeof sbSyncDebounced === 'function') sbSyncDebounced();
    aplicarFunciones();
    if (typeof clearClientSel === 'function') clearClientSel(); // por si había un cliente elegido en el POS
}

function toggleAlertaDeuda(checked) {
    const wrap = document.getElementById('cfg-deuda-wrap');
    if (wrap) wrap.style.opacity = checked ? '1' : '0.4';
    settings.alertas.deuda = checked;
    localStorage.setItem('bodega_settings', JSON.stringify(settings));
    actualizarStatusAlertas();
    actualizarDeudaAltaCount();
    actualizarNotificaciones();
    actualizarDashboardReal();
}

function actualizarPreviewAlertaStock(val) {
    const el = document.getElementById('cfg-stock-preview-msg');
    const num = parseInt(val) || 0;
    if (!el) return;
    if (num > 0) {
        const afectados = productos.filter(p => p.stock <= num).length;
        el.textContent = afectados > 0
            ? `⚠️ Con esta configuración, ${afectados} producto(s) recibirían alerta actualmente.`
            : `✓ Ningún producto activo recibirá alerta con este umbral.`;
    } else {
        el.textContent = '';
    }
}

function actualizarPreviewAlertaDeuda(val) {
    const el = document.getElementById('cfg-deuda-preview');
    const num = parseFloat(val) || 0;
    if (!el) return;
    if (num > 0) {
        const afectados = clientes.filter(c => c.deuda > num).length;
        el.textContent = afectados > 0
            ? `⚠️ ${afectados} cliente(s) superan este límite`
            : `✓ Ningún cliente supera este límite`;
    } else {
        el.textContent = '';
    }
}

function actualizarStatusAlertas() {
    const el = document.getElementById('cfg-alertas-status');
    if (!el) return;
    const stockActivos = productos.filter(p => p.stock <= (settings.alertas.minStock || 3)).length;
    const deudaActivos = clientes.filter(c => c.deuda > (parseFloat(settings.alertas.montoDeuda) || 100)).length;
    el.innerHTML = `
        <div>🔔 Alerta de stock: <strong>${settings.alertas.stock ? 'Activada' : 'Desactivada'}</strong> — umbral: <strong>≤ ${settings.alertas.minStock} unidades</strong> — ${stockActivos} producto(s) afectados actualmente</div>
        <div>💰 Alerta de deudas: <strong>${settings.alertas.deuda ? 'Activada' : 'Desactivada'}</strong> — límite: <strong>${moneda()} ${settings.alertas.montoDeuda}</strong> — ${deudaActivos} cliente(s) superan el límite</div>
    `;
}

function probarAlertas() {
    showToast('🔔 Esta es una notificación de prueba del sistema', 'success');
    setTimeout(() => showToast('⚠️ Ejemplo: Producto "Arroz" con stock bajo (2 uds.)', 'error'), 1000);
}

// --- SISTEMA ---
function actualizarPreviewMoneda(val) {
    const el = document.getElementById('cfg-moneda-preview');
    if (el) el.textContent = `Vista previa de precio: ${val} 25.50`;
    // Previsualizar en tiempo real sin guardar
    const tempSym = val || moneda();
    const cartTotalEl = document.getElementById('cartTotal');
    if (cartTotalEl) {
        const num = cartTotalEl.textContent.replace(/[^\d.]/g, '');
        if (num) cartTotalEl.textContent = `${tempSym} ${parseFloat(num).toFixed(2)}`;
    }
}

function cfgPreviewToast(checked) {
    // Mostrar toast de preview directamente sin respetar settings.sistema.mensajes
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;font-weight:600;animation:fadeIn 0.3s ease;box-shadow:0 8px 24px rgba(0,0,0,0.4);display:flex;align-items:center;gap:8px;`;
    if (checked) {
        toast.style.background='rgba(16,185,129,0.15)';
        toast.style.border='1px solid rgba(16,185,129,0.4)';
        toast.style.color='#10b981';
        toast.innerHTML=`<i class="fa fa-check-circle"></i> Los mensajes de aviso están activados ✓`;
    } else {
        toast.style.background='rgba(100,116,139,0.15)';
        toast.style.border='1px solid rgba(100,116,139,0.4)';
        toast.style.color='var(--text2)';
        toast.innerHTML=`<i class="fa fa-bell-slash"></i> Mensajes de aviso desactivados — este es el último toast`;
    }
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function actualizarInfoSistema() {
    const calcSize = () => {
        let total = 0;
        for (let k in localStorage) {
            if (localStorage.hasOwnProperty(k)) {
                total += ((localStorage[k].length + k.length) * 2);
            }
        }
        return total < 1024 ? total + ' B' : total < 1048576 ? (total/1024).toFixed(1) + ' KB' : (total/1048576).toFixed(2) + ' MB';
    };
    const si = document.getElementById('sysInfoProductos');
    const sc = document.getElementById('sysInfoClientes');
    const sv = document.getElementById('sysInfoVentas');
    const ss = document.getElementById('sysInfoStorage');
    if (si) si.textContent = productos.length;
    if (sc) sc.textContent = clientes.length;
    if (sv) sv.textContent = ventasHistorial.length + ' registros';
    if (ss) ss.textContent = calcSize();
}

// Sobrescribir showConfig para inicializar datos al entrar en cada panel
function showConfig(el, panelId) {
    // Si venimos del panel de apariencia sin haber guardado, restaurar estado guardado
    if (_cfgPanelActivo === 'cfg-apariencia' && panelId !== 'cfg-apariencia') {
        aplicarModoOscuro(settings.apariencia.darkMode);
        aplicarColorPreview(settings.apariencia.colorAcento || '#f59e0b');
        const chk = document.getElementById('cfg-dark-mode');
        if (chk) chk.checked = !!settings.apariencia.darkMode;
    }
    _cfgPanelActivo = panelId; // guardar panel activo
    document.querySelectorAll('.config-nav-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.config-panel').forEach(p => p.style.display = 'none');
    const panel = document.getElementById(panelId);
    if (panel) panel.style.display = 'block';
    
    // Acciones al entrar en cada panel
    if (panelId === 'cfg-negocio') {
        const nombre = document.getElementById('cfg-nombre-negocio');
        if (nombre) cfgPreviewNombre(nombre.value);
    }
    if (panelId === 'cfg-apariencia') {
        // Re-sincronizar toggle y color con el estado actual de settings
        const chk = document.getElementById('cfg-dark-mode');
        if (chk) chk.checked = !!settings.apariencia.darkMode;
        const col = document.getElementById('cfg-color-acento');
        if (col) col.value = settings.apariencia.colorAcento || '#f59e0b';
    }
    if (panelId === 'cfg-notif') {
        actualizarStatusAlertas();
        const stock = document.getElementById('cfg-alerta-stock');
        const deuda = document.getElementById('cfg-alerta-deuda');
        if (stock) toggleAlertaStock(stock.checked);
        if (deuda) toggleAlertaDeuda(deuda.checked);
        const minStock = document.getElementById('cfg-min-stock');
        const montoDeuda = document.getElementById('cfg-monto-deuda');
        if (minStock) actualizarPreviewAlertaStock(minStock.value);
        if (montoDeuda) actualizarPreviewAlertaDeuda(montoDeuda.value);
    }
    if (panelId === 'cfg-ticket') { tkCfgCargar(); if (typeof cargarImpresoraPanel === 'function') cargarImpresoraPanel(); }
    if (panelId === 'cfg-pagos') {
        // Volver a mostrar lo guardado (descarta cambios sin guardar de una apertura anterior)
        ['yape','tarjeta','mixto'].forEach(m => {
            const c = document.getElementById('cfg-pago-' + m);
            if (c) c.checked = !!settings.pagos[m];
        });
        cfgPagosActualizar();
    }
    if (panelId === 'cfg-sistema') {
        actualizarInfoSistema();
        const moneda = document.getElementById('cfg-moneda');
        if (moneda) actualizarPreviewMoneda(moneda.value);
    }
}



// ========================================
// INICIO DE CONFIGURACIÓN (accesos por categoría)
// ========================================
const _CFG_TITULOS = {
  'cfg-negocio':   { t: 'Datos del Negocio', i: 'fa-store',    c: '#f59e0b' },
  'cfg-apariencia':{ t: 'Apariencia',        i: 'fa-palette',  c: '#8b5cf6' },
  'cfg-sistema':   { t: 'Preferencias',      i: 'fa-sliders',  c: '#06b6d4' },
  'cfg-pagos':     { t: 'Formas de Pago',    i: 'fa-credit-card', c: '#10b981' },
  'cfg-ticket':    { t: 'Ticket de Venta',   i: 'fa-receipt',  c: '#ec4899' },
  'cfg-notif':     { t: 'Alertas',           i: 'fa-bell',     c: '#f97316' },
  'cfg-backup':    { t: 'Respaldo y Datos',  i: 'fa-database', c: '#64748b' },
  'cfg-supabase':  { t: 'Nube',              i: 'fa-cloud',    c: '#0ea5e9' }
};

// Abre una opción en una ventana (reutiliza showConfig, que prepara los datos de cada panel)
function abrirConfig(el, panelId, extra) {
  showConfig(el, panelId);
  const m = _CFG_TITULOS[panelId] || { t: 'Configuración', i: 'fa-gear', c: 'var(--accent)' };
  document.getElementById('cfgModalTitulo').innerHTML =
    `<i class="fa ${m.i}" style="color:${m.c};margin-right:8px;"></i>${m.t}`;
  openModal('modalConfig');
  document.querySelector('#modalConfig .modal').scrollTop = 0;
  if (panelId === 'cfg-ticket' && typeof tkAjustarPreview === 'function') tkAjustarPreview(); // ya visible: se ajusta al alto de la pantalla
  if (typeof extra === 'function') extra();
}

// Se ejecuta al cerrar la ventana (por la X, clic afuera o al cambiar de página)
function cfgAlCerrar() {
  // Si salió de Apariencia sin guardar, restaurar el estado guardado
  if (_cfgPanelActivo === 'cfg-apariencia') {
    aplicarModoOscuro(settings.apariencia.darkMode);
    aplicarColorPreview(settings.apariencia.colorAcento || '#f59e0b');
    const chk = document.getElementById('cfg-dark-mode');
    if (chk) chk.checked = !!settings.apariencia.darkMode;
  }
  _cfgPanelActivo = 'cfg-negocio';
}

// Cierra la ventana si está abierta (usado al navegar)
function cfgVolver() {
  const m = document.getElementById('modalConfig');
  if (m) m.classList.remove('show'); // el observador de abajo llama a cfgAlCerrar
  cfgAlCerrar();
}

// Detecta cualquier forma de cierre de la ventana
(function () {
  const m = document.getElementById('modalConfig');
  if (!m) return;
  let abierto = false;
  new MutationObserver(() => {
    const ahora = m.classList.contains('show');
    if (abierto && !ahora) cfgAlCerrar();
    abierto = ahora;
  }).observe(m, { attributes: true, attributeFilter: ['class'] });
})();
