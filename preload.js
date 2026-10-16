const { contextBridge, ipcRenderer } = require('electron');

// Puerto directo con el proceso de inyección de entrada
let inputPort = null;
ipcRenderer.on('input-port', (event) => {
  inputPort = event.ports[0];
});

function post(msg) {
  if (inputPort) inputPort.postMessage(msg);
}

contextBridge.exposeInMainWorld('qr', {
  config: () => ipcRenderer.invoke('config'),
  setSession: (active) => {
    post({ t: 'session', active: active === true });
    ipcRenderer.send('compact', active === true);
  },
  input: (msg) => post(msg),
  pauseInput: (on) => post({ t: 'pause', on: on === true }),
  setPrivacy: (on) => ipcRenderer.send('privacy', on === true),
  attention: () => ipcRenderer.send('attention'),
});
