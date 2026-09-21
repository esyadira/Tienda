// ========================================
// PRODUCTS
// ========================================

// ----- Tipo de unidad y promoción -----
// p.unidad: 'unidad' | 'kg' (granel) | 'paquete'. Los productos viejos solo tienen p.esPeso.
function unidadDe(p){ return p.unidad || (p.esPeso ? 'kg' : 'unidad'); }
function hoyISO(){ return new Date().toLocaleDateString('en-CA'); }

// Promoción del producto: { tipo:'nxm'|'pack'|'precio', lleva, paga, precio, hasta }
//  nxm    -> lleva N y paga M (2x1, 3x2...)
//  pack   -> lleva N por S/ precio (3 por S/ 5)
//  precio -> precio en oferta (el % de descuento se calcula a partir del precio normal)
function promoDe(p){
  if(!p) return null;
  if('promo' in p){
    const pr = (p.promo && p.promo.tipo) ? p.promo : null;
    // Las promociones viejas por % de descuento ahora son un precio en oferta
    if(pr && pr.tipo === 'descuento') return {tipo:'precio', precio: Math.round(p.precio * (1 - pr.pct / 100) * 100) / 100, hasta: pr.hasta || ''};
    return pr;
  }
  if(p.precioPromo > 0) return {tipo:'precio', precio:p.precioPromo, hasta:p.promoHasta || ''}; // datos de la versión anterior
  return null;
}
// Promoción vigente: existe, no ha vencido y tiene sentido frente al precio normal
function promoVigente(p){
  const pr = promoDe(p);
  if(!pr) return false;
  if(pr.hasta && pr.hasta < hoyISO()) return false;
  if(pr.tipo === 'precio') return pr.precio > 0 && pr.precio < p.precio;
  return true;
}
// % de descuento de un precio en oferta respecto al precio normal (0 si no aplica)
function promoPct(p){
  const pr = promoDe(p);
  if(!pr || pr.tipo !== 'precio' || !(p.precio > 0) || !(pr.precio > 0)) return 0;
  return Math.round((1 - pr.precio / p.precio) * 100);
}
// Texto de la promoción: "3x2", "3 x S/. 5.00", "S/. 4.50 · -10%". Con corto=true, el precio en oferta solo muestra "10%"
function promoEtiqueta(p, corto){
  const pr = promoDe(p);
  if(!pr) return '';
  if(pr.tipo === 'nxm') return `${pr.lleva}x${pr.paga}`;
  if(pr.tipo === 'pack') return `${pr.lleva} x ${moneda()} ${(+pr.precio).toFixed(2)}`;
  const pct = promoPct(p);
  if(corto) return pct > 0 ? `${pct}%` : 'OFERTA';
  return `${moneda()} ${(+pr.precio).toFixed(2)} · ${pct > 0 ? `-${pct}%` : 'OFERTA'}`;
}
// Precio unitario "de lista" con promoción vigente (solo cambia con el precio en oferta)
function precioListaPromo(p){
  if(!promoVigente(p)) return p.precio;
  const pr = promoDe(p);
  if(pr.tipo === 'precio') return pr.precio;
  return p.precio;
}
// Calcula lo que se cobra por `qty` unidades (o kg) del producto p (p.precio = precio normal).
// La oferta se aplica sola cuando se llega a la cantidad de la promoción. -> { total, tarifa: ''|'promo' }
function calcLinea(p, qty){
  const base = p.precio;
  let mejor = base * qty, tarifa = '';
  if(promoVigente(p)){
    const pr = promoDe(p);
    const granel = unidadDe(p) === 'kg';
    let t = null;
    if(pr.tipo === 'nxm' && !granel){
      const g = Math.floor(qty / pr.lleva);
      if(g > 0) t = (qty - g * (pr.lleva - pr.paga)) * base;
    } else if(pr.tipo === 'pack' && !granel){
      const g = Math.floor(qty / pr.lleva);
      if(g > 0) t = g * pr.precio + (qty - g * pr.lleva) * base;
    } else if(pr.tipo === 'precio'){
      t = qty * pr.precio;
    }
    if(t !== null && t < mejor - 1e-9){ mejor = t; tarifa = 'promo'; }
  }
  return {total: Math.round(mejor * 100) / 100, tarifa};
}
// Precio para mostrar en listas: con descuento % u oferta, el normal va tachado
function precioHTML(p){
  const pl = precioListaPromo(p);
  if(pl < p.precio) return `<span style="text-decoration:line-through;color:var(--text3);font-weight:400;font-size:11px;margin-right:4px;">${moneda()} ${p.precio.toFixed(2)}</span>${moneda()} ${pl.toFixed(2)}`;
  return `${moneda()} ${p.precio.toFixed(2)}`;
}
function badgesProducto(p){
  const u = unidadDe(p);
  let h = '';
  if(u === 'kg') h += '<span class="badge badge-blue" style="font-size:10px;margin-left:4px;">granel</span>';
  if(u === 'paquete') h += `<span class="badge badge-blue" style="font-size:10px;margin-left:4px;">paquete${p.unidadesPaquete ? ' x' + p.unidadesPaquete : ''}</span>`;
  if(promoVigente(p)) h += `<i class="fa fa-star" title="Promoción ${promoEtiqueta(p)}" style="color:#f59e0b;margin-left:6px;font-size:13px;"></i>`;
  return h;
}
// Productos: estrella sobre la imagen cuando hay promoción
function estrellaPromoImg(p){
  if(!promoVigente(p)) return '';
  return `<div title="Promoción ${promoEtiqueta(p)}" style="position:absolute;top:6px;left:6px;z-index:3;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;"><i class="fa fa-star" style="color:#f59e0b;font-size:13px;margin:0;"></i></div>`;
}
// Punto de venta: cinta con la promoción arriba de la imagen
function cintaPromoPOS(p){
  if(!promoVigente(p)) return '';
  return `<div style="position:absolute;top:0;left:0;z-index:3;background:linear-gradient(135deg,#f43f5e,#f97316);color:#fff;font-size:11px;font-weight:800;letter-spacing:.3px;padding:4px 10px 4px 8px;border-radius:0 0 12px 0;box-shadow:0 2px 8px rgba(0,0,0,.28);display:flex;align-items:center;gap:5px;line-height:1.1;"><i class="fa fa-star" style="font-size:10px;color:#fde047;margin:0;"></i>${promoEtiqueta(p)}</div>`;
}
function unidadStockLbl(p){ const u = unidadDe(p); return u === 'kg' ? 'kg' : u === 'paquete' ? 'paq.' : 'uds.'; }

