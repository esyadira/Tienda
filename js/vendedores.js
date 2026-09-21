// ========================================
// VENDEDORES
// ========================================
const turnoLabels={mañana:'Mañana (6-11am)',mediodia:'Mediodía (11am-2:30pm)',tarde:'Tarde (2:30-7pm)',noche:'Noche (7pm-12am)'};
const turnoIcons={mañana:'☀️',mediodia:'⛅',tarde:'🌤️',noche:'🌙'};

function renderVendedores(){
  const tb=document.getElementById('vendTbody');
  const vc=document.getElementById('vendContador');
  if(vc){const t=vendedores.length;vc.textContent=`${t} vendedor${t!==1?'es':''}`; }
  tb.innerHTML=vendedores.length===0?`<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3);font-size:13px;"><i class="fa fa-id-badge" style="display:block;font-size:28px;margin-bottom:8px;opacity:0.3;"></i>Sin registros</td></tr>`:vendedores.map(v=>`<tr style="cursor:pointer;" onclick="editVendedor(${v.id})" onmouseenter="this.style.background='var(--surface2)'" onmouseleave="this.style.background=''">
    <td><div style="display:flex;align-items:center;gap:10px;">
      ${v.foto
        ? `<img src="${v.foto}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--border);flex-shrink:0;">`
        : `<div class="rs-avatar" style="width:36px;height:36px;font-size:12px;flex-shrink:0;">${(v.nombre[0]||'?')}${(v.apellido[0]||'?')}</div>`
      }
      <div><strong style="font-size:13px;">${v.nombre} ${v.apellido}</strong>${v.esAdmin?`<span style="display:inline-flex;align-items:center;gap:4px;margin-left:6px;background:rgba(245,158,11,0.15);color:var(--accent);font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;"><i class="fa fa-shield-halved"></i> Admin</span>`:''} ${v.telefono?`<div style="font-size:11px;color:var(--text3);">${v.telefono}</div>`:''}</div>
    </div></td>
    <td><span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent)">@${v.usuario}</span></td>
    <td><div style="display:flex;flex-wrap:wrap;gap:4px;">${v.esAdmin?`<span class="badge badge-yellow" style="font-size:10px;">Todos los permisos</span>`:((v.permisos||[]).map(p=>`<span class="badge badge-yellow" style="font-size:10px;">${p}</span>`).join(''))}</div></td>
    <td><span class="badge ${v.estado==='activo'?'badge-green':'badge-red'}">${v.estado}</span></td>
    <td><div class="action-btns" onclick="event.stopPropagation()">
      ${!v.esAdmin?`<div class="icon-btn del" title="Eliminar" onclick="delVend(${v.id})"><i class="fa fa-trash"></i></div>`
      :`<div class="icon-btn" title="Administrador — no se puede eliminar" style="opacity:0.3;cursor:not-allowed;"><i class="fa fa-lock"></i></div>`}
    </div></td>
  </tr>`).join('');
  // Actualizar selector del reporte de vendedores si está visible
  const sel = document.getElementById('repVendSelect');
  if (sel) {
    const prev = sel.value;
    sel.innerHTML = '<option value="todos">Todos los vendedores</option>';
    const vendsReg = (vendedores || []).map(v => (v.nombre && v.apellido) ? (v.nombre + ' ' + v.apellido).trim() : (v.nombre || v.usuario || '')).filter(Boolean);
    vendsReg.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      sel.appendChild(opt);
    });
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  }
}

function selectTurno(el,t){
  document.querySelectorAll('.turno-item').forEach(x=>x.classList.remove('selected'));
  el.classList.add('selected');selectedTurno=t;
}

