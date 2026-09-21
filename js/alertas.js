// Stock Bajo
function updateStockBajoCount(){
  const bajos=productos.filter(p=>p.stock<=(settings.alertas.minStock||3));
  const el=document.getElementById('stockBajoCount');
  if(el)el.textContent=bajos.length;
  // Refrescar notificaciones siempre que cambie el conteo de stock bajo
  if(typeof actualizarNotificaciones === 'function') actualizarNotificaciones();
}

function toggleStockBajoPanel() {
  const panel = document.getElementById('stockBajoPanel');
  if (panel.style.display === 'none') {
    // Filtramos los productos con stock bajo (menor o igual a 3)
    const bajos = productos.filter(p => p.stock <= (settings.alertas.minStock||3));
    
    document.getElementById('stockBajoList').innerHTML = bajos.length === 0
      ? '<tr><td colspan="3" style="text-align:center;padding:16px;color:var(--text3);">✅ Sin productos con stock bajo</td></tr>'
      : bajos.map(p => `
        <tr style="border-bottom: 1px solid var(--border);">
          <td style="padding:10px 12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              ${p.img ? `<img src="${p.img}" style="width:24px;height:24px;object-fit:cover;border-radius:4px;">` : `<div style="width:24px;height:24px;background:var(--surface3);border-radius:4px;display:flex;align-items:center;justify-content:center;"><i class="fa fa-image" style="font-size:10px;color:var(--text3);"></i></div>`}
              <span style="font-weight:500;">${p.nombre}</span>
            </div>
          </td>
          <td style="padding:10px 12px;">
            <span style="font-weight:700;color:var(--accent);">${moneda()} ${p.precio.toFixed(2)}</span>
          </td>
          <td style="padding:10px 12px; text-align:center;">
            <span class="badge badge-red" style="font-size:12px; padding:4px 10px;">${p.stock} unidades</span>
          </td>
        </tr>`).join('');
        
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}

function abrirModalStockBajo() {
    const umbral = settings.alertas.minStock || 3;
    const bajos = productos.filter(p => p.stock <= umbral);
    
    if (bajos.length === 0) {
        showToast('✅ No hay productos con stock bajo', 'success');
        return;
    }
    
    document.getElementById('stockBajoHeader').innerHTML = `
        <span style="font-size: 13px; color: var(--text3);">Total: ${bajos.length} producto(s) críticos (umbral: ≤ ${umbral})</span>
        <button class="btn btn-secondary btn-sm" onclick="exportStockBajoExcel()"><i class="fa fa-file-excel"></i> Exportar Excel</button>
    `;
    
    document.getElementById('stockBajoFooter').innerHTML = `
        <i class="fa fa-triangle-exclamation" style="color: var(--danger); margin-right: 8px;"></i>
        <span style="font-size: 12px; color: var(--text2);">Estos productos necesitan reposición. Haz clic en <i class="fa fa-plus"></i> para editar y aumentar stock.</span>
    `;
    
    document.getElementById('stockBajoTableWrapper').innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: var(--surface2); position: sticky; top: 0;">
                    <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: var(--text3);">Producto</th>
                    <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: var(--text3);">Precio</th>
                    <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: var(--text3);">Stock Actual</th>
                    <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: var(--text3);">Acción</th>
                </tr>
            </thead>
            <tbody>
                ${bajos.map(p => `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 12px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                ${p.img ? `<img src="${p.img}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 6px;">` : `<div style="width: 32px; height: 32px; background: var(--surface3); border-radius: 6px; display: flex; align-items: center; justify-content: center;"><i class="fa fa-box"></i></div>`}
                                <span style="font-weight: 500;">${p.nombre}</span>
                            </div>
                        </td>
                        <td style="padding: 12px;"><span style="font-weight: 700; color: var(--accent);">${moneda()} ${p.precio.toFixed(2)}</span></td>
                        <td style="padding: 12px; text-align: center;"><span class="badge badge-red" style="font-size: 12px; padding: 4px 10px;">${p.stock} uds.</span></td>
                        <td style="padding: 12px; text-align: center;">
                            <button class="icon-btn" onclick="closeModal('modalStockBajo'); showPage('productos'); setTimeout(()=>editProduct(${p.id}),150);" style="background:rgba(16,185,129,0.1); border-color:rgba(16,185,129,0.3); color:var(--accent3); display: inline-flex; align-items: center; justify-content: center;" title="Editar producto"><i class="fa fa-plus"></i></button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    openModal('modalStockBajo');
}

function abrirModalDeudaAlta() {
    const montoMaximo = parseFloat(settings.alertas.montoDeuda) || 100;
    const clientesDeuda = clientes.filter(c => c.deuda > montoMaximo);
    
    if (clientesDeuda.length === 0) {
        showToast(`✅ No hay clientes con deuda superior a ${moneda()} ${montoMaximo.toFixed(2)}`, 'success');
        return;
    }
    
    // Encabezado fijo
    document.getElementById('deudaAltaHeader').innerHTML = `
        <span style="font-size: 13px; color: var(--text3);">Límite configurado: ${moneda()} ${montoMaximo.toFixed(2)} · ${clientesDeuda.length} cliente(s) superan el límite</span>
        <button class="btn btn-secondary btn-sm" onclick="exportDeudaAltaExcel()"><i class="fa fa-file-excel"></i> Exportar Excel</button>
    `;
    
    // Footer fijo
    document.getElementById('deudaAltaFooter').innerHTML = `
        <i class="fa fa-exclamation-triangle" style="color: var(--danger); margin-right: 8px;"></i>
        <span style="font-size: 12px; color: var(--text2);">Estos clientes han superado el límite de crédito configurado. Considera gestionar sus pagos.</span>
    `;
    
    // Tabla con scroll y encabezado fijo - SIN COLUMNA LÍMITE
    document.getElementById('deudaAltaTableWrapper').innerHTML = `
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <thead>
                <tr style="background: var(--surface2); position: sticky; top: 0;">
                    <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: var(--text3); width: 35%; border-bottom: 1px solid var(--border);">Cliente</th>
                    <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: var(--text3); width: 20%; border-bottom: 1px solid var(--border);">Teléfono</th>
                    <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: var(--text3); width: 30%; border-bottom: 1px solid var(--border);">Deuda Actual</th>
                    <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: var(--text3); width: 15%; border-bottom: 1px solid var(--border);">Acción</th>
                </tr>
            </thead>
            <tbody>
                ${clientesDeuda.sort((a, b) => b.deuda - a.deuda).map(c => {
                    const porcentaje = Math.min((c.deuda / c.limite) * 100, 100);
                    return `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div class="rs-avatar" style="width: 32px; height: 32px; font-size: 11px; background: linear-gradient(135deg, var(--accent2), #7c3aed); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; flex-shrink: 0;">${c.nombre.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}</div>
                                    <span style="font-weight: 500; word-break: break-word;">${c.nombre}</span>
                                </div>
                            </td>
                            <td style="padding: 12px; font-family: monospace; font-size: 12px; color: var(--text2);">${c.tel}</td>
                            <td style="padding: 12px; text-align: center;">
                                <div>
                                    <span style="font-weight: 800; color: var(--danger); font-size: 14px;">${moneda()} ${c.deuda.toFixed(2)}</span>
                                    <div class="client-debt-bar" style="margin-top: 6px; width: 100%; height: 4px; background: var(--surface3); border-radius: 4px; overflow: hidden;"><div class="client-debt-fill" style="width: ${porcentaje}%; height: 100%; background: var(--danger); border-radius: 4px;"></div></div>
                                </div>
                            </td>
                            <td style="padding: 12px; text-align: center;">
                                <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                                    <button class="icon-btn" onclick="closeModal('modalDeudaAlta'); showPage('clientes'); setTimeout(()=>verCuentaCliente(${c.id}),150);" title="Ver cuenta" style="width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid rgba(var(--accent-rgb,245,158,11),0.3); background: var(--surface2); color: var(--accent); transition: all 0.2s;"><i class="fa fa-file-invoice-dollar"></i></button>
                                    <button class="icon-btn" onclick="closeModal('modalDeudaAlta'); showPage('clientes'); setTimeout(()=>pagarDeudaCliente(${c.id}),150);" title="Registrar pago" style="width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid rgba(16,185,129,0.3); background: var(--surface2); color: var(--accent3); transition: all 0.2s;"><i class="fa fa-money-bill"></i></button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    openModal('modalDeudaAlta');
}

// Función para exportar deuda alta a Excel
function exportDeudaAltaExcel() {
    const montoMaximo = parseFloat(settings.alertas.montoDeuda) || 100;
    // Filtramos clientes cuya deuda es mayor que el límite configurado
    const clientesDeuda = clientes.filter(c => c.deuda > montoMaximo);
    const now = new Date().toLocaleDateString('es-PE');

    let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial; background-color: white; }

        table {
          border-collapse: collapse;
          margin: auto;
        }

        th, td {
          border: 1px solid #fca5a5;
          padding: 4px;
          font-size: 11px;
        }

        .title {
          color: #b91c1c;
          font-weight: bold;
          font-size: 16px;
          text-align: center;
          border: none;
        }

        .subtitle {
          text-align: center;
          font-size: 11px;
          color: #6b7280;
          border: none;
        }

        th {
          background-color: #7f1d1d;
          color: white;
          text-align: center;
        }

        .client-name {
          text-align: center;
          font-weight: bold;
        }

        .debt {
          color: #b91c1c;
          font-weight: bold;
          text-align: center;
        }
        
        .phone {
          text-align: center;
          font-family: bold;
        }

        .center {
          text-align: center;
        }
      </style>
    </head>

    <body>
      <table>
        <colgroup>
          <col style="width:70px">
          <col style="width:280px">
          <col style="width:125px">
          <col style="width:130px">
        </colgroup>

        <tr>
          <td colspan="4" class="title">⚠️ REPORTE DE CLIENTES CON DEUDA ALTA</td>
        </tr>
        <tr>
          <td colspan="4" class="subtitle">
            Generado el: ${now} · Límite configurado: ${moneda()} ${montoMaximo.toFixed(2)} · Total: ${clientesDeuda.length} clientes en estado crítico
          </td>
        </tr>
        <tr></tr>

        <tr>
          <th>#</th>
          <th>Cliente</th>
          <th>Teléfono</th>
          <th>Deuda Actual</th>
        </tr>

        ${clientesDeuda.sort((a,b) => b.deuda - a.deuda).map((c, i) => `
          <tr>
            <td class="center">${i + 1}</td>
            <td class="client-name">${c.nombre.toUpperCase()}</td>
            <td class="phone">${c.tel || '---'}</td>
            <td class="debt">${moneda()} ${c.deuda.toFixed(2)}</td>
          </tr>
        `).join('')}

      </table>
    </body>
    </html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Deuda_Alta_${now.replace(/\//g, '-')}.xls`;
    a.click();
}

function exportStockBajoExcel() {
  const bajos = productos.filter(p => p.stock <= (settings.alertas.minStock || 3));
  const now = new Date().toLocaleDateString('es-PE');

  let html = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-com:office:excel"
        xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial; background-color: white; }

      table {
        border-collapse: collapse;
        margin: auto;
      }

      th, td {
        border: 1px solid #fca5a5;
        padding: 4px;
        font-size: 11px;
      }

      .title {
        color: #b91c1c;
        font-weight: bold;
        font-size: 16px;
        text-align: center;
        border: none;
      }

      .subtitle {
        text-align: center;
        font-size: 11px;
        color: #6b7280;
        border: none;
      }

      th {
        background-color: #7f1d1d;
        color: white;
        text-align: center;
      }

      .prod {
        text-align: center;
        font-weight: bold;
      }

      .stock {
        color: #b91c1c;
        font-weight: bold;
        text-align: center;
      }

      .center {
        text-align: center;
      }
    </style>
  </head>

  <body>
    <table>
      <!-- 🔥 AQUÍ CONTROLAS EL ANCHO -->
      <colgroup>
        <col style="width:70px">
        <col style="width:285px">
        <col style="width:150px">
        <col style="width:100px">
      </colgroup>

      <tr>
        <td colspan="4" class="title">⚠️ REPORTE DE STOCK BAJO</td>
      </tr>
      <tr>
        <td colspan="4" class="subtitle">
          Generado el: ${now} · Total: ${bajos.length} productos críticos
        </td>
      </tr>
      <tr></tr>

      <tr>
        <th>#</th>
        <th>Producto</th>
        <th>Precio (S/.)</th>
        <th>Stock Actual</th>
      </tr>

      ${bajos.map((p, i) => `
        <tr>
          <td class="center">${i + 1}</td>
          <td class="prod">${p.nombre.toUpperCase()}</td>
          <td class="center">${moneda()} ${p.precio.toFixed(2)}</td>
          <td class="stock">${p.stock}</td>
        </tr>
      `).join('')}

    </table>
  </body>
  </html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `StockBajo_${now.replace(/\//g, '-')}.xls`;
  a.click();
}

