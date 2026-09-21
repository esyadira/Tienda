function actualizarDeudaAltaCount() {
  const montoMaximo = parseFloat(settings.alertas.montoDeuda) || 100;
  const deudaAlta = clientes.filter(c => c.deuda > montoMaximo);
  const el = document.getElementById('deudaAltaCount');
  if (el) el.textContent = deudaAlta.length;
}

// Función para actualizar los botones del modal según si hay cliente o no
function actualizarBotonesCobro() {
  const btnFiar = document.getElementById('btnFiar');
  if (selectedClientePOS) {
    if (btnFiar) btnFiar.style.display = 'flex';
  } else {
    if (btnFiar) btnFiar.style.display = 'none';
  }
}

// Función para setear el monto exacto (total de la venta)
function setMontoExacto() {
  setMonto(pendingVentaTotal);
}

// procesarVenta() está definida arriba — no duplicar aquí

// Crear cliente automáticamente al presionar Enter
function crearClienteAlEnter(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const nombre = document.getElementById('clientSearchInput').value.trim();
    if (nombre && nombre.length > 0) {
      // Verificar si ya existe un cliente con ese nombre
      const existe = clientes.some(c => c.nombre.toLowerCase() === nombre.toLowerCase());
      if (!existe) {
        const nuevo = {
          id: Date.now(),
          nombre: nombre,
          tel: '---',
          deuda: 0,
          limite: 200,
          ultima: new Date().toLocaleDateString('en-CA'),
          historial: [],
          notas: [],
          botellas: 0,
          pagos: []
        };
        clientes.push(nuevo);
        renderClients();
        selectClientePOS(nuevo.id);
        showToast(`Cliente "${nombre}" creado correctamente`, 'success');
      } else {
        // Si ya existe, seleccionarlo
        const existeCliente = clientes.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
        if (existeCliente) {
          selectClientePOS(existeCliente.id);
          showToast(`Cliente "${nombre}" seleccionado`, 'success');
        }
      }
    }
  }
}

// Función para enfocar el buscador de productos en POS
function enfocarBuscarPOS() {
  // Desactivado: no enfocar automáticamente para no abrir el teclado
}

// Auto-refocus desactivado para no abrir el teclado automáticamente


function enfocarMontoCobro() {
  // No enfocar ni seleccionar para evitar abrir el teclado virtual
  // El monto ya viene precargado y el resultado se calcula automáticamente
}

