'use strict';
/* ======================= Sprachchat =======================
   Ton geht direkt von Spieler zu Spieler (WebRTC über PeerJS, kein Server dazwischen).
   Sprechen: Taste B halten (änderbar: Optionen → Tastatur & Maus) · Handy: 🎤 antippen (an/aus).
   In der Pause: Sprachchat an/aus, „Mikro immer an“, Lautstärke der anderen.
   Das Mikrofon wird erst beim ersten Sprechen angefragt und sendet nur, solange man spricht.
   Zwischen zwei Spielern gibt es genau eine Sprachverbindung; wer schon ein Mikrofon hat, ruft an. */
(function () {
  if (window.KZ_PORTAL) return;   // Spieleportal: kein Sprachchat mit Fremden
  // mode: 'toggle' = Taste einmal drücken → Mikro bleibt an, bis man nochmal drückt (Standard) · 'ptt' = Taste halten · 'open' = immer an
  // live: Mikro ist eingeschaltet (bleibt gespeichert – auch nach dem Neuladen wieder an)
  const VC = { on: true, mode: 'toggle', live: false, vol: 1, stream: null, asking: false, denied: false, calls: {}, sent: {}, out: {}, ana: {}, speak: {} };
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
  $v('vcVol').oninput = e => { VC.vol = +e.target.value; save(); for (const id in VC.out) VC.out[id].volume = Math.min(1, VC.vol); for (const id in VC.ana) if (VC.ana[id].gain) VC.ana[id].gain.gain.value = VC.vol; };
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
    if (VC.stream) { for (const t of VC.stream.getTracks()) t.stop(); VC.stream = null; VC.meAna = null; hangAll(); }   // neues Mikrofon: beim nächsten Sprechen neu verbinden
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
      callAll();   // jetzt haben wir Ton → alle anrufen (bestehende Nur-Hören-Verbindungen werden ersetzt)
    }).catch(() => { VC.asking = false; VC.denied = true; syncSet(); if (typeof showMsg === 'function') showMsg('🎙 Mikrofon nicht erlaubt – im Browser freigeben, dann geht der Sprachchat.'); });
  }

  /* --- Verbindungen --- */
  function attach(call, mine) {
    call._mine = mine; VC.calls[call.peer] = call;
    call.on('stream', s => play(call.peer, s));
    const end = () => { if (VC.calls[call.peer] === call) { delete VC.calls[call.peer]; delete VC.sent[call.peer]; stop(call.peer); } };
    call.on('close', end); call.on('error', end);
  }
  function callTo(id) {
    if (!peer || !VC.stream || !human(id)) return;
    const old = VC.calls[id]; if (old) { delete VC.calls[id]; try { old.close(); } catch (e) {} }
    let c; try { c = peer.call(id, VC.stream); } catch (e) { return; }
    if (!c) return;
    attach(c, true); VC.sent[id] = true;
  }
  function callAll() { if (!VC.on || typeof world !== 'object') return; for (const id in world.players) if (human(id) && !VC.sent[id]) callTo(id); }
  function onCall(call) {
    if (!VC.on) { try { call.close(); } catch (e) {} return; }
    const id = call.peer, old = VC.calls[id];
    if (old && old._mine && VC.sent[id] && String(myId) < String(id)) { try { call.close(); } catch (e) {} return; }   // beide riefen gleichzeitig an: die Verbindung des „kleineren“ Namens gewinnt
    if (old) { delete VC.calls[id]; try { old.close(); } catch (e) {} }
    try { call.answer(VC.stream || undefined); } catch (e) { return; }
    attach(call, false); VC.sent[id] = !!VC.stream;
  }
  function hangAll() { for (const id in VC.calls) { try { VC.calls[id].close(); } catch (e) {} } VC.calls = {}; VC.sent = {}; for (const id in VC.out) stop(id); }

  /* --- Wiedergabe + „spricht gerade“-Erkennung --- */
  function play(id, stream) {
    stop(id);
    const a = new Audio(); a.autoplay = true; a.srcObject = stream; a.volume = Math.min(1, VC.vol); a.muted = false;
    const p = a.play(); if (p && p.catch) p.catch(() => {});
    VC.out[id] = a;
    const C = ac(); if (C) { try { const src = C.createMediaStreamSource(stream), an = C.createAnalyser(); an.fftSize = 512; src.connect(an); VC.ana[id] = { an, buf: new Uint8Array(an.fftSize) }; } catch (e) {} }
  }
  function stop(id) { const a = VC.out[id]; if (a) { try { a.pause(); a.srcObject = null; } catch (e) {} delete VC.out[id]; } delete VC.ana[id]; delete VC.speak[id]; }
  function level(o) { o.an.getByteTimeDomainData(o.buf); let s = 0; for (let i = 0; i < o.buf.length; i += 4) { const v = (o.buf[i] - 128) / 128; s += v * v; } return Math.sqrt(s / (o.buf.length / 4)); }

  /* --- Takt: Sprechen an/aus, neue Mitspieler anrufen, Anzeige --- */
  let hooked = null, lastScan = 0;
  setInterval(() => {
    if (typeof peer !== 'undefined' && peer && hooked !== peer) { hooked = peer; peer.on('call', onCall); }
    const playing = typeof running !== 'undefined' && running;
    const want = VC.on && playing && (VC.mode === 'open' || VC.live || (VC.mode === 'ptt' && typeof keys === 'object' && keys.Talk));
    if (want && !VC.stream) ensureMic();
    if (VC.stream) for (const t of VC.stream.getAudioTracks()) t.enabled = !!want;
    const now = performance.now();
    if (playing && VC.on && now - lastScan > 1500) {
      lastScan = now;
      if (VC.stream) callAll();
      for (const id in VC.calls) if (!world.players[id]) { try { VC.calls[id].close(); } catch (e) {} delete VC.calls[id]; delete VC.sent[id]; stop(id); }   // Spieler weg
    }
    for (const id in VC.ana) if (level(VC.ana[id]) > 0.035) VC.speak[id] = now;
    // Verbindung hängt fest oder ist gescheitert → schließen; beim nächsten Durchlauf wird neu angerufen
    for (const id in VC.calls) { const pc = VC.calls[id].peerConnection, st = pc && pc.iceConnectionState;
      if (st === 'failed' || (st === 'disconnected' && (VC.calls[id]._disc = VC.calls[id]._disc || now) && now - VC.calls[id]._disc > 6000)) { try { VC.calls[id].close(); } catch (e) {} delete VC.calls[id]; delete VC.sent[id]; stop(id); }
      else if (st !== 'disconnected') VC.calls[id]._disc = 0; }
    // Pause-Menü offen: Mikrofon-Pegel und Verbindung zu jedem Mitspieler anzeigen (zur Fehlersuche)
    const pz = document.getElementById('pause');
    if (pz && !pz.classList.contains('hidden') && now - (VC.connT || 0) > 400 && typeof world === 'object') {
      VC.connT = now; let h = '';
      const ml = VC.meAna ? level(VC.meAna) : 0;
      h += VC.stream ? `🎙 Dein Mikrofon${VC.micName ? ' (' + (typeof esc === 'function' ? esc(VC.micName.slice(0, 40)) : '') + ')' : ''}: <span style="display:inline-block;width:80px;height:8px;background:#333;border-radius:4px;vertical-align:middle;overflow:hidden"><span style="display:block;height:100%;width:${Math.min(100, ml * 600) | 0}%;background:#4cd964"></span></span> ${want ? '' : '(aus)'}<br>`
        : (VC.denied ? '' : '🎙 Mikrofon noch nicht eingeschaltet<br>');
      for (const id in world.players) {
        if (!human(id)) continue;
        const c = VC.calls[id], pc = c && c.peerConnection, st = pc ? pc.iceConnectionState : 'none';
        const ok = st === 'connected' || st === 'completed';
        const nm = typeof esc === 'function' ? esc(world.players[id].name || '?') : '?';
        h += `${ok ? '🟢' : st === 'none' ? '⚪' : st === 'failed' || st === 'disconnected' ? '🔴' : '🟡'} ${nm}: ${ok ? (VC.out[id] ? 'verbunden – Ton kommt an' : 'verbunden') : st === 'none' ? (VC.stream ? 'verbindet gleich …' : 'wartet, bis jemand das Mikro anmacht') : st === 'failed' || st === 'disconnected' ? 'keine Verbindung (Netzwerk) – neuer Versuch …' : 'verbindet …'}<br>`;
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
  const unlock = () => { ac(); for (const id in VC.out) { const a = VC.out[id]; if (a.paused) { const p = a.play(); if (p && p.catch) p.catch(() => {}); } } };
  document.addEventListener('pointerdown', unlock, true); document.addEventListener('keydown', unlock, true);
  document.getElementById('btnSet2') && document.getElementById('pause').addEventListener('click', () => syncSet());
  window.VOICE = VC;   // zum Nachsehen
})();
