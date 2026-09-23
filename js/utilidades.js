// ========================================
// MODALS
// ========================================
function openModal(id){
  document.getElementById(id).classList.add('show');
  // No auto-enfocar ningún input para no mover la barra de escritura
}
function closeModal(id){
  document.getElementById(id).classList.remove('show');
  // No enfocar automáticamente ningún buscador al cerrar modal
  // para evitar abrir el teclado virtual o mover la barra de escritura
}
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show');});
});

// ========================================
// MISC
// ========================================
// Reduce y comprime cualquier foto (producto, vendedor, logo) a un dataURL liviano en JPEG.
// Se usa antes de mostrarla en pantalla y antes de subirla a Storage.
function comprimirImagenArchivo(file, maxPx=500, calidad=0.75){
  return new Promise((resolve)=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const im=new Image();
      im.onload=()=>{
        const r=Math.min(1,maxPx/Math.max(im.width,im.height));
        const c=document.createElement('canvas');
        c.width=Math.max(1,Math.round(im.width*r));
        c.height=Math.max(1,Math.round(im.height*r));
        c.getContext('2d').drawImage(im,0,0,c.width,c.height);
        resolve(c.toDataURL('image/jpeg',calidad));
      };
      im.onerror=()=>resolve(e.target.result); // si no se pudo procesar como imagen, se usa tal cual
      im.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function previewImg(input){
  const file=input.files[0];if(!file)return;
  // Se reduce a máx. 500px y se comprime para no llenar el almacenamiento con fotos pesadas de celular
  comprimirImagenArchivo(file,500,0.75).then(dataUrl=>{
    const imgEl=document.getElementById('imgPreview');
    imgEl.src=dataUrl;imgEl.style.display='block';
    const icon=document.getElementById('prodImgIcon');
    if(icon)icon.style.display='none';
  });
}

// Stock fijo diario: cada día el producto vuelve a su cantidad fija (se haya agotado o le haya sobrado).
// p.stockFijoFecha guarda el día en que se repuso por última vez. Un producto que tiene stock fijo pero
// todavía no tiene fecha (activado antes de este cambio) se repone si está en 0 y, si aún tiene stock, solo se anota el día.
function resetearStockFijo(){
  const hoy=new Date().toLocaleDateString('en-CA');
  let cambio=false;
  productos.forEach(p=>{
    if(!(p.stockFijo>0) || p.stockFijoFecha===hoy) return;
    if(p.stockFijoFecha===undefined && p.stock>0){ p.stockFijoFecha=hoy; cambio=true; return; }
    p.stock=p.stockFijo; p.stockFijoFecha=hoy; cambio=true;
  });
  if(cambio){
    renderProdTable();renderProdGrid();renderPOSProducts();updateStockBajoCount();actualizarNotificaciones();
    if(typeof guardarTodoEnLocalStorage==='function') guardarTodoEnLocalStorage(); // que la reposición no se pierda al recargar
  }
}

// Toast
function showToast(msg,type='success'){
  const toast=document.createElement('div');
  toast.style.cssText=`position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;font-weight:600;animation:fadeIn 0.3s ease;box-shadow:0 8px 24px rgba(0,0,0,0.4);display:flex;align-items:center;gap:8px;`;
  if(type==='success'){toast.style.background='rgba(16,185,129,0.15)';toast.style.border='1px solid rgba(16,185,129,0.4)';toast.style.color='var(--accent3)';toast.innerHTML=`<i class="fa fa-check-circle"></i> ${msg}`;}
  else{toast.style.background='rgba(239,68,68,0.15)';toast.style.border='1px solid rgba(239,68,68,0.4)';toast.style.color='var(--danger)';toast.innerHTML=`<i class="fa fa-circle-xmark"></i> ${msg}`;}
  document.body.appendChild(toast);
  setTimeout(()=>toast.remove(),3000);
}

// Date in dashboard
const dn=new Date();
const days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const dashDate=document.getElementById('dashDate');
if(dashDate)dashDate.textContent=`${days[dn.getDay()]}, ${dn.getDate()} de ${months[dn.getMonth()]} ${dn.getFullYear()}`;

