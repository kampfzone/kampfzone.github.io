/* ======================= Bildschirmaufnahme: Video vom Spiel aufnehmen =======================
   F9 oder Knopf ⏺ oben rechts: Aufnahme starten, nochmal = stoppen → das Video wird als Datei gespeichert
   (Download-Ordner, Name „kampfzone-Datum-Uhrzeit.webm“ bzw. „.mp4“ auf iPhone/Mac-Safari).
   PC: nimmt den ganzen Spiel-Tab auf – mit allen Anzeigen (Fadenkreuz, Leben, Karte …) und Ton.
       Der Browser fragt dabei einmal, ob dieser Tab geteilt werden darf.
   Handy (oder wenn man am PC „Abbrechen“ drückt): nimmt das Spielbild direkt auf, mit Spielton, ohne Anzeigen. */
(function () {
  const REC = { mr: null, chunks: [], t0: 0, stream: null, aud: null, type: '', mode: '' };
  const css = document.createElement('style');
  css.textContent = `#recBtn { position: fixed; right: 92px; top: 10px; z-index: 60; font: 700 14px/1 Rajdhani, system-ui, sans-serif; letter-spacing: .5px;
      background: rgba(0,0,0,.55); color: #fff; padding: 6px 10px; border-radius: 6px; cursor: pointer; user-select: none; -webkit-user-select: none; display: none; }
    #recBtn .dot { color: #ff4a3a; } #recBtn.on { background: rgba(190,20,20,.88); } #recBtn.on .dot { color: #fff; animation: recBlink 1s steps(2) infinite; }
    @keyframes recBlink { 50% { opacity: 0; } }
    body.touch #recBtn { right: 14px; top: 92px; font-size: 12px; padding: 5px 8px; }`;
  document.head.appendChild(css);
  const btn = document.createElement('div'); btn.id = 'recBtn'; btn.title = 'Video aufnehmen (F9)';
  btn.innerHTML = '<span class="dot">⏺</span> <span class="txt">REC</span>';
  document.body.appendChild(btn);
  const txt = btn.querySelector('.txt');

  function pickType() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    for (const t of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a', 'video/mp4']) if (MediaRecorder.isTypeSupported(t)) return t;
    return '';
  }
  // Spielton (alles, was über den Hauptregler läuft) als Tonspur abzweigen
  function gameAudio() {
    try {
      if (typeof initAudio === 'function') initAudio();
      if (!actx || !master) return null;
      REC.aud = actx.createMediaStreamDestination(); master.connect(REC.aud);
      return REC.aud.stream.getAudioTracks()[0] || null;
    } catch (e) { return null; }
  }
  const say = m => { if (typeof showMsg === 'function') showMsg(m); };
  async function start() {
    if (REC.mr || REC.busy) return;
    if (!window.MediaRecorder) { say('Aufnahme geht in diesem Browser leider nicht'); return; }
    REC.busy = true;
    let stream = null, mode = 'bild';
    if (!TOUCH && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', systemAudio: 'exclude' });
        mode = 'tab';
      } catch (e) { stream = null; }   // abgelehnt → Spielbild direkt aufnehmen
    }
    if (!stream) {
      // Spielbild: nach jedem gezeichneten Bild wird es (höchstens 30× pro Sekunde) ins Video übernommen (recFrame in ui.js)
      try {
        const s0 = renderer.domElement.captureStream(0), t0 = s0.getVideoTracks()[0];
        if (t0 && t0.requestFrame) { stream = s0; REC.vt = t0; } else { if (t0) t0.stop(); stream = renderer.domElement.captureStream(30); }
      } catch (e) { stream = null; }
      if (!stream) { REC.busy = false; say('Aufnahme geht in diesem Browser leider nicht'); return; }
      mode = 'bild';
    }
    if (!stream.getAudioTracks().length) { const a = gameAudio(); if (a) stream.addTrack(a); }
    const type = pickType();
    let mr;
    try { mr = new MediaRecorder(stream, Object.assign({ videoBitsPerSecond: TOUCH ? 4e6 : 8e6 }, type ? { mimeType: type } : {})); }
    catch (e) { try { mr = new MediaRecorder(stream); } catch (e2) { REC.busy = false; cleanup(stream); say('Aufnahme konnte nicht starten'); return; } }
    REC.chunks = [];
    mr.ondataavailable = e => { if (e.data && e.data.size) REC.chunks.push(e.data); };
    mr.onstop = save;
    const vt = stream.getVideoTracks()[0]; if (vt) vt.addEventListener('ended', stop);   // „Freigabe beenden“ im Browser = stoppen
    mr.start(1000);
    Object.assign(REC, { mr, stream, t0: performance.now(), type: mr.mimeType || type || 'video/webm', mode, busy: false });
    say(mode === 'tab' ? '⏺ Aufnahme läuft (mit Anzeigen und Ton) – F9 = stoppen' : `⏺ Aufnahme läuft – ${TOUCH ? '⏺ antippen' : 'F9'} = stoppen`);
    update();
  }
  function stop() { if (REC.mr && REC.mr.state !== 'inactive') try { REC.mr.stop(); } catch (e) {} }
  function cleanup(stream) {
    REC.vt = null;
    if (stream) for (const tr of stream.getTracks()) try { tr.stop(); } catch (e) {}
    try { if (REC.aud && master) master.disconnect(REC.aud); } catch (e) {}
    REC.aud = null;
  }
  function save() {
    const type = REC.type || 'video/webm', ext = type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
    const blob = new Blob(REC.chunks, { type: type.split(';')[0] }), secs = Math.round((performance.now() - REC.t0) / 1000);
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const name = `kampfzone-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
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
  // nach jedem fertigen Bild (ui.js): Spielbild ins Video übernehmen, höchstens 30× pro Sekunde
  let lastF = 0;
  window.recFrame = () => {
    if (!REC.vt || !REC.mr) return;
    const n = performance.now(); if (n - lastF < 32) return; lastF = n;
    try { REC.vt.requestFrame(); } catch (e) {}
  };
  function update() {
    const on = !!REC.mr;
    btn.classList.toggle('on', on);
    if (on) { const s = Math.floor((performance.now() - REC.t0) / 1000); txt.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
    else txt.textContent = 'REC';
    btn.style.display = on || (typeof running !== 'undefined' && running) ? 'block' : 'none';
  }
  setInterval(update, 500);
  btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggle(); });
  for (const ev of ['mousedown', 'touchstart', 'pointerdown']) btn.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  window.addEventListener('keydown', e => { if (e.code === 'F9') { e.preventDefault(); toggle(); } });
})();
