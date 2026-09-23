/*
 * BodegaPOS · versión de escritorio (Electron)
 *
 * Abre la app dentro de su propia ventana, sin navegador ni servidor ni internet.
 *  - Sirve la carpeta www/ (la app web tal cual) por un protocolo interno: app://bodegapos/
 *  - Los datos quedan en la carpeta del usuario (%APPDATA%\BodegaPOS), no dentro del programa:
 *    actualizar o reinstalar NO los borra.
 *  - Reemplaza window.prompt (Electron no lo trae) y habilita la impresora térmica por USB (Web Serial).
 */
const { app, BrowserWindow, Menu, dialog, protocol, net, session, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

app.setName('BodegaPOS');
if (process.platform === 'win32') app.setAppUserModelId('com.bodegapos.app');

// Instalado: www/ está junto a este archivo. En desarrollo: la app es la carpeta de arriba.
const WWW = fs.existsSync(path.join(__dirname, 'www')) ? path.join(__dirname, 'www') : path.join(__dirname, '..');
const ORIGEN = 'app://bodegapos';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

// Impresión directa a la impresora predeterminada, sin cuadro de diálogo (igual que el acceso directo con --kiosk-printing)
app.commandLine.appendSwitch('kiosk-printing');

if (!app.requestSingleInstanceLock()) { app.quit(); }

let ventana = null;
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- prompt() de reemplazo (ventana pequeña; el renderer espera la respuesta) ----------
function pedirTexto(padre, mensaje, valor) {
  return new Promise(resolve => {
    const w = new BrowserWindow({
      parent: padre || undefined, modal: !!padre, width: 480, height: 250, resizable: false, minimizable: false, maximizable: false,
      show: false, autoHideMenuBar: true, title: 'BodegaPOS', backgroundColor: '#ffffff',
      icon: path.join(__dirname, 'icono.ico'),
      webPreferences: { preload: path.join(__dirname, 'prompt-preload.js'), sandbox: true, contextIsolation: true }
    });
    w.setMenuBarVisibility(false);
    let listo = false;
    const fin = v => { if (listo) return; listo = true; ipcMain.removeListener('bodegapos:prompt-res', h); resolve(v); if (!w.isDestroyed()) w.close(); };
    const h = (e, v) => { if (e.sender.id === w.webContents.id) fin(v); };
    ipcMain.on('bodegapos:prompt-res', h);
    w.on('closed', () => fin(null));
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0;padding:22px 24px;font:14px 'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff}
      .m{white-space:pre-wrap;line-height:1.45;margin-bottom:14px;max-height:96px;overflow:auto}
      input{width:100%;box-sizing:border-box;padding:10px 12px;font:inherit;border:1px solid #cbd5e1;border-radius:8px;outline:none}
      input:focus{border-color:#f59e0b}
      .b{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}
      button{padding:9px 20px;font:600 13px 'Segoe UI',Arial,sans-serif;border-radius:8px;cursor:pointer;border:1px solid #cbd5e1;background:#f1f5f9;color:#1e293b}
      button.ok{background:#f59e0b;border-color:#f59e0b;color:#000}
    </style></head><body>
      <div class="m">${esc(mensaje)}</div>
      <input id="v" value="${esc(valor)}" autofocus>
      <div class="b"><button id="c">Cancelar</button><button class="ok" id="a">Aceptar</button></div>
      <script>
        const i=document.getElementById('v');
        const ok=()=>window.bodegaPrompt.responder(i.value), no=()=>window.bodegaPrompt.responder(null);
        document.getElementById('a').onclick=ok; document.getElementById('c').onclick=no;
        addEventListener('keydown',e=>{ if(e.key==='Enter') ok(); else if(e.key==='Escape') no(); });
        i.focus(); i.select();
      </script></body></html>`;
    w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    w.once('ready-to-show', () => { w.show(); });
  });
}
ipcMain.on('bodegapos:prompt', (event, mensaje, valor) => {
  pedirTexto(BrowserWindow.fromWebContents(event.sender), mensaje, valor).then(v => { event.returnValue = v; });
});

// ---------- Ventana principal ----------
function crearVentana() {
  ventana = new BrowserWindow({
    width: 1366, height: 800, minWidth: 900, minHeight: 600,
    show: false, autoHideMenuBar: true, title: 'BodegaPOS', backgroundColor: '#f0f2f5',
    icon: path.join(__dirname, 'icono.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
  });
  ventana.maximize();
  ventana.once('ready-to-show', () => ventana.show());
  ventana.on('closed', () => { ventana = null; });

  // Enlaces externos (WhatsApp, etc.) se abren en el navegador; la app nunca navega fuera de sí misma
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:|tel:)/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  ventana.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGEN)) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });
  ventana.webContents.on('did-fail-load', (e, codigo, desc, url, principal) => {
    if (principal && codigo !== -3) dialog.showErrorBox('BodegaPOS', 'No se pudo cargar la aplicación.\n' + desc + ' (' + codigo + ')');
  });

  // Impresora térmica por USB (Web Serial): si hay una sola se elige sola; si hay varias se pregunta
  ventana.webContents.session.on('select-serial-port', (event, puertos, wc, callback) => {
    event.preventDefault();
    if (!puertos.length) return callback('');
    if (puertos.length === 1) return callback(puertos[0].portId);
    dialog.showMessageBox(ventana, {
      type: 'question', title: 'Impresora', message: '¿Cuál es tu impresora?',
      buttons: puertos.map(p => p.displayName || p.portName || p.portId).concat('Cancelar'), cancelId: puertos.length, noLink: true
    }).then(r => callback(r.response < puertos.length ? puertos[r.response].portId : ''));
  });

  ventana.loadURL(ORIGEN + '/index.html');
}

app.whenReady().then(() => {
  // app://bodegapos/<ruta>  ->  archivo dentro de www/ (sin permitir salirse de esa carpeta)
  protocol.handle('app', req => {
    let ruta = decodeURIComponent(new URL(req.url).pathname);
    if (ruta === '/' || ruta === '') ruta = '/index.html';
    const archivo = path.normalize(path.join(WWW, ruta));
    if (!archivo.startsWith(path.normalize(WWW + path.sep)) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
      return new Response('No encontrado', { status: 404 });
    }
    return net.fetch(pathToFileURL(archivo).toString());
  });

  const ses = session.defaultSession;
  const propio = u => String(u || '').startsWith(ORIGEN);
  ses.setPermissionCheckHandler((wc, permiso, origen) => propio(origen) || propio(wc && wc.getURL()));
  ses.setPermissionRequestHandler((wc, permiso, cb) => cb(propio(wc.getURL())));
  ses.setDevicePermissionHandler(d => propio(d.origin) && d.deviceType === 'serial');

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Edición', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'Ver', submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'toggleDevTools' }] }
  ]));

  crearVentana();
});

app.on('second-instance', () => { if (ventana) { if (ventana.isMinimized()) ventana.restore(); ventana.focus(); } });
app.on('window-all-closed', () => app.quit());
