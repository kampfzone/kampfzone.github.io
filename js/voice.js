'use strict';
/* ======================= Sprachchat =======================
   Ton läuft über die Spielverbindung (wie die Spielzüge, über den Host) – klappt in jedem Netz, in dem man zusammen spielen kann.
   Sprechen: Taste B halten (änderbar: Optionen → Tastatur & Maus) · Handy: 🎤 antippen (an/aus).
   In der Pause: Sprachchat an/aus, „Mikro immer an“, Lautstärke der anderen.
   Das Mikrofon wird erst beim ersten Sprechen angefragt und sendet nur, solange man spricht.
   Zwischen zwei Spielern gibt es genau eine Sprachverbindung; wer schon ein Mikrofon hat, ruft an. */
(function () {
  if (window.KZ_PORTAL) return;   // Spieleportal: kein Sprachchat mit Fremden
  // mode: 'toggle' = Taste einmal drücken → Mikro bleibt an, bis man nochmal drückt (Standard) · 'ptt' = Taste halten · 'open' = immer an
  // live: Mikro ist eingeschaltet (bleibt gespeichert – auch nach dem Neuladen wieder an)
  const VC = { on: true, mode: 'toggle', live: false, vol: 1, stream: null, asking: false, denied: false, rx: {}, last: {}, speak: {}, dec: {} };
  try { const s = JSON.parse(localStorage.getItem('kz_voice') || 'null'); if (s) { VC.on = s.on !== false; VC.mode = s.mode || (s.open ? 'open' : 'toggle'); VC.live = !!s.live; VC.vol = s.vol >= 0 ? s.vol : 1; VC.dev = s.dev || ''; } } catch (e) {}
  const save = () => { try { localStorage.setItem('kz_voice', JSON.stringify({ on: VC.on, mode: VC.mode, live: VC.live, vol: VC.vol, dev: VC.dev })); } catch (e) {} };
  // Taste (B) gedrückt: im Modus „an/aus“ umschalten
  window.voiceKey = () => { if (VC.mode !== 'toggle') return; if (!VC.on) { VC.on = true; VC.live = true; } else VC.live = !VC.live; save(); syncSet();
    if (typeof showMsg === 'function') showMsg(VC.live ? '🎙 Mikrofon AN – alle hören dich (nochmal drücken = aus)' : '🔇 Mikrofon aus'); };
  const human = id => id && id !== myId && !String(id).startsWith('bot');
  let AC = null;
  const ac = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; };

  /* --- Anzeige: unten links (wer spricht), dazu 🎤-Knopf --- */
  const css = document.createElement('style');
  css.textContent = `#vcHud{position:fixed;left:14px;bottom:150px;z-index:30;font:600 14px system-ui,sans-serif;color:#fff;pointer-events:none;text-shadow:0 1px 3px #000}
  #vcHud .vcMe{display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,.35);border-radius:16px;padding:4px 10px;margin-bottom:4px;pointer-events:auto;cursor:pointer}
  #vcHud .vcMe.live{background:rgba(200,30,40,.75)} #vcHud .vcMe.off{opacity:.55}
  #vcHud .vcP{background:rgba(0,0,0,.4);border-radius:12px;padding:3px 10px;margin-top:3px;width:max-content}
  body.touch #vcHud,#vcHud.tch{left:50%;bottom:auto;top:96px;transform:translateX(-50%);text-align:center}
  #vcSet{margin:12px 0 4px;padding:10px;border-radius:10px;background:rgba(255,255,255,.06);text-align:left;font-size:14px}
  #vcSet label{display:flex;align-items:center;gap:8px;margin:6px 0} #vcSet input[type=range]{flex:1}`;
  document.head.appendChild(css);
  const hud = document.createElement('div'); hud.id = 'vcHud'; if (typeof TOUCH !== 'undefined' && TOUCH) hud.className = 'tch'; hud.innerHTML = '<div class="vcMe"></div><div class="vcList"></div>';
  document.body.appendChild(hud);
  const meEl = hud.querySelector('.vcMe'), listEl = hud.querySelector('.vcList');
  meEl.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (!VC.on) VC.on = true; VC.live = !VC.live; save(); syncSet(); });   // 🎤 antippen = an/aus

  /* --- Einstellungen im Pause-Menü --- */
  const set = document.createElement('div'); set.id = 'vcSet';
  set.innerHTML = `<b>🎙 Sprachchat</b>
    <label><input type="checkbox" id="vcOn"> Sprachchat an (andere hören, selbst sprechen)</label>
    <label>Sprechen: <select id="vcMode"><option value="toggle">Taste drücken = an/aus</option><option value="ptt">Taste halten</option><option value="open">Mikro immer an</option></select></label>
    <label>Lautstärke der anderen <input type="range" id="vcVol" min="0" max="1.5" step="0.05"></label>
    <label>Mikrofon: <select id="vcDev" style="max-width:230px"><option value="">Standard (Windows)</option></select></label>
    <div id="vcInfo" style="font-size:12px;color:#a8c0a8"></div>
    <div id="vcConn" style="font-size:12px;margin-top:6px;line-height:1.5"></div>`;
  const pausePanel = document.querySelector('#pause .panel'), resume = document.getElementById('btnResume');
  if (pausePanel && resume) pausePanel.insertBefore(set, resume);
  const $v = id => document.getElementById(id);
  for (const ev of ['keydown', 'keyup']) set.addEventListener(ev, e => e.stopPropagation());
  function syncSet() {
    $v('vcOn').checked = VC.on; $v('vcMode').value = VC.mode; $v('vcVol').value = VC.vol;
    const k = typeof kbK === 'function' ? kbK('talk') : 'B';
    $v('vcInfo').textContent = VC.denied ? '⚠ Mikrofon blockiert – im Browser (Schloss-Symbol neben der Adresse) erlauben.'
      : (VC.mode === 'toggle' ? `Taste ${k} einmal drücken = Mikro an (bleibt an), nochmal = aus` : VC.mode === 'ptt' ? `Taste ${k} halten = sprechen` : 'Mikro ist immer an')
        + ' · Handy: 🎤 antippen. Ton geht direkt an die Mitspieler.';
  }
  $v('vcOn').onchange = e => { VC.on = e.target.checked; save(); if (!VC.on) hangAll(); };
  $v('vcMode').onchange = e => { VC.mode = e.target.value; if (VC.mode !== 'toggle') VC.live = false; save(); syncSet(); };
  $v('vcVol').oninput = e => { VC.vol = +e.target.value; save(); for (const id in VC.rx) VC.rx[id].g.gain.value = VC.vol; };
  // Mikrofon auswählen (Liste erst mit Namen, wenn das Mikrofon einmal erlaubt wurde)
  function fillDevs() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then(ds => {
      const sel = $v('vcDev'), mics = ds.filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');
      sel.innerHTML = '<option value="">Standard (Windows)</option>' + mics.map((d, i) => `<option value="${d.deviceId}">${(d.label || 'Mikrofon ' + (i + 1)).replace(/[<>&"]/g, '')}</option>`).join('');
      sel.value = mics.some(d => d.deviceId === VC.dev) ? VC.dev : '';
    }).catch(() => {});
  }
  $v('vcDev').onchange = e => {
    VC.dev = e.target.value; save();
    if (VC.stream) { for (const t of VC.stream.getTracks()) t.stop(); VC.stream = null; VC.meAna = null; stopSend(); }   // neues Mikrofon: beim nächsten Sprechen neu verbinden
  };
  fillDevs();
  syncSet();

  /* --- Mikrofon --- */
  function ensureMic() {
    if (VC.stream || VC.asking || VC.denied) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { VC.denied = true; syncSet(); return; }
    VC.asking = true;
    const aud = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }; if (VC.dev) aud.deviceId = { exact: VC.dev };
    navigator.mediaDevices.getUserMedia({ audio: aud }).catch(() => navigator.mediaDevices.getUserMedia({ audio: true })).then(s => {
      fillDevs();
      VC.stream = s; VC.asking = false; for (const t of s.getAudioTracks()) t.enabled = false;
      const C = ac(); if (C) { try { const src = C.createMediaStreamSource(s), an = C.createAnalyser(); an.fftSize = 512; src.connect(an); VC.meAna = { an, buf: new Uint8Array(an.fftSize) }; } catch (e) {} }   // eigener Pegel (Anzeige: kommt Ton vom Mikrofon?)
      VC.micName = (s.getAudioTracks()[0] || {}).label || '';
      startSend(s);
    }).catch(() => { VC.asking = false; VC.denied = true; syncSet(); if (typeof showMsg === 'function') showMsg('🎙 Mikrofon nicht erlaubt – im Browser freigeben, dann geht der Sprachchat.'); });
  }

  /* --- Übertragung: über die Spielverbindung (wie Spielzüge, über den Host) – klappt überall, wo das gemeinsame Spielen klappt.
     Mikrofon → 12 kHz, μ-law (1 Byte pro Abtastwert, ~12 kB/s) → Host → alle anderen; Stille wird nicht gesendet. */
  const RATE = 12000, TX_RATE = 16000;   // empfangen: alte Pakete 12 kHz, neue (r: 16) 16 kHz
  const enc = x => { const s = Math.max(-1, Math.min(1, x)); return (s < 0 ? 0x80 : 0) | Math.round(Math.log(1 + 255 * Math.abs(s)) / Math.log(256) * 127); };
  const DEC = new Float32Array(256); for (let v = 0; v < 256; v++) DEC[v] = (v & 0x80 ? -1 : 1) * (Math.pow(256, (v & 0x7f) / 127) - 1) / 255;
  /* --- Opus (wie Discord/WhatsApp): 48 kHz, ~32 kbit/s, 20-ms-Pakete – viel klarer als μ-law. Browser ohne WebCodecs nehmen weiter μ-law. --- */
  const OPUS_CFG = { codec: 'opus', sampleRate: 48000, numberOfChannels: 1, bitrate: 32000 };
  const HAS_OPUS = typeof AudioEncoder === 'function' && typeof AudioDecoder === 'function' && typeof AudioData === 'function' && typeof EncodedAudioChunk === 'function';
  function startOpus(s) {
    let C2; try { C2 = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 }); } catch (e) { return false; }
    if (C2.sampleRate !== 48000) { try { C2.close(); } catch (e) {} return false; }
    let enc2, ts = 0, hold = 0;
    // 5 Opus-Pakete (100 ms) zu einer Nachricht bündeln: weniger Nachrichten = weniger Stocken über die Spielverbindung
    const pend = [];
    const flush = () => {
      if (!pend.length) return;
      let n = 0; for (const p of pend) n += 2 + p.length;
      const out = new Uint8Array(n); let k = 0;
      for (const p of pend) { out[k++] = p.length >> 8; out[k++] = p.length & 255; out.set(p, k); k += p.length; }
      pend.length = 0;
      try { net.send({ t: 'vc', o: 2, d: out }); } catch (e) {}
    };
    try {
      enc2 = new AudioEncoder({
        output: ch => { const b = new Uint8Array(ch.byteLength); ch.copyTo(b); pend.push(b); if (pend.length >= 5) flush(); },
        error: () => { VC.opusBroken = true; },
      });
      enc2.configure(Object.assign({ opus: { frameDuration: 20000, complexity: 8, application: 'voip' } }, OPUS_CFG));
    } catch (e) { try { C2.close(); } catch (e2) {} return false; }
    const src = C2.createMediaStreamSource(s), pr = C2.createScriptProcessor(1024, 1, 1), z = C2.createGain(); z.gain.value = 0;
    src.connect(pr); pr.connect(z); z.connect(C2.destination);
    pr.onaudioprocess = e => {
      const inp = e.inputBuffer.getChannelData(0), dur = inp.length / 48000 * 1e6;
      if (!VC.sending || typeof net !== 'object' || VC.opusBroken) { ts += dur; return; }
      let rms = 0; for (let i = 0; i < inp.length; i += 2) rms += inp[i] * inp[i]; rms = Math.sqrt(rms / (inp.length / 2));
      const now = performance.now(); if (rms > 0.004) hold = now + 450;   // nach dem Sprechen noch kurz weiter senden: keine abgeschnittenen Silben
      if (now >= hold && pend.length) flush();   // Satzende: Rest sofort schicken
      if (now < hold) { try { const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: inp.length, numberOfChannels: 1, timestamp: ts, data: new Float32Array(inp) }); enc2.encode(ad); ad.close(); } catch (err) {} }
      ts += dur;
    };
    if (C2.state === 'suspended') { const r = () => C2.resume(); addEventListener('pointerdown', r, { once: true }); addEventListener('keydown', r, { once: true }); }
    VC.proc = pr; VC.procSrc = src; VC.opusCtx = C2; VC.opusEnc = enc2;
    return true;
  }
  function startSend(s) {
    if (VC.proc) return;
    // Opus klang in echten Spielen schlechter → wieder die bewährte μ-law-Übertragung senden (Empfang von Opus bleibt für ältere Versionen)
    const C = ac(); if (!C || VC.proc) return;
    try {
      // 16 kHz („HD-Telefon“): vorher Tiefpass (2× 7 kHz), dann sauber umrechnen (lineare Interpolation, fortlaufend über die Blöcke)
      const src = C.createMediaStreamSource(s), pr = C.createScriptProcessor(2048, 1, 1), z = C.createGain(); z.gain.value = 0;
      const lp1 = C.createBiquadFilter(), lp2 = C.createBiquadFilter();
      for (const f of [lp1, lp2]) { f.type = 'lowpass'; f.frequency.value = 7000; f.Q.value = -3.01; }   // Q in dB: −3 dB = ohne Überhöhung (Butterworth)
      src.connect(lp1); lp1.connect(lp2); lp2.connect(pr); pr.connect(z); z.connect(C.destination);
      let ph = 0, prev = 0, hold = 0;
      pr.onaudioprocess = e => {
        const inp = e.inputBuffer.getChannelData(0), L = inp.length, step = C.sampleRate / TX_RATE;
        const on = VC.sending && typeof net === 'object', out = on ? new Uint8Array(Math.ceil(L / step) + 2) : null;
        let n = 0, rms = 0;
        while (ph <= L - 1) {
          const k = Math.floor(ph), f = ph - k, a = k < 0 ? prev : inp[k], b = k + 1 < L ? inp[k + 1] : a;
          if (on) { const v = a + (b - a) * f; rms += v * v; out[n++] = enc(v); }
          ph += step;
        }
        ph -= L; prev = inp[L - 1];
        if (!on || !n) return;
        const now = performance.now(); if (Math.sqrt(rms / n) >= 0.003) hold = now + 350;   // nach dem Sprechen kurz weiter senden: keine abgeschnittenen Silben
        if (now > hold) return;   // Stille
        try { net.send({ t: 'vc', r: 16, d: out.subarray(0, n) }); } catch (err) {}
      };
      VC.proc = pr; VC.procSrc = src;
    } catch (e) {}
  }
  function stopSend() {
    if (VC.proc) { try { VC.procSrc.disconnect(); VC.proc.disconnect(); } catch (e) {} VC.proc = null; }
    if (VC.opusEnc) { try { VC.opusEnc.close(); } catch (e) {} VC.opusEnc = null; }
    if (VC.opusCtx) { try { VC.opusCtx.close(); } catch (e) {} VC.opusCtx = null; }
  }
  // Abspielen: Pakete eines Mitspielers lückenlos hintereinander, mit kleinem Puffer gegen Ruckeln
  function vcPlay(id, ch, rate, C) {
    let rms = 0; for (let i = 0; i < ch.length; i++) rms += ch[i] * ch[i];
    const now = performance.now(); VC.last[id] = now;
    if (Math.sqrt(rms / ch.length) > 0.02) VC.speak[id] = now;
    let o = VC.rx[id]; if (!o) { o = VC.rx[id] = { g: C.createGain(), t: 0 }; o.g.connect(C.destination); }
    o.g.gain.value = VC.vol;
    const buf = C.createBuffer(1, ch.length, rate); buf.getChannelData(0).set(ch);
    const t0 = C.currentTime; if (o.t < t0 + 0.02 || o.t > t0 + 0.7) o.t = t0 + 0.12;   // Puffer gegen Ruckeln (bei Lücke neu aufbauen)
    const sn = C.createBufferSource(); sn.buffer = buf; sn.connect(o.g); sn.start(o.t); o.t += buf.duration;
  }
  function opusRecv(id, u, C) {
    let o = VC.dec[id];
    if (!o) {
      o = VC.dec[id] = { ts: 0, d: null, acc: [], n: 0, rate: 48000, tm: 0 };
      try {
        o.d = new AudioDecoder({
          output: ad => {   // Stücke sammeln und als größere Blöcke abspielen (keine Knackser an den 20-ms-Grenzen)
            try {
              const f = new Float32Array(ad.numberOfFrames); ad.copyTo(f, { planeIndex: 0, format: 'f32-planar' });
              o.acc.push(f); o.n += f.length; o.rate = ad.sampleRate;
              const go = () => { clearTimeout(o.tm); o.tm = 0; if (!o.n) return; const all = new Float32Array(o.n); let k = 0; for (const a of o.acc) { all.set(a, k); k += a.length; } o.acc = []; o.n = 0; vcPlay(id, all, o.rate, C); };
              if (o.n >= o.rate * 0.1) go(); else if (!o.tm) o.tm = setTimeout(go, 40);
            } catch (e) {}
            ad.close();
          },
          error: () => { delete VC.dec[id]; },
        });
        o.d.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 1 });
      } catch (e) { o.d = null; }
    }
    if (!o.d) return;
    try { o.d.decode(new EncodedAudioChunk({ type: 'key', timestamp: o.ts, data: u })); o.ts += 20000; } catch (e) { delete VC.dec[id]; }
  }
  // Ton von einem Mitspieler (net.js ruft das auf): hintereinander abspielen, mit kleinem Puffer gegen Ruckeln
  window.vcRecv = (id, d, opus, r) => {
    if (!VC.on || !d || id === myId) return;
    const C = ac(); if (!C) return;
    const u = d instanceof Uint8Array ? d : d instanceof ArrayBuffer ? new Uint8Array(d) : ArrayBuffer.isView(d) ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : null;
    if (!u || !u.length) return;
    if (opus === 2) { if (HAS_OPUS) for (let k = 0; k + 2 <= u.length;) { const n = (u[k] << 8) | u[k + 1]; k += 2; if (!n || k + n > u.length) break; opusRecv(id, u.subarray(k, k + n), C); k += n; } return; }
    if (opus) { if (HAS_OPUS) opusRecv(id, u, C); return; }
    const ch = new Float32Array(u.length); for (let i = 0; i < u.length; i++) ch[i] = DEC[u[i]];
    vcPlay(id, ch, r === 16 ? 16000 : RATE, C);
  };
  function hangAll() { for (const id in VC.rx) { try { VC.rx[id].g.disconnect(); } catch (e) {} } VC.rx = {}; VC.speak = {}; for (const id in VC.dec) { try { VC.dec[id].d.close(); } catch (e) {} } VC.dec = {}; }
  function level(o) { o.an.getByteTimeDomainData(o.buf); let s = 0; for (let i = 0; i < o.buf.length; i += 4) { const v = (o.buf[i] - 128) / 128; s += v * v; } return Math.sqrt(s / (o.buf.length / 4)); }

  /* --- Takt: Sprechen an/aus, neue Mitspieler anrufen, Anzeige --- */
  setInterval(() => {
    const playing = typeof running !== 'undefined' && running;
    const want = VC.on && playing && (VC.mode === 'open' || VC.live || (VC.mode === 'ptt' && typeof keys === 'object' && keys.Talk));
    if (want && !VC.stream) ensureMic();
    if (VC.stream) for (const t of VC.stream.getAudioTracks()) t.enabled = !!want;
    VC.sending = !!want;
    const now = performance.now();
    for (const id in VC.rx) if (typeof world === 'object' && !world.players[id]) { try { VC.rx[id].g.disconnect(); } catch (e) {} delete VC.rx[id]; delete VC.speak[id]; }   // Spieler weg
    // Pause-Menü offen: Mikrofon-Pegel und Verbindung zu jedem Mitspieler anzeigen (zur Fehlersuche)
    const pz = document.getElementById('pause');
    if (pz && !pz.classList.contains('hidden') && now - (VC.connT || 0) > 400 && typeof world === 'object') {
      VC.connT = now; let h = '';
      const ml = VC.meAna ? level(VC.meAna) : 0;
      h += VC.stream ? `🎙 Dein Mikrofon${VC.micName ? ' (' + (typeof esc === 'function' ? esc(VC.micName.slice(0, 40)) : '') + ')' : ''}: <span style="display:inline-block;width:80px;height:8px;background:#333;border-radius:4px;vertical-align:middle;overflow:hidden"><span style="display:block;height:100%;width:${Math.min(100, ml * 600) | 0}%;background:#4cd964"></span></span> ${want ? '' : '(aus)'}<br>`
        : (VC.denied ? '' : '🎙 Mikrofon noch nicht eingeschaltet<br>');
      for (const id in world.players) {
        if (!human(id)) continue;
        const nm = typeof esc === 'function' ? esc(world.players[id].name || '?') : '?', hear = now - (VC.last[id] || -1e9) < 1500;
        h += `🟢 ${nm}: ${hear ? 'Ton kommt an 🔊' : 'verbunden (spricht gerade nicht)'}<br>`;
      }
      const ce = document.getElementById('vcConn'); if (ce && ce.innerHTML !== h) ce.innerHTML = h;
    }
    // Anzeige
    hud.style.display = playing ? '' : 'none';
    if (!playing) return;
    const key = typeof kbK === 'function' ? kbK('talk') : 'B';
    meEl.className = 'vcMe' + (want ? ' live' : '') + (VC.on ? '' : ' off');
    // kommt überhaupt Ton vom Mikrofon? (8 s lang Stille trotz „Mikro AN“ → Hinweis)
    if (want && VC.meAna) { if (level(VC.meAna) > 0.01) VC.meLoud = now; else if (!VC.meLoud) VC.meLoud = now; } else VC.meLoud = 0;
    const silent = want && VC.meAna && VC.meLoud && now - VC.meLoud > 8000;
    meEl.textContent = !VC.on ? '🎙 Sprachchat aus' : VC.denied ? '🎙 Mikro blockiert' : want ? (VC.mode === 'ptt' ? '🔴 Du sprichst …' : `🔴 Mikro AN${VC.mode === 'toggle' ? (TOUCH ? ' (antippen = aus)' : ` (${key} = aus)`) : ''}`)
      : `🎤 ${TOUCH ? 'antippen' : VC.mode === 'ptt' ? key + ' halten' : key + ' drücken'} = Mikro an`;
    if (silent) meEl.textContent += ' · ⚠ Mikro ist still – richtiges Mikrofon gewählt? (Esc → Sprachchat)';
    let html = '';
    for (const id in VC.speak) if (now - VC.speak[id] < 400 && world.players[id]) html += `<div class="vcP">🔊 ${typeof esc === 'function' ? esc(world.players[id].name || '?') : '?'}</div>`;
    if (listEl.innerHTML !== html) listEl.innerHTML = html;
  }, 60);
  // Browser hat das Abspielen blockiert (kein Klick vorher)? Beim nächsten Klick/Tastendruck nachholen
  const unlock = () => { ac(); };
  document.addEventListener('pointerdown', unlock, true); document.addEventListener('keydown', unlock, true);
  document.getElementById('btnSet2') && document.getElementById('pause').addEventListener('click', () => syncSet());
  window.VOICE = VC;   // zum Nachsehen
})();