function addVendedor(){
  const nombre=document.getElementById('vNombre').value.trim()||'Vendedor';
  const apellido=document.getElementById('vApellido').value.trim()||'Nuevo';
  const usuario=document.getElementById('vUsuario').value.trim()||'user'+Date.now();
  const password=document.getElementById('vPassword').value;
  const foto=document.getElementById('vFotoImg').src && document.getElementById('vFotoImg').style.display!=='none'
    ? document.getElementById('vFotoImg').src : '';
  
  if(!password || password.length < 4){
    showToast('La contraseña debe tener al menos 4 caracteres','error');
    return;
  }
  if(getUsuarios().find(u=>u.user===usuario)){
    showToast('Ya existe un usuario con ese nombre de usuario','error');
    return;
  }
  
  const perms=[];
  ['Dashboard','Punto de Venta','Productos','Clientes','Proveedores','Reportes','Vendedores','Configuración'].forEach((p,i)=>{
    if(document.getElementById('p'+(i+1)).checked)perms.push(p);
  });
  vendedores.push({
    id: Date.now(),
    nombre, apellido, usuario, password, foto,
    permisos: perms, estado: 'activo'
  });
  renderVendedores();
  closeModal('modalVendedor');
  guardarTodoEnLocalStorage();
  resetModalVendedorFooter();
  showToast(`Vendedor ${nombre} creado — puede iniciar sesión con usuario: ${usuario}`,'success');
}
function delVend(id){
  const v = vendedores.find(x=>x.id===id);
  if(v && v.esAdmin){ showToast('El Administrador del sistema no puede ser eliminado','error'); return; }
  if(cfgConfirm('¿Eliminar vendedor?')){vendedores=vendedores.filter(v=>v.id!==id);renderVendedores();guardarTodoEnLocalStorage();showToast('Vendedor eliminado','success');}
}

