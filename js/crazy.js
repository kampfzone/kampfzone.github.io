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
  const s = document.createElement('script'); s.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
  s.onload = async () => {
    try { await window.CrazyGames.SDK.init(); SDK = window.CrazyGames.SDK; } catch (e) { return; }
    try { SDK.game.loadingStart(); } catch (e) {}
    try { SDK.game.addSettingsChangeListener(() => mute(muteWanted())); } catch (e) {}
    // Benutzername übernehmen
    try { if (SDK.user.isUserAccountAvailable) { const u = await SDK.user.getUser(); const inp = document.getElementById('nameIn');
      if (u && u.username && inp && !localStorage.getItem('kz_name')) inp.value = u.username.slice(0, 16); } } catch (e) {}
    // Über eine Einladung gekommen → automatisch beitreten
    try { const code = SDK.game.getInviteParam('room'); if (code && /^[A-Z0-9]{5}$/.test(code) && !running) { document.getElementById('codeIn').value = code; setTimeout(() => document.getElementById('btnJoin').click(), 600); } } catch (e) {}
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
