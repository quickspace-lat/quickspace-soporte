// Proceso aparte para inyectar mouse y teclado. No puede vivir en el proceso principal:
// un clic remoto sobre la barra de título de nuestra propia ventana deja a ese proceso
// bloqueado hasta que se suelta el botón, y nadie más podría soltarlo.
const { mouse, keyboard, screen, Button, Point } = require('@nut-tree-fork/nut-js');
const keymap = require('./keymap');

mouse.config.autoDelayMs = 0;
mouse.config.mouseSpeed = 100000;
keyboard.config.autoDelayMs = 0;

const BUTTONS = [Button.LEFT, Button.MIDDLE, Button.RIGHT];
const MAX_TEXT = 5000;

let sessionActive = false;
let paused = false;
let screenSize = null;
let queue = Promise.resolve();
const keysDown = new Set();
const buttonsDown = new Set();

function clamp01(n) {
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}

function clampDelta(n) {
  return Number.isFinite(n) ? Math.max(-2000, Math.min(2000, Math.round(n))) : 0;
}

async function moveTo(nx, ny) {
  const x = clamp01(nx);
  const y = clamp01(ny);
  if (x === null || y === null || !screenSize) return;
  await mouse.setPosition(
    new Point(Math.round(x * (screenSize.width - 1)), Math.round(y * (screenSize.height - 1)))
  );
}

async function releaseAll() {
  for (const key of keysDown) await keyboard.releaseKey(key).catch(() => {});
  for (const button of buttonsDown) await mouse.releaseButton(button).catch(() => {});
  keysDown.clear();
  buttonsDown.clear();
}

async function setSession(active) {
  if (active) {
    screenSize = { width: await screen.width(), height: await screen.height() };
    sessionActive = true;
  } else {
    sessionActive = false;
    paused = false;
    await releaseAll();
  }
}

async function applyInput(msg) {
  if (!msg || typeof msg.t !== 'string') return;
  if (msg.t === 'session') return setSession(msg.active === true);
  if (msg.t === 'pause') {
    paused = msg.on === true;
    if (paused) await releaseAll();
    return;
  }
  if (!sessionActive || paused) return;
  switch (msg.t) {
    case 'm':
      await moveTo(msg.x, msg.y);
      break;
    case 'd':
    case 'u': {
      const button = BUTTONS[msg.b];
      if (button === undefined) return;
      await moveTo(msg.x, msg.y);
      if (msg.t === 'd') {
        buttonsDown.add(button);
        await mouse.pressButton(button);
      } else {
        buttonsDown.delete(button);
        await mouse.releaseButton(button);
      }
      break;
    }
    case 'w': {
      const dy = clampDelta(msg.dy);
      const dx = clampDelta(msg.dx);
      if (dy > 0) await mouse.scrollDown(dy);
      else if (dy < 0) await mouse.scrollUp(-dy);
      if (dx > 0) await mouse.scrollRight(dx);
      else if (dx < 0) await mouse.scrollLeft(-dx);
      break;
    }
    case 'kd':
    case 'ku': {
      const key = keymap.get(msg.c);
      if (key === undefined) return;
      if (msg.t === 'kd') {
        keysDown.add(key);
        await keyboard.pressKey(key);
      } else {
        keysDown.delete(key);
        await keyboard.releaseKey(key);
      }
      break;
    }
    case 'text':
      if (typeof msg.s === 'string' && msg.s.length <= MAX_TEXT) await keyboard.type(msg.s);
      break;
    case 'rel':
      await releaseAll();
      break;
  }
}

function enqueue(task) {
  queue = queue.then(task).catch((err) => console.error('[input]', err && err.message ? err.message : err));
}

// El proceso principal entrega un puerto conectado directamente con la ventana
process.parentPort.on('message', (event) => {
  const [port] = event.ports;
  if (!port) return;
  port.on('message', (e) => {
    if (process.env.QR_DEBUG) console.log('[input]', sessionActive, JSON.stringify(e.data));
    enqueue(() => applyInput(e.data));
  });
  port.on('close', () => enqueue(() => setSession(false)));
  port.start();
});
