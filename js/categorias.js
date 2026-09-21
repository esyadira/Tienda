// FUNCIONES DE CATEGORÍAS
function renderCategorias() {
  const tb = document.getElementById('catTbody');
  const stats = document.getElementById('catStatsGrid');
  if (!tb) return;
  const cc=document.getElementById('catContador');
  if(cc){const t=categorias.length;cc.textContent=`${t} categoría${t!==1?'s':''}`; }

  // Renderizar Tabla
  tb.innerHTML = categorias.length===0 ? `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3);font-size:13px;"><i class="fa fa-folder-open" style="display:block;font-size:28px;margin-bottom:8px;opacity:0.3;"></i>Sin registros</td></tr>` : categorias.map(cat => {
    const count = productos.filter(p => p.cat === cat).length;
    return `
      <tr style="cursor:pointer;" onclick="verProductosDeCategoria('${cat}')" onmouseenter="this.style.background='var(--surface2)'" onmouseleave="this.style.background=''">
        <td><div class="icon-btn" style="background:var(--surface2); cursor:default;">${getEmojiForCat(cat)}</div></td>
        <td><strong style="color:var(--text);">${cat}</strong></td>
        <td><span class="badge badge-blue">${count} productos</span></td>
        <td><span class="badge badge-green">Activo</span></td>
        <td>
          <div class="action-btns" onclick="event.stopPropagation()">
            <div class="icon-btn" title="Editar" onclick="editCategoria('${cat}')"><i class="fa fa-pen"></i></div>
            <div class="icon-btn del" title="Eliminar" onclick="delCategoria('${cat}')"><i class="fa fa-trash"></i></div>
          </div>
        </td>
      </tr>`;
  }).join('');

  // Renderizar Mini Stats en la parte superior
  if (stats) {
    stats.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon" style="--icon-c: var(--accent); --icon-bg: rgba(var(--accent-rgb,245,158,11),0.1);"><i class="fa fa-tags"></i></div>
        <div class="stat-label">Total Categorías</div>
        <div class="stat-value">${categorias.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><i class="fa fa-layer-group"></i></div>
        <div class="stat-label">Más Popular</div>
        <div class="stat-value" style="font-size:18px;">${getMostPopularCat()}</div>
      </div>
    `;
  }
}

function verProductosDeCategoria(cat) {
  const prods = productos.filter(p => p.cat === cat);
  document.getElementById('modalProdCatTitle').innerHTML = `<i class="fa fa-tag" style="color:var(--accent);margin-right:8px;"></i>${cat} <span style="font-size:12px;color:var(--text3);font-weight:400;">(${prods.length} productos)</span>`;
  const lista = document.getElementById('modalProdCatList');
  if (!prods.length) {
    lista.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text3);font-size:13px;"><i class="fa fa-box" style="display:block;font-size:28px;margin-bottom:8px;opacity:0.3;"></i>Sin productos en esta categoría</div>`;
  } else {
    lista.innerHTML = prods.map(p => {
      const agotado = p.stock <= 0;
      const stockBadge = agotado ? 'badge-red' : p.stock <= (settings.alertas.minStock||3) ? 'badge-red' : 'badge-green';
      return `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);">
        ${p.img ? `<img src="${p.img}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;flex-shrink:0;">` : `<div style="width:40px;height:40px;background:var(--surface3);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa fa-box" style="color:var(--text3);"></i></div>`}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:13px;${agotado?'color:var(--text3);':''}">${p.nombre}</div>
          <div style="font-size:11px;color:var(--text3);font-family:'JetBrains Mono',monospace;">${p.codigo}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-weight:700;color:var(--accent);font-size:14px;">${moneda()} ${p.precio.toFixed(2)}</div>
          <span class="badge ${stockBadge}" style="font-size:10px;">${agotado?'Agotado':p.stock+' uds.'}</span>
        </div>
        <div class="icon-btn" title="Editar" onclick="closeModal('modalProductosCategoria');showPage('productos');setTimeout(()=>editProduct(${p.id}),150);" style="flex-shrink:0;"><i class="fa fa-pen"></i></div>
      </div>`;
    }).join('');
  }
  openModal('modalProductosCategoria');
}

function saveCategoria(){
  const original = document.getElementById('editCatOriginal').value;
  const nombre = document.getElementById('catNombre').value.trim();
  if(!nombre) return showToast('Ingresa un nombre','error');
  if(original){
    // Editing existing
    const idx = categorias.indexOf(original);
    if(idx>-1){
      categorias[idx]=nombre;
      // update all products that had the old category
      productos.forEach(p=>{ if(p.cat===original) p.cat=nombre; });
    }
    showToast('Categoría actualizada','success');
  } else {
    if(categorias.includes(nombre)) return showToast('La categoría ya existe','error');
    categorias.push(nombre);
    showToast('Categoría añadida','success');
  }
  renderCategoryChart();
  renderCategorias();
  actualizarSelectsCategorias();
  closeModal('modalCategoria');
  guardarTodoEnLocalStorage();
  document.getElementById('catNombre').value='';
  document.getElementById('editCatOriginal').value='';
}
function addCategoria(){ saveCategoria(); } // backward compat
function editCategoria(cat){
  document.getElementById('editCatOriginal').value=cat;
  document.getElementById('modalCatTitle').innerHTML='<i class="fa fa-pen" style="color:var(--accent);margin-right:8px;"></i>Editar Categoría';
  document.getElementById('catNombre').value=cat;
  document.getElementById('catEmoji').value='';
  openModal('modalCategoria');
}
function openNuevaCategoria(){
  document.getElementById('editCatOriginal').value='';
  document.getElementById('modalCatTitle').innerHTML='<i class="fa fa-tag" style="color:var(--accent);margin-right:8px;"></i>Nueva Categoría';
  document.getElementById('catNombre').value='';
  document.getElementById('catEmoji').value='';
  openModal('modalCategoria');
}

function delCategoria(cat) {
  const vinculados = productos.filter(p => p.cat === cat).length;
  if (vinculados > 0) {
    return showToast(`No puedes eliminar "${cat}" porque tiene ${vinculados} productos asociados`, 'error');
  }
  
  if (cfgConfirm(`¿Eliminar la categoría "${cat}"?`)) {
    const idx = categorias.indexOf(cat);
    if (idx > -1) {
      categorias.splice(idx, 1);
      renderCategorias();
      actualizarSelectsCategorias();
      guardarTodoEnLocalStorage();
      showToast('Categoría eliminada', 'success');
    }
  }
}

function getEmojiForCat(cat) {
  const map = { 'Abarrotes': '🌾', 'Bebidas': '🥤', 'Limpieza': '🧼', 'Lácteos': '🥛', 'Snacks': '🍪' };
  return map[cat] || '🏷️';
}

function getMostPopularCat() {
  if (productos.length === 0) return "N/A";
  const counts = {};
  productos.forEach(p => counts[p.cat] = (counts[p.cat] || 0) + 1);
  return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
}

// Esta función asegura que los selects de "Nueva Venta" y "Nuevo Producto" se actualicen
function actualizarSelectsCategorias() {
  // 1. Ubicamos los selects de ambas pantallas (POS y Productos)
  const posFilter = document.getElementById('posCatFilter');
  const prodFilter = document.getElementById('filterCatSelect');
  
  // 2. Creamos la opción base
  let options = `<option value="">Todas las categorías</option>`;
  
  // 3. Si hay categorías, las ordenamos y las agregamos
  if (categorias && categorias.length > 0) {
    // Usamos sort() para que aparezcan en orden alfabético
    options += categorias.slice().sort().map(c => `<option value="${c}">${c}</option>`).join('');
  }
  
  // 4. Inyectamos el HTML en los selects
  if (posFilter) posFilter.innerHTML = options;
  if (prodFilter) prodFilter.innerHTML = options;
}

