const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bodegaPrompt', { responder: v => ipcRenderer.send('bodegapos:prompt-res', v) });
