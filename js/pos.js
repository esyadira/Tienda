// ========================================
// POS
// ========================================
function renderPOSProducts(q,cat){
  const g=document.getElementById('posProductGrid');
  let list=productos;
  if(q)list=list.filter(p=>p.nombre.toLowerCase().includes(q)||p.codigo.toLowerCase().includes(q));
  if(cat)list=list.filter(p=>p.cat===cat);
  g.innerHTML=list.map(p=>{
    const agotado = p.stock<=0;
    const style = agotado ? 'opacity:0.45;filter:grayscale(80%);cursor:not-allowed;pointer-events:none;' : 'cursor:pointer;';
    return `
    <div class="prod-card" onclick="${!agotado?(p.esPeso?`openPesoModal(${p.id})`:`addToCart(${p.id})`):'void(0)'}" style="${style}position:relative;">
      ${agotado?'<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10;background:rgba(0,0,0,0.65);color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;white-space:nowrap;">AGOTADO</div>':''}
      <div class="prod-card-img">${cintaPromoPOS(p)}${p.img?`<img src="${p.img}" style="width:100%;height:100%;object-fit:contain;">`:`<i class="fa fa-box" style="font-size:28px;color:var(--text3);"></i>`}${unidadDe(p)==='kg'&&!agotado?'<div style="position:absolute;top:4px;right:4px;background:var(--accent);color:#000;font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;">kg</div>':''}${unidadDe(p)==='paquete'&&!agotado?`<div style="position:absolute;top:4px;right:4px;background:var(--accent);color:#000;font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;">paq${p.unidadesPaquete?' x'+p.unidadesPaquete:''}</div>`:''}</div>
      <div class="prod-card-body">
        <div class="prod-card-name" style="font-size:12px;">${p.nombre}</div>
        <div class="prod-card-footer" style="margin-top:6px;">
          <div class="prod-card-price">${moneda()} ${precioListaPromo(p).toFixed(2)}</div>
          <span class="prod-card-stock badge ${p.stock<=(settings.alertas.minStock||3)&&p.stock>0?'badge-yellow':p.stock<=0?'badge-red':'badge-green'}">${p.stock}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

let barcodeBuffer='';
let barcodeTimer=null;

// ========================================
// ESCÁNER GLOBAL: captura códigos de barra
// en cualquier parte de la página de ventas
// ========================================
(function() {
  let _barBuffer = '';
  let _barTimer = null;

  document.addEventListener('keydown', function(e) {
    // Solo actuar si estamos en la página de ventas
    const ventasPage = document.getElementById('page-ventas');
    if (!ventasPage || !ventasPage.classList.contains('active')) return;

    // Si hay un modal abierto, no interceptar
    const modalOpen = document.querySelector('.modal-overlay.show');
    if (modalOpen) return;

    // Si el foco está en otro input (distinto al buscador POS), no interceptar
    const focused = document.activeElement;
    const posSearchInput = document.querySelector('#page-ventas .table-search input');
    if (focused && focused !== document.body && focused !== posSearchInput &&
        (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA' || focused.tagName === 'SELECT')) {
      return;
    }

    // Solo caracteres imprimibles y Enter
    if (e.key === 'Enter') {
      if (_barBuffer.length >= 4) {
        const codigo = _barBuffer.trim();
        _barBuffer = '';
        clearTimeout(_barTimer);
        _procesarCodigoEscaneado(codigo);
      } else {
        _barBuffer = '';
      }
      return;
    }

    if (e.key.length === 1) {
      _barBuffer += e.key;
      clearTimeout(_barTimer);
      // Si no hay Enter en 120ms, asumir escritura manual y limpiar
      _barTimer = setTimeout(() => { _barBuffer = ''; }, 120);
    }
  });

  window._procesarCodigoEscaneado = function(codigo) {
    const prod = productos.find(p =>
      p.codigo && p.codigo.toLowerCase() === codigo.toLowerCase()
    );
    if (prod) {
      if (prod.esPeso) {
        openPesoModal(prod.id);
      } else {
        addToCart(prod.id);
        // Limpiar el buscador si tenía algo
        const inp = document.querySelector('#page-ventas .table-search input');
        if (inp) { inp.value = ''; renderPOSProducts('', document.getElementById('posCatFilter').value); }
      }
    } else if (/^\d+$/.test(codigo)) {
      // Código numérico no encontrado: abrir modal nuevo producto
      openNuevoProducto();
      setTimeout(() => {
        const barcodeField = document.getElementById('prodBarcode');
        if (barcodeField) { barcodeField.value = codigo; checkBarcodeExists(codigo); }
      }, 150);
    }
  };
})();

function filterPOSProducts(inp){
  const q=inp.value.toLowerCase();
  const cat=document.getElementById('posCatFilter').value;
  renderPOSProducts(q,cat);
  // Auto-scan: si el input tiene exactamente el código de un producto, agregar al carrito
  const exact=productos.find(p=>p.codigo.toLowerCase()===inp.value.toLowerCase()||(inp.value.length>=8&&p.nombre.toLowerCase()===inp.value.toLowerCase()));
  if(exact&&inp.value.length>=6){
    clearTimeout(barcodeTimer);
    barcodeTimer=setTimeout(()=>{
      if(document.querySelector('#page-ventas .table-search input').value===inp.value){
        if(exact.esPeso){openPesoModal(exact.id);}
        else{addToCart(exact.id);inp.value='';renderPOSProducts('',document.getElementById('posCatFilter').value);}
        enfocarBuscarPOS(); // 👈 Agrega esta línea
      }
    },80);
  } else if(inp.value.length>=6 && !exact && /^\d+$/.test(inp.value)){
    // Solo si es un código de barras puro (solo dígitos) que no existe, abrir modal
    clearTimeout(barcodeTimer);
    barcodeTimer=setTimeout(()=>{
      if(document.querySelector('#page-ventas .table-search input').value===inp.value){
        const codigoEscaneado = inp.value;
        inp.value='';
        renderPOSProducts('',document.getElementById('posCatFilter').value);
        openNuevoProducto();
        setTimeout(()=>{
          const barcodeField = document.getElementById('prodBarcode');
          if(barcodeField){ barcodeField.value = codigoEscaneado; checkBarcodeExists(codigoEscaneado); }
        }, 150);
      }
    },300);
  }
}

function filterPOSByCategory(cat){
  const q=document.querySelector('#page-ventas .table-search input').value.toLowerCase();
  renderPOSProducts(q,cat);
  enfocarBuscarPOS();
}

function clearPOSFilter(){
  const inp=document.querySelector('#page-ventas .table-search input');
  if(inp)inp.value='';
  const sel=document.getElementById('posCatFilter');
  if(sel)sel.value='';
  renderPOSProducts('','');
  enfocarBuscarPOS(); // 👈 Agrega esta línea
}

let currentPesoProductId=null;
function openPesoModal(id){
  const p=productos.find(x=>x.id===id);if(!p)return;
  currentPesoProductId=id;
  document.getElementById('pesoProductoNombre').textContent=p.nombre;
  let _txtKg=`Precio: ${moneda()} ${precioListaPromo(p).toFixed(2)} por kg`;
  if(promoVigente(p))_txtKg+=` (${promoEtiqueta(p,true)})`;
  document.getElementById('pesoPrecioPorKg').textContent=_txtKg;
  document.getElementById('pesoKgInput').value='';
  document.getElementById('pesoTotalPrecio').style.display='none';
  openModal('modalPeso');
  setTimeout(()=>document.getElementById('pesoKgInput').focus(),300);
}

function calcPrecioByPeso(){
  const p=productos.find(x=>x.id===currentPesoProductId);if(!p)return;
  const kg=parseFloat(document.getElementById('pesoKgInput').value)||0;
  const r=calcLinea(p,kg);
  const el=document.getElementById('pesoTotalPrecio');
  if(kg>0){el.style.display='block';el.textContent=`Total: ${moneda()} ${r.total.toFixed(2)} (${kg} kg)${r.tarifa==='promo'?' · promoción':''}`;}
  else el.style.display='none';
}

function agregarProductoPorPeso(){
  const p=productos.find(x=>x.id===currentPesoProductId);if(!p)return;
  const kg=parseFloat(document.getElementById('pesoKgInput').value)||0;
  if(!kg||kg<=0)return showToast('Ingresa el peso correctamente','error');
  const precioTotal=calcLinea(p,kg).total;
  const itemPeso={...p,id:p.id+'_peso_'+Date.now(),nombre:`${p.nombre} (${kg}kg)`,nombreBase:p.nombre,pesoKg:kg,precio:precioTotal,precioKgOrig:p.precio,qty:1,esPesoItem:true};
  carrito.push(itemPeso);
  recalcPrecioItem(itemPeso);
  renderCart();
  closeModal('modalPeso');
  showToast(`${p.nombre} (${kg}kg) agregado al carrito`,'success');
  enfocarBuscarPOS(); // 👈 Agrega esta línea
}

function addToCart(id){
  const prod=productos.find(p=>p.id===id);
  if(!prod||prod.stock<=0)return showToast('Sin stock disponible','error');
  const ex=carrito.find(c=>c.id===id);
  if(ex){
    if(ex.qty>=prod.stock)return showToast('Stock insuficiente','error');
    ex.qty++;
    recalcPrecioItem(ex);
    // Mover al frente del carrito para mostrar el último modificado primero
    const idx=carrito.indexOf(ex);
    if(idx>0){ carrito.splice(idx,1); carrito.unshift(ex); }
  } else {
    const nuevoItem={...prod,qty:1,precioBase:prod.precio};
    recalcPrecioItem(nuevoItem);
    carrito.unshift(nuevoItem); // Agregar al inicio
  }
  renderCart();
  enfocarBuscarPOS();
}

function removeFromCart(id){carrito=carrito.filter(c=>c.id!==id);renderCart();}
function changeQty(id,delta){
  const item=carrito.find(c=>c.id===id);
  if(!item)return;
  item.qty+=delta;
  if(item.qty<=0)carrito=carrito.filter(c=>c.id!==id);
  else recalcPrecioItem(item);
  renderCart();
}

// Aplica al ítem del carrito lo que le corresponde según su cantidad: precio normal, promoción (se activa sola
// al llegar a la cantidad, ej. 3x2).
// c.precio queda como precio unitario efectivo (total de la línea ÷ cantidad). Los artículos comunes no se tocan.
function recalcPrecioItem(c){
  const esPeso=!!c.esPesoItem;
  const baseP=esPeso?c.precioKgOrig:c.precioBase;
  if(baseP===undefined)return;
  const base={...c,precio:baseP};
  if(esPeso){
    const r=calcLinea(base,c.pesoKg);
    c.precio=r.total; c.tarifa=r.tarifa;
  } else {
    const r=calcLinea(base,c.qty);
    c.precio=r.total/c.qty; c.tarifa=r.tarifa;
  }
}

// Etiqueta de la promoción en la línea del precio del carrito ("S/. 0.25 c/u · 4 x S/. 1.00"):
// amarilla mientras la promoción todavía no se aplica y verde cuando ya se aplica
function promoLabelCarrito(c){
  const base=c.esPesoItem?c.precioKgOrig:c.precioBase;
  if(c.esArticuloComun||base===undefined) return '';
  const p={...c,precio:base};
  if(!promoVigente(p)) return '';
  if(unidadDe(p)==='kg'&&promoDe(p).tipo!=='precio') return '';
  return ` <span style="color:${c.tarifa==='promo'?'#10b981':'#eab308'};font-weight:700;">· ${promoEtiqueta(p,true)}</span>`;
}
// Precio original de una unidad, solo cuando se aplicó una promoción por cantidad (3x2, 3 x S/. 5...):
// en el ticket la columna Precio lleva ese precio y el ahorro se ve en el Importe
function precioOrigTicket(c){
  if(c.tarifa!=='promo'||c.esPesoItem||c.precioBase===undefined) return null;
  const pr=promoDe({...c,precio:c.precioBase});
  return (pr&&(pr.tipo==='nxm'||pr.tipo==='pack')) ? c.precioBase : null;
}
// Texto de la promoción para el ticket (solo si se aplicó): "4 x S/. 1.00", "3x2", "-10%"
function promoAplicadaTxt(c){
  if(c.tarifa!=='promo') return '';
  const base=c.esPesoItem?c.precioKgOrig:c.precioBase;
  if(base===undefined) return '';
  return promoEtiqueta({...c,precio:base},true);
}

function renderCart(){
  const el=document.getElementById('carritoItems');
  if(!carrito.length){
    el.innerHTML=`<div style="text-align:center;padding:40px 20px;color:var(--text3);"><i class="fa fa-cart-shopping" style="font-size:32px;display:block;margin-bottom:8px;opacity:0.3;"></i><p style="font-size:13px;">Agrega productos al carrito</p></div>`;
  }else{
    el.innerHTML=carrito.map(c=>`
      <div class="carrito-item">
        <div class="ci-img">${c.img?`<img src="${c.img}" style="width:40px;height:40px;object-fit:cover;border-radius:7px;">`:c.emoji?`<span style="font-size:18px;">${c.emoji}</span>`:`<i class="fa fa-box" style="font-size:16px;color:var(--text3);"></i>`}</div>
        <div class="ci-info"><strong>${c.nombre}</strong><small>${moneda()} ${c.precio.toFixed(2)} c/u${promoLabelCarrito(c)}</small></div>
        <div class="ci-qty">
          <div class="qty-btn" onclick="changeQty(${JSON.stringify(c.id).replace(/"/g,"'") },-1)"><i class="fa fa-minus"></i></div>
          <span class="qty-val">${c.qty}</span>
          <div class="qty-btn" onclick="changeQty(${JSON.stringify(c.id).replace(/"/g,"'") },1)"><i class="fa fa-plus"></i></div>
        </div>
        <span class="ci-price">${moneda()} ${(c.precio*c.qty).toFixed(2)}</span>
        <i class="fa fa-xmark ci-del" onclick="removeFromCart(${JSON.stringify(c.id).replace(/"/g,"'") })"></i>
      </div>
    `).join('');
  }
  const total=calcularTotalCarrito();
  document.getElementById('cartTotal').textContent=`${moneda()} ${total.toFixed(2)}`;
  if(typeof actualizarFilaMayoreo==='function')actualizarFilaMayoreo();
  if(selectedClientePOS)updateBottleZoneVisibility();
}

function clearCart(){
  carrito=[];
  selectedClientePOS=null;
  clearClientSel();
  renderCart();
  enfocarBuscarPOS(); // 👈 Agrega esta línea
}

// Abre directamente la ventana de cobro con el método de pago preseleccionado
function abrirCobroDirecto(metodo) {
  if(!carrito.length) {
    showToast('El carrito está vacío', 'error');
    return;
  }
  selectedPayMethod = pagoActivo(metodo) ? metodo : 'efectivo';
  procesarVenta();
}

// Cambia el método de pago dentro de la ventana de cobro (efectivo, yape, tarjeta o mixto)
function setMetodoCobro(m) {
  if (!pagoActivo(m)) m = 'efectivo'; // el método fue desactivado en Configuración
  selectedPayMethod = m;
  document.querySelectorAll('.cobro-metodo').forEach(b => b.classList.toggle('selected', b.dataset.metodo === m));
  document.querySelectorAll('.pay-method').forEach(b => b.classList.toggle('selected', b.dataset.metodo === m));

  const mixto = m === 'mixto';
  const tarjeta = m === 'tarjeta';
  document.getElementById('cobroSimple').style.display = (mixto || tarjeta) ? 'none' : 'block';
  document.getElementById('cobroTarjeta').style.display = tarjeta ? 'block' : 'none';
  document.getElementById('cobroMixto').style.display = mixto ? 'block' : 'none';
  const labels = {
    efectivo: '¿Cuánto te dio el cliente?',
    yape: 'Monto pagado por Yape'
  };
  if (!mixto && !tarjeta) document.getElementById('cobroLabelMonto').textContent = labels[m] || labels.efectivo;

  // Tarjeta: se cobra el total exacto, no se pide monto (solo referencia opcional)
  if (tarjeta) document.getElementById('cobroMonto').value = pendingVentaTotal.toFixed(2);

  calcCambio();
}

// Monto en cada campo del pago mixto
function leerMixto() {
  const n = (id, m) => (pagoActivo(m) ? Math.max(0, parseFloat(document.getElementById(id).value) || 0) : 0);
  return { efectivo: n('mixtoEfectivo', 'efectivo'), yape: n('mixtoYape', 'yape'), tarjeta: n('mixtoTarjeta', 'tarjeta') };
}

// Total que el cliente está pagando según el método elegido
function getDadoCobro() {
  if (selectedPayMethod === 'mixto') {
    const m = leerMixto();
    return m.efectivo + m.yape + m.tarjeta;
  }
  return parseFloat(document.getElementById('cobroMonto').value) || 0;
}

// Botón "Resto": completa ese campo con lo que falta para llegar al total
function mixtoResto(id) {
  const ids = [['mixtoEfectivo','efectivo'], ['mixtoYape','yape'], ['mixtoTarjeta','tarjeta']]
    .filter(x => pagoActivo(x[1])).map(x => x[0]);
  const otros = ids.filter(x => x !== id).reduce((a, x) => a + (parseFloat(document.getElementById(x).value) || 0), 0);
  const resto = Math.max(0, pendingVentaTotal - otros);
  document.getElementById(id).value = resto > 0 ? resto.toFixed(2) : '';
  calcCambio();
}

// CLIENT SEARCH POS
function searchClientPOS(q){
  const dd=document.getElementById('clientDropdown');
  const ql=q.toLowerCase();
  if(!ql){dd.style.display='none';return;}
  const matches=clientes.filter(c=>c.nombre.toLowerCase().includes(ql)||c.tel.includes(ql));
  let html=matches.map(c=>`
    <div onclick="selectClientePOS(${c.id})" style="padding:9px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;"
      onmouseenter="this.style.background='var(--surface2)'" onmouseleave="this.style.background=''">
      <span>${c.nombre}</span>
      <span style="font-size:11px;color:${c.deuda>0?'var(--warning)':'var(--text3)'};">${c.deuda>0?'Deuda '+moneda()+' '+c.deuda.toFixed(2):'Sin deuda'}</span>
    </div>`).join('');
  html+=`<div onclick="crearClienteRapido('${q.replace(/'/g,"\\'")}' )" style="padding:9px 12px;cursor:pointer;font-size:13px;color:var(--accent);"
    onmouseenter="this.style.background='var(--surface2)'" onmouseleave="this.style.background=''">
    <i class="fa fa-plus" style="margin-right:6px;"></i>Crear cliente "${q}"</div>`;
  dd.innerHTML=html;
  dd.style.display='block';
}

function selectClientePOS(id){
  const c = clientes.find(x => x.id === id);
  if(!c) return;
  
  selectedClientePOS = c;

  // 1. Ocultar el buscador y dropdown en el header
  const inp = document.getElementById('clientSearchInput');
  if(inp){ inp.value = ''; inp.style.display = 'none'; }
  document.getElementById('clientDropdown').style.display = 'none';

  // 2. Mostrar badge con info del cliente en el header
  const info = document.getElementById('clientSelInfo');
  document.getElementById('clientSelName').textContent = c.nombre;
  
  const botellas = c.botellas || 0;
  let deudaText = c.deuda > 0 ? `S/. ${c.deuda.toFixed(2)}` : '';
  if(botellas > 0) deudaText += (deudaText ? ' · ' : '') + `🍾 ${botellas}`;
  document.getElementById('clientSelDeuda').textContent = deudaText;
  
  info.style.display = 'flex';

  // Mostrar zona de botellas/notas si aplica
  document.getElementById('bottleNoteZone').style.display = 'block';
  updateBottleZoneVisibility();
}

function clearClientSel() {
  selectedClientePOS = null;

  // Mostrar el input de búsqueda en el header
  const inp = document.getElementById('clientSearchInput');
  if (inp) {
    inp.value = '';
    inp.style.display = '';
  }

  // Ocultar el badge de cliente seleccionado
  const info = document.getElementById('clientSelInfo');
  if (info) info.style.display = 'none';

  // Ocultamos la línea de Botella y Nota
  const bz = document.getElementById('bottleNoteZone');
  if (bz) bz.style.display = 'none';
  
  // Resetear el botón de botella visualmente si existe
  const btn = document.getElementById('bottleToggleBtn');
  const icon = document.getElementById('bottleIcon');
  if (btn && icon) {
    btn.style.background = 'var(--surface3)';
    btn.style.borderColor = 'var(--border)';
    btn.style.color = 'var(--text3)';
    icon.className = 'fa fa-square';
  }
}

function cartHasGaseosas(){
  return carrito.some(c=>c.cat==='Gaseosas'||(c.nombre&&(c.nombre.toLowerCase().includes('gaseosa')||c.nombre.toLowerCase().includes('inca kola')||c.nombre.toLowerCase().includes('coca cola')||c.nombre.toLowerCase().includes('pepsi')||c.nombre.toLowerCase().includes('sprite')||c.nombre.toLowerCase().includes('fanta'))));
}

// Reemplaza la función cartHasBebidas() con esta:

function cartHasBebidas(){
  // SOLO mostrar mensaje de botella si el producto tiene categoría "Gaseosas"
  return carrito.some(c => c.cat === 'Gaseosa');
}

// Reemplaza la función updateBottleZoneVisibility() con esta:

function updateBottleZoneVisibility(){
  if(!selectedClientePOS)return;
  const noteZone = document.getElementById('bottleNoteZone');
  if(!noteZone)return;
  
  // SOLO mostrar la zona de botella si hay productos con categoría "Gaseosas"
  const tieneGaseosas = cartHasBebidas();
  
  noteZone.style.display = tieneGaseosas ? 'block' : 'none';
  
  // Mostrar información de botellas que ya debe el cliente (si aplica)
  const c = selectedClientePOS;
  const botellas = c.botellas || 0;
  const infoDiv = document.getElementById('bottleDebtInfo');
  if(infoDiv){
    if(botellas > 0 && tieneGaseosas){
      infoDiv.style.display = 'block';
      infoDiv.textContent = `🍾 Este cliente debe ${botellas} botella(s)`;
    } else {
      infoDiv.style.display = 'none';
    }
  }
}

function toggleBottleDebt() {
  // Cambiamos el estado (si era true pasa a false y viceversa)
  bottleOwed = !bottleOwed;
  
  const btn = document.getElementById('bottleToggleBtn');
  const icon = document.getElementById('bottleIcon');
  
  if (bottleOwed) {
    // ESTADO: DEBE BOTELLA (Marcado)
    btn.style.background = 'rgba(245,158,11,0.15)';
    btn.style.borderColor = 'var(--accent)';
    btn.style.color = 'var(--accent)';
    icon.className = 'fa fa-check-square'; // Icono marcado
  } else {
    // ESTADO: NO DEBE (Desmarcado / Trajo botella)
    btn.style.background = 'var(--surface3)';
    btn.style.borderColor = 'var(--border)';
    btn.style.color = 'var(--text3)';
    icon.className = 'fa fa-square'; // Icono vacío
  }
}

function crearClienteRapido(nombre){
  const nuevo={id:Date.now(),nombre:nombre.trim(),tel:'---',deuda:0,limite:200,ultima:new Date().toLocaleDateString('en-CA'),historial:[]};
  clientes.push(nuevo);
  renderClients();
  selectClientePOS(nuevo.id);
  showToast('Cliente creado: '+nuevo.nombre,'success');
}

// Modifica la función procesarVenta
function procesarVenta(){
  if(!carrito.length) return showToast('El carrito está vacío','error');
  const total=calcularTotalCarrito();
  pendingVentaTotal=total;
  document.getElementById('cobroTotal').textContent=`${moneda()} ${total.toFixed(2)}`;
  const totalArticulos = carrito.reduce((a, c) => a + (c.qty || 0), 0);
  const elArt = document.getElementById('cobroTotalArticulos'); if (elArt) elArt.textContent = totalArticulos;
  const clientInfo=selectedClientePOS?`Cliente: ${selectedClientePOS.nombre}`:'Venta sin cliente';
  document.getElementById('cobroClienteInfo').textContent=clientInfo;
  // Con cliente: empezar en 0 para que elija cuánto paga; sin cliente: poner total exacto
  if(selectedClientePOS){
    document.getElementById('cobroMonto').value='0';
  } else {
    document.getElementById('cobroMonto').value=total.toFixed(2);
  }
  ['mixtoEfectivo','mixtoYape','mixtoTarjeta'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('cobroResultado').style.display='none';

  // Reinicia referencia de tarjeta y nota de la venta
  const refEl = document.getElementById('cobroReferencia'); if (refEl) refEl.value = '';
  const mixRefEl = document.getElementById('mixtoTarjetaRef'); if (mixRefEl) mixRefEl.value = '';
  const notaEl = document.getElementById('cobroNotaTexto'); if (notaEl) notaEl.value = '';
  const notaBox = document.getElementById('cobroNotaBox'); if (notaBox) notaBox.style.display = 'none';

  actualizarBotonesCobro();
  aplicarFormasPago();
  setMetodoCobro(selectedPayMethod || 'efectivo');
  
  openModal('modalCobro');
  setTimeout(() => { document.getElementById('cobroMonto').blur(); }, 120);
}
function setMonto(v){
  document.getElementById('cobroMonto').value=v;
  calcCambio();
}

// Muestra/oculta el cuadro de nota dentro de la ventana de cobro (botón o tecla F4)
function toggleCobroNota(){
  const box = document.getElementById('cobroNotaBox');
  if (!box) return;
  const abrir = box.style.display === 'none';
  box.style.display = abrir ? 'block' : 'none';
  if (abrir) setTimeout(() => document.getElementById('cobroNotaTexto').focus(), 80);
}

function calcCambio(){
  const total=pendingVentaTotal;
  const dado=getDadoCobro();
  const res=document.getElementById('cobroResultado');
  res.style.display='block';
  const estilo=(bg,bd,col)=>{res.style.background=bg;res.style.border='1px solid '+bd;res.style.color=col;};

  // Tarjeta: siempre se cobra el total exacto, no hace falta calcular vuelto/restante
  if(selectedPayMethod==='tarjeta'){
    estilo('rgba(16,185,129,0.1)','rgba(16,185,129,0.3)','var(--accent3)');
    res.innerHTML=`<i class="fa fa-check-circle" style="margin-right:6px;"></i>Cobro exacto: <strong>${moneda()} ${total.toFixed(2)}</strong>`;
    return;
  }

  if(dado===0){
    if(selectedPayMethod==='mixto'){
      estilo('rgba(249,115,22,0.1)','rgba(249,115,22,0.3)','var(--warning)');
      res.innerHTML=`<i class="fa fa-exclamation-circle" style="margin-right:6px;"></i>Ingresa los montos del pago`;
    } else if(selectedClientePOS){
      estilo('rgba(239,68,68,0.1)','rgba(239,68,68,0.3)','var(--danger)');
      res.innerHTML=`<i class="fa fa-user-clock" style="margin-right:6px;"></i>Fiar: ${moneda()} ${total.toFixed(2)}`;
    } else {
      estilo('rgba(249,115,22,0.1)','rgba(249,115,22,0.3)','var(--warning)');
      res.innerHTML=`<i class="fa fa-exclamation-circle" style="margin-right:6px;"></i>Ingresa el monto recibido`;
    }
  } else if(dado>=total){
    const vuelto=dado-total;
    if(selectedPayMethod==='mixto' && vuelto>leerMixto().efectivo+0.004){
      estilo('rgba(239,68,68,0.1)','rgba(239,68,68,0.3)','var(--danger)');
      res.innerHTML=`<i class="fa fa-triangle-exclamation" style="margin-right:6px;"></i>Sobran ${moneda()} ${vuelto.toFixed(2)} (solo se da vuelto del efectivo)`;
    } else {
      estilo('rgba(16,185,129,0.1)','rgba(16,185,129,0.3)','var(--accent3)');
      res.innerHTML=`<i class="fa fa-check-circle" style="margin-right:6px;"></i>Vuelto: <strong>${moneda()} ${vuelto.toFixed(2)}</strong>`;
    }
  } else {
    const falta=total-dado;
    estilo('rgba(249,115,22,0.1)','rgba(249,115,22,0.3)','var(--warning)');
    res.innerHTML=`<i class="fa fa-clock" style="margin-right:6px;"></i>Restante: <strong style="font-size:17px;">${moneda()} ${falta.toFixed(2)}</strong>`;
  }
}

function confirmarCobro(imprimir) {
  imprimir = imprimir !== false; // F1 (o llamado sin argumento) = imprime; F2 = no imprime
  const total = pendingVentaTotal || calcularTotalCarrito();
  let dado = getDadoCobro();
  const now = new Date();
  const clientName = selectedClientePOS ? selectedClientePOS.nombre : 'Público General';

  // --- REFERENCIA DE PAGO CON TARJETA (voucher / N° de aprobación) y NOTA DE LA VENTA ---
  const refSimple = document.getElementById('cobroReferencia');
  const refMixto = document.getElementById('mixtoTarjetaRef');
  const referenciaPago = (selectedPayMethod === 'tarjeta' && refSimple ? refSimple.value.trim() : '')
    || (selectedPayMethod === 'mixto' && refMixto ? refMixto.value.trim() : '');
  const notaVentaEl = document.getElementById('cobroNotaTexto');
  const notaVenta = notaVentaEl ? notaVentaEl.value.trim() : '';

  // --- PAGO MIXTO: validar y desglosar por método ---
  let metodoFinal = selectedPayMethod;
  let desglose = null;
  if (selectedPayMethod === 'mixto') {
    const m = leerMixto();
    if (dado <= 0) { showToast('Ingresa los montos del pago mixto', 'error'); return; }
    const exceso = Math.max(0, dado - total);
    if (exceso > m.efectivo + 0.004) { showToast('Los montos superan el total. Solo se puede dar vuelto del efectivo', 'error'); return; }
    const usados = ['efectivo', 'yape', 'tarjeta'].filter(k => m[k] > 0);
    if (usados.length === 1) {
      metodoFinal = usados[0]; // si solo usó un método, se registra como ese método
    } else {
      desglose = {
        efectivo: Math.round((m.efectivo - Math.min(exceso, m.efectivo)) * 100) / 100,
        yape: m.yape,
        tarjeta: m.tarjeta
      };
    }
  }

  // Sin cliente: si el monto está en 0 o sin llenar, asumir pago exacto del total
  if (!selectedClientePOS && dado === 0 && selectedPayMethod !== 'mixto') {
    dado = total;
    document.getElementById('cobroMonto').value = total.toFixed(2);
  }

  // Sin cliente y monto menor al total: bloquear (no se puede fiar sin cliente)
  if (!selectedClientePOS && dado < total) {
    showToast('⚠️ Sin cliente seleccionado, debe pagar el monto total o un monto mayor', 'error');
    return;
  }

  // --- LÓGICA DE CRÉDITO / FIADO ---
  if (selectedClientePOS && dado < total) {
    const fiar = total - dado;
    selectedClientePOS.deuda += fiar;
    selectedClientePOS.ultima = now.toLocaleDateString('en-CA');
    const histEntry = {
      fecha: now.toLocaleDateString('es-PE'),
      hora: now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
      productos: carrito.map(c => ({ nombre: c.nombre, qty: c.qty, precio: c.precio })),
      total: fiar,
      pagado: 0,
      pagadoAlComprar: dado
    };
    selectedClientePOS.historial.push(histEntry);
    renderClients();
    actualizarNotificaciones();
    actualizarDeudaAltaCount(); 
  }

  // --- LÓGICA DE BOTELLAS ---
  if (selectedClientePOS && bottleOwed === true && cartHasBebidas()) {
    if (!selectedClientePOS.botellas) selectedClientePOS.botellas = 0;
    const bebidasQty = carrito.filter(c => 
      c.cat === 'Bebidas' || c.cat === 'Gaseosas' || 
      (c.nombre && (c.nombre.toLowerCase().includes('cola') || c.nombre.toLowerCase().includes('kola')))
    ).reduce((a, c) => a + c.qty, 0);
    selectedClientePOS.botellas += bebidasQty || 1;
  }

  // --- LÓGICA DE NOTAS (ahora es un monto de dinero) ---
const notaInput = document.getElementById('cartNote');
let montoNota = notaInput ? parseFloat(notaInput.value) : 0;
if (montoNota > 0 && selectedClientePOS) {
  if (!selectedClientePOS.notas) selectedClientePOS.notas = [];
  // Guardamos el monto como nota con formato de dinero
  selectedClientePOS.notas.push({ 
    fecha: now.toLocaleDateString('es-PE'), 
    nota: `Dejó ${moneda()} ${montoNota.toFixed(2)}`  
  });
}
// Limpiar el campo después de guardar
if (notaInput) notaInput.value = '';

  // --- GENERACIÓN DE TICKET ---
  const vuelto = dado > total ? dado - total : 0;
  const carritoSnapshot = [...carrito.map(c => ({ ...c }))];
  const _pagoLabel = desglose ? 'Mixto' : metodoInfo(metodoFinal).label;
  const _pagoDetalle = desglose
    ? ['efectivo', 'yape', 'tarjeta'].filter(k => desglose[k] > 0).map(k => ({ label: metodoInfo(k).label, monto: desglose[k] }))
    : [];
  // El diseño del ticket se personaliza en Configuración → Ticket (js/ticket.js)
  const ticket = ticketHTML({
    fecha: now.toLocaleDateString('es-PE'),
    hora: now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    numero: String(ventasHistorial.length + 1).padStart(4, '0'),
    // productos por peso: el ticket muestra el nombre sin el "(0.5kg)" y los kilos en la columna Cant.
    items: carrito.map(c => ({
      nombre: (c.esPesoItem && c.nombreBase) ? c.nombreBase : c.nombre,
      qty: c.qty,
      precio: c.precio,
      kg: (c.esPesoItem && c.pesoKg) ? +(c.pesoKg * c.qty).toFixed(3) : null,
      promo: promoAplicadaTxt(c),
      precioOrig: precioOrigTicket(c)
    })),
    total, dado, vuelto,
    fiado: (dado < total && dado >= 0) ? total - dado : 0,
    cliente: clientName,
    vendedor: currentUser ? currentUser.nombre : 'Admin',
    pagoLabel: _pagoLabel,
    pagoDetalle: _pagoDetalle,
    referencia: referenciaPago,
    notaVenta: notaVenta
  }, ticketCfg(), (settings && settings.negocio) || {});

  // --- ACTUALIZACIÓN DE STOCK ---
  carrito.forEach(c => {
    const p = productos.find(x => x.id === c.id);
    if (p) p.stock = Math.max(0, (p.stock || 0) - c.qty);
  });

  // --- REGISTRO EN HISTORIAL ---
  const ventaRecord = {
    id: Date.now(),
    fecha: now.toLocaleDateString('es-PE'),
    fechaISO: now.toLocaleDateString('en-CA'),
    hora: now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    horaRaw: now.getHours(),
    productos: carritoSnapshot.map(c => ({ nombre: c.nombre, qty: c.qty, precio: c.precio, cat: c.cat || '' })),
    pagado: dado,
    metodoPago: metodoFinal,
    ...(desglose ? { desglose } : {}),
    ...(referenciaPago ? { referenciaPago } : {}),
    ...(notaVenta ? { notaVenta } : {}),
    items: carritoSnapshot.map(c => ({ nombre: c.nombre, cant: c.qty, precio: c.precio, cat: c.cat || 'Otros', promo: promoAplicadaTxt(c), precioOrig: precioOrigTicket(c) })),
    total: total,
    cliente: clientName,
    vendedor: currentUser ? currentUser.nombre : 'Admin'
  };
  
  ventasHistorial.push(ventaRecord);

  // --- LIMPIEZA Y ACTUALIZACIÓN ---
  
  // 1. Resetear datos de venta
  carrito = [];
  bottleOwed = null;
  if (document.getElementById('cartNote')) document.getElementById('cartNote').value = '';
  if (refSimple) refSimple.value = '';
  if (refMixto) refMixto.value = '';
  if (notaVentaEl) notaVentaEl.value = '';
  const notaBoxEl = document.getElementById('cobroNotaBox'); if (notaBoxEl) notaBoxEl.style.display = 'none';

  // 2. Limpiar selección de cliente (Oculta tarjeta azul y muestra buscador)
  clearClientSel();

  // 3. Actualizar Gráficos y Dashboard
  renderCategoryChart(); //
  actualizarDashboardReal(); //
  updateStockBajoCount();
  actualizarNotificaciones();

  // 4. Refrescar UI de productos y carrito
  renderCart();
  renderProdTable();
  renderProdGrid();
  renderPOSProducts();

  // 5. Guardar cambios en LocalStorage
  guardarTodoEnLocalStorage(); //

  // --- MOSTRAR RESULTADO ---
  closeModal('modalCobro');

  // F1 (Cobrar e Imprimir): manda el ticket a imprimir de una vez (por USB directo si hay
  // impresora conectada en modo "directa", o al diálogo del navegador si no).
  // F2 (Cobrar sin Imprimir): se salta este paso, así que tampoco se dispara el cajón de dinero
  // (el cajón se abre junto con el propio trabajo de impresión, ver imprimirDirecto en impresora.js).
  if (imprimir) {
    imprimirTicketHTML(ticket, ticketCfg().ancho || 80, ticketCfg());
  }

  if (settings.sistema.ticket) {
      document.getElementById('ticketContent').innerHTML = ticket;
      openModal('modalTicket');
  }
  showToast(imprimir ? 'Venta registrada e impresa ✓' : 'Venta registrada sin imprimir', 'success');
  // No enfocar el buscador tras la venta
}

// ========================================
// ATAJOS DE TECLADO DEL MODAL DE COBRO: F1 = cobrar e imprimir, F2 = cobrar sin imprimir, Esc = cancelar
// ========================================
document.addEventListener('keydown', function(e) {
  const modal = document.getElementById('modalCobro');
  if (!modal || !modal.classList.contains('show')) return;
  if (e.key === 'F1') { e.preventDefault(); confirmarCobro(true); }
  else if (e.key === 'F2') { e.preventDefault(); confirmarCobro(false); }
  else if (e.key === 'F4') { e.preventDefault(); toggleCobroNota(); }
  else if (e.key === 'Escape') { e.preventDefault(); closeModal('modalCobro'); }
});