// ----- Vistas de la página Productos: Productos · Promociones · Bajo stock · Stock fijo -----
let prodVistaTab = 'todos';
function _enVistaProd(p){
  if(prodVistaTab === 'promo') return promoVigente(p);
  if(prodVistaTab === 'bajo') return p.stock <= (settings.alertas.minStock || 3);
  if(prodVistaTab === 'fijo') return (p.stockFijo || 0) > 0;
  return true;
}
const _MSG_VISTA_VACIA = {
  promo: 'No hay productos con promoción vigente',
  bajo: 'No hay productos con bajo stock',
  fijo: 'No hay productos con stock fijo'
};
// Resalta la vista activa y muestra cuántos productos tiene cada una
function actualizarTabsProductos(){
  const cont = {
    todos: productos.length,
    promo: productos.filter(p => promoVigente(p)).length,
    bajo: productos.filter(p => p.stock <= (settings.alertas.minStock || 3)).length,
    fijo: productos.filter(p => (p.stockFijo || 0) > 0).length
  };
  document.querySelectorAll('#prodVistaTabs .prod-tab').forEach(b => {
    b.classList.toggle('activo', b.dataset.vista === prodVistaTab);
    const c = b.querySelector('.prod-tab-count'); if(c) c.textContent = cont[b.dataset.vista];
  });
}
function setProdVista(v){
  prodVistaTab = v;
  // Mismo buscador y categoría de siempre, pero solo con los productos de la vista elegida
  const ql = ((document.getElementById('prodSearchInput') || {}).value || '').toLowerCase();
  const cat = (document.getElementById('filterCatSelect') || {}).value || '';
  const lista = productos.filter(p => (!ql || p.nombre.toLowerCase().includes(ql) || p.codigo.toLowerCase().includes(ql)) && (!cat || p.cat === cat));
  renderProdTable(lista);
  renderProdGrid(lista);
}

function renderProdTable(list){
  actualizarTabsProductos();
  const data = (list || productos).filter(_enVistaProd).slice().sort((a,b) => a.nombre.localeCompare(b.nombre, 'es', {sensitivity:'base'}));
  const tb=document.getElementById('prodTbody');
  const contador = document.getElementById('prodContador');
  if(contador){const total=productos.length,mostrando=data.length;contador.textContent=mostrando<total?`${mostrando} de ${total} productos`:`${total} producto${total!==1?'s':''}`;}
  if(!data.length){tb.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text3);font-size:13px;"><i class="fa fa-box" style="display:block;font-size:28px;margin-bottom:8px;opacity:0.3;"></i>${(!list||list.length===productos.length)&&_MSG_VISTA_VACIA[prodVistaTab]?_MSG_VISTA_VACIA[prodVistaTab]:'Sin registros'}</td></tr>`;return;}
  tb.innerHTML=data.map(p=>{
    const agotado = p.stock <= 0;
    const rowStyle = agotado ? 'opacity:0.5;filter:grayscale(60%);background:var(--surface2);' : '';
    return `
    <tr style="${rowStyle}cursor:pointer;" onclick="editProduct(${p.id})" onmouseenter="this.style.background='var(--surface2)'" onmouseleave="this.style.background='${agotado?'var(--surface2)':''}'">
      <td><span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text3);">${p.codigo}</span></td>
      <td><div style="display:flex;align-items:center;gap:10px;">
        ${p.img?`<img src="${p.img}" style="width:32px;height:32px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">`:`<div style="width:32px;height:32px;background:var(--surface3);border-radius:6px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:14px;"><i class="fa fa-image"></i></div>`}
        <span style="font-weight:500;">${p.nombre}</span>${badgesProducto(p)}
      </div></td>
      <td><span class="badge badge-blue">${p.cat}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:600;${p.stock<=(settings.alertas.minStock||3)?'color:var(--danger)':''}">${p.stock}</span>
          ${p.stock<=(settings.alertas.minStock||3)?'<span class="badge badge-red">Bajo</span>':''}
          ${p.stockFijo?'<span class="badge badge-blue" style="font-size:10px;">Auto</span>':''}
        </div>
      </td>
      <td style="font-weight:700;color:var(--accent);">${precioHTML(p)}</td>
      <td><span class="badge ${p.stock>0?'badge-green':'badge-red'}">${p.stock>0?'Activo':'Agotado'}</span></td>
      <td><div class="action-btns" onclick="event.stopPropagation()">
        <div class="icon-btn" title="Ver detalle" onclick="viewProduct(${p.id})"><i class="fa fa-eye"></i></div>
        <div class="icon-btn del" title="Eliminar" onclick="delProduct(${p.id})"><i class="fa fa-trash"></i></div>
      </div></td>
    </tr>
  `}).join('');
}

