'use strict';
/* ======================= CrazyGames (nur im CrazyGames-Paket aktiv: window.KZ_PORTAL = 'crazygames') =======================
   - meldet „Spiel läuft“ / „Pause“ an CrazyGames (gameplayStart/Stop) und „Laden fertig“
   - Werbung nur zwischen zwei Runden (Rundenende), Ton dabei stumm; CrazyGames-Einstellung „Ton aus“ wird beachtet
   - CrazyGames-Benutzername als Spielername (wenn eingeloggt und kein eigener Name gesetzt)
   - Einladen: Link von CrazyGames mit Raum-Code; wer über so einen Link kommt, tritt dem Raum automatisch bei
   Auf kampfzone.github.io passiert hier nichts. */
(function () {
  if (window.KZ_PORTAL !== 'crazygames') return;
  let SDK = null, playing = false, adBusy = false, lastEnd = false, room = null;
  const mute = on => { try { if (master) master.gain.value = on ? 0 : volume; } catch (e) {} };
  const muteWanted = () => adBusy || (SDK && SDK.game.settings && SDK.game.settings.muteAudio);
  // Spielstand (Münzen, Waffen, Tuning, Einstellungen …) zusätzlich im CrazyGames-Datenmodul speichern:
  // so bleibt der Fortschritt beim CrazyGames-Konto, auch auf einem anderen Gerät. Alles „kz_…“ aus dem Browser-Speicher
  // wird als ein Paket abgelegt (Schlüssel „kz_save“).
  const SAVE = 'kz_save';
  let sync = false, pushT = 0;
  const snap = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('kz_') === 0) o[k] = localStorage.getItem(k); } return o; };
  const push = () => { if (!sync) return; clearTimeout(pushT); pushT = setTimeout(() => { try { SDK.data.setItem(SAVE, JSON.stringify(snap())); } catch (e) {} }, 800); };
  const oSet = Storage.prototype.setItem, oDel = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) { oSet.call(this, k, v); if (this === localStorage && String(k).indexOf('kz_') === 0) push(); };
  Storage.prototype.removeItem = function (k) { oDel.call(this, k); if (this === localStorage && String(k).indexOf('kz_') === 0) push(); };
  function loadSave() {
    if (!SDK.data) return;
    let cloud = null; try { cloud = JSON.parse(SDK.data.getItem(SAVE) || 'null'); } catch (e) {}
    if (cloud && typeof cloud === 'object') {
      let changed = false;
      for (const k in cloud) if (k.indexOf('kz_') === 0 && typeof cloud[k] === 'string' && localStorage.getItem(k) !== cloud[k]) { oSet.call(localStorage, k, cloud[k]); changed = true; }
      if (changed) {
        // Spielstand von CrazyGames ist anders als hier → einmal neu laden, damit das Spiel ihn übernimmt
        let again = false; try { again = sessionStorage.getItem('kz_cgsync') === '1'; sessionStorage.setItem('kz_cgsync', '1'); } catch (e) { again = true; }
        if (!running && !again) { location.reload(); return 'reload'; }   // höchstens einmal pro Besuch (keine Endlosschleife)
        if (again) { sync = true; push(); }
        return;   // schon im Spiel: nichts überschreiben, der gespeicherte Stand bleibt bis zum nächsten Laden erhalten
      }
    }
    sync = true; push();
  }
  const s = document.createElement('script'); s.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
  s.onload = async () => {
    try { await window.CrazyGames.SDK.init(); SDK = window.CrazyGames.SDK; } catch (e) { return; }
    try { if (loadSave() === 'reload') return; } catch (e) {}
    try { SDK.game.loadingStart(); } catch (e) {}
    try { SDK.game.addSettingsChangeListener(() => mute(muteWanted())); } catch (e) {}
    // Benutzername übernehmen
    try { if (SDK.user.isUserAccountAvailable) { const u = await SDK.user.getUser(); const inp = document.getElementById('nameIn');
      if (u && u.username && inp && !localStorage.getItem('kz_name')) inp.value = u.username.slice(0, 16); } } catch (e) {}
    // Über eine Einladung gekommen → automatisch beitreten
    let invited = false;
    try { const code = SDK.game.getInviteParam('room'); if (code && /^[A-Z0-9]{5}$/.test(code) && !running) { invited = true; document.getElementById('codeIn').value = code; setTimeout(() => document.getElementById('btnJoin').click(), 600); } } catch (e) {}
    // Einladung angenommen, während man schon im Spiel ist → aktuellen Raum verlassen und dem Raum des Freundes beitreten
    try { SDK.game.addJoinRoomListener(p => {
      const code = p && p.room; if (!code || !/^[A-Z0-9]{5}$/.test(code) || code === roomCode) return;
      if (!running) { document.getElementById('codeIn').value = code; document.getElementById('btnJoin').click(); return; }
      try { SDK.game.leftRoom(); } catch (e) {}
      try { sessionStorage.setItem('kz_autojoin', code); } catch (e) {}
      try { peer && peer.destroy(); } catch (e) {}
      location.reload();
    }); } catch (e) {}
    // „Sofort-Mehrspieler“ (CrazyGames startet das Spiel für eine Gruppe): gleich einen eigenen Raum öffnen, dem Freunde beitreten können
    try { if (SDK.game.isInstantMultiplayer && !invited && !running) setTimeout(() => { if (!running) document.getElementById('btnQuick').click(); }, 800); } catch (e) {}
    // Raum verlassen → CrazyGames Bescheid sagen
    try { const lv = document.getElementById('btnLeave'); if (lv) lv.addEventListener('click', () => { try { SDK.game.leftRoom(); } catch (e) {} }, true); } catch (e) {}
    // Einladungslink kopieren: Link von CrazyGames statt der eigenen Adresse
    const cp = document.getElementById('btnCopy');
    if (cp) cp.onclick = () => {
      let link = ''; try { link = SDK.game.inviteLink({ room: roomCode }); } catch (e) {}
      try { navigator.clipboard.writeText(link || roomCode); cp.textContent = '✓'; } catch (e) { cp.textContent = link || roomCode; }
      setTimeout(() => cp.textContent = 'Einladungslink kopieren', 1800);
    };
    // „Laden fertig“, sobald das Gras der Karte vorbereitet ist (oder spätestens nach 25 s)
    const t0 = performance.now(), ld = setInterval(() => {
      const st = window.grassLoadState ? grassLoadState() : null;
      if (!st || st.geladen >= st.gesamt || performance.now() - t0 > 25000 || running) { clearInterval(ld); try { SDK.game.loadingStop(); } catch (e) {} }
    }, 500);
  };
  document.head.appendChild(s);
  // Takt: läuft gerade echtes Spiel? (im Spiel, nicht in Pause/Menü/Rundenende/Werbung)
  setInterval(() => {
    if (!SDK) return;
    const vis = id => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); };
    const ended = vis('endScreen');
    const now = running && !vis('pause') && !ended && !adBusy && !vis('shop') && !vis('boerse');
    if (now !== playing) { playing = now; try { now ? SDK.game.gameplayStart() : SDK.game.gameplayStop(); } catch (e) {} }
    // Rundenende: einmal Werbung zeigen (CrazyGames achtet selbst auf genug Abstand zwischen zwei Werbungen)
    if (ended && !lastEnd && !adBusy) {
      adBusy = true; mute(true);
      const done = () => { adBusy = false; mute(muteWanted()); };
      try { SDK.ad.requestAd('midgame', { adStarted: () => mute(true), adFinished: done, adError: done }); } catch (e) { done(); }
    }
    lastEnd = ended;
    // Raum an CrazyGames melden (Freunde können beitreten)
    if (running && roomCode && room !== roomCode) { room = roomCode; try { SDK.game.updateRoom({ roomId: roomCode, isJoinable: true, inviteParams: { room: roomCode } }); } catch (e) {} }
  }, 400);
})();
