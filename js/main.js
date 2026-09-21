document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item, .logout-btn').forEach(el => {
    el.addEventListener('click', () => {
      if (window.innerWidth <= 1024) closeSidebar();
    });
  });

  // ===== INICIO: Setup o Sesión =====
  const sesionGuardada = localStorage.getItem('bodega_sesion_activa');
  const setupCompletado = localStorage.getItem(SETUP_KEY);

  if (!setupCompletado) {
    // Primera vez: mostrar pantalla de setup
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('setupScreen').classList.add('visible');
    renderSetupPerms();
  } else if (sesionGuardada) {
    // Sesión activa guardada: restaurar directamente
    try {
      const savedUser = JSON.parse(sesionGuardada);
      // Verificar que el usuario sigue siendo válido
      const stillValid = getUsuarios().find(u => u.user === savedUser.user && u.pass === savedUser.pass);
      if (stillValid) {
        currentUser = stillValid;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('app').classList.add('visible');
        document.getElementById('userName').textContent = stillValid.nombre;
        document.getElementById('userRole').textContent = stillValid.rol;
        const avatarEl = document.getElementById('userAvatarHdr');
        if (stillValid.foto) {
          avatarEl.innerHTML = `<img src="${stillValid.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
          avatarEl.style.padding = '0'; avatarEl.style.overflow = 'hidden';
        } else {
          avatarEl.textContent = stillValid.avatar;
        }
        if (stillValid.rol === 'Vendedor' && stillValid.permisos) {
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
              const allowed = Object.entries(permMap).some(([perm, pg]) => pg === page && stillValid.permisos.includes(perm));
              item.style.display = allowed ? '' : 'none';
            }
          });
        }
        initApp();
        sbInicializar(); // ☁️ Inicializar nube una sola vez al arrancar
        cajaVerificarSesion(stillValid); // pide el efectivo en caja si aún no se registró hoy
        const lastPage = localStorage.getItem('bodega_last_page');
        if (lastPage) setTimeout(() => showPage(lastPage), 100);
      } else {
        localStorage.removeItem('bodega_sesion_activa');
      }
    } catch(e) {
      localStorage.removeItem('bodega_sesion_activa');
    }
  }
  // Si no hay sesión ni setup pendiente, se queda en el loginScreen (visible por defecto)
});