function editVendedor(id) {
  const v = vendedores.find(x=>x.id===id); if(!v) return;
  document.getElementById('modalVendedorTitle').textContent = 'Editar Vendedor';
  document.getElementById('vNombre').value = v.nombre;
  document.getElementById('vApellido').value = v.apellido;
  document.getElementById('vUsuario').value = v.usuario;
  document.getElementById('vPassword').value = v.password || '';
  document.getElementById('vTelefono').value = v.telefono || '';
  // Foto
  if (v.foto) {
    document.getElementById('vFotoImg').src = v.foto;
    document.getElementById('vFotoImg').style.display = 'block';
    document.getElementById('vFotoIcon').style.display = 'none';
    document.getElementById('vFotoQuitarBtn').style.display = 'block';
  } else {
    quitarFotoVend();
  }
  const permsNombres=['Dashboard','Punto de Venta','Productos','Clientes','Proveedores','Reportes','Vendedores','Configuración'];
  permsNombres.forEach((p,i)=>{
    const el=document.getElementById('p'+(i+1)); if(el) el.checked=(v.permisos||[]).includes(p);
  });
  // Footer modo edición
  const footer = document.querySelector('#modalVendedor .modal-footer');
  footer.innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('modalVendedor');resetModalVendedorFooter();">Cancelar</button>
    <button class="btn btn-danger btn-sm" onclick="toggleEstadoVendedor(${id})"><i class="fa fa-power-off"></i> ${v.estado==='activo'?'Desactivar':'Activar'}</button>
    <button class="btn btn-primary" onclick="guardarEditVendedor(${id})"><i class="fa fa-floppy-disk"></i> Guardar Cambios</button>
  `;
  openModal('modalVendedor');
}

function guardarEditVendedor(id) {
  const v = vendedores.find(x=>x.id===id); if(!v) return;
  const nuevoUsuario = document.getElementById('vUsuario').value.trim();
  const nuevaPass = document.getElementById('vPassword').value;
  const conflict = vendedores.find(x=>x.id!==id && x.usuario===nuevoUsuario);
  if(conflict){showToast('Ese nombre de usuario ya está en uso','error');return;}
  // Guardar el nombre anterior antes de modificarlo para actualizar el historial
  const nombreAnterior = (v.nombre + ' ' + (v.apellido||'')).trim();
  v.nombre = document.getElementById('vNombre').value.trim()||v.nombre;
  v.apellido = document.getElementById('vApellido').value.trim()||v.apellido;
  const nombreNuevo = (v.nombre + ' ' + (v.apellido||'')).trim();
  // Actualizar el campo vendedor en todas las ventas del historial que usen el nombre anterior
  if (nombreAnterior !== nombreNuevo) {
    ventasHistorial.forEach(venta => {
      if ((venta.vendedor || '').trim() === nombreAnterior) {
        venta.vendedor = nombreNuevo;
      }
    });
    // También actualizar en pagos de clientes
    clientes.forEach(c => {
      (c.pagos || []).forEach(p => {
        if ((p.vendedor || '').trim() === nombreAnterior) p.vendedor = nombreNuevo;
      });
    });
    // Y en pagos a proveedores
    pagosProveedoresHistorial.forEach(pp => {
      if ((pp.vendedor || '').trim() === nombreAnterior) pp.vendedor = nombreNuevo;
    });
  }
  v.usuario = nuevoUsuario||v.usuario;
  v.telefono = document.getElementById('vTelefono').value.trim();
  if(nuevaPass && nuevaPass.length>=4) v.password = nuevaPass;
  // Foto
  const fotoImg = document.getElementById('vFotoImg');
  v.foto = (fotoImg && fotoImg.style.display!=='none' && fotoImg.src) ? fotoImg.src : '';
  const permsNombres=['Dashboard','Punto de Venta','Productos','Clientes','Proveedores','Reportes','Vendedores','Configuración'];
  v.permisos = permsNombres.filter((p,i)=>document.getElementById('p'+(i+1))?.checked);
  renderVendedores();
  closeModal('modalVendedor');
  guardarTodoEnLocalStorage();
  resetModalVendedorFooter();
  showToast('Vendedor actualizado correctamente','success');
}

function toggleEstadoVendedor(id) {
  const v = vendedores.find(x=>x.id===id); if(!v) return;
  if(v.esAdmin && v.estado==='activo') { showToast('El Administrador del sistema no puede ser desactivado','error'); return; }
  v.estado = v.estado==='activo'?'inactivo':'activo';
  renderVendedores();
  closeModal('modalVendedor');
  guardarTodoEnLocalStorage();
  resetModalVendedorFooter();
  showToast(`Vendedor ${v.estado==='activo'?'activado':'desactivado'}`,'success');
}

function previewVendFoto(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('vFotoImg').src = e.target.result;
    document.getElementById('vFotoImg').style.display = 'block';
    document.getElementById('vFotoIcon').style.display = 'none';
    document.getElementById('vFotoQuitarBtn').style.display = 'block';
  };
  reader.readAsDataURL(input.files[0]);
}

function quitarFotoVend() {
  document.getElementById('vFotoImg').src = '';
  document.getElementById('vFotoImg').style.display = 'none';
  document.getElementById('vFotoIcon').style.display = 'block';
  document.getElementById('vFotoQuitarBtn').style.display = 'none';
  document.getElementById('vFotoInput').value = '';
}

function toggleTodosPermisos(val) {
  ['p1','p2','p3','p4','p5','p6','p7','p8'].forEach(id => {
    const el = document.getElementById(id); if(el) el.checked = val;
  });
}

function resetModalVendedorFooter() {
  document.getElementById('modalVendedorTitle').textContent = 'Nuevo Vendedor';
  const footer = document.querySelector('#modalVendedor .modal-footer');
  if(footer) footer.innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('modalVendedor');resetModalVendedorFooter();">Cancelar</button>
    <button class="btn btn-primary" onclick="addVendedor()"><i class="fa fa-floppy-disk"></i> Guardar Vendedor</button>
  `;
  // Limpiar campos
  ['vNombre','vApellido','vUsuario','vPassword','vTelefono'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  quitarFotoVend();
  // Permisos por defecto
  ['p1','p2','p3','p4','p5','p6','p7','p8'].forEach((id,i)=>{
    const el=document.getElementById(id); if(el) el.checked=(i<2);
  });
}

