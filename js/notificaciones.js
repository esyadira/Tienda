// ========================================
// NOTIFICATIONS
// ========================================
function toggleNotif(){
  actualizarNotificaciones();
  document.getElementById('notifPanel').classList.toggle('show');
}

// IDs de notificaciones leídas — persisten en localStorage
let _notifLeidas = new Set(JSON.parse(localStorage.getItem('bodega_notif_leidas') || '[]'));

function _guardarNotifLeidas() {
  localStorage.setItem('bodega_notif_leidas', JSON.stringify([..._notifLeidas]));
}

function marcarTodasLeidas() {
  document.querySelectorAll('.notif-item[data-notif-id]').forEach(el => {
    _notifLeidas.add(el.getAttribute('data-notif-id'));
  });
  _guardarNotifLeidas();
  const badge = document.getElementById('notifCount');
  const headerCount = document.getElementById('notifHeaderCount');
  const btn = document.getElementById('notifMarkAllBtn');
  const lista = document.getElementById('notifList');
  if (badge) badge.style.display = 'none';
  if (headerCount) headerCount.textContent = '0 nuevas';
  if (btn) btn.style.display = 'none';
  if (lista) lista.innerHTML = `<div style="padding:20px;text-align:center;font-size:12px;color:var(--text3);">✓ Sin alertas pendientes</div>`;
}

function actualizarNotificaciones() {
  if (!settings.alertas) return;
  const umbralStock = settings.alertas.stock ? (settings.alertas.minStock || 3) : -1;
  const umbralDeuda = settings.alertas.deuda ? (parseFloat(settings.alertas.montoDeuda) || 100) : -1;

  let items = [];

  // Alertas de stock
  if (umbralStock >= 0) {
    productos.filter(p => p.stock <= umbralStock).forEach(p => {
      items.push({
        id: `stock-${p.id}`,
        tipo: p.stock <= 0 ? 'danger' : 'warn',
        icono: p.stock <= 0 ? 'fa-box-open' : 'fa-box',
        titulo: p.stock <= 0 ? `Agotado: ${p.nombre}` : `Stock bajo: ${p.nombre}`,
        desc: p.stock <= 0 ? 'Sin unidades disponibles' : `Quedan solo ${p.stock} unidad${p.stock !== 1 ? 'es' : ''}`,
        pagina: 'productos'
      });
    });
  }

  // Alertas de deuda
  if (umbralDeuda >= 0) {
    clientes.filter(c => c.deuda > umbralDeuda).forEach(c => {
      items.push({
        id: `deuda-${c.id}`,
        tipo: 'danger',
        icono: 'fa-user',
        titulo: `Deuda alta: ${c.nombre}`,
        desc: `Pendiente: ${moneda()} ${c.deuda.toFixed(2)}`,
        pagina: 'clientes'
      });
    });
  }

  const badge = document.getElementById('notifCount');
  const headerCount = document.getElementById('notifHeaderCount');
  const lista = document.getElementById('notifList');
  const btn = document.getElementById('notifMarkAllBtn');
  if (!badge || !lista) return;

  const noLeidas = items.filter(it => !_notifLeidas.has(it.id));
  const count = noLeidas.length;

  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
  if (headerCount) headerCount.textContent = `${count} nueva${count !== 1 ? 's' : ''}`;
  if (btn) btn.style.display = items.length > 0 ? 'inline-block' : 'none';

  lista.innerHTML = items.length === 0
    ? `<div style="padding:20px;text-align:center;font-size:12px;color:var(--text3);">✓ Sin alertas pendientes</div>`
    : items.filter(it => !_notifLeidas.has(it.id)).map(it => {
        return `
        <div class="notif-item" data-notif-id="${it.id}" data-pagina="${it.pagina}"
          style="cursor:pointer;transition:background 0.15s;"
          onclick="irDesdeNotif(this)"
          onmouseenter="this.style.background='var(--surface2)'"
          onmouseleave="this.style.background=''">
          <div class="notif-icon ${it.tipo}"><i class="fa ${it.icono}"></i></div>
          <div style="flex:1;">
            <strong>${it.titulo}</strong>
            <p>${it.desc}</p>
          </div>
          <i class="fa fa-xmark" onclick="eliminarNotif('${it.id}',event)" style="font-size:12px;color:var(--text3);align-self:center;margin-left:6px;padding:4px;border-radius:4px;" onmouseenter="this.style.color='var(--danger)'" onmouseleave="this.style.color='var(--text3)'"></i>
        </div>`;
      }).join('') || `<div style="padding:20px;text-align:center;font-size:12px;color:var(--text3);">✓ Sin alertas pendientes</div>`;
}

function irDesdeNotif(el) {
  const pagina = el.getAttribute('data-pagina');
  const id = el.getAttribute('data-notif-id');
  if (id) { _notifLeidas.add(id); _guardarNotifLeidas(); }
  document.getElementById('notifPanel').classList.remove('show');
  if (pagina) showPage(pagina);
  actualizarNotificaciones();
}

// elimina visualmente la notif sin navegar (click en X si lo hubiera)
function eliminarNotif(id, e) {
  if (e) e.stopPropagation();
  _notifLeidas.add(id);
  _guardarNotifLeidas();
  actualizarNotificaciones();
}
document.addEventListener('click',e=>{
  if(!e.target.closest('.notif-btn')&&!e.target.closest('.notif-panel'))
    document.getElementById('notifPanel').classList.remove('show');
});

