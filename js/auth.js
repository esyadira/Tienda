// ========================================
// LOGIN
// ========================================
// Toast que se muestra SIEMPRE (independiente de settings.sistema.mensajes)
function _showToastSiempre(msg, type) {
  const toast = document.createElement('div');
  toast.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:100000;padding:12px 20px;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;font-weight:600;animation:fadeIn 0.3s ease;box-shadow:0 8px 24px rgba(0,0,0,0.4);display:flex;align-items:center;gap:8px;`;
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
  setTimeout(()=>toast.remove(), 3500);
}

function doLogin(){
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const found = getUsuarios().find(x=>x.user===u && x.pass===p);
  
  if(!found){
    document.getElementById('loginError').style.display='flex';
    return;
  }
  
  currentUser = found;
  localStorage.setItem('bodega_sesion_activa', JSON.stringify(found));
  document.getElementById('loginError').style.display='none';
  document.getElementById('loginScreen').style.display='none';

  showSplash(`¡Bienvenido, ${found.nombre}! 👋`, 500, () => {
   // Antes de mostrar el sistema, el cajero registra su efectivo inicial
   solicitarCajaInicial(found, () => {
    document.getElementById('app').classList.add('visible');
    document.getElementById('userName').textContent = found.nombre;
    document.getElementById('userRole').textContent = found.rol;
    showToast(`¡Bienvenido, ${found.nombre}! 👋`, 'success');
    _showToastSiempre(`¡Bienvenido, ${found.nombre}! 👋`, 'success');
    const avatarEl = document.getElementById('userAvatarHdr');
    if (found.foto) {
      avatarEl.innerHTML = `<img src="${found.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      avatarEl.style.padding = '0'; avatarEl.style.overflow = 'hidden';
    } else {
      avatarEl.textContent = found.avatar; avatarEl.style.padding = ''; avatarEl.style.overflow = '';
    }
    if (found.rol === 'Vendedor' && found.permisos) {
      const permMap = {
        'Dashboard': 'dashboard', 'Punto de Venta': 'ventas', 'Productos': 'productos',
        'Clientes': 'clientes', 'Proveedores': 'compras', 'Reportes': 'reportes',
        'Vendedores': 'vendedores', 'Configuración': 'configuracion'
      };
      document.querySelectorAll('.nav-item').forEach(item => {
        const onclick = item.getAttribute('onclick') || '';
        const match = onclick.match(/showPage\('([^']+)'\)/);
        if (match) {
          const page = match[1];
          const allowed = Object.entries(permMap).some(([perm, pg]) => pg === page && found.permisos.includes(perm));
          item.style.display = allowed ? '' : 'none';
        }
      });
    } else {
      document.querySelectorAll('.nav-item').forEach(item => item.style.display = '');
    }
    initApp();
    showPage('dashboard');
   });
  });
}

// ========================================
// SETUP INICIAL (Primera vez)
// ========================================
const SETUP_KEY = 'bodega_setup_completado';
const SETUP_PERMS_ALL = ['Dashboard','Punto de Venta','Productos','Clientes','Proveedores','Reportes','Vendedores','Configuración'];

function checkSetup() {
  const setupDone = localStorage.getItem(SETUP_KEY);
  if (!setupDone) {
    // Primera vez: mostrar setup
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('setupScreen').classList.add('visible');
    renderSetupPerms();
  }
  // Si ya fue configurado, el login normal se maneja por la sesión activa guardada
}

function renderSetupPerms() {
  const grid = document.getElementById('setupPermsGrid');
  if (!grid) return;
  const icons = {
    'Dashboard': 'fa-gauge-high', 'Punto de Venta': 'fa-cash-register',
    'Productos': 'fa-box', 'Clientes': 'fa-users',
    'Proveedores': 'fa-truck', 'Reportes': 'fa-chart-bar',
    'Vendedores': 'fa-id-badge', 'Configuración': 'fa-gear'
  };
  grid.innerHTML = SETUP_PERMS_ALL.map(p => `
    <label class="setup-perm-item locked">
      <input type="checkbox" id="setupPerm_${p.replace(/\s/g,'_')}" checked disabled>
      <i class="fa ${icons[p] || 'fa-circle'}" style="color:var(--accent);font-size:12px;"></i>
      <span>${p}</span>
    </label>`).join('');
}

