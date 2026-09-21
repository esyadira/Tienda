/// ========================================
// DATA
// ========================================
const datosLocales = JSON.parse(localStorage.getItem('bodega_data_permanente')) || {};

// Lista base de usuarios — vacía, solo se usan los vendedores creados en el setup
const _usuariosBase = [];

// usuarios es dinámico: solo vendedores guardados (el admin se crea en el setup)
function getUsuarios() {
  const vends = JSON.parse(localStorage.getItem('bodega_data_permanente'))?.vendedores || vendedores || [];
  return vends
    .filter(v => v.usuario && v.password && v.estado === 'activo')
    .map(v => ({
      user: v.usuario,
      pass: v.password,
      nombre: v.nombre + (v.apellido ? ' ' + v.apellido : ''),
      rol: v.esAdmin ? 'Administrador' : 'Vendedor',
      avatar: (v.nombre[0] + (v.apellido ? v.apellido[0] : '')).toUpperCase(),
      foto: v.foto || '',
      permisos: v.permisos || [],
      esAdmin: v.esAdmin || false
    }));
}
// Alias para compatibilidad con código legado
const usuarios = _usuariosBase;

// Aplicar modo visual al cargar la página (antes de que se vea nada)
(function() {
  try {
    const s = JSON.parse(localStorage.getItem('bodega_settings')) || {};
    const isDark = s.apariencia ? !!s.apariencia.darkMode : false;
    const root = document.documentElement;
    if (isDark) {
      root.style.setProperty('--bg','#0a0e1a');root.style.setProperty('--surface','#111827');
      root.style.setProperty('--surface2','#1a2235');root.style.setProperty('--surface3','#1f2d42');
      root.style.setProperty('--border','#2a3a52');root.style.setProperty('--text','#e2e8f0');
      root.style.setProperty('--text2','#94a3b8');root.style.setProperty('--text3','#64748b');
    }
    // Si isDark es false, ya tiene los valores claro por defecto en :root
  } catch(e) {}
})();

let productos = datosLocales.productos || [];
let clientes = datosLocales.clientes || [];
let proveedores = datosLocales.proveedores || [];
// Migrar proveedores viejos que no tienen fechaCreacion
proveedores.forEach(p=>{ if(!p.fechaCreacion) p.fechaCreacion = new Date().toISOString(); });
let vendedores = datosLocales.vendedores || [];
let ordenesCompra = datosLocales.ordenesCompra || [];   // Compras: órdenes (pendiente / recibida / cancelada)
let listaCompras = datosLocales.listaCompras || [];     // Compras: lista de lo que falta comprar
// ... resto del código

let carrito = [];
let ventasHistorial = JSON.parse(localStorage.getItem('bodega_ventas_historial') || '[]');
let cajasHistorial = JSON.parse(localStorage.getItem('bodega_cajas') || '[]');
let pagosProveedoresHistorial = JSON.parse(localStorage.getItem('bodega_pagos_proveedores') || '[]');
let selectedTurno = '';
let currentUser = null;
let prodViewGrid = true;
let selectedClientePOS = null;
let selectedPayMethod = 'efectivo';
let pendingVentaTotal = 0;
// Redondea el total al décimo más cercano (0.10, 0.20, ... 1.30, etc.)
function redondearTotal(n){ return Math.round(n * 10) / 10; }
let bottleOwed = null; // true=debe, false=no debe, null=no aplica
let categorias = JSON.parse(localStorage.getItem('bodega_categorias')) || [];

// ===== Datos de los nuevos botones de Ventas (Entrada/Salida, Pendientes, Devoluciones) =====
let movimientosCaja = JSON.parse(localStorage.getItem('bodega_movimientos_caja') || '[]');
let ventasPendientes = JSON.parse(localStorage.getItem('bodega_ventas_pendientes') || '[]');
let devolucionesHistorial = JSON.parse(localStorage.getItem('bodega_devoluciones') || '[]');

