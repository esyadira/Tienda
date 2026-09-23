// --- FUNCIONES DE RESPALDO ---
function exportarBackup() {
  const data = {
    productos, clientes, proveedores, vendedores,
    fecha: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Backup_Bodega_${new Date().toLocaleDateString().replace(/\//g,'-')}.json`;
  a.click();
  showToast('Copia de seguridad descargada', 'success');
}

function importarBackup(input) {
  const file = input.files[0];
  if (!file || !confirm('¿Restaurar? Se perderán los datos actuales no guardados.')) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      productos = data.productos;
      clientes = data.clientes;
      proveedores = data.proveedores;
      initApp(); // Refresca todo el sistema
      showToast('Datos cargados con éxito', 'success');
    } catch (err) { showToast('Archivo no válido', 'error'); }
  };
  reader.readAsText(file);
}

// Autoguardado cada hora
setInterval(() => {
  localStorage.setItem('bodega_auto_backup', JSON.stringify({ productos, clientes }));
  const el = document.getElementById('lastBackupTime');
  if(el) el.textContent = 'Última copia local: ' + new Date().toLocaleTimeString();
}, 3600000);

function reiniciarSistemaCompleto() {
  const conf1 = confirm("⚠️ ¡ATENCIÓN! Estás a punto de borrar TODO el sistema (productos, clientes, deudas y CATEGORÍAS). ¿Deseas continuar?");
  if (!conf1) return;

  const conf2 = prompt("Para confirmar la eliminación total, escribe la palabra: BORRAR");
  
  if (conf2 === "BORRAR") {
    // 1. Limpiar variables en memoria
    productos = [];
    clientes = [];
    proveedores = [];
    vendedores = [];
    categorias = []; // <--- Ahora las categorías también se eliminan
    
    // 2. Limpiar todo el almacenamiento local
    localStorage.clear();
    
    // 3. Notificar y recargar
    alert("El sistema ha sido restaurado de fábrica. Todo está en 0.");
    location.reload(); 
  } else {
    showToast("Reinicio cancelado", "error");
  }
}

function guardarTodoEnLocalStorage() {
  const datos = {
    productos: productos,
    clientes: clientes,
    proveedores: proveedores,
    vendedores: vendedores,
    ordenesCompra: ordenesCompra,
    listaCompras: listaCompras
  };
  let guardadoLocal = true;
  try {
    localStorage.setItem('bodega_data_permanente', JSON.stringify(datos));
    localStorage.setItem('bodega_ventas_historial', JSON.stringify(ventasHistorial));
    localStorage.setItem('bodega_pagos_proveedores', JSON.stringify(pagosProveedoresHistorial));
    localStorage.setItem('bodega_categorias', JSON.stringify(categorias));
    localStorage.setItem('bodega_cajas', JSON.stringify(cajasHistorial));
    localStorage.setItem('bodega_movimientos_caja', JSON.stringify(movimientosCaja));
    localStorage.setItem('bodega_ventas_pendientes', JSON.stringify(ventasPendientes));
    localStorage.setItem('bodega_devoluciones', JSON.stringify(devolucionesHistorial));
    // Marca de cuándo se guardó por última vez en ESTE dispositivo.
    // La usa supabase.js para decidir si lo local es más nuevo que la nube (en vez de
    // comparar solo cantidad de productos, que podía pisar cambios reales por error).
    localStorage.setItem('bodega_ultima_modificacion_local', new Date().toISOString());
  } catch (e) {
    // La memoria local del navegador se llenó (o algo falló) y NO se guardó nada de esto.
    // Antes esto fallaba en silencio y la app igual decía "guardado" — ahora se avisa siempre.
    guardadoLocal = false;
    console.error('No se pudo guardar en localStorage:', e);
    const msg = '⚠️ NO SE GUARDÓ localmente — memoria llena. Intentando subir a la nube igual. No cierres esta pestaña: exporta un backup ya (Configuración > Copia de seguridad) y borra fotos de productos.';
    if (typeof showToast === 'function') showToast(msg, 'error'); else alert(msg);
  }
  // ☁️ Sincronizar con Supabase automáticamente (con debounce de 1.5s).
  // Se intenta SIEMPRE, incluso si el guardado local falló: así, si hay internet,
  // el cambio no se pierde del todo aunque este navegador esté lleno.
  sbSyncDebounced();
  if (guardadoLocal) console.log("Datos guardados automáticamente.");
  return guardadoLocal;
}

