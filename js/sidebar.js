// ====== RESPONSIVE SIDEBAR TOGGLE ======
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const isMobile = window.innerWidth <= 1024;

  if (isMobile) {
    // Mobile: slide-over drawer con backdrop
    if (sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
    } else {
      sidebar.classList.add('open');
      backdrop.classList.add('show');
    }
  } else {
    // Desktop: colapsar/expandir inline (sin lag)
    requestAnimationFrame(() => {
      sidebar.classList.toggle('collapsed');
    });
  }
}
function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  sidebar.classList.remove('open');
  backdrop.classList.remove('show');
  // En desktop, mantener colapsado
  if (window.innerWidth > 1024) {
    sidebar.classList.add('collapsed');
  }
}
