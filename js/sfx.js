'use strict';
/* ======================= Menü-Klänge und Menü-Musik =======================
   - Knöpfe: leises „Tick“ beim Drüberfahren, kurzes „Blip“ beim Klicken (Menü, Pause, Optionen, Läden …)
   - Menü-Musik: eigene, im Browser erzeugte Elektro-Schleife (Bass, Beat, Akkorde) – nur im Hauptmenü, beim Spielstart ausgeblendet
   - Optionen → „🎵 Menü-Musik: AN/AUS“ (gespeichert)
   Browser erlauben Ton erst nach dem ersten Klick/Tastendruck → dann startet alles. */
(function () {
  const MUS = { on: true, playing: false, gain: null, timer: 0, next: 0, step: 0, bar: 0 };
  try { MUS.on = localStorage.getItem('kz_music') !== '0'; } catch (e) {}
  const ready = () => typeof actx !== 'undefined' && actx && master;

  /* --- Knopf-Klänge --- */
  function uiTick(hover) {
    if (!ready()) return;
    // weich und tief (kein Piepen): Drüberfahren = leises „Tock“, Klicken = kurzer, runder „Plopp“
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(hover ? 520 : 440, t); o.frequency.exponentialRampToValueAtTime(hover ? 380 : 260, t + 0.06);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(hover ? 0.03 : 0.1, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + (hover ? 0.05 : 0.09));
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.13);
  }
  let lastBtn = null, lastHover = 0;
  const isBtn = el => el && el.closest && el.closest('button, select, .shopItem, .invSlot, [data-sell]');
  document.addEventListener('pointerover', e => {
    const b = isBtn(e.target); if (!b || b === lastBtn) return; lastBtn = b;
    const now = performance.now(); if (now - lastHover < 45 || b.disabled) return; lastHover = now; uiTick(true);
  }, true);
  document.addEventListener('pointerout', e => { if (isBtn(e.target) === lastBtn && !isBtn(e.relatedTarget)) lastBtn = null; }, true);
  document.addEventListener('click', e => { const b = isBtn(e.target); if (b && !b.disabled) uiTick(false); }, true);

  /* --- Menü-Musik: 112 Schläge/Minute, Akkorde Am – F – C – G, 16 Schritte pro Takt --- */
  const BPM = 112, STEP = 60 / BPM / 4;
  const CH = [   // Bass-Grundton, Akkordtöne (Hz)
    [110.0, [220.0, 261.6, 329.6]], [87.31, [174.6, 220.0, 261.6]], [130.8, [196.0, 261.6, 329.6]], [98.0, [196.0, 246.9, 293.7]]];
  const BASS = [0, 3, 6, 8, 11, 14], ARP = [0, 1, 2, 1, 2, 0, 1, 2];
  function voice(type, f, t, len, vol, cut) {
    const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = f;
    let n = o; if (cut) { const fl = actx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cut; o.connect(fl); n = fl; }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, len * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(g); g.connect(MUS.gain); o.start(t); o.stop(t + len + 0.02);
  }
  function noise(t, len, vol, type, f, q) {
    const s = noiseSrc(), fl = actx.createBiquadFilter(), g = actx.createGain(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(fl); fl.connect(g); g.connect(MUS.gain); s.start(t, Math.random() * 1.5); s.stop(t + len + 0.02);
  }
  function kick(t) {
    const o = actx.createOscillator(), g = actx.createGain(); o.frequency.setValueAtTime(125, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); o.connect(g); g.connect(MUS.gain); o.start(t); o.stop(t + 0.3);
  }
  function playStep(t) {
    const s = MUS.step, [root, tones] = CH[MUS.bar % 4], intro = MUS.bar < 2;
    if (s % 4 === 0) kick(t);
    if (!intro && (s === 4 || s === 12)) noise(t, 0.16, 0.32, 'bandpass', 1700, 0.8);       // Klatschen
    if (s % 4 === 2) noise(t, 0.03, 0.05, 'highpass', 6000);                                 // leise Hi-Hat (nur auf den Off-Beats, kein Dauerrauschen)
    if (BASS.includes(s)) voice('sawtooth', root, t, STEP * 1.8, 0.2, 420);                     // Bass
    if (s === 0) for (const f of tones) voice('triangle', f, t, STEP * 15, 0.035, 1400);        // Flächen-Akkord
    if (!intro && s % 2 === 0) voice('triangle', tones[ARP[(s / 2) % 8]], t, STEP * 0.9, 0.03, 1500);   // weiches Arpeggio (tiefer, ohne Quietschen)
  }
  function schedule() {
    if (!ready() || !MUS.gain) return;
    while (MUS.next < actx.currentTime + 0.25) {
      playStep(MUS.next);
      MUS.next += STEP; MUS.step++; if (MUS.step >= 16) { MUS.step = 0; MUS.bar++; }
    }
  }
  function startMusic() {
    if (MUS.playing || !MUS.on || !ready()) return;
    if (!MUS.gain) { MUS.gain = actx.createGain(); MUS.gain.connect(master); }
    MUS.playing = true; MUS.step = 0; MUS.bar = 0; MUS.next = actx.currentTime + 0.1;
    MUS.gain.gain.cancelScheduledValues(actx.currentTime); MUS.gain.gain.setValueAtTime(0.0001, actx.currentTime); MUS.gain.gain.linearRampToValueAtTime(0.16, actx.currentTime + 1.5);
    clearInterval(MUS.timer); MUS.timer = setInterval(schedule, 60);
  }
  function stopMusic(fast) {
    if (!MUS.playing) return;
    MUS.playing = false;
    if (ready() && MUS.gain) { const t = actx.currentTime; MUS.gain.gain.cancelScheduledValues(t); MUS.gain.gain.setValueAtTime(MUS.gain.gain.value, t); MUS.gain.gain.linearRampToValueAtTime(0.0001, t + (fast ? 0.15 : 0.9)); }
    setTimeout(() => { if (!MUS.playing) clearInterval(MUS.timer); }, fast ? 200 : 1000);
  }
  // Ton freischalten beim ersten Klick/Tastendruck, Musik im Menü an, im Spiel aus
  const unlock = () => { if (typeof initAudio === 'function') initAudio(); };
  document.addEventListener('pointerdown', unlock, true); document.addEventListener('keydown', unlock, true);
  setInterval(() => {
    const inMenu = typeof running !== 'undefined' && !running;
    if (inMenu && MUS.on) startMusic(); else stopMusic(!inMenu);
  }, 300);

  /* --- Schalter in den Optionen --- */
  const btn = document.createElement('button'); btn.id = 'btnMusic'; btn.className = 'sec';
  const label = () => { btn.textContent = '🎵 Menü-Musik: ' + (MUS.on ? 'AN' : 'AUS'); };
  btn.onclick = () => { MUS.on = !MUS.on; try { localStorage.setItem('kz_music', MUS.on ? '1' : '0'); } catch (e) {} label(); if (!MUS.on) stopMusic(true); };
  const after = document.getElementById('btnThr') || document.getElementById('btnFps');
  if (after && after.parentNode) after.parentNode.insertBefore(btn, after.nextSibling);
  label();
  window.MENU_MUSIC = MUS;
})();