function renderProdGrid(list){
  const data = (list || productos).filter(_enVistaProd).slice().sort((a,b) => a.nombre.localeCompare(b.nombre, 'es', {sensitivity:'base'}));
  const g=document.getElementById('prodGridView');
  if(!data.length && _MSG_VISTA_VACIA[prodVistaTab] && (!list||list.length===productos.length)){
    g.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text3);font-size:13px;"><i class="fa fa-box" style="display:block;font-size:28px;margin-bottom:8px;opacity:0.3;"></i>${_MSG_VISTA_VACIA[prodVistaTab]}</div>`;
    return;
  }
  g.innerHTML=data.map(p=>{
    const agotado = p.stock <= 0;
    return `
    <div class="prod-card" onclick="viewProductGrid(${p.id})" style="${agotado?'opacity:0.55;filter:grayscale(80%);':''}position:relative;">
      ${agotado?`<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10;background:rgba(0,0,0,0.62);color:#fff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:20px;white-space:nowrap;letter-spacing:0.5px;pointer-events:none;">AGOTADO</div>`:''}
      <div class="prod-card-img">${estrellaPromoImg(p)}${p.img?`<img src="${p.img}" style="width:100%;height:100%;object-fit:contain;">`:`<i class="fa fa-box" style="font-size:32px;color:var(--text3);"></i>`}</div>
      <div class="prod-card-body">
        <div class="prod-card-name">${p.nombre}</div>
        <div class="prod-card-cat">${p.cat}</div>
        <div class="prod-card-footer">
          <div class="prod-card-price" style="${agotado?'color:var(--text3);':''}">${moneda()} ${precioListaPromo(p).toFixed(2)}</div>
          <span class="prod-card-stock ${agotado?'badge-red':p.stock<=(settings.alertas.minStock||3)?'badge-red':'badge-green'} badge">${agotado?'0':p.stock}</span>
        </div>
      </div>
    </div>
  `}).join('');
}

function _detalleProductoHTML(p){
  const u = unidadDe(p);
  const uTxt = u === 'kg' ? 'Granel (kg)' : u === 'paquete' ? `Paquete${p.unidadesPaquete ? ' x' + p.unidadesPaquete + ' uds.' : ''}` : 'Unidad';
  const card = (titulo, contenido) => `<div style="background:var(--surface2);padding:12px;border-radius:8px;"><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">${titulo}</div>${contenido}</div>`;
  let gan = '';
  if(p.costo > 0){
    const g = precioListaPromo(p) - p.costo;
    gan = card('Ganancia', `<div style="font-size:16px;font-weight:700;color:${g>=0?'var(--accent3)':'var(--danger)'};">${moneda()} ${g.toFixed(2)} <span style="font-size:12px;font-weight:600;">(${(g/p.costo*100).toFixed(1)}%)</span></div>`);
  }
  return `
    <div style="text-align:center;margin-bottom:20px;">
      ${p.img?`<img src="${p.img}" style="width:80px;height:80px;object-fit:cover;border-radius:12px;border:2px solid var(--border);margin:0 auto 8px;display:block;">`:`<div style="width:80px;height:80px;background:var(--surface2);border-radius:12px;border:2px solid var(--border);margin:0 auto 8px;display:flex;align-items:center;justify-content:center;"><i class="fa fa-box" style="font-size:28px;color:var(--text3);"></i></div>`}
      <h3 style="font-size:18px;font-weight:700;margin-top:8px;">${p.nombre}</h3>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      ${card('Código', `<div style="font-family:'JetBrains Mono',monospace;font-size:12px;">${p.codigo}</div>`)}
      ${card('Categoría', `<span class="badge badge-blue">${p.cat}</span>`)}
      ${card('Se vende por', `<div style="font-size:13px;">${uTxt}</div>`)}
      ${card('Precio de venta', `<div style="font-size:18px;font-weight:700;color:var(--accent);">${precioHTML(p)}</div>`)}
      ${p.costo > 0 ? card('Precio de costo', `<div style="font-size:16px;font-weight:700;">${moneda()} ${p.costo.toFixed(2)}</div>`) : ''}
      ${gan}
      ${promoDe(p) ? card('Promoción', `<div style="font-size:16px;font-weight:700;color:${promoVigente(p)?'#f59e0b':'var(--text3)'};"><i class="fa fa-star" style="margin-right:5px;"></i>${promoEtiqueta(p)}</div><div style="font-size:11px;color:var(--text3);">${promoVigente(p)?'Vigente':'Vencida'}${promoDe(p).hasta?' · hasta '+promoDe(p).hasta.split('-').reverse().join('/'):''}</div>`) : ''}
      ${card('Stock', `<div style="font-size:18px;font-weight:700;${p.stock<=(settings.alertas.minStock||3)?'color:var(--danger)':'color:var(--accent3)'};">${p.stock} ${unidadStockLbl(p)}</div>`)}
      ${card('Estado', `<span class="badge ${p.stock>0?'badge-green':'badge-red'}">${p.stock>0?'Activo':'Agotado'}</span>`)}
    </div>
  `;
}

function viewProductGrid(id){ viewProduct(id); }

function toggleProductView(){
  prodViewGrid = !prodViewGrid;
  
  // Guardamos la preferencia: 'grid' o 'list'
  localStorage.setItem('bodega_prod_view_mode', prodViewGrid ? 'grid' : 'list');
  
  const listView = document.getElementById('prodListView');
  const gridView = document.getElementById('prodGridView');
  const icon = document.getElementById('viewToggleIcon');

  if (listView && gridView && icon) {
    listView.style.display = prodViewGrid ? 'none' : 'block';
    gridView.style.display = prodViewGrid ? 'grid' : 'none';
    icon.className = prodViewGrid ? 'fa fa-list' : 'fa fa-grip';
  }
}

function _setVal(id,v){ const el=document.getElementById(id); if(el) el.value=v; }

// Stock fijo diario: al activar el interruptor, la cantidad que esté en "Cantidad en Stock" es la que se repone
// sola todos los días (se agote o sobre). Si se edita un producto que ya tenía stock fijo y no se toca el stock,
// se conserva su cantidad diaria (el stock del momento puede ser menor porque ya se vendió).
let _fijoCargado = 0, _stockCargado = '';
function toggleStockFijo(){
  if(document.getElementById('prodFijoOn').checked){
    const st=document.getElementById('prodStock');
    if(!(parseInt(st.value)>0)) st.focus();
  }
}
function _mostrarStockFijo(n){
  document.getElementById('prodFijoOn').checked = n>0;
  _fijoCargado = n>0 ? n : 0;
  _stockCargado = document.getElementById('prodStock').value;
}
// Abre el formulario siempre desde arriba (lo primero que se ve es el producto)
function _prodScrollArriba(){
  const body=document.querySelector('#modalProducto .modal-body'); if(body) body.scrollTop=0;
}

function openNuevoProducto(){
  document.getElementById('editProdId').value='';
  document.getElementById('modalProdTitle').innerHTML='<i class="fa fa-box" style="color:var(--accent);margin-right:8px;"></i>Nuevo Producto';
  document.getElementById('prodBarcode').value='';
  document.getElementById('prodNombre').value='';
  document.getElementById('prodCatInput').value='';
  document.getElementById('prodCatVal').value='';
  document.getElementById('prodStock').value='';
  document.getElementById('prodStockMin').value='3';
  ['prodCosto','prodGananciaPct','prodPrecio','prodUnidadesPaquete','prodDesc'].forEach(id=>_setVal(id,''));
  // Si está activo el margen de ganancia automático (Preferencias), se precarga aquí; el usuario
  // puede cambiarlo libremente y eso solo afecta a este producto, no al valor guardado en Preferencias.
  if(settings && settings.sistema && settings.sistema.margenAuto && settings.sistema.margenPct>0){
    _setVal('prodGananciaPct', settings.sistema.margenPct);
  }
  setUnidad('unidad');
  _cargarPromoForm(null);
  _mostrarStockFijo(0);
  actualizarInfoPrecios();
  const imgEl=document.getElementById('imgPreview');
  imgEl.style.display='none';imgEl.src='';
  document.getElementById('prodImgIcon').style.display='block';
  openModal('modalProducto');
  _prodScrollArriba();
}

// Llena los campos de precios, unidad, imagen, etc. con los datos de un producto (usado al editar y al autocompletar)
function _cargarCamposProducto(p){
  document.getElementById('prodCatInput').value=p.cat;
  document.getElementById('prodCatVal').value=p.cat;
  _setVal('prodCosto', p.costo>0 ? p.costo : '');
  _setVal('prodGananciaPct', (p.costo>0 && p.gananciaPct!=null && p.gananciaPct!=='') ? p.gananciaPct : '');
  _setVal('prodPrecio', p.precio);
  _setVal('prodUnidadesPaquete', p.unidadesPaquete||'');
  _mostrarStockFijo(p.stockFijo||0);
  document.getElementById('prodStockMin').value=p.stockMin||3;
  _setVal('prodDesc', p.desc||'');
  setUnidad(unidadDe(p));
  _cargarPromoForm(promoDe(p));
  const imgEl=document.getElementById('imgPreview');
  if(p.img){imgEl.src=p.img;imgEl.style.display='block';document.getElementById('prodImgIcon').style.display='none';}
  else{imgEl.style.display='none';imgEl.src='';document.getElementById('prodImgIcon').style.display='block';}
  actualizarInfoPrecios();
}

// ----- Cálculo de costo / ganancia / precio de venta -----
function _numCampo(id){ const v=parseFloat((document.getElementById(id)||{}).value); return isNaN(v)?0:v; }

// Al cambiar el costo o el % de ganancia: precio de venta = costo + (costo × ganancia%)
// Precio "cobrable": al décimo más cercano (5.42 -> 5.40). Si es menor a 0.10 se deja con sus céntimos.
function _redondear10(x){ return x >= 0.1 ? Math.round(x * 10) / 10 : Math.round(x * 100) / 100; }

function calcPrecioDesdeCosto(){
  const costo=_numCampo('prodCosto');
  const pctStr=document.getElementById('prodGananciaPct').value;
  const pct=parseFloat(pctStr);
  if(costo>0 && pctStr!=='' && !isNaN(pct)){
    document.getElementById('prodPrecio').value=_redondear10(costo*(1+pct/100)).toFixed(2);
  } else if(costo>0 && pctStr==='' && _numCampo('prodPrecio')>0){
    calcPctDesdePrecio(); return;
  }
  actualizarInfoPrecios();
}

// Si escriben el precio de venta a mano, se recalcula el % de ganancia
function calcPctDesdePrecio(){
  const costo=_numCampo('prodCosto');
  const precio=_numCampo('prodPrecio');
  if(costo>0 && precio>0){
    document.getElementById('prodGananciaPct').value=String(+(((precio-costo)/costo)*100).toFixed(2));
  }
  actualizarInfoPrecios();
}

// ----- Formulario de promoción -----
// prodPromoTipo guarda el tipo real: '' | 'nxm' | 'pack' | 'precio'. En pantalla hay 2 opciones:
// Sin promoción · Por cantidad (nxm o pack). "precio" (precio en oferta) ya no se puede crear desde
// el formulario, pero se conserva la lógica para productos que ya tenían una guardada (compatibilidad).
function setPromoTipo(t){
  if(t==='cantidad') t = (document.getElementById('prodPackLleva').value || document.getElementById('prodPackPrecio').value) ? 'pack' : 'nxm';
  document.getElementById('prodPromoTipo').value=t||'';
  const grupo = (t==='nxm'||t==='pack') ? 'cantidad' : (t||'');
  document.querySelectorAll('#promoTipos .prod-chip').forEach(b=>b.classList.toggle('activo', b.dataset.tipo===grupo));
  const activo = grupo==='cantidad';
  const panelCant=document.getElementById('promoPanel-cantidad');
  if(panelCant){
    panelCant.classList.toggle('promo-disabled', !activo);
    panelCant.querySelectorAll('input,button').forEach(x=>{ x.disabled=!activo; });
  }
  const extra=document.getElementById('promoExtra');
  if(extra){
    extra.classList.toggle('promo-disabled', !activo);
    extra.querySelectorAll('input').forEach(x=>{ x.disabled=!activo; });
  }
  actualizarInfoPromo();
}
// Promoción común elegida con un botón (2x1, 3x2...): limpia el "X por S/ Y"
function setNxm(l,p){
  document.getElementById('prodNxmLleva').value=l;
  document.getElementById('prodNxmPaga').value=p;
  _setVal('prodPackLleva',''); _setVal('prodPackPrecio','');
  marcarNxm(); setPromoTipo('nxm');
}
// Si escriben su propio "X por S/ Y", se suelta la promoción común
function usarPack(){
  _setVal('prodNxmLleva',''); _setVal('prodNxmPaga','');
  marcarNxm(); setPromoTipo('pack');
}
function marcarNxm(){
  const l=document.getElementById('prodNxmLleva').value, p=document.getElementById('prodNxmPaga').value;
  document.querySelectorAll('#promoPanel-cantidad [data-nxm]').forEach(b=>b.classList.toggle('activo', b.dataset.nxm===l+'-'+p));
}
// Precio en oferta <-> descuento %: al escribir uno se calcula el otro con el precio de venta
function promoPrecioInput(){
  const precio=_numCampo('prodPrecio'), po=_numCampo('prodPromoPrecio');
  _setVal('prodPromoPct', (precio>0 && po>0 && po<precio) ? String(Math.round((1-po/precio)*100)) : '');
  actualizarInfoPromo();
}
function promoPctInput(){
  const precio=_numCampo('prodPrecio'), pct=_numCampo('prodPromoPct');
  _setVal('prodPromoPrecio', (precio>0 && pct>0 && pct<100) ? _redondear10(precio*(1-pct/100)).toFixed(2) : '');
  actualizarInfoPromo();
}
// Carga la promoción de un producto en el formulario (null = sin promoción)
function _cargarPromoForm(pr){
  ['prodNxmLleva','prodNxmPaga','prodPackLleva','prodPackPrecio','prodPromoPct','prodPromoPrecio','prodPromoHasta'].forEach(id=>_setVal(id,''));
  if(pr){
    if(pr.tipo==='nxm'){ _setVal('prodNxmLleva',pr.lleva); _setVal('prodNxmPaga',pr.paga); }
    if(pr.tipo==='pack'){ _setVal('prodPackLleva',pr.lleva); _setVal('prodPackPrecio',pr.precio); }
    if(pr.tipo==='precio'){ _setVal('prodPromoPrecio',pr.precio); promoPrecioInput(); }
    _setVal('prodPromoHasta',pr.hasta||'');
  }
  setPromoTipo(pr?pr.tipo:'');
  marcarNxm();
}
// Lee y valida la promoción del formulario -> { promo } o { error }
function _leerPromoForm(precio){
  const tipo=document.getElementById('prodPromoTipo').value;
  if(!tipo) return {promo:null};
  const hasta=document.getElementById('prodPromoHasta').value||'';
  if(hasta && hasta<hoyISO()) return {error:'La fecha de la promoción ya pasó'};
  if(tipo==='nxm'){
    const lleva=parseInt(document.getElementById('prodNxmLleva').value)||0;
    const paga=parseInt(document.getElementById('prodNxmPaga').value)||0;
    if(lleva<2||paga<1||paga>=lleva) return {error:'Elige una promoción (2x1, 3x2...) o escribe tu propio "X por S/ Y"'};
    return {promo:{tipo,lleva,paga,hasta}};
  }
  if(tipo==='pack'){
    const lleva=parseInt(document.getElementById('prodPackLleva').value)||0;
    const pp=_numCampo('prodPackPrecio');
    if(lleva<2||pp<=0) return {error:'Indica cuántas unidades lleva y por cuánto (ej: 3 por S/ 5)'};
    if(precio>0 && pp>=lleva*precio) return {error:`No se puede aplicar esta promoción: el pack debe costar menos de ${moneda()} ${(lleva*precio).toFixed(2)} (${lleva} × el precio de venta)`};
    return {promo:{tipo,lleva,precio:pp,hasta}};
  }
  const po=_numCampo('prodPromoPrecio');
  if(po<=0) return {error:'Indica el precio en oferta o el porcentaje de descuento'};
  if(precio>0 && po>=precio) return {error:`No se puede aplicar esta promoción: el precio en oferta debe ser menor al precio de venta (${moneda()} ${precio.toFixed(2)})`};
  return {promo:{tipo:'precio',precio:po,hasta}};
}
// Muestra el precio actual, qué pagará el cliente y cuánto ganas con la promoción (o avisa que no se puede aplicar)
function actualizarInfoPromo(){
  const tipo=(document.getElementById('prodPromoTipo')||{}).value||'';
  const precio=_numCampo('prodPrecio'), costo=_numCampo('prodCosto'), m=moneda();
  const pa=document.getElementById('promoPrecioActual'); if(pa) pa.textContent = precio>0 ? `${m} ${precio.toFixed(2)}` : 'Sin precio aún';
  const el=document.getElementById('prodPromoInfo'); if(!el) return;
  // Si cambió el precio de venta, el % del precio en oferta se vuelve a calcular (salvo que se esté escribiendo el %)
  if(tipo==='precio' && precio>0 && document.activeElement!==document.getElementById('prodPromoPct')){
    const po=_numCampo('prodPromoPrecio');
    _setVal('prodPromoPct', (po>0 && po<precio) ? String(Math.round((1-po/precio)*100)) : '');
  }
  if(!tipo||!(precio>0)){ el.innerHTML = ''; return; }
  const aviso=t=>`<span style="color:var(--danger);font-weight:700;"><i class="fa fa-triangle-exclamation" style="margin-right:5px;"></i>No se puede aplicar esta promoción: ${t}</span>`;
  let txt='', unit=0;
  if(tipo==='nxm'){
    const l=parseInt(document.getElementById('prodNxmLleva').value)||0, p=parseInt(document.getElementById('prodNxmPaga').value)||0;
    if(l>=2 && p>=1 && p<l){ unit=p*precio/l; txt=`Llevando ${l}, el cliente paga ${m} ${(p*precio).toFixed(2)} (${m} ${unit.toFixed(2)} c/u)`; }
  } else if(tipo==='pack'){
    const l=parseInt(document.getElementById('prodPackLleva').value)||0, pp=_numCampo('prodPackPrecio');
    if(l>=2 && pp>0){
      if(pp>=l*precio){ el.innerHTML=aviso(`${l} unidades cuestan ${m} ${(l*precio).toFixed(2)} al precio actual y el pack (${m} ${pp.toFixed(2)}) debe costar menos`); return; }
      unit=pp/l; txt=`Llevando ${l}, el cliente paga ${m} ${pp.toFixed(2)} (${m} ${unit.toFixed(2)} c/u)`;
    }
  } else if(tipo==='precio'){
    const po=_numCampo('prodPromoPrecio'), pct=_numCampo('prodPromoPct');
    if(po>0 && po>=precio){ el.innerHTML=aviso(`el precio en oferta (${m} ${po.toFixed(2)}) debe ser menor al precio actual (${m} ${precio.toFixed(2)})`); return; }
    if(pct>=100){ el.innerHTML=aviso('el descuento debe ser menor a 100%'); return; }
    if(po>0){ unit=po; txt=`Cada unidad sale a ${m} ${po.toFixed(2)}`; }
  }
  if(!txt){ el.innerHTML=''; return; }
  if(costo>0){
    const g=unit-costo;
    txt+=g>=0?` · ganas ${m} ${g.toFixed(2)} por unidad`:` · <span style="color:var(--danger);font-weight:700;">⚠ vendes bajo el costo (${m} ${g.toFixed(2)} por unidad)</span>`;
  }
  el.innerHTML=txt;
}

function actualizarInfoPrecios(){
  const costo=_numCampo('prodCosto');
  const precio=_numCampo('prodPrecio');
  const m=moneda();
  const info=document.getElementById('prodGananciaInfo');
  if(info){
    if(costo>0 && precio>0){
      const g=precio-costo;
      info.style.color=g>=0?'var(--accent3)':'var(--danger)';
      info.innerHTML=g>=0?`${m} ${g.toFixed(2)} por venta`:`⚠ Vendes ${m} ${Math.abs(g).toFixed(2)} bajo el costo`;
    } else {
      info.style.color='var(--text3)';
      info.textContent='Ingresa el costo para calcularla';
    }
  }
  actualizarInfoPromo();
}

function saveProduct(){
  const editId = document.getElementById('editProdId').value;
  const nombre = document.getElementById('prodNombre').value || 'Producto Nuevo';

  // Capturar valores de los inputs
  let cat = document.getElementById('prodCatVal').value || document.getElementById('prodCatInput').value || 'Otros';

  const precio = _numCampo('prodPrecio');
  const costo = _numCampo('prodCosto');
  const stock = parseInt(document.getElementById('prodStock').value) || 0;
  const stockMin = parseInt(document.getElementById('prodStockMin').value) || 3;
  const codigo = document.getElementById('prodBarcode').value || genCode();
  const imgEl = document.getElementById('imgPreview');
  const img = imgEl.style.display !== 'none' ? imgEl.src : '';
  const unidad = document.getElementById('prodUnidad').value || 'unidad';
  const unidadesPaquete = unidad === 'paquete' ? (parseInt(document.getElementById('prodUnidadesPaquete').value) || 0) : 0;
  const fijoOn = document.getElementById('prodFijoOn').checked;
  const sinCambios = !!editId && _fijoCargado > 0 && String(document.getElementById('prodStock').value) === String(_stockCargado);
  const stockFijo = fijoOn ? (sinCambios ? _fijoCargado : stock) : 0;
  const desc = (document.getElementById('prodDesc') && document.getElementById('prodDesc').value) || '';
  const promoRes = _leerPromoForm(precio);
  const gananciaPct = (costo > 0 && precio > 0) ? +(((precio - costo) / costo) * 100).toFixed(2) : 0;

  // --- VALIDACIONES ---
  if (unidad === 'paquete' && unidadesPaquete < 2) return showToast('Indica cuántas unidades trae el paquete', 'error');
  if (fijoOn && stockFijo < 1) return showToast('Pon la cantidad en stock para activar el stock fijo diario', 'error');
  if (promoRes.error) {
    const sec = document.getElementById('promoSeccion');
    if (sec) sec.scrollIntoView({block: 'center', behavior: 'smooth'});
    return showToast(promoRes.error, 'error');
  }

  // --- AUTOMATIZACIÓN DE CATEGORÍAS ---
  if (cat && !categorias.includes(cat)) {
    categorias.push(cat);
    if (typeof renderCategorias === "function") renderCategorias();
    actualizarSelectsCategorias(); // Para que aparezca en los filtros de inmediato
  }

  // Campos nuevos de precio / unidad (se usan tanto al crear como al editar)
  const extra = {unidad, esPeso: unidad === 'kg', unidadesPaquete, costo, gananciaPct, promo: promoRes.promo, precioPromo: 0, promoHasta: '', stockFijoFecha: fijoOn ? hoyISO() : undefined};

  if(editId){
    const idx = productos.findIndex(p => p.id === parseInt(editId));
    if(idx > -1){
      productos[idx] = {...productos[idx], nombre, cat, precio, img, stock, stockMin, codigo, stockFijo: stockFijo || 0, desc, ...extra};
      showToast('Producto actualizado', 'success');
    }
  } else {
    const existing = codigo ? productos.find(p => p.codigo === codigo) : null;
    if(existing){
      existing.stock += stock;
      showToast(`Stock actualizado: ${existing.nombre}`, 'success');
    } else {
      productos.push({id: Date.now(), codigo, nombre, cat, stock, precio, img, estado: 'ok', stockMin, stockFijo: stockFijo || 0, desc, ...extra});
      showToast('Producto guardado', 'success');
    }
  }

  // Preservar el filtro activo del buscador al guardar
  const _searchVal = (document.getElementById('prodSearchInput') || {}).value || '';
  const _catVal = (document.getElementById('filterCatSelect') || {}).value || '';
  if (_searchVal || _catVal) {
    filterProducts(_searchVal);
  } else {
    renderProdTable();
    renderProdGrid();
  }
  renderPOSProducts();
  updateStockBajoCount();
  actualizarNotificaciones();
  guardarTodoEnLocalStorage();
  renderCategoryChart();
  closeModal('modalProducto');
}

function editProduct(id){
  const p=productos.find(x=>x.id===id);if(!p)return;
  document.getElementById('editProdId').value=p.id;
  document.getElementById('modalProdTitle').innerHTML='<i class="fa fa-pen" style="color:var(--accent);margin-right:8px;"></i>Editar Producto';
  document.getElementById('prodBarcode').value=p.codigo;
  document.getElementById('prodNombre').value=p.nombre;
  document.getElementById('prodStock').value=p.stock;
  _cargarCamposProducto(p);
  openModal('modalProducto');
  _prodScrollArriba();
}

function viewProduct(id){
  const p=productos.find(x=>x.id===id);if(!p)return;
  document.getElementById('verProductoBody').innerHTML=_detalleProductoHTML(p);
  // El botón Editar siempre apunta al producto que se está viendo
  document.querySelector('#modalVerProducto .modal-footer').innerHTML=`
    <button class="btn btn-secondary" onclick="closeModal('modalVerProducto')">Cerrar</button>
    <button class="btn btn-primary" onclick="closeModal('modalVerProducto');editProduct(${p.id})"><i class="fa fa-pen"></i> Editar</button>
  `;
  openModal('modalVerProducto');
}

function delProduct(id){
  if(cfgConfirm('¿Eliminar este producto?')){
    productos=productos.filter(p=>p.id!==id);
    renderProdTable();renderProdGrid();updateStockBajoCount();actualizarNotificaciones();
    guardarTodoEnLocalStorage();
    showToast('Producto eliminado','success');
    _enfocarBusquedaProductos();
  }
}

function genBarcode(){
  const code=genCode();
  document.getElementById('prodBarcode').value=code;
}
function genCode(){return Math.floor(7000000000000+Math.random()*999999999999).toString();}

function checkBarcodeExists(code){
  if(!code||code.length<4)return;
  const editId=document.getElementById('editProdId').value;
  if(editId)return; // don't autocomplete when editing
  const existing=productos.find(p=>p.codigo===code);
  if(existing){
    document.getElementById('prodNombre').value=existing.nombre;
    _cargarCamposProducto(existing);
    // Leave stock empty for user to fill (the amount being added)
    document.getElementById('prodStock').value='';
    document.getElementById('prodStock').focus();
    showToast('Producto encontrado — ingresa la cantidad a añadir al stock','success');
  }
}

function checkNombreExists(nombre){
  if(!nombre||nombre.trim().length<2)return;
  const editId=document.getElementById('editProdId').value;
  if(editId)return; // no autocompletar al editar
  const term=nombre.trim().toLowerCase();
  // Buscar coincidencia exacta primero, luego parcial
  const existing=productos.find(p=>p.nombre.toLowerCase()===term)
    || productos.find(p=>p.nombre.toLowerCase().includes(term));
  if(existing){
    document.getElementById('prodNombre').value=existing.nombre;
    document.getElementById('prodBarcode').value=existing.codigo||'';
    _cargarCamposProducto(existing);
    document.getElementById('prodStock').value='';
    document.getElementById('prodStock').focus();
    showToast('Producto encontrado — ingresa la cantidad a añadir al stock','success');
  }
}

function setUnidad(val){
  if(!['unidad','kg','paquete'].includes(val)) val='unidad';
  document.getElementById('prodUnidad').value=val;
  const btns={unidad:'unidadBtn',kg:'kgBtn',paquete:'paqBtn'};
  Object.keys(btns).forEach(k=>{
    const el=document.getElementById(btns[k]);if(!el)return;
    const on=(k===val);
    el.style.background=on?'rgba(245,158,11,0.15)':'var(--surface2)';
    el.style.border=on?'2px solid var(--accent)':'2px solid var(--border)';
    el.style.color=on?'var(--accent)':'var(--text3)';
  });
  const paqBox=document.getElementById('paqBox');
  if(paqBox)paqBox.style.display=(val==='paquete')?'block':'none';
  // Granel (kg): solo precio en oferta (la promoción por cantidad no aplica al peso)
  ['cantidad'].forEach(t=>{ const ch=document.querySelector('#promoTipos [data-tipo="'+t+'"]'); if(ch) ch.style.display=(val==='kg')?'none':''; });
  const tipoAct=document.getElementById('prodPromoTipo');
  if(val==='kg' && tipoAct && (tipoAct.value==='nxm'||tipoAct.value==='pack')) setPromoTipo('');
  const por=document.getElementById('prodPrecioPor');
  if(por)por.textContent=val==='kg'?'(por kg)':val==='paquete'?'(por paquete)':'(por unidad)';
}

let _prodScanTimer = null;
function filterProducts(q){
  const cat=document.getElementById('filterCatSelect').value;
  const ql=q.toLowerCase();
  const filtered=productos.filter(p=>{
    const matchQ=!ql||p.nombre.toLowerCase().includes(ql)||p.codigo.toLowerCase().includes(ql);
    const matchCat=!cat||p.cat===cat;
    return matchQ&&matchCat;
  });
  renderProdTable(filtered);
  renderProdGrid(filtered);
  // Detección de escaneo: código ≥6 caracteres y solo dígitos → si no existe, abrir modal nuevo producto
  const esCodigoNumerico = /^\d+$/.test(q);
  if(q.length>=6 && esCodigoNumerico){
    clearTimeout(_prodScanTimer);
    _prodScanTimer=setTimeout(()=>{
      const inp=document.getElementById('prodSearchInput');
      if(!inp||inp.value!==q)return;
      const existe=productos.find(p=>p.codigo.toLowerCase()===q.toLowerCase());
      if(!existe){
        inp.value='';
        renderProdTable();renderProdGrid();
        openNuevoProducto();
        setTimeout(()=>{
          const barcodeField=document.getElementById('prodBarcode');
          if(barcodeField){barcodeField.value=q;checkBarcodeExists(q);}
        },150);
      }
    },300);
  } else {
    clearTimeout(_prodScanTimer);
  }
}

function _enfocarBusquedaProductos(){
  // Desactivado: no enfocar automáticamente
}
function clearVendFilter(){document.getElementById('vendSearchInput').value='';renderVendedores();}

function filterTable(inp,tableId){
  const q=inp.value.toLowerCase();
  document.querySelectorAll(`#${tableId} tbody tr`).forEach(r=>{
    r.style.display=r.textContent.toLowerCase().includes(q)?'':'none';
  });
}

function exportProductsExcel(){
  const now=new Date().toLocaleDateString('es-PE');
  let html=`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel' xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset='UTF-8'>
  <style>
    body{font-family:Arial,sans-serif;text-align:center;}
    table{border-collapse:collapse;width:90%;margin:0 auto;}
    th{background:#1a2235;color:#f59e0b;padding:10px 16px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #2a3a52;}
    td{padding:9px 16px;font-size:13px;border:1px solid #e2e8f0;text-align:center;}
    tr:nth-child(even) td{background:#f8fafc;}
    tr:nth-child(odd) td{background:#ffffff;}
    .badge-bajo{background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;}
    .badge-ok{background:#d1fae5;color:#059669;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;}
    h2{color:#1a2235;margin-bottom:4px;text-align:center;}
    p{color:#64748b;font-size:12px;margin-top:0;text-align:center;}
  </style></head><body>
  <h2>📦 Inventario de Productos</h2>
  <p>Exportado: ${now} · Total: ${productos.length} productos</p>
  <table>
    <thead><tr>
      <th>#</th><th>Código</th><th>Imagen</th><th>Producto</th><th>Categoría</th><th>Unidad</th><th>Stock</th><th>Costo (S/.)</th><th>Precio (S/.)</th>
    </tr></thead>
    <tbody>
    ${productos.map((p,i)=>`<tr>
      <td>${i+1}</td>
      <td style="font-family:monospace;font-size:11px;">${p.codigo}</td>
      <td>${p.img?`<img src="${p.img}" width="40" height="40" style="object-fit:cover;border-radius:6px;">`:'—'}</td>
      <td><strong>${p.nombre}</strong></td>
      <td>${p.cat}</td>
      <td>${unidadDe(p)==='kg'?'Granel (kg)':unidadDe(p)==='paquete'?'Paquete'+(p.unidadesPaquete?' x'+p.unidadesPaquete:''):'Unidad'}</td>
      <td style="font-weight:600;color:${p.stock<=(settings.alertas.minStock||3)?'#dc2626':'#059669'};">${p.stock}${p.stockFijo?' ↺':''}</td>
      <td>${p.costo>0?moneda()+' '+p.costo.toFixed(2):'—'}</td>
      <td style="font-weight:700;">${moneda()} ${precioListaPromo(p).toFixed(2)}</td>
    </tr>`).join('')}
    </tbody>
  </table></body></html>`;
  const blob=new Blob([html],{type:'application/vnd.ms-excel;charset=utf-8;'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='productos_bodega.xls';
  a.click();
  showToast('Exportado a Excel exitosamente','success');
  _enfocarBusquedaProductos();
}

