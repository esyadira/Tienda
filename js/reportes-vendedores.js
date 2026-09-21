// Helper: búsqueda genérica en cualquier tbody
function filtrarTablaGenerica(tbodyId, query) {
  const q = (query || '').toLowerCase().trim();
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
    tr.style.display = (!q || tr.textContent.toLowerCase().includes(q)) ? '' : 'none';
  });
}

function renderReportes(panelId) {
  const fecha = getRepFecha();
  const label = document.getElementById('repFechaLabel');
  if (label) label.textContent = getRepFechaLabel(fecha);
  
  if (!panelId) {
    const activeBtn = document.querySelector('.rep-tab-btn.active');
    if (activeBtn) {
      const m = activeBtn.getAttribute('onclick').match(/'([^']+)'/);
      panelId = m ? m[1] : 'rep-vendedores';
    } else {
      panelId = 'rep-vendedores';
    }
  }

  if (panelId === 'rep-dia') renderRepDia(fecha);
  else if (panelId === 'rep-vendedores') renderRepVendedores();
  else if (panelId === 'rep-cerveza') renderRepProducto(fecha, 'cerveza');
  else if (panelId === 'rep-helado') renderRepProducto(fecha, 'helado');
  else if (panelId === 'rep-yape') renderRepYape(fecha);
  else if (panelId === 'rep-inventario') renderRepInventario(fecha);
  else if (panelId === 'rep-salidas') renderRepSalidas();
}

