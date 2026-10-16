(async () => {
  const $ = (id) => document.getElementById(id);
  const views = { idle: $('view-idle'), request: $('view-request'), session: $('view-session') };
  const cfg = await window.qr.config();

  // Únicos mensajes del técnico que se convierten en mouse o teclado
  const INPUT_TYPES = new Set(['m', 'd', 'u', 'w', 'kd', 'ku', 'text', 'rel']);
  const PRIVACY_ASK_MS = 30000;

  let ws = null;
  let pc = null;
  let dc = null;
  let stream = null;
  let technician = '';
  let retryMs = 1000;
  let privacy = 'off'; // off | ask | on
  let privacyTimer = null;

  function show(name) {
    for (const key in views) views[key].hidden = key !== name;
    document.body.classList.toggle('compact', name === 'session');
  }

  function wsSend(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function dcSend(msg) {
    if (dc && dc.readyState === 'open') dc.send(JSON.stringify(msg));
  }

  // ---------- señalización ----------

  function connect() {
    ws = new WebSocket(cfg.serverUrl.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws?role=agent');
    ws.onopen = () => {
      retryMs = 1000;
      wsSend({ type: 'register', name: cfg.hostname, platform: cfg.platform });
    };
    ws.onmessage = (e) => onSignal(JSON.parse(e.data));
    ws.onclose = () => {
      endSession();
      show('idle');
      $('code').textContent = '— — —';
      $('status').textContent = 'Sin conexión con el servidor. Reintentando…';
      setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 15000);
    };
  }

  async function onSignal(msg) {
    switch (msg.type) {
      case 'registered':
        $('code').textContent = msg.code.replace(/(\d{3})(?=\d)/g, '$1 ');
        $('status').textContent = 'Esperando al técnico…';
        break;
      case 'request':
        technician = msg.technician;
        $('req-name').textContent = technician;
        show('request');
        window.qr.attention();
        break;
      case 'request-cancelled':
        show('idle');
        break;
      case 'start':
        await startSession(msg.iceServers);
        break;
      case 'signal':
        await onRemoteSignal(msg.data);
        break;
      case 'peer-left':
        endSession();
        show('idle');
        break;
    }
  }

  $('accept-btn').addEventListener('click', () => wsSend({ type: 'respond', accept: true }));
  $('reject-btn').addEventListener('click', () => {
    wsSend({ type: 'respond', accept: false });
    show('idle');
  });
  $('end-btn').addEventListener('click', () => {
    wsSend({ type: 'bye' });
    endSession();
    show('idle');
  });

  // ---------- pantalla privada ----------

  // El técnico la solicita y el cliente decide. Mientras se le pregunta, el control remoto
  // queda en pausa para que la respuesta solo pueda darla quien está frente al equipo.
  // Una vez oculta, el cliente no puede volver a mirar sin cortar: su salida es "Finalizar".
  function setPrivacy(state) {
    clearTimeout(privacyTimer);
    privacy = state;
    window.qr.pauseInput(state === 'ask');
    window.qr.setPrivacy(state === 'on');
    $('privacy-no-btn').hidden = state !== 'ask';
    $('privacy-yes-btn').hidden = state !== 'ask';
    $('end-btn').hidden = state === 'ask';
    if (state === 'ask') {
      $('session-title').textContent = '¿Ocultar tu pantalla?';
      $('session-text').textContent = 'Para verla deberás finalizar';
      $('session-text').title = `${technician} pide trabajar sin mostrar la pantalla. Para volver a verla tendrás que finalizar la sesión.`;
      window.qr.attention();
      privacyTimer = setTimeout(() => setPrivacy('off'), PRIVACY_ASK_MS);
    } else if (state === 'on') {
      $('session-title').textContent = '● Pantalla oculta';
      $('session-text').textContent = `${technician} está trabajando`;
    } else {
      $('session-title').textContent = '● Sesión activa';
      $('session-text').textContent = `${technician} controla este equipo`;
    }
    if (state !== 'ask') $('session-text').title = '';
    dcSend({ t: 'privacy-state', state });
  }

  function onPrivacyRequest(on) {
    if (on === true && privacy === 'off') setPrivacy('ask');
    else if (on !== true && privacy !== 'off') setPrivacy('off');
  }

  $('privacy-yes-btn').addEventListener('click', () => setPrivacy('on'));
  $('privacy-no-btn').addEventListener('click', () => setPrivacy('off'));

  // ---------- WebRTC ----------

  async function startSession(iceServers) {
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
    } catch (err) {
      wsSend({ type: 'bye' });
      show('idle');
      $('status').textContent = 'No se pudo capturar la pantalla.';
      return;
    }

    pc = new RTCPeerConnection({ iceServers });
    const track = stream.getVideoTracks()[0];
    track.contentHint = 'detail';
    const sender = pc.addTrack(track, stream);

    dc = pc.createDataChannel('input', { ordered: true });
    dc.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (!msg || typeof msg.t !== 'string') return;
      if (msg.t === 'privacy') onPrivacyRequest(msg.on);
      else if (INPUT_TYPES.has(msg.t)) window.qr.input(msg);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) wsSend({ type: 'signal', data: { candidate: e.candidate } });
    };
    pc.onconnectionstatechange = () => {
      if (pc && pc.connectionState === 'failed') {
        wsSend({ type: 'bye' });
        endSession();
        show('idle');
      }
    };

    await pc.setLocalDescription(await pc.createOffer());
    wsSend({ type: 'signal', data: { sdp: pc.localDescription } });

    const params = sender.getParameters();
    if (params.encodings && params.encodings.length) {
      params.encodings[0].maxBitrate = 6000000;
      params.degradationPreference = 'maintain-resolution';
      sender.setParameters(params).catch(() => {});
    }

    window.qr.setSession(true);
    show('session');
    setPrivacy('off');
  }

  async function onRemoteSignal(data) {
    if (!pc || !data) return;
    try {
      if (data.sdp) await pc.setRemoteDescription(data.sdp);
      else if (data.candidate) await pc.addIceCandidate(data.candidate);
    } catch (err) {
      console.error('Error de señalización', err);
    }
  }

  function endSession() {
    clearTimeout(privacyTimer);
    privacy = 'off';
    window.qr.setPrivacy(false);
    window.qr.setSession(false);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (pc) pc.close();
    stream = null;
    pc = null;
    dc = null;
  }

  connect();
})();
