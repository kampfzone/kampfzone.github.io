/* ======================= Leitern: an Hauswänden hochklettern und aufs Dach steigen =======================
   Die Leitern werden aus den Kollisionsboxen der Karte bestimmt (für alle Spieler gleich, ohne Netzwerk):
   große Häuser (Grundfläche ab 5×5 m, 3,5–40 m hoch, stehen auf dem Boden), an einer freien Wand, mindestens 28 m auseinander.
   W = hoch, S = runter, Leertaste = abspringen; oben steigt man automatisch aufs Dach. */
(function () {
  const LADDERS = [];
  const MAX = MAP_ID === 'welt' ? 140 : 45, GAP = 28;
  function free(x, y, z) {   // ist an dieser Stelle (Körper 0,4 m breit, 1,7 m hoch) keine Box?
    const near = typeof nearBoxes === 'function' ? nearBoxes(x, z, 2) : boxes;
    for (const b of near) if (x > b.min.x - 0.4 && x < b.max.x + 0.4 && z > b.min.z - 0.4 && z < b.max.z + 0.4 && y + 1.7 > b.min.y && y < b.max.y) return false;
    return true;
  }
  // Liegt über der Box noch etwas Sichtbares (Spitzdach, Aufbau)? Strahl von oben auf die Dachmitte und die Wandmitten.
  let statics = null;
  const rc = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0);
  function roofAbove(b) {
    if (!statics) { statics = []; scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position && o.material && !o.material.transparent && o.visible && o.renderOrder >= 0 && !(o.material.side === THREE.BackSide)) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); if (o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() < 450) statics.push(o); } }); }   // ohne Himmel, Wolken, riesige Flächen
    const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, y = b.max.y + 15;
    for (const [x, z] of [[cx, cz], [b.min.x + 1, cz], [b.max.x - 1, cz], [cx, b.min.z + 1], [cx, b.max.z - 1]]) {
      rc.set(new THREE.Vector3(x, y, z), DOWN); rc.far = 15 - 1.5;   // trifft etwas mehr als 1,5 m über der Dachfläche → Spitzdach / Stockwerk drauf (kleine Aufbauten sind ok)
      if (rc.intersectObjects(nearStatics(x, z), false).length) return true;
    }
    return false;
  }
  function covered(x, z, gy, top) {   // Strahl von hoch oben bis 2 m über den Boden: trifft er etwas, ist der Platz überdacht
    const y = top + 20; rc.set(new THREE.Vector3(x, y, z), DOWN); rc.far = y - (gy + 2);
    return rc.intersectObjects(nearStatics(x, z), false).length > 0;
  }
  // Raster (40 m) der Bauteile nach ihrer Umkugel: schnelle Suche, welche Teile über einer Stelle liegen könnten
  const CELL = 40; let grid = null;
  function nearStatics(x, z) {
    if (!grid) {
      grid = new Map();
      for (const o of statics) {
        const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld), r = o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() + 1;
        for (let gx = Math.floor((c.x - r) / CELL); gx <= Math.floor((c.x + r) / CELL); gx++) for (let gz = Math.floor((c.z - r) / CELL); gz <= Math.floor((c.z + r) / CELL); gz++) {
          const k = gx + ',' + gz; let a = grid.get(k); if (!a) grid.set(k, a = []); a.push({ o, x: c.x, z: c.z, r });
        }
      }
    }
    const a = grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) || [], out = [];
    for (const e of a) if (Math.hypot(e.x - x, e.z - z) < e.r) out.push(e.o);
    return out;
  }
  // in kleinen Häppchen im Hintergrund rechnen (Strahltests sind auf großen Karten teuer) – das Laden wird nicht länger
  function build() {
    scene.updateMatrixWorld(true);
    const list = [];
    let i = 0;
    const step = () => {
      const t = performance.now();
      while (i < boxes.length && list.length < MAX && performance.now() - t < 12) { const k = i++; one(boxes[k], k); }
      if (i < boxes.length && list.length < MAX) return setTimeout(step, 20);
      finish(list);
    };
    setTimeout(step, 1200);
    function one(b, i) {
      const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y;
      if (!b.vis || w < 5 || d < 5 || h > 40) return;   // nur echte, eckige Hauswände (keine runden Tanks o. Ä.)
      const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
      if (list.some(l => Math.hypot(l.x - cx, l.z - cz) < GAP)) return;
      const faces = [[1, 0, b.max.x, cz], [-1, 0, b.min.x, cz], [0, 1, cx, b.max.z], [0, -1, cx, b.min.z]];
      let roofChecked = false;
      for (let j = 0; j < 4; j++) {
        const [nx, nz, fx, fz] = faces[(i + j) % 4];
        const px = fx + nx * 0.9, pz = fz + nz * 0.9, gy = groundH(px, pz, b.min.y + 0.5);
        if (b.max.y - gy < 3.5 || b.max.y - gy > 40 || gy > b.min.y + 0.6) continue;   // Dach 3,5–40 m über dem Boden davor
        let ok = true;   // ganze Leiter-Strecke vom Boden bis unters Dach frei (bei gestapelten Häusern: unten nichts im Weg)
        for (let y = gy + 0.1; y < b.max.y - 1.7 && ok; y += 1.5) ok = free(px, y, pz) && free(px + nz * 0.5, y, pz - nx * 0.5) && free(px - nz * 0.5, y, pz + nx * 0.5);
        if (!ok) continue;
        if (!roofChecked) { roofChecked = true; if (roofAbove(b)) return; }
        if (covered(px, pz, gy, b.max.y)) continue;   // Leiterplatz liegt drinnen / unter einem Vordach   // oben drauf noch etwas (Spitzdach, Stockwerk)? dann nicht
        // die Wand muss bis unten reichen (sonst hängt die Leiter in der Luft): direkt an der Wand eine Box auf Bodenhöhe
        if (!(typeof nearBoxes === 'function' ? nearBoxes(fx, fz, 1) : boxes).some(o => o.vis && o.min.y <= gy + 0.6 && o.max.y >= gy + 2 && fx + nx * 0.02 > o.min.x - 0.05 && fx + nx * 0.02 < o.max.x + 0.05 && fz + nz * 0.02 > o.min.z - 0.05 && fz + nz * 0.02 < o.max.z + 0.05 && (fx - nx * 0.3 > o.min.x && fx - nx * 0.3 < o.max.x && fz - nz * 0.3 > o.min.z && fz - nz * 0.3 < o.max.z))) continue;
        if (list.some(l => Math.hypot(l.x - fx, l.z - fz) < GAP)) break;
        list.push({ x: fx + nx * 0.07, z: fz + nz * 0.07, nx, nz, y0: gy, y1: b.max.y });
        break;
      }
    }
  }
  function finish(list) {
    LADDERS.push(...list.slice(0, MAX));
    // Aussehen: zwei Holme + Sprossen (alle Leitern in zwei InstancedMeshes)
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.6, roughness: 0.45 });
    let nR = 0; for (const l of LADDERS) nR += Math.floor((l.y1 + 1 - l.y0) / 0.32);
    const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 1, 0.05), mat, LADDERS.length * 2);
    const rungs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6).rotateZ(Math.PI / 2), mat, Math.max(1, nR));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let ir = 0, iu = 0;
    for (const l of LADDERS) {
      q.setFromAxisAngle(up, Math.atan2(l.nx, l.nz));   // Leiter quer zur Wand: Sprossen laufen entlang der Wand
      const H = l.y1 + 1 - l.y0;   // 1 m über die Dachkante hinaus (zum Festhalten beim Umsteigen)
      for (const sd of [-0.25, 0.25]) { p.set(l.x + l.nz * sd, l.y0 + H / 2, l.z - l.nx * sd); s.set(1, H, 1); rails.setMatrixAt(ir++, m.compose(p, q, s)); }
      for (let y = l.y0 + 0.3; y < l.y1 + 0.95; y += 0.32) { p.set(l.x, y, l.z); s.set(1, 1, 1); rungs.setMatrixAt(iu++, m.compose(p, q, s)); }
    }
    rungs.count = iu;
    for (const im of [rails, rungs]) { im.castShadow = true; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; scene.add(im); }
    window.LADDERS = LADDERS;
  }
  window.LADDERS = LADDERS;
  try { build(); } catch (e) { console.warn('Leitern', e); }

  /* --- Leiter selbst setzen: Taste L vor einer Wand (max. 8 pro Spieler, die älteste verschwindet) --- */
  const OWN = {}, LMAT = new THREE.MeshStandardMaterial({ color: 0xc8a040, metalness: 0.3, roughness: 0.6 });
  function ladderMesh(l) {
    const g = new THREE.Group(), H = l.y1 + 1 - l.y0;
    g.position.set(l.x, l.y0, l.z); g.rotation.y = Math.atan2(l.nx, l.nz);
    for (const sd of [-0.25, 0.25]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, H, 0.06), LMAT); r.position.set(sd, H / 2, 0); g.add(r); }
    const rg = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6).rotateZ(Math.PI / 2);
    for (let y = 0.3; y < H - 0.05; y += 0.32) { const r = new THREE.Mesh(rg, LMAT); r.position.y = y; g.add(r); }
    g.traverse(o => { o.castShadow = true; }); scene.add(g); return g;
  }
  function addOwn(id, l) {
    if (!l || ![l.x, l.z, l.y0, l.y1, l.nx, l.nz].every(Number.isFinite) || l.y1 - l.y0 > 45 || l.y1 <= l.y0) return;
    const a = OWN[id] || (OWN[id] = []);
    if (a.length >= 8) { const o = a.shift(); scene.remove(o.mesh); const k = LADDERS.indexOf(o.l); if (k >= 0) LADDERS.splice(k, 1); }
    const L = { x: l.x, z: l.z, nx: l.nx, nz: l.nz, y0: l.y0, y1: l.y1 };
    LADDERS.push(L); a.push({ l: L, mesh: ladderMesh(L) });
  }
  window.ladderRecv = (id, l) => addOwn(id, l);
  window.placeLadder = () => {
    if (!me.alive || (typeof ride === 'object' && ride.v >= 0)) return;
    const d = new THREE.Vector3(-Math.sin(me.yaw), 0, -Math.cos(me.yaw)), o = new THREE.Vector3(me.pos.x, me.pos.y + 1.0, me.pos.z);
    const h = rayMap(o, d, 3);
    const n = h && (Array.isArray(h.normal) ? h.normal : h.normal ? [h.normal.x, h.normal.y, h.normal.z] : null);
    if (!h || !n || Math.abs(n[1]) > 0.5) { if (typeof showMsg === 'function') showMsg('🪜 Stell dich direkt vor eine Wand (max. 3 m), dann L'); return; }
    const p = h.point || o.clone().addScaledVector(d, h.dist);
    // Box der Wand finden → Dachhöhe
    const ix = p.x - n[0] * 0.05, iz = p.z - n[2] * 0.05; let top = -1;
    for (const b of (typeof nearBoxes === 'function' ? nearBoxes(ix, iz, 1) : boxes)) if (ix > b.min.x && ix < b.max.x && iz > b.min.z && iz < b.max.z && p.y > b.min.y - 0.1 && p.y < b.max.y + 0.1) top = Math.max(top, b.max.y);
    // gestapelte Kästen: so lange weiter nach oben, wie direkt darüber noch eine Box an dieser Wand ist
    for (let k = 0; k < 20 && top > 0; k++) { let up = -1; for (const b of nearBoxes(ix, iz, 1)) if (ix > b.min.x && ix < b.max.x && iz > b.min.z && iz < b.max.z && b.min.y <= top + 0.05 && b.max.y > top + 0.05) up = Math.max(up, b.max.y); if (up < 0) break; top = up; }
    const gy = groundH(p.x + n[0] * 0.5, p.z + n[2] * 0.5, me.pos.y + 0.5);
    if (top < gy + 1.5) { if (typeof showMsg === 'function') showMsg('🪜 Hier passt keine Leiter'); return; }
    if (top - gy > 45) { if (typeof showMsg === 'function') showMsg('🪜 Zu hoch für eine Leiter (max. 45 m)'); return; }
    const l = { x: +(p.x + n[0] * 0.07).toFixed(2), z: +(p.z + n[2] * 0.07).toFixed(2), nx: n[0], nz: n[2], y0: +gy.toFixed(2), y1: +top.toFixed(2) };
    addOwn(typeof myId === 'string' ? myId : 'me', l);
    try { net.send({ t: 'lad', l }); } catch (e) {}
    if (typeof sndClick === 'function') sndClick(0.08, 0.6);
    if (typeof showMsg === 'function') showMsg('🪜 Leiter gesetzt (' + Math.round(top - gy) + ' m) – W = hochklettern');
  };
  addEventListener('keydown', e => {
    if (e.code !== 'KeyL' || e.repeat || typeof running === 'undefined' || !running) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    placeLadder();
  });

  let hintT = 0, stepT = 0;
  // pro Bild aus game.js: true = man hängt an der Leiter (dann keine Schwerkraft, kein normaler Sprung)
  window.ladderTick = (dt, iF, fx, fz) => {
    if (!me.alive || (typeof ride === 'object' && ride.v >= 0)) { me.climb = null; return false; }
    let L = null;
    for (const l of LADDERS) {
      const rx = me.pos.x - l.x, rz = me.pos.z - l.z;
      if (Math.abs(rx) > 2 || Math.abs(rz) > 2) continue;
      const a = rx * l.nx + rz * l.nz, b = rx * l.nz - rz * l.nx;   // a: Abstand von der Wand, b: seitlich
      const held = me.climb === l, top = me.pos.y > l.y1 - 0.3 && me.pos.y < l.y1 + (held ? 1.6 : 0.3);   // oben auf dem Dach an der Leiter
      if ((a > 0.05 || (top && a > -0.9)) && a < 1.0 && Math.abs(b) < 0.6 && me.pos.y > l.y0 - 0.4 && me.pos.y < l.y1 + (held ? 1.6 : 0.3)) { L = l; break; }
    }
    if (!L) { me.climb = null; return false; }
    const facing = -(fx * L.nx + fz * L.nz);   // > 0: man schaut zur Wand
    if (!me.climb) {
      const now = performance.now(), onTop = me.pos.y > L.y1 - 0.3;
      if (now > hintT && typeof showMsg === 'function') { hintT = now + 6000; showMsg(onTop ? (TOUCH ? '🪜 Leiter: rückwärts = runterklettern' : '🪜 Leiter: S (rückwärts zur Kante) = runterklettern') : (TOUCH ? '🪜 Leiter: vorwärts = hochklettern' : '🪜 Leiter: W = hochklettern · S = runter · Leertaste = abspringen')); }
      if (onTop) {   // vom Dach aus: rückwärts zur Kante → an die Leiter hängen und runter
        if (!(iF < 0 && facing > 0.2)) return false;
        me.pos.set(L.x + L.nx * 0.45, L.y1 - 0.5, L.z + L.nz * 0.45); me.vel.set(0, 0, 0);
      } else if (!(iF > 0 && facing > 0.2)) return false;   // erst losklettern, wenn man zur Leiter läuft
      me.climb = L;
    }
    if (keys.Space) {   // abspringen
      me.climb = null; me.vel.set(L.nx * 4, 4.5, L.nz * 4); return false;
    }
    const dir = iF > 0 ? (facing > -0.2 ? 1 : -1) : iF < 0 ? -1 : 0;
    // an der Leiter festhalten: leicht zur Wand ziehen, mittig halten
    const b = (me.pos.x - L.x) * L.nz - (me.pos.z - L.z) * L.nx;
    me.vel.x = -L.nx * 0.8 - L.nz * b * 4; me.vel.z = -L.nz * 0.8 + L.nx * b * 4;
    me.vel.y = dir * 3.4;
    if (dir > 0 && me.pos.y > L.y1 - 0.35) {   // oben: weiter hoch und zur Wand drücken, bis man über der Kante (auch über einer Brüstung) ist
      const a = (me.pos.x - L.x) * L.nx + (me.pos.z - L.z) * L.nz;
      if (a < -0.35 || me.pos.y > L.y1 + 1.5) { me.climb = null; return false; }   // über dem Dach → loslassen, man landet oben
      me.vel.y = 3.4; me.vel.x = -L.nx * 3; me.vel.z = -L.nz * 3; me.onGround = false; return true;
    }
    if (dir < 0 && me.pos.y <= L.y0 + 0.05) { me.climb = null; return false; }   // unten angekommen
    if (dir) { stepT -= dt; if (stepT <= 0) { stepT = 0.34; if (typeof sndStep === 'function') sndStep(0.05); } }
    me.onGround = false;
    return true;
  };
})();