// Agrega la nueva lógica para el reporte de vendedores:
function renderRepVendedores() {
  const fecha = getRepFecha();
  const selector = document.getElementById('repVendSelect');
  const currentVal = selector.value;

  // Construir mapa: nombre viejo en historial → nombre actual del vendedor
  // Para manejar el caso de que un vendedor fue renombrado
  const vendMap = {}; // nombreHistorial → nombreActual
  (vendedores || []).forEach(vObj => {
    const nombreActual = (vObj.nombre + ' ' + (vObj.apellido||'')).trim();
    vendMap[nombreActual.toLowerCase()] = nombreActual;
    // También mapear el usuario por si acaso
    if (vObj.usuario) vendMap[vObj.usuario.toLowerCase()] = nombreActual;
  });
  // Normalizar nombre: si existe en el mapa usar el nombre actual
  const normalizarVend = n => {
    const k = (n||'').toLowerCase();
    return vendMap[k] || n;
  };

  // Vendedores que aparecen en ventas (normalizados al nombre actual)
  const vendsEnVentas = [...new Set(ventasHistorial.map(v => normalizarVend(v.vendedor || 'Admin')).filter(Boolean))];
  const vendsRegistrados = (vendedores || []).map(v => (v.nombre + ' ' + (v.apellido||'')).trim()).filter(Boolean);
  // Solo mostrar vendedores que existen en la lista registrada (sin "Admin" inventado)
  const todosVends = [...new Set([...vendsEnVentas, ...vendsRegistrados])]
    .filter(n => vendsRegistrados.some(r => r.toLowerCase() === n.toLowerCase()) || vendsEnVentas.includes(n))
    .filter(n => n !== 'Admin' || vendsRegistrados.some(r => r.toLowerCase() === 'admin'))
    .sort();

  selector.innerHTML = '<option value="todos">Todos los usuarios</option>';
  todosVends.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    selector.appendChild(opt);
  });
  // Restaurar selección previa si sigue existiendo; si no, intentar con nombre normalizado
  const currentValNorm = normalizarVend(currentVal);
  if ([...selector.options].some(o => o.value === currentVal)) selector.value = currentVal;
  else if ([...selector.options].some(o => o.value === currentValNorm)) selector.value = currentValNorm;
  else selector.value = 'todos';

  // Leer el valor DESPUÉS de reconstruir el select
  const selectedVend = selector.value;

  const ventas = ventasHistorial.filter(v => {
    const coincideFecha = (v.fechaISO === fecha);
    const coincideVend = (selectedVend === 'todos' || normalizarVend(v.vendedor || 'Admin') === selectedVend);
    return coincideFecha && coincideVend && !v.esPagoPedidoProv;
  });

  let totalVendidoReal = 0;
  let totalFiado = 0;
  let lineasHTML = '';
  const tbody = document.getElementById('repVendTbody');

  if (ventas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text3);">No hay registros para este vendedor en la fecha seleccionada</td></tr>`;
    // Renderizar KPIs en cero
    const kpiCards = document.getElementById('repVendKpiCards');
    if (kpiCards) {
      // Calcular abonos y pagos proveedores incluso sin ventas
      let totalAbonosCero = 0;
      let totalProvCero = 0;
      const selectedVendCero = selector.value;
      clientes.forEach(c => {
        (c.pagos || []).filter(p => p.fechaISO === fecha && (selectedVendCero === 'todos' || (p.vendedor || 'Admin') === selectedVendCero)).forEach(p => {
          totalAbonosCero += p.monto || 0;
        });
      });
      pagosProveedoresHistorial.filter(pp => pp.fechaISO === fecha && (selectedVendCero === 'todos' || (pp.vendedor || 'Admin') === selectedVendCero)).forEach(pp => {
        totalProvCero += parseFloat(pp.monto) || 0;
      });
      kpiCards.innerHTML = `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;position:relative;overflow:hidden;">
          <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(16,185,129,0.06),transparent);pointer-events:none;"></div>
          <div style="width:34px;height:34px;border-radius:9px;background:rgba(16,185,129,0.15);color:#10b981;display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:10px;"><i class="fa fa-cash-register"></i></div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:3px;">Ingresos en Caja</div>
          <div style="font-size:19px;font-weight:800;color:#10b981;font-family:'JetBrains Mono',monospace;">${moneda()} 0.00</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px;">Total efectivamente cobrado</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;position:relative;overflow:hidden;">
          <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(239,68,68,0.06),transparent);pointer-events:none;"></div>
          <div style="width:34px;height:34px;border-radius:9px;background:rgba(239,68,68,0.15);color:var(--danger);display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:10px;"><i class="fa fa-clock-rotate-left"></i></div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:3px;">Pendiente de Cobro</div>
          <div style="font-size:19px;font-weight:800;color:var(--danger);font-family:'JetBrains Mono',monospace;">${moneda()} 0.00</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px;">Ventas fiadas / parciales</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;position:relative;overflow:hidden;">
          <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(124,58,237,0.06),transparent);pointer-events:none;"></div>
          <div style="width:34px;height:34px;border-radius:9px;background:rgba(124,58,237,0.15);color:#7c3aed;display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:10px;"><i class="fa fa-mobile-screen"></i></div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:3px;">Yape</div>
          <div style="font-size:19px;font-weight:800;color:#7c3aed;font-family:'JetBrains Mono',monospace;">${moneda()} 0.00</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px;">Pagos vía Yape</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;position:relative;overflow:hidden;">
          <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(245,158,11,0.06),transparent);pointer-events:none;"></div>
          <div style="width:34px;height:34px;border-radius:9px;background:rgba(245,158,11,0.15);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:10px;"><i class="fa fa-money-bill-wave"></i></div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:3px;">Efectivo</div>
          <div style="font-size:19px;font-weight:800;color:var(--accent);font-family:'JetBrains Mono',monospace;">${moneda()} 0.00</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px;">Pagos en efectivo</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;position:relative;overflow:hidden;">
          <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(14,165,233,0.06),transparent);pointer-events:none;"></div>
          <div style="width:34px;height:34px;border-radius:9px;background:rgba(14,165,233,0.15);color:#0ea5e9;display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:10px;"><i class="fa fa-credit-card"></i></div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:3px;">Tarjeta</div>
          <div style="font-size:19px;font-weight:800;color:#0ea5e9;font-family:'JetBrains Mono',monospace;">${moneda()} 0.00</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px;">Pagos con tarjeta</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;position:relative;overflow:hidden;">
          <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(59,130,246,0.06),transparent);pointer-events:none;"></div>
          <div style="width:34px;height:34px;border-radius:9px;background:rgba(59,130,246,0.15);color:#3b82f6;display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:10px;"><i class="fa fa-hand-holding-dollar"></i></div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:3px;">Abonos Cobrados</div>
          <div style="font-size:19px;font-weight:800;color:#3b82f6;font-family:'JetBrains Mono',monospace;">${moneda()} ${totalAbonosCero.toFixed(2)}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px;">Deudas cobradas hoy</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;position:relative;overflow:hidden;">
          <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(249,115,22,0.06),transparent);pointer-events:none;"></div>
          <div style="width:34px;height:34px;border-radius:9px;background:rgba(249,115,22,0.15);color:var(--warning);display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:10px;"><i class="fa fa-truck"></i></div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:3px;">Pagos Proveedores</div>
          <div style="font-size:19px;font-weight:800;color:var(--warning);font-family:'JetBrains Mono',monospace;">${moneda()} ${totalProvCero.toFixed(2)}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px;">Egresos a proveedores</div>
        </div>
      `;
    }
    // Actualizar contador a 0 cuando no hay ventas
    const vendCountElCero = document.getElementById('repVendCant');
    if (vendCountElCero) vendCountElCero.textContent = '0 líneas';
    return;
  }

  ventas.slice().reverse().forEach(v => {
    const vendName = normalizarVend(v.vendedor || 'Admin');
    const esFiadoTotal = (v.pagado === 0 && v.total > 0);
    const esFiadoParcial = (v.pagado > 0 && v.pagado < v.total);
    
    // Determinar el badge de método
    let metodoHTML = '';
    if (esFiadoTotal) {
      metodoHTML = '<span class="badge badge-red"></i> Fiado</span>';
    } else if (esFiadoParcial) {
      metodoHTML = metodoBadgeHTML(v.metodoPago);
    } else {
      metodoHTML = metodoBadgeHTML(v.metodoPago);
    }
    
    (v.items || v.productos || []).forEach((p, pIdx, prods) => {
      const subtotal = (p.precio * (p.cant || p.qty || 1));
      const pagado = Math.min(v.pagado ?? v.total ?? 0, v.total ?? 0);
      const esFiadoTotal = pagado === 0 && v.total > 0;
      const esFiadoParcial = pagado > 0 && pagado < v.total;

      // FIFO: calcular cuánto del pago le corresponde a este producto
      let cubierto = subtotal;
      let pendiente = 0;
      if (esFiadoParcial) {
        let pagadoHastaAntes = 0;
        for (let i = 0; i < pIdx; i++) {
          const prev = prods[i];
          pagadoHastaAntes += (prev.precio * (prev.cant || prev.qty || 1));
        }
        const restoPagado = Math.max(0, pagado - pagadoHastaAntes);
        cubierto = Math.min(restoPagado, subtotal);
        pendiente = subtotal - cubierto;
      }

      let montoHTML = '';
      if (esFiadoTotal) {
        montoHTML = `<span style="color: var(--text3); text-decoration: line-through; font-weight: 600;">${moneda()} ${subtotal.toFixed(2)}</span>`;
        totalFiado += subtotal;
      } else if (esFiadoParcial) {
        if (cubierto >= subtotal - 0.004) {
          // Totalmente pagado
          montoHTML = `<span style="font-weight:700; color:${metodoColorMonto(v.metodoPago)};">${moneda()} ${subtotal.toFixed(2)}</span>`;
          totalVendidoReal += subtotal;
        } else if (cubierto <= 0.004) {
          // Sin pagar nada
          montoHTML = `<span style="color: var(--text3); text-decoration: line-through; font-weight: 600;">${moneda()} ${subtotal.toFixed(2)}</span>`;
          totalFiado += subtotal;
        } else {
          // Parcialmente pagado: mostrar pagado + tachado total
          montoHTML = `
            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
              <span style="font-weight: 700; color: var(--accent);">${moneda()} ${cubierto.toFixed(2)}</span>
              <span style="color: var(--text3); text-decoration: line-through; font-size: 12px;">${moneda()} ${subtotal.toFixed(2)}</span>
            </div>`;
          totalVendidoReal += cubierto;
          totalFiado += pendiente;
        }
      } else {
        montoHTML = `<span style="font-weight:700; color:${metodoColorMonto(v.metodoPago)};">${moneda()} ${subtotal.toFixed(2)}</span>`;
        totalVendidoReal += subtotal;
      }

      const metodoTag = esFiadoTotal ? 'fiado' : (esFiadoParcial ? 'parcial' : (['yape','tarjeta','mixto'].includes(v.metodoPago) ? v.metodoPago : 'efectivo'));
      // Color de fila según estado de ESTA línea (lógica FIFO por producto)
      let rowBg;
      if (esFiadoTotal) {
        rowBg = 'background:rgba(100,116,139,0.12);';
      } else if (esFiadoParcial) {
        if (cubierto >= subtotal - 0.004) {
          rowBg = 'background:var(--surface);'; // pagado completo → blanco
        } else if (cubierto <= 0.004) {
          rowBg = 'background:rgba(100,116,139,0.12);'; // sin pagar nada → gris
        } else {
          rowBg = 'background:rgba(59,130,246,0.08);'; // pago parcial → azul
        }
      } else {
        rowBg = 'background:var(--surface);'; // venta completa → blanco
      }
      lineasHTML += `
        <tr class="vend-row" data-metodo="${metodoTag}" data-comp="${componentesVenta(v)}" data-producto="${(p.nombre||'').toLowerCase()}" data-cliente="${(v.cliente||'').toLowerCase()}" data-vendedor="${vendName.toLowerCase()}"
          style="${rowBg}">
          <td style="font-family:'JetBrains Mono'; font-size:12px; color:var(--text3);">${v.hora || '--:--'}</td>
          <td><span class="badge badge-yellow" style="font-size:10px;background:rgba(245,158,11,0.15);">${vendName}</span></td>
          <td style="font-size:12px; font-weight:600; color:var(--text);">${v.cliente !== 'Público General' ? v.cliente : 'Venta rápida'}</td>
          <td style="font-weight:400; font-size:13px;">${p.nombre}</td>
          <td style="text-align:center;"><span class="badge badge-blue">x${p.cant || p.qty || 1}</span></td>
          <td>${metodoHTML}</td>
          <td style="text-align:right;">${montoHTML}</td>
          <td style="text-align:center;"><button onclick="eliminarLineaVenta(${v.id}, ${pIdx})" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--danger);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;" title="Eliminar línea"><i class="fa fa-trash"></i></button></td>
        </tr>`;
    });
  });

  tbody.innerHTML = lineasHTML;
  // Contar filas de ventas (se actualizará después de agregar abonos y pagos)

    // ========== ABONOS DE DEUDA ==========
  const abonosDia = [];
  clientes.forEach(c => {
    (c.pagos || []).filter(p => {
      if (p.fechaISO !== fecha) return false;
      const abVend = normalizarVend(p.vendedor || 'Admin');
      return selectedVend === 'todos' || abVend === selectedVend;
    }).forEach(p => {
      abonosDia.push({
        cliente: c.nombre,
        fecha: p.fecha,
        fechaISO: p.fechaISO,
        hora: p.hora,
        monto: p.monto,
        metodo: p.metodo,
        vendedor: normalizarVend(p.vendedor || 'Admin')
      });
    });
  });

  if (abonosDia.length > 0) {
    // Separador visual
    const sepAbonos = `<tr style="background:rgba(59,130,246,0.06);">
        <td colspan="8" style="padding:8px 18px;border-top:2px dashed var(--border);border-bottom:1px solid var(--border);font-size:11px;color:#3b82f6;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
          <i class="fa fa-hand-holding-dollar" style="margin-right:8px;"></i> ABONOS DE DEUDA
        </td>
      </tr>`
    tbody.innerHTML += sepAbonos;
    
    abonosDia.forEach(ab => {
      const metodoBadge = ab.metodo === 'yape'
        ? `<span class="badge" style="background:rgba(124,58,237,0.15);color:#7c3aed;"><i class="fa fa-mobile-screen"></i> Yape</span>`
        : `<span class="badge badge-green"><i class="fa fa-money-bill"></i> Efectivo</span>`;
      
      const montoHTML = `<span style="font-weight:700; color:#3b82f6;">+ ${moneda()} ${ab.monto.toFixed(2)}</span>`;
      
      tbody.innerHTML += `
        <tr style="background:rgba(59,130,246,0.03);">
          <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text3);">${ab.hora || '—'}</td>
          <td><span class="badge" style="background:rgba(59,130,246,0.15);color:#3b82f6;font-size:10px;"><i class="fa fa-user-check"></i> ${ab.vendedor}</span></td>
          <td style="font-size:12px; font-weight:600; color:var(--text);">${ab.cliente}</td>
          <td style="font-size:12px;color:#3b82f6;"><i class="fa fa-hand-holding-dollar"></i> Abono de deuda</td>
          <td style="text-align:center;">—</td>
          <td>${metodoBadge}</td>
          <td style="text-align:right;">${montoHTML}</td>
          <td style="text-align:center;"><button onclick="eliminarAbonoIndividual(${JSON.stringify(ab.cliente)}, ${JSON.stringify(ab.fechaISO)}, ${ab.monto}, ${JSON.stringify(ab.hora||'—')})" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--danger);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;" title="Eliminar abono"><i class="fa fa-trash"></i></button></td>
        </tr>`;
    });
  }

  // Pagos a proveedores del día en vendedores
  const provVend = pagosProveedoresHistorial.filter(pp => {
    if (pp.fechaISO !== fecha) return false;
    const ppVend = normalizarVend(pp.vendedor || 'Admin');
    return selectedVend === 'todos' || ppVend === selectedVend;
  });
  if (provVend.length) {
    const sepProv = `<tr style="background:rgba(249,115,22,0.06);">
        <td colspan="8" style="padding:8px 18px;border-top:2px dashed var(--border);border-bottom:1px solid var(--border);font-size:11px;color:var(--warning);font-weight:700;text-transform:uppercase;letter-spacing:1px;">
          <i class="fa fa-truck" style="margin-right:8px;"></i> PAGOS A PROVEEDORES
        </td></tr>`;
    const filasProv = provVend.map(pp => {
      const iniciales = pp.proveedor.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
      const metodoBadge = pp.metodo === 'yape'
        ? `<span class="badge" style="background:rgba(124,58,237,0.15);color:#7c3aed;"><i class="fa fa-mobile-screen"></i> Yape</span>`
        : `<span class="badge badge-green"><i class="fa fa-money-bill"></i> Efectivo</span>`;
      const items = pp.items||[{nombre:'Pedido proveedor', qty:1}];
      const montoTotal = parseFloat(pp.monto)||0;
      return items.map((it, itIdx) => {
        const montoDisplay = itIdx === 0
          ? `- ${moneda()} ${montoTotal.toFixed(2)}`
          : `<span style="color:var(--text3);font-size:11px;">↑ incluido</span>`;
        return `
        <tr style="background:rgba(249,115,22,0.03);">
          <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text3);">${pp.hora||'—'}</td>
          <td><span class="badge" style="background:rgba(249,115,22,0.15);color:var(--warning);font-size:10px;">${pp.vendedor || 'Admin'}</span></td>
          <td style="font-size:12px; font-weight:600; color:var(--text);">${pp.proveedor}</td>
          <td style="font-size:12px;color:var(--warning);"><i class="fa fa-truck"></i> ${it.nombre}</td>
          <td style="text-align:center;"><span class="badge badge-blue">x${it.qty||1}</span></td>
          <td>${metodoBadge}</td>
          <td style="text-align:right;font-weight:700;color:var(--warning);">${montoDisplay}</td>
          <td style="text-align:center;">${itIdx === 0 ? `<button onclick="eliminarPagoProvIndividual(${JSON.stringify(pp.fechaISO)}, ${JSON.stringify(pp.proveedor)}, ${montoTotal}, ${JSON.stringify(pp.hora||'—')})" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--danger);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;" title="Eliminar pago proveedor"><i class="fa fa-trash"></i></button>` : '—'}</td>
        </tr>`;
      }).join('');
    }).join('');
    tbody.innerHTML += sepProv + filasProv;
  }

  // Actualizar contador total (ventas + abonos + pagos proveedores)
  const totalFilasVentas = ventas.reduce((acc, v) => acc + (v.items || v.productos || []).length, 0);
  const totalFilasAbonos = abonosDia.length;
  const totalFilasProv = provVend.reduce((acc, pp) => acc + ((pp.items && pp.items.length) ? pp.items.length : 1), 0);
  const totalFilasVend = totalFilasVentas + totalFilasAbonos + totalFilasProv;
  const vendCountEl = document.getElementById('repVendCant');
  if (vendCountEl) vendCountEl.textContent = `${totalFilasVend} línea${totalFilasVend !== 1 ? 's' : ''}`;
  
  // Cálculo del Total General (Suma de lo cobrado y lo pendiente)
  const volumenTotal = totalVendidoReal + totalFiado;

  // ===== CALCULAR MÉTRICAS ADICIONALES =====
  // Ingresos Yape
  let totalYape = 0;
  let totalEfectivo = 0;
  let totalTarjeta = 0;
  let totalAbonosCobrados = 0;
  let totalPagosProveedores = 0;

  ventas.forEach(v => {
    const d = desgloseVenta(v);
    totalYape += d.yape;
    totalEfectivo += d.efectivo;
    totalTarjeta += d.tarjeta;
  });

  // Abonos cobrados filtrados por vendedor
  clientes.forEach(c => {
    (c.pagos || []).filter(p => p.fechaISO === fecha && (selector.value === 'todos' || (p.vendedor || 'Admin') === selector.value)).forEach(p => {
      totalAbonosCobrados += p.monto || 0;
    });
  });

  // Pagos a proveedores filtrados por vendedor
  pagosProveedoresHistorial.filter(pp => pp.fechaISO === fecha && (selector.value === 'todos' || (pp.vendedor || 'Admin') === selector.value)).forEach(pp => {
    totalPagosProveedores += parseFloat(pp.monto) || 0;
  });

  // ===== RENDERIZAR 6 KPI CARDS — igual que Yape: estado visual integrado en el render =====
  const kpiCards = document.getElementById('repVendKpiCards');
  if (kpiCards) {
    const mkCard = (fv, bg, ac, ic, label, valor, sub) => {
      const isA = repVendFiltroActivo === fv;
      return `<div onclick="toggleFiltroVend('${fv}');renderRepVendedores();"
        style="background:var(--surface);border:2px solid ${isA ? ac : 'var(--border)'};border-radius:var(--radius);padding:16px;position:relative;overflow:hidden;cursor:pointer;transition:all 0.15s;${isA ? `box-shadow:0 0 0 3px ${ac}22;` : ''}">
        <div style="position:absolute;inset:0;background:linear-gradient(135deg,${bg},transparent);pointer-events:none;"></div>
        <div style="width:34px;height:34px;border-radius:9px;background:${bg.replace('0.06','0.15')};color:${ac};display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:10px;">${ic}</div>
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:3px;">${label}${isA ? ' ✓' : ''}</div>
        <div style="font-size:19px;font-weight:800;color:${ac};font-family:'JetBrains Mono',monospace;">${valor}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:3px;">${sub}</div>
      </div>`;
    };
    const ingresoCaja = totalVendidoReal + totalAbonosCobrados - totalPagosProveedores;
    kpiCards.innerHTML =
      mkCard('cobrado','rgba(16,185,129,0.06)','#10b981','<i class="fa fa-cash-register"></i>','Ingresos en Caja',`${moneda()} ${ingresoCaja.toFixed(2)}`,'Ventas + Abonos - Proveedores') +
      mkCard('fiado','rgba(239,68,68,0.06)','var(--danger)','<i class="fa fa-clock-rotate-left"></i>','Pendiente Cobro',`${moneda()} ${totalFiado.toFixed(2)}`,'Fiado / parcial') +
      mkCard('yape','rgba(124,58,237,0.06)','#7c3aed','<i class="fa fa-mobile-screen"></i>','Yape',`${moneda()} ${totalYape.toFixed(2)}`,'Pagos vía Yape') +
      mkCard('efectivo','rgba(245,158,11,0.06)','var(--accent)','<i class="fa fa-money-bill-wave"></i>','Efectivo',`${moneda()} ${totalEfectivo.toFixed(2)}`,'Pagos efectivo') +
      mkCard('tarjeta','rgba(14,165,233,0.06)','#0ea5e9','<i class="fa fa-credit-card"></i>','Tarjeta',`${moneda()} ${totalTarjeta.toFixed(2)}`,'Pagos con tarjeta') +
      mkCard('abono','rgba(59,130,246,0.06)','#3b82f6','<i class="fa fa-hand-holding-dollar"></i>','Abonos Cobrados',`${moneda()} ${totalAbonosCobrados.toFixed(2)}`,'Deudas cobradas') +
      mkCard('proveedor','rgba(249,115,22,0.06)','var(--warning)','<i class="fa fa-truck"></i>','Pagos Proveedores',`${moneda()} ${totalPagosProveedores.toFixed(2)}`,'Egresos');
  }

  // ===== APLICAR FILTRO A LA TABLA SEGÚN repVendFiltroActivo =====
  if (repVendFiltroActivo) {
    const f = repVendFiltroActivo;
    // Filas de ventas
    document.querySelectorAll('#repVendTbody tr.vend-row').forEach(tr => {
      const m = tr.dataset.metodo;
      let show = false;
      const comp = tr.dataset.comp || '';
      if (f === 'cobrado') show = (m === 'efectivo' || m === 'yape' || m === 'tarjeta' || m === 'mixto' || m === 'parcial');
      else if (f === 'fiado') show = (m === 'fiado' || m === 'parcial');
      else if (f === 'yape') show = m === 'yape' || (m === 'mixto' && comp.includes('yape'));
      else if (f === 'efectivo') show = m === 'efectivo' || (m === 'mixto' && comp.includes('efectivo'));
      else if (f === 'tarjeta') show = m === 'tarjeta' || (m === 'mixto' && comp.includes('tarjeta'));
      tr.style.display = show ? '' : 'none';
    });
    // Separadores y filas de abonos/proveedores
    document.querySelectorAll('#repVendTbody tr:not(.vend-row)').forEach(tr => {
      const esAbonoBanner = tr.innerHTML.includes('ABONOS DE DEUDA');
      const esProvBanner  = tr.innerHTML.includes('PAGOS A PROVEEDORES');
      const esAbonoFila   = tr.innerHTML.includes('Abono de deuda');
      const esProvFila    = tr.innerHTML.includes('fa-truck') && !esProvBanner;
      if (f === 'abono')     tr.style.display = (esAbonoBanner || esAbonoFila) ? '' : 'none';
      else if (f === 'proveedor') tr.style.display = (esProvBanner || esProvFila) ? '' : 'none';
      else tr.style.display = 'none';
    });
  }
}

// ===== FILTRO POR KPI CARD =====
let repVendFiltroActivo = null;

function toggleFiltroVend(fv) {
  // Alterna: si ya estaba activo ese filtro, lo limpia; si no, lo activa
  repVendFiltroActivo = (repVendFiltroActivo === fv) ? null : fv;
}

function limpiarFiltrosVendedor() {
  document.getElementById('repVendSelect').value = 'todos';
  document.getElementById('repVendSearch').value = '';
  limpiarFiltroVend();
  renderRepVendedores();
  showToast('Filtros de vendedor limpiados', 'success');
}

function limpiarFiltroVend() {
  repVendFiltroActivo = null;
  document.querySelectorAll('#repVendKpiCards [data-kpi]').forEach(el => {
    el.style.outline = '';
    el.style.background = 'var(--surface)';
  });
  const badge = document.getElementById('repVendFiltroActivo');
  if (badge) badge.style.display = 'none';
  const s = document.getElementById('repVendSearch');
  if (s) s.value = '';
  document.querySelectorAll('#repVendTbody tr').forEach(tr => tr.style.display = '');
}

// ===== BUSCADOR DE TABLA =====
function filtrarTablaVend(q) {
  const term = q.toLowerCase().trim();
  const vendSelect = document.getElementById('repVendSelect');
  const vendFiltro = vendSelect ? vendSelect.value.toLowerCase() : 'todos';
  const kpiFiltro = repVendFiltroActivo;

  document.querySelectorAll('#repVendTbody tr.vend-row').forEach(tr => {
    const prod = tr.dataset.producto || '';
    const cli = tr.dataset.cliente || '';
    const vend = tr.dataset.vendedor || '';
    const metodo = tr.dataset.metodo || '';
    // También buscar en el texto completo de la fila para mayor cobertura
    const textFila = tr.textContent.toLowerCase();

    // Filtro por texto (si hay término) — busca en producto, cliente y texto completo
    const matchText = !term || prod.includes(term) || cli.includes(term) || textFila.includes(term);
    // Filtro por vendedor seleccionado
    const matchVend = vendFiltro === 'todos' || vend.includes(vendFiltro) || vendFiltro.includes(vend);
    // Filtro por KPI activo
    let matchKpi = true;
    const compFila = tr.dataset.comp || '';
    if (kpiFiltro === 'cobrado') matchKpi = (metodo === 'efectivo' || metodo === 'yape' || metodo === 'tarjeta' || metodo === 'mixto' || metodo === 'parcial');
    else if (kpiFiltro === 'fiado') matchKpi = (metodo === 'fiado' || metodo === 'parcial');
    else if (kpiFiltro === 'yape') matchKpi = metodo === 'yape' || (metodo === 'mixto' && compFila.includes('yape'));
    else if (kpiFiltro === 'efectivo') matchKpi = metodo === 'efectivo' || (metodo === 'mixto' && compFila.includes('efectivo'));
    else if (kpiFiltro === 'tarjeta') matchKpi = metodo === 'tarjeta' || (metodo === 'mixto' && compFila.includes('tarjeta'));
    else if (kpiFiltro === 'abono' || kpiFiltro === 'proveedor') matchKpi = false;

    tr.style.display = (matchText && matchVend && matchKpi) ? '' : 'none';
  });

  // Filas de separadores/abonos/proveedores: respetar el filtro KPI
  document.querySelectorAll('#repVendTbody tr:not(.vend-row)').forEach(tr => {
    if (!kpiFiltro) {
      // Sin KPI activo y sin texto: mostrar separadores
      tr.style.display = term ? 'none' : '';
    } else {
      const esAbonoBanner = tr.innerHTML.includes('ABONOS DE DEUDA');
      const esProvBanner = tr.innerHTML.includes('PAGOS A PROVEEDORES');
      const esAbonoFila = tr.innerHTML.includes('Abono de deuda');
      const esProvFila = tr.innerHTML.includes('fa-truck') && !esProvBanner;
      if (kpiFiltro === 'abono') tr.style.display = (esAbonoBanner || esAbonoFila) ? '' : 'none';
      else if (kpiFiltro === 'proveedor') tr.style.display = (esProvBanner || esProvFila) ? '' : 'none';
      else tr.style.display = 'none';
    }
  });
}