function setupTogglePass(inputId, eyeId) {
  const inp = document.getElementById(inputId);
  const eye = document.getElementById(eyeId);
  if (!inp || !eye) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    eye.innerHTML = '<i class="fa fa-eye-slash"></i>';
  } else {
    inp.type = 'password';
    eye.innerHTML = '<i class="fa fa-eye"></i>';
  }
}

function setupCheckPass(val) {
  const bar = document.getElementById('setupPassBar');
  if (!bar) return;
  let score = 0;
  if (val.length >= 4) score++;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const widths = ['0%','20%','40%','70%','90%','100%'];
  const colors = ['transparent','#ef4444','#f97316','#f59e0b','#10b981','#3b82f6'];
  bar.style.width = widths[score];
  bar.style.background = colors[score];
}

function setupNext() {
  const nombre = document.getElementById('setupNombre').value.trim();
  const apellido = document.getElementById('setupApellido').value.trim();
  const usuario = document.getElementById('setupUsuario').value.trim();
  const pass = document.getElementById('setupPassword').value;
  const passConf = document.getElementById('setupPasswordConfirm').value;
  const errEl = document.getElementById('setupError1');

  if (!nombre) { errEl.textContent = 'El nombre es obligatorio.'; errEl.style.display = 'block'; return; }
  if (!usuario) { errEl.textContent = 'El nombre de usuario es obligatorio.'; errEl.style.display = 'block'; return; }
  if (!/^[a-zA-Z0-9_]+$/.test(usuario)) { errEl.textContent = 'El usuario solo puede tener letras, números y guión bajo.'; errEl.style.display = 'block'; return; }
  if (!pass || pass.length < 4) { errEl.textContent = 'La contraseña debe tener al menos 4 caracteres.'; errEl.style.display = 'block'; return; }
  if (pass !== passConf) { errEl.textContent = 'Las contraseñas no coinciden.'; errEl.style.display = 'block'; return; }

  errEl.style.display = 'none';
  document.getElementById('setupStep1').style.display = 'none';
  document.getElementById('setupStepNegocio').style.display = 'block';
  document.getElementById('setupDot1').classList.add('active');
  document.getElementById('setupDot2').classList.add('active');
}

// --- Paso 2: datos del negocio ---
let _setupLogo = ''; // logo elegido (data URL); vacío = ícono por defecto

function setupNegocioBack() {
  document.getElementById('setupStepNegocio').style.display = 'none';
  document.getElementById('setupStep1').style.display = 'block';
  document.getElementById('setupDot2').classList.remove('active');
}

function setupNegocioNext() {
  const nombre = document.getElementById('setupNegNombre').value.trim();
  const dir = document.getElementById('setupNegDir').value.trim();
  const email = document.getElementById('setupNegEmail').value.trim();
  const errEl = document.getElementById('setupErrorNeg');
  const fallo = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };

  if (!nombre) return fallo('El nombre del negocio es obligatorio.');
  if (!dir) return fallo('La dirección es obligatoria.');
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return fallo('El correo no parece válido.');

  errEl.style.display = 'none';
  document.getElementById('setupStepNegocio').style.display = 'none';
  document.getElementById('setupStep2').style.display = 'block';
  document.getElementById('setupDot3').classList.add('active');
}

function setupBack() {
  // Desde permisos vuelve a los datos del negocio
  document.getElementById('setupStep2').style.display = 'none';
  document.getElementById('setupStepNegocio').style.display = 'block';
  document.getElementById('setupDot3').classList.remove('active');
}

function setupRenderLogo() {
  const box = document.getElementById('setupLogoBox');
  const quitar = document.getElementById('setupLogoQuitar');
  if (_setupLogo) {
    box.innerHTML = `<img src="${_setupLogo}" style="width:100%;height:100%;object-fit:contain;">`;
    box.style.background = 'var(--surface2)';
    box.style.boxShadow = 'none';
    box.style.border = '1px solid var(--border)';
    quitar.style.display = '';
  } else {
    box.innerHTML = '🏪';
    box.style.background = 'linear-gradient(135deg,#f59e0b,#d97706)';
    box.style.boxShadow = '0 6px 18px rgba(245,158,11,0.3)';
    box.style.border = '';
    quitar.style.display = 'none';
  }
}

