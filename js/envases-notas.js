function limpiarEnvases(id) {
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    if (cfgConfirm(`¿Confirmas que ${c.nombre} ya entregó todos sus envases?`)) {
        c.botellas = 0;
        guardarTodoEnLocalStorage();
        verCuentaCliente(id); // Recargar el modal
        showToast('Envases actualizados', 'success');
    }
}

function limpiarNotas(id) {
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    if (cfgConfirm(`¿Borrar todas las notas de este cliente?`)) {
        c.notas = [];
        guardarTodoEnLocalStorage();
        verCuentaCliente(id); // Recargar el modal
        showToast('Notas eliminadas', 'success');
    }
}

function restarEnvases(id) {
    const c = clientes.find(x => x.id === id);
    if (!c) return;

    const actual = c.botellas || 0;
    const cantidadStr = prompt(`El cliente debe ${actual} envases. ¿Cuántos está devolviendo ahora?`, "1");
    
    if (cantidadStr === null) return; // Cancelar
    const aRestar = parseInt(cantidadStr);

    if (isNaN(aRestar) || aRestar <= 0) {
        showToast('Ingresa un número válido', 'error');
        return;
    }

    if (aRestar > actual) {
        showToast('No puedes restar más de los que debe', 'error');
        return;
    }

    // Actualizar datos
    c.botellas -= aRestar;
    
    // Eliminar automáticamente las últimas N notas igual al número de envases restados
    if (c.notas && c.notas.length > 0) {
      const notasAEliminar = Math.min(aRestar, c.notas.length);
      c.notas.splice(c.notas.length - notasAEliminar, notasAEliminar);
    }
    
    guardarTodoEnLocalStorage();
    verCuentaCliente(id); // Recarga el modal para mostrar el nuevo número
    showToast(`Se restaron ${aRestar} envases. Pendientes: ${c.botellas}`, 'success');
}

function eliminarNotaIndividual(clienteId, notaIdx) {
    const c = clientes.find(x => x.id === clienteId);
    if (!c || !c.notas) return;

    // Confirmación simple para evitar errores
    if (cfgConfirm(`¿Eliminar esta nota: "${c.notas[notaIdx].nota}"?`)) {
        // Eliminamos solo la nota seleccionada por su posición en el arreglo
        c.notas.splice(notaIdx, 1);
        
        guardarTodoEnLocalStorage();
        verCuentaCliente(clienteId); // Refresca el modal al instante
        showToast('Nota eliminada', 'success');
    }
}

