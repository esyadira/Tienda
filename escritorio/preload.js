// Puente seguro entre la app y Electron: solo expone el prompt() de reemplazo.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bodegaEscritorio', {
  prompt: (mensaje, valor) => ipcRenderer.sendSync('bodegapos:prompt', String(mensaje == null ? '' : mensaje), valor == null ? '' : String(valor))
});
