const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  session,
  screen: displays,
  utilityProcess,
  MessageChannelMain,
} = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FULL_SIZE = { width: 380, height: 470 };
const COMPACT_SIZE = { width: 380, height: 64 };

let win = null;
let isCompact = false;
let inputProc = null;
let quitting = false;
const overlays = [];

// config.json junto al .exe portable tiene prioridad sobre el empaquetado
function loadConfig() {
  const candidates = [];
  if (process.env.PORTABLE_EXECUTABLE_DIR) candidates.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'config.json'));
  candidates.push(path.join(__dirname, 'config.json'));
  for (const file of candidates) {
    try {
      const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (cfg && typeof cfg.serverUrl === 'string') return cfg;
    } catch {}
  }
  return { serverUrl: 'http://localhost:3600' };
}

// La entrada remota va de la ventana al proceso de inyección por un puerto directo,
// sin pasar por este proceso (ver input-worker.js)
function startInputProc() {
  inputProc = utilityProcess.fork(path.join(__dirname, 'input-worker.js'), [], { stdio: 'inherit' });
  // Sin proceso de inyección no hay control remoto: si se cae, se relanza
  inputProc.on('exit', () => {
    inputProc = null;
    if (quitting) return;
    setTimeout(() => {
      startInputProc();
      connectInputPort();
    }, 1000);
  });
}

function connectInputPort() {
  if (!win || !inputProc) return;
  const { port1, port2 } = new MessageChannelMain();
  win.webContents.postMessage('input-port', null, [port1]);
  inputProc.postMessage(null, [port2]);
}

function createWindow() {
  win = new BrowserWindow({
    width: FULL_SIZE.width,
    height: FULL_SIZE.height,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    backgroundColor: '#14243c',
    title: 'Quick Space Soporte',
    icon: path.join(__dirname, 'renderer', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('did-finish-load', connectInputPort);
  win.on('closed', () => {
    win = null;
    isCompact = false;
    for (const overlay of overlays.splice(0)) if (!overlay.isDestroyed()) overlay.destroy();
    app.quit();
  });
}

// Durante la sesión la ventana se reduce a una barra en la esquina inferior derecha:
// sigue visible por encima del resto, pero no estorba y se puede minimizar.
function setCompact(compact) {
  if (!win || compact === isCompact) return;
  isCompact = compact;
  win.setResizable(true);
  if (compact) {
    win.setContentSize(COMPACT_SIZE.width, COMPACT_SIZE.height);
    const bounds = win.getBounds();
    const area = displays.getPrimaryDisplay().workArea;
    win.setPosition(area.x + area.width - bounds.width - 16, area.y + area.height - bounds.height - 16);
  } else {
    win.setSize(FULL_SIZE.width, FULL_SIZE.height);
    win.center();
  }
  win.setResizable(false);
  win.setAlwaysOnTop(compact);
  if (win.isMinimized()) win.restore();
  win.show();
}

// Pantalla privada: cubre los monitores del cliente con una ventana negra que no recibe
// clics y queda excluida de la captura, así el técnico sigue viendo el escritorio.
// La barra de sesión se mantiene encima para que el cliente pueda finalizar cuando quiera.
function setPrivacy(on) {
  if (!win || on === overlays.length > 0) return;
  if (on) {
    for (const display of displays.getAllDisplays()) {
      const overlay = new BrowserWindow({
        ...display.bounds,
        frame: false,
        show: false,
        fullscreen: true,
        movable: false,
        focusable: false,
        skipTaskbar: true,
        backgroundColor: '#000000',
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      overlay.setContentProtection(true);
      overlay.setIgnoreMouseEvents(true);
      overlay.setAlwaysOnTop(true, 'screen-saver');
      overlay.loadFile(path.join(__dirname, 'renderer', 'privacy.html'));
      overlay.once('ready-to-show', () => {
        overlay.showInactive();
        if (win) win.moveTop();
      });
      overlays.push(overlay);
    }
    // La barra no se puede minimizar ni mover mientras la pantalla está oculta
    win.setMinimizable(false);
    win.setMovable(false);
    if (win.isMinimized()) win.restore();
    const bounds = win.getBounds();
    const area = displays.getPrimaryDisplay().workArea;
    win.setPosition(area.x + area.width - bounds.width - 16, area.y + area.height - bounds.height - 16);
    win.setAlwaysOnTop(true, 'screen-saver');
    win.show();
  } else {
    for (const overlay of overlays.splice(0)) if (!overlay.isDestroyed()) overlay.destroy();
    win.setMinimizable(true);
    win.setMovable(true);
    win.setAlwaysOnTop(isCompact);
  }
}

// ---------- IPC ----------

ipcMain.handle('config', () => ({
  serverUrl: process.env.QR_SERVER || loadConfig().serverUrl,
  hostname: os.hostname(),
  platform: process.platform,
}));

ipcMain.on('compact', (event, compact) => {
  if (compact !== true) setPrivacy(false);
  setCompact(compact === true);
});

ipcMain.on('privacy', (event, on) => setPrivacy(on === true && isCompact));

ipcMain.on('attention', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.flashFrame(true);
});

// ---------- arranque ----------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    // getDisplayMedia entrega siempre la pantalla principal, sin selector
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen'] })
        .then((sources) => {
          const primaryId = String(displays.getPrimaryDisplay().id);
          const source = sources.find((s) => s.display_id === primaryId) || sources[0];
          if (source) callback({ video: source });
          else callback({});
        })
        .catch(() => callback({}));
    });
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
      callback(permission === 'media' || permission === 'display-capture');
    });

    startInputProc();
    createWindow();
  });

  // Cerrar la ventana termina el acceso: no queda nada en segundo plano
  app.on('before-quit', () => (quitting = true));
  app.on('window-all-closed', () => app.quit());
}