function setupLeerLogo(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const errEl = document.getElementById('setupErrorNeg');
  if (!file.type.startsWith('image/')) {
    errEl.textContent = 'El archivo debe ser una imagen.'; errEl.style.display = 'block';
    input.value = ''; return;
  }
  errEl.style.display = 'none';
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      // Se reduce a máx. 256 px para no llenar el almacenamiento local
      const r = Math.min(1, 256 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * r));
      c.height = Math.max(1, Math.round(img.height * r));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      _setupLogo = c.toDataURL('image/png');
      setupRenderLogo();
    };
    img.onerror = () => { errEl.textContent = 'No se pudo leer la imagen.'; errEl.style.display = 'block'; };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function setupQuitarLogo() {
  _setupLogo = '';
  document.getElementById('setupLogoInput').value = '';
  setupRenderLogo();
}

function setupFinish() {
  const nombre = document.getElementById('setupNombre').value.trim();
  const apellido = document.getElementById('setupApellido').value.trim() || '';
  const usuario = document.getElementById('setupUsuario').value.trim();
  const pass = document.getElementById('setupPassword').value;

  // Crear el vendedor administrador
  const adminVendedor = {
    id: Date.now(),
    nombre: nombre,
    apellido: apellido,
    usuario: usuario,
    password: pass,
    foto: '',
    telefono: '',
    permisos: [...SETUP_PERMS_ALL],
    estado: 'activo',
    esAdmin: true // marca especial para no permitir desactivar
  };

  // Agregar a la lista de vendedores y guardar
  vendedores.push(adminVendedor);
  guardarTodoEnLocalStorage();

  // Guardar los datos del negocio (logo vacío = ícono por defecto)
  settings.negocio.nombre = document.getElementById('setupNegNombre').value.trim() || 'BodegaPOS';
  settings.negocio.dir    = document.getElementById('setupNegDir').value.trim();
  settings.negocio.tel    = document.getElementById('setupNegTel').value.trim();
  settings.negocio.email  = document.getElementById('setupNegEmail').value.trim();
  settings.negocio.logo   = _setupLogo;
  localStorage.setItem('bodega_settings', JSON.stringify(settings));
  try { aplicarCambiosVisuales(); } catch (e) {}

  // Marcar setup como completado
  localStorage.setItem(SETUP_KEY, '1');

  // Animar y pasar al login
  const card = document.querySelector('.setup-card');
  card.style.transform = 'scale(0.95)';
  card.style.opacity = '0';
  card.style.transition = 'all 0.4s ease';

  setTimeout(() => {
    document.getElementById('setupScreen').classList.remove('visible');
    document.getElementById('loginScreen').style.display = 'flex';
    showToast('¡Administrador creado! Inicia sesión para continuar', 'success');
  }, 450);
}

function toggleLoginPass(){
  const inp=document.getElementById('loginPass');
  const icon=document.getElementById('togglePassIcon');
  if(inp.type==='password'){inp.type='text';icon.className='fa fa-eye-slash';}
  else{inp.type='password';icon.className='fa fa-eye';}
}
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.getElementById('loginScreen').style.display!=='none')doLogin();});

function showSplash(msg, duration, cb) {
  const s = document.getElementById('splashScreen');
  const m = document.getElementById('splashMsg');
  if (m) m.textContent = msg || 'Cargando...';
  s.classList.add('visible');
  setTimeout(() => { s.classList.remove('visible'); if (cb) cb(); }, duration || 900);
}

function doLogout(){
  const nombreUsuario = currentUser ? currentUser.nombre : '';
  localStorage.removeItem('bodega_sesion_activa');
  localStorage.removeItem('bodega_caja_activa');
  localStorage.removeItem('bodega_last_page');
  localStorage.removeItem('bodega_prod_view_mode');
  localStorage.removeItem('bodega_notif_leidas');
  _notifLeidas.clear();
  currentUser = null;
  document.getElementById('app').classList.remove('visible');
  showSplash('Sesión cerrada correctamente 👋', 500, () => {
    if (localStorage.getItem(SETUP_KEY)) {
      // Limpiar campos del login
      const loginUser = document.getElementById('loginUser');
      const loginPass = document.getElementById('loginPass');
      if (loginUser) loginUser.value = '';
      if (loginPass) loginPass.value = '';
      document.getElementById('loginError').style.display = 'none';
      document.getElementById('loginScreen').style.display = 'flex';
      aplicarModoOscuro(settings.apariencia.darkMode);
      setTimeout(() => _showToastSiempre('Sesión cerrada correctamente 👋', 'success'), 200);
    } else {
      document.getElementById('setupScreen').classList.add('visible');
      renderSetupPerms();
    }
  });
}

// Proteger al vendedor administrador (esAdmin) de ser eliminado o desactivado
const _origDelVend = typeof delVend === 'function' ? delVend : null;

