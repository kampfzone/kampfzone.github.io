/* ======================= Bildschirmaufnahme: Video vom Spiel aufnehmen =======================
   F9 oder Knopf ⏺: Aufnahme starten, nochmal = stoppen → das Video wird als Datei gespeichert
   (Download-Ordner, Name „kampfzone-Datum-Uhrzeit.mp4“ – nur in Browsern ohne MP4-Aufnahme „.webm“).
   PC: nimmt den ganzen Spiel-Tab auf – mit allen Anzeigen und Ton (der Browser fragt einmal, ob der Tab geteilt werden darf).
   Handy (oder „Abbrechen“ am PC): nimmt das Spielbild direkt auf, mit Spielton, ohne Anzeigen.
   Lenkrad-Kamera (Knopf 📱): ein Handy filmt das Lenkrad (Seite cam.html, Verbindung per QR-Code, direkt im WLAN).
   Dann zeigt die Aufnahme oben das Spiel und unten das Lenkrad – beides gleichzeitig, also automatisch synchron. */
(function () {
  const REC = { mr: null, chunks: [], t0: 0, stream: null, aud: null, type: '', mode: '', vt: null, comp: null };
  const CAM = { peer: null, code: '', video: null, call: null, connected: false, panel: null };
  const css = document.createElement('style');
  css.textContent = `#recBtn, #camBtn { position: fixed; top: 10px; z-index: 60; font: 700 14px/1 Rajdhani, system-ui, sans-serif; letter-spacing: .5px;
      background: rgba(0,0,0,.55); color: #fff; padding: 6px 10px; border-radius: 6px; cursor: pointer; user-select: none; -webkit-user-select: none; display: none; }
    #recBtn { right: 92px; } #camBtn { right: 168px; } #camBtn.on { background: rgba(20,120,40,.85); }
    #recBtn .dot { color: #ff4a3a; } #recBtn.on { background: rgba(190,20,20,.88); } #recBtn.on .dot { color: #fff; animation: recBlink 1s steps(2) infinite; }
    @keyframes recBlink { 50% { opacity: 0; } }
    body.touch #recBtn { right: 14px; top: 92px; font-size: 12px; padding: 5px 8px; } body.touch #camBtn { right: 14px; top: 124px; font-size: 12px; padding: 5px 8px; }
    #camPanel { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 80; width: min(420px, 92vw); max-height: 92vh; overflow: auto;
      background: #14171c; color: #eee; border: 1px solid #333a44; border-radius: 12px; padding: 16px 18px; font: 15px/1.45 system-ui, sans-serif; box-shadow: 0 10px 40px rgba(0,0,0,.6); }
    #camPanel h3 { margin: 0 0 8px; font-size: 18px; color: #ffcc33; } #camPanel ol { margin: 6px 0 10px; padding-left: 20px; }
    #camPanel .qr { display: block; margin: 8px auto; width: 190px; height: 190px; background: #fff; border-radius: 8px; image-rendering: pixelated; }
    #camPanel .code { font: 800 24px system-ui; letter-spacing: 4px; color: #fff; } #camPanel video { width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 8px; object-fit: cover; margin-top: 8px; }
    #camPanel .row { display: flex; gap: 8px; margin-top: 10px; } #camPanel button { flex: 1; font: 700 15px system-ui; border: 0; border-radius: 8px; padding: 10px; cursor: pointer; background: #2b3038; color: #eee; }
    #camPanel button.main { background: #ffcc33; color: #111; } #camPanel .st { margin-top: 6px; font-weight: 700; } #camPanel .ok { color: #7dff7a; } #camPanel .wait { color: #ffcc33; }`;
  document.head.appendChild(css);
  const mkBtn = (id, html, title) => { const b = document.createElement('div'); b.id = id; b.title = title; b.innerHTML = html; document.body.appendChild(b); return b; };
  const btn = mkBtn('recBtn', '<span class="dot">⏺</span> <span class="txt">REC</span>', 'Video aufnehmen (F9)');
  const camBtn = mkBtn('camBtn', '📱 <span>Kamera</span>', 'Handy als Lenkrad-Kamera verbinden (F8)');
  const txt = btn.querySelector('.txt');
  const say = m => { if (typeof showMsg === 'function') showMsg(m); };

  function pickType() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    // zuerst MP4 (H.264 + AAC): läuft auf jedem Handy, in WhatsApp & Co. – WebM nur, wenn der Browser kein MP4 aufnehmen kann (z. B. Firefox)
    for (const t of ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) if (MediaRecorder.isTypeSupported(t)) return t;
    return '';
  }
  // Spielton (alles, was über den Hauptregler läuft) als Tonspur abzweigen.
  // Läuft die Tonausgabe nicht (noch kein Klick im Spiel), ohne Ton aufnehmen – sonst wartet die Aufnahme ewig auf Ton und bleibt leer
  async function gameAudio() {
    try {
      if (typeof initAudio === 'function') initAudio();
      if (!actx || !master) return null;
      if (actx.state !== 'running') { try { await Promise.race([actx.resume(), new Promise(r => setTimeout(r, 400))]); } catch (e) {} }
      if (actx.state !== 'running') return null;
      REC.aud = actx.createMediaStreamDestination(); master.connect(REC.aud);
      return REC.aud.stream.getAudioTracks()[0] || null;
    } catch (e) { return null; }
  }
  // Videospur aus einer Leinwand: Bilder werden nach jedem Spielbild übergeben (recFrame), sonst 30 fps automatisch
  function canvasStream(cv) {
    const s0 = cv.captureStream(0), t0 = s0.getVideoTracks()[0];
    if (t0 && t0.requestFrame) { REC.vt = t0; return s0; }
    if (t0) t0.stop(); return cv.captureStream(30);
  }
  const camReady = () => CAM.connected && CAM.video && CAM.video.videoWidth > 0;
  async function start() {
    if (REC.mr || REC.busy) return;
    if (!window.MediaRecorder) { say('Aufnahme geht in diesem Browser leider nicht'); return; }
    REC.busy = true;
    let stream = null, mode = 'bild';
    if (camReady()) {   // oben Spiel, unten Lenkrad-Kamera – auf einer Leinwand zusammengesetzt
      // Höhe des unteren Bereichs = echtes Format der Kamera (Querformat 16:9 → 720 px, Hochkant bis 1280 px) → nie gestaucht
      const gc = renderer.domElement, W = 1280, gH = Math.round(W * gc.height / gc.width / 2) * 2;
      const cH = Math.round(Math.min(1280, Math.max(360, W * CAM.video.videoHeight / CAM.video.videoWidth)) / 2) * 2;
      const c = document.createElement('canvas'); c.width = W; c.height = gH + cH;
      REC.comp = { c, g: c.getContext('2d'), W, gH, cH };
      try { stream = canvasStream(c); mode = 'kamera'; } catch (e) { stream = null; REC.comp = null; }
    }
    if (!stream && !TOUCH && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', systemAudio: 'exclude' });
        mode = 'tab';
      } catch (e) { stream = null; }   // abgelehnt → Spielbild direkt aufnehmen
    }
    if (!stream) {
      try { stream = canvasStream(renderer.domElement); } catch (e) { stream = null; }
      if (!stream) { REC.busy = false; say('Aufnahme geht in diesem Browser leider nicht'); return; }
      mode = 'bild';
    }
    if (!stream.getAudioTracks().length) { const a = await gameAudio(); if (a) stream.addTrack(a); }
    const type = pickType();
    let mr;
    try { mr = new MediaRecorder(stream, Object.assign({ videoBitsPerSecond: TOUCH ? 4e6 : mode === 'kamera' ? 10e6 : 8e6 }, type ? { mimeType: type } : {})); }
    catch (e) { try { mr = new MediaRecorder(stream); } catch (e2) { REC.busy = false; cleanup(stream); say('Aufnahme konnte nicht starten'); return; } }
    REC.chunks = [];
    mr.ondataavailable = e => { if (e.data && e.data.size) REC.chunks.push(e.data); };
    mr.onstop = save;
    const vt = stream.getVideoTracks()[0]; if (vt && mode === 'tab') vt.addEventListener('ended', stop);   // „Freigabe beenden“ im Browser = stoppen
    mr.start(1000);
    Object.assign(REC, { mr, stream, t0: performance.now(), type: mr.mimeType || type || 'video/webm', mode, busy: false });
    say(mode === 'kamera' ? '⏺ Aufnahme läuft: oben Spiel, unten Lenkrad – F9 = stoppen' : mode === 'tab' ? '⏺ Aufnahme läuft (mit Anzeigen und Ton) – F9 = stoppen' : `⏺ Aufnahme läuft – ${TOUCH ? '⏺ antippen' : 'F9'} = stoppen`);
    update();
  }
  function stop() { if (REC.mr && REC.mr.state !== 'inactive') try { REC.mr.stop(); } catch (e) {} }
  function cleanup(stream) {
    REC.vt = null; REC.comp = null;
    if (stream) for (const tr of stream.getTracks()) try { tr.stop(); } catch (e) {}
    try { if (REC.aud && master) master.disconnect(REC.aud); } catch (e) {}
    REC.aud = null;
  }
  function save() {
    const type = REC.type || 'video/webm', ext = type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
    const blob = new Blob(REC.chunks, { type: type.split(';')[0] }), secs = Math.round((performance.now() - REC.t0) / 1000);
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const name = `kampfzone-${REC.mode === 'kamera' ? 'lenkrad-' : ''}${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
    cleanup(REC.stream);
    REC.mr = null; REC.stream = null; REC.chunks = [];
    if (!blob.size) { say('Aufnahme war leer – bitte nochmal versuchen'); update(); return; }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    say(`💾 Video gespeichert: ${name} (${secs} s) – im Download-Ordner`);
    update();
  }
  function toggle() { if (REC.mr) stop(); else start(); }
  window.toggleRecording = toggle;

  // Ein Bild des Zusammenschnitts: oben Spiel (mit Tempo/Drift-Punkten), unten Lenkrad (füllend zugeschnitten)
  function drawComp() {
    const { g, W, gH, cH } = REC.comp, gc = renderer.domElement;
    g.drawImage(gc, 0, 0, W, gH);
    const v = CAM.video;
    if (camReady()) {   // ganzes Kamerabild im echten Seitenverhältnis einpassen (nichts gestaucht, nichts abgeschnitten); Rest schwarz
      const vw = v.videoWidth, vh = v.videoHeight, sc = Math.min(W / vw, cH / vh), dw = Math.round(vw * sc), dh = Math.round(vh * sc);
      g.fillStyle = '#000'; g.fillRect(0, gH, W, cH);
      g.drawImage(v, 0, 0, vw, vh, Math.round((W - dw) / 2), gH + Math.round((cH - dh) / 2), dw, dh);
    } else { g.fillStyle = '#111'; g.fillRect(0, gH, W, cH); g.fillStyle = '#888'; g.font = '700 40px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('Lenkrad-Kamera getrennt', W / 2, gH + cH / 2); g.textAlign = 'left'; }
    g.fillStyle = '#000'; g.fillRect(0, gH - 3, W, 6);   // Trennlinie
    // Anzeige im Spielbild: Tempo und Drift-Punkte (die HTML-Anzeigen sind nicht Teil des Spielbilds)
    if (typeof ride !== 'undefined' && ride.v >= 0) {
      const kmh = Math.round(Math.abs(ride.kind === 'plane' ? (ride.planeV || 0) : (ride.speed || 0)) * 3.6);
      g.font = '800 54px system-ui, sans-serif'; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.6)'; g.fillStyle = '#fff';
      g.strokeText(kmh + ' km/h', 28, gH - 30); g.fillText(kmh + ' km/h', 28, gH - 30);
      if (typeof DRIFT !== 'undefined' && DRIFT.pts > 0) { const t = 'DRIFT ' + Math.round(DRIFT.pts).toLocaleString('de-DE'); g.fillStyle = '#ffcc33'; g.strokeText(t, 28, gH - 96); g.fillText(t, 28, gH - 96); }
    }
  }
  // nach jedem fertigen Bild (ui.js): ins Video übernehmen, höchstens 30× pro Sekunde
  let lastF = 0;
  window.recFrame = () => {
    if (!REC.mr || (!REC.vt && !REC.comp)) return;
    const n = performance.now(); if (n - lastF < 32) return; lastF = n;
    if (REC.comp) drawComp();
    if (REC.vt) try { REC.vt.requestFrame(); } catch (e) {}
  };

  /* ---------- Handy als Lenkrad-Kamera verbinden (QR-Code → cam.html auf dem Handy, Bild kommt per WebRTC) ---------- */
  const PEER_CFG = { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] } };
  const camUrl = () => location.origin + location.pathname.replace(/[^/]*$/, '') + 'cam.html?c=' + CAM.code;
  function newCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
  function camStatus() {
    if (!CAM.panel) return;
    const st = CAM.panel.querySelector('.st');
    st.className = 'st ' + (CAM.connected ? 'ok' : 'wait');
    st.textContent = CAM.connected ? '✅ Handy verbunden – drück jetzt im Spiel F9: oben Spiel, unten Lenkrad' : CAM.peer && CAM.peer.open ? '⏳ Warte auf das Handy …' : '⏳ Verbinde mit dem Server …';
    camBtn.classList.toggle('on', CAM.connected);
  }
  function startPeer() {
    if (typeof Peer === 'undefined') { say('Verbindung nicht möglich (PeerJS fehlt)'); return; }
    if (CAM.peer && !CAM.peer.destroyed) return;
    CAM.code = newCode();
    CAM.peer = new Peer('kz-cam-' + CAM.code, PEER_CFG);
    CAM.peer.on('open', () => { showQr(); camStatus(); });
    CAM.peer.on('error', e => { if (e && e.type === 'unavailable-id') { try { CAM.peer.destroy(); } catch (x) {} CAM.peer = null; startPeer(); } else camStatus(); });
    CAM.peer.on('call', call => {
      if (CAM.call) try { CAM.call.close(); } catch (e) {}
      CAM.call = call; call.answer();
      call.on('stream', s => {
        CAM.video.srcObject = s; CAM.video.play().catch(() => {});
        CAM.connected = true; camStatus(); say('📱 Lenkrad-Kamera verbunden');
      });
      const lost = () => { if (CAM.call === call) { CAM.connected = false; camStatus(); say('📱 Lenkrad-Kamera getrennt'); } };
      call.on('close', lost); call.on('error', lost);
    });
    camStatus();
  }
  function showQr() {
    if (!CAM.panel) return;
    CAM.panel.querySelector('.code').textContent = CAM.code;
    CAM.panel.querySelector('.url').textContent = camUrl().replace(/^https?:\/\//, '').replace(/\?.*$/, '');
    const img = CAM.panel.querySelector('.qr');
    const draw = () => { try { const q = qrcode(0, 'M'); q.addData(camUrl()); q.make(); img.src = q.createDataURL(5, 4); } catch (e) {} };
    if (typeof qrcode === 'function') draw();
    else { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'; s.onload = draw; document.head.appendChild(s); }
  }
  function openCam() {
    if (document.pointerLockElement) document.exitPointerLock();
    if (!CAM.panel) {
      const p = document.createElement('div'); p.id = 'camPanel';
      p.innerHTML = `<h3>📱 Lenkrad-Kamera (iPhone / Handy)</h3>
        <ol><li>Handy und PC im <b>selben WLAN</b>.</li>
        <li>QR-Code mit der <b>Handy-Kamera</b> scannen – oder am Handy <b class="url"></b> öffnen und den Code <span class="code"></span> eingeben.</li>
        <li>Am Handy <b>„Kamera starten“</b> und aufs Lenkrad richten (quer oder hochkant – das Bild behält sein echtes Format).</li>
        <li>Zurück ins Spiel, <b>F9</b> = Aufnahme: oben das Spiel, unten das Lenkrad – gleichzeitig aufgenommen.</li></ol>
        <img class="qr" alt="QR-Code">
        <div class="st wait"></div><video muted playsinline autoplay></video>
        <div class="row"><button class="main close">Fertig</button><button class="drop">Kamera trennen</button></div>`;
      document.body.appendChild(p); CAM.panel = p;
      CAM.video = p.querySelector('video');
      for (const ev of ['mousedown', 'touchstart', 'pointerdown', 'click', 'keydown']) p.addEventListener(ev, e => e.stopPropagation());
      p.querySelector('.close').onclick = () => { p.style.display = 'none'; };
      p.querySelector('.drop').onclick = () => { if (CAM.call) try { CAM.call.close(); } catch (e) {} CAM.call = null; CAM.connected = false; CAM.video.srcObject = null; camStatus(); };
    }
    CAM.panel.style.display = 'block';
    startPeer(); if (CAM.peer && CAM.peer.open) showQr(); camStatus();
  }
  window.openLenkradCam = openCam;

  function update() {
    const on = !!REC.mr;
    btn.classList.toggle('on', on);
    if (on) { const s = Math.floor((performance.now() - REC.t0) / 1000); txt.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
    else txt.textContent = 'REC';
    const show = on || (typeof running !== 'undefined' && running);
    btn.style.display = show ? 'block' : 'none'; camBtn.style.display = show || CAM.connected ? 'block' : 'none';
  }
  setInterval(update, 500);
  btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggle(); });
  camBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openCam(); });
  for (const b of [btn, camBtn]) for (const ev of ['mousedown', 'touchstart', 'pointerdown']) b.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  window.addEventListener('keydown', e => {
    if (e.code === 'F9') { e.preventDefault(); toggle(); }
    else if (e.code === 'F8') { e.preventDefault(); openCam(); }
  });
})();
