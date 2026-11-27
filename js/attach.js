'use strict';
/* ======================= Waffen-Werkstatt: Aufsätze kaufen und anbauen =======================
   Pro Waffe: Mündung (Schalldämpfer, Kompensator, Mündungsbremse), Visier (Rotpunkt, Holo, 4×), Griff, Magazin, Laser, Lackierung.
   Jeder Aufsatz ändert die Werte der Waffe (Schaden, Rückstoß, Streuung, Magazin, Nachladen, Zoom) und ist an der Waffe zu sehen.
   Gekauft wird mit Coins; gespeichert im Browser (kz_attach). Öffnen: Waffenladen → „🔧 Waffen umbauen“. */
const ATT_SLOTS = [
  { k: 'muz', n: 'Mündung', o: [
    { id: '', n: 'Standard', d: 'ohne Aufsatz', p: 0 },
    { id: 'sil', n: 'Schalldämpfer', d: 'leise, kein Mündungsfeuer, nicht auf dem Radar · Schaden −10 %', p: 4000, m: { dmg: 0.9 } },
    { id: 'comp', n: 'Kompensator', d: 'Rückstoß −30 %', p: 3000, m: { kick: 0.7 } },
    { id: 'brake', n: 'Mündungsbremse', d: 'Rückstoß −20 %, Streuung −10 %', p: 3500, m: { kick: 0.8, spread: 0.9 } }] },
  { k: 'opt', n: 'Visier', o: [
    { id: '', n: 'Kimme & Korn', d: 'Standard', p: 0 },
    { id: 'red', n: 'Rotpunkt', d: 'Streuung −15 %', p: 2500, m: { spread: 0.85 } },
    { id: 'holo', n: 'Holo-Visier', d: 'mehr Zoom beim Zielen · Streuung −20 %', p: 3500, m: { spread: 0.8, zoom: 0.85 } },
    { id: 'acog', n: '4×-Zielfernrohr', d: 'starker Zoom · Streuung −30 % · im Laufen ungenauer', p: 6000, m: { spread: 0.7, move: 1.25, zoom: 0.55 } },
    { id: 'x8', n: '8×-Zielfernrohr', d: 'sehr starker Zoom · Streuung −40 % · im Laufen viel ungenauer', p: 9000, m: { spread: 0.6, move: 1.45, zoom: 0.36 } }] },
  { k: 'brl', n: 'Lauf', o: [
    { id: '', n: 'Standard', d: 'Standard', p: 0 },
    { id: 'long', n: 'Langer Lauf', d: 'Schaden +10 %, Streuung −15 % · im Laufen ungenauer', p: 4500, m: { dmg: 1.1, spread: 0.85, move: 1.15 } },
    { id: 'short', n: 'Kurzer Lauf', d: 'im Laufen genauer (−25 %) · Schaden −5 %', p: 3500, m: { move: 0.75, dmg: 0.95 } },
    { id: 'heavy', n: 'Schwerer Lauf', d: 'Schaden +18 % · Rückstoß +15 %', p: 7000, m: { dmg: 1.18, kick: 1.15 } }] },
  { k: 'stk', n: 'Schaft', o: [
    { id: '', n: 'Standard', d: 'Standard', p: 0 },
    { id: 'tac', n: 'Taktischer Schaft', d: 'Rückstoß −20 %', p: 3500, m: { kick: 0.8 } },
    { id: 'light', n: 'Leichter Schaft', d: 'im Laufen genauer (−20 %) · Rückstoß +10 %', p: 3000, m: { move: 0.8, kick: 1.1 } },
    { id: 'sniper', n: 'Präzisionsschaft', d: 'Streuung −20 % · Nachladen 10 % langsamer', p: 5000, m: { spread: 0.8, reload: 1.1 } }] },
  { k: 'ammo', n: 'Munition', o: [
    { id: '', n: 'Standard', d: 'Standard', p: 0 },
    { id: 'hp', n: 'Hohlspitz', d: 'Schaden +15 % · Kopfschuss-Bonus etwas kleiner', p: 5000, m: { dmg: 1.15, head: 0.9 } },
    { id: 'match', n: 'Match-Munition', d: 'Streuung −25 %', p: 4500, m: { spread: 0.75 } },
    { id: 'head', n: 'Scharfschützen-Munition', d: 'Kopfschuss +30 % · Feuerrate 10 % langsamer', p: 6500, m: { head: 1.3, rate: 1.1 } }] },
  { k: 'trg', n: 'Abzug', o: [
    { id: '', n: 'Standard', d: 'Standard', p: 0 },
    { id: 'fast', n: 'Schnellabzug', d: 'Feuerrate +15 % · Rückstoß +10 %', p: 6000, m: { rate: 0.87, kick: 1.1 } },
    { id: 'match', n: 'Match-Abzug', d: 'Streuung −15 % · Feuerrate 5 % langsamer', p: 4000, m: { spread: 0.85, rate: 1.05 } }] },
  { k: 'grip', n: 'Griff', o: [
    { id: '', n: 'Ohne', d: 'Standard', p: 0 },
    { id: 'vert', n: 'Vertikalgriff', d: 'Rückstoß −25 %', p: 2500, m: { kick: 0.75 } },
    { id: 'angle', n: 'Winkelgriff', d: 'im Laufen genauer (−35 %)', p: 2500, m: { move: 0.65 } }] },
  { k: 'mag', n: 'Magazin', o: [
    { id: '', n: 'Standard', d: 'Standard', p: 0 },
    { id: 'ext', n: 'Erweitertes Magazin', d: '+50 % Schuss · Nachladen 20 % langsamer', p: 3500, m: { mag: 1.5, reload: 1.2 } },
    { id: 'fast', n: 'Schnellmagazin', d: 'Nachladen 35 % schneller', p: 3000, m: { reload: 0.65 } }] },
  { k: 'las', n: 'Laser', o: [
    { id: '', n: 'Ohne', d: 'Standard', p: 0 },
    { id: 'laser', n: 'Laser', d: 'genauer aus der Hüfte (Streuung −25 %)', p: 2000, m: { spread: 0.75 } }] },
  { k: 'paint', n: 'Lackierung', o: [
    { id: '', n: 'Original', d: '', p: 0 },
    { id: 'black', n: 'Schwarz matt', d: '', p: 1500, c: 0x1a1c20 },
    { id: 'desert', n: 'Wüste', d: '', p: 2000, c: 0xb39a6c },
    { id: 'green', n: 'Oliv', d: '', p: 2000, c: 0x5c6b3c },
    { id: 'red', n: 'Rot', d: '', p: 2000, c: 0x9c1d1d },
    { id: 'arctic', n: 'Arktis', d: '', p: 2500, c: 0xdfe3e7 },
    { id: 'blue', n: 'Blau', d: '', p: 2000, c: 0x1f4f9c },
    { id: 'purple', n: 'Lila', d: '', p: 2500, c: 0x5b2a86 },
    { id: 'pink', n: 'Pink', d: '', p: 2500, c: 0xd9548f },
    { id: 'orange', n: 'Orange', d: '', p: 2500, c: 0xd96d1c },
    { id: 'chrome', n: 'Chrom', d: '', p: 10000, c: 0xc8ccd2, gold: true },
    { id: 'gold', n: 'Gold', d: '', p: 15000, c: 0xd9a838, gold: true },
    { id: 'diamond', n: 'Diamant', d: '', p: 40000, c: 0x8fe3f5, gold: true }] },
];
const ATT_BASE = WEAPONS.map(w => ({ dmg: w.dmg, kick: w.kick, spread: w.spread, move: w.move, mag: w.mag, reload: w.reload, zoom: w.zoom, rate: w.rate, head: w.head }));
const ATT = { owned: {}, eq: {} };
try { const s = JSON.parse(localStorage.getItem('kz_attach') || 'null'); if (s) { ATT.owned = s.owned || {}; ATT.eq = s.eq || {}; } } catch (e) {}
const attSave = () => { try { localStorage.setItem('kz_attach', JSON.stringify({ owned: ATT.owned, eq: ATT.eq })); } catch (e) {} };
const attWeapon = i => { const w = WEAPONS[i]; return w && !w.rocket && !w.gl && !w.flame; };   // Raketen-/Granat-/Flammenwerfer: keine Aufsätze
const attSlots = i => ATT_SLOTS.filter(s => !(s.k === 'opt' && WEAPONS[i].scope) && !(s.k === 'grip' && (i === 3 || i === 5)));
const attOf = i => ATT.eq[i] || {};
const attSil = i => attWeapon(i) && attOf(i).muz === 'sil';
function attApply(i) {
  const w = WEAPONS[i], b = ATT_BASE[i]; if (!w || !b) return;
  Object.assign(w, b);
  if (!attWeapon(i)) return;
  const eq = attOf(i);
  for (const s of attSlots(i)) { const o = s.o.find(x => x.id === (eq[s.k] || '')); if (!o || !o.m) continue;
    for (const k in o.m) w[k] = k === 'mag' ? Math.round(w[k] * o.m[k]) : w[k] * o.m[k]; }
  if (typeof me === 'object' && me.ammo && me.ammo[i] > w.mag) me.ammo[i] = w.mag;
}
WEAPONS.forEach((w, i) => attApply(i));

/* --- Aufsätze als Modellteile (Waffen-Koordinaten: Lauf nach -z, Mündung bei (0, muzzleY, -len)) --- */
const _attSide = new Map();
const ATT_SIDE = m => { let s = _attSide.get(m); if (!s) { s = m.clone(); s.side = THREE.DoubleSide; _attSide.set(m, s); } return s; };
// höchster Punkt der Waffe im Bereich der Visiermontage (Waffen-Koordinaten)
function attTop(group, sy) {
  let top = null; const bx = new THREE.Box3();
  group.traverse(o => { if (!o.isMesh) return; o.updateMatrix(); if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    bx.copy(o.geometry.boundingBox).applyMatrix4(o.matrix);
    if (bx.max.z < -0.14 || bx.min.z > 0.03 || bx.max.y > sy + 0.06) return;
    if (top == null || bx.max.y > top) top = bx.max.y; });
  return top;
}
function attParts(i, gi, top) {
  const M = GUN_MATS, P = [], eq = attOf(i);
  const box = (w, h, d, mat, x, y, z) => ({ geo: new THREE.BoxGeometry(w, h, d), mat, p: [x, y, z], r: [0, 0, 0] });
  const cyl = (r1, r2, len, mat, x, y, z) => ({ geo: new THREE.CylinderGeometry(r1, r2, len, 16), mat, p: [x, y, z], r: [Math.PI / 2, 0, 0] });
  const L = gi.len, my = gi.muzzleY, sy = gi.sight;
  let muzzleZ = -L;
  if (eq.muz === 'sil') { P.push(cyl(0.021, 0.021, 0.17, M.steel, 0, my, -L - 0.085), cyl(0.023, 0.023, 0.02, M.metal, 0, my, -L - 0.01), cyl(0.0225, 0.0225, 0.012, M.metal, 0, my, -L - 0.165)); muzzleZ = -L - 0.17; }
  else if (eq.muz === 'comp') { P.push(cyl(0.016, 0.016, 0.06, M.metal, 0, my, -L - 0.03)); for (const dz of [-0.018, -0.036]) P.push(box(0.034, 0.006, 0.008, M.dark, 0, my + 0.012, -L + dz)); muzzleZ = -L - 0.06; }
  else if (eq.muz === 'brake') { P.push(box(0.042, 0.03, 0.07, M.metal, 0, my, -L - 0.035)); for (const dz of [-0.015, -0.035, -0.055]) P.push(box(0.044, 0.008, 0.008, M.dark, 0, my, -L - 0.035 + dz + 0.035)); muzzleZ = -L - 0.07; }
  let sight = sy;
  if (!WEAPONS[i].scope && eq.opt) {
    // Montage oben auf der höchsten Stelle der Waffe (über Kimme/Tragegriff), damit nichts ineinander steckt
    const b = Math.max(sy - 0.012, top == null ? sy - 0.012 : top);
    const tube = (r, len, z, y) => ({ geo: new THREE.CylinderGeometry(r, r, len, 20, 1, true), mat: ATT_SIDE(M.metal), p: [0, y, z], r: [Math.PI / 2, 0, 0] });
    const ring = (r, y, z) => ({ geo: new THREE.TorusGeometry(r, 0.0025, 6, 20), mat: M.metal, p: [0, y, z], r: [0, 0, 0] });
    const dot = (y, z, s) => ({ geo: new THREE.SphereGeometry(s, 8, 6), mat: ATT_RED, p: [0, y, z], r: [0, 0, 0] });
    if (eq.opt === 'red') { const y = b + 0.03; P.push(box(0.026, 0.014, 0.05, M.metal, 0, b + 0.007, -0.06), box(0.012, 0.012, 0.03, M.metal, 0, b + 0.016, -0.06), tube(0.017, 0.05, -0.06, y), ring(0.017, y, -0.035), ring(0.017, y, -0.085), dot(y, -0.085, 0.0012)); sight = y; }
    else if (eq.opt === 'holo') { const y = b + 0.03; P.push(box(0.034, 0.014, 0.08, M.metal, 0, b + 0.007, -0.06), box(0.05, 0.006, 0.07, M.metal, 0, b + 0.014, -0.06),
      box(0.005, 0.034, 0.012, M.metal, -0.024, y, -0.09), box(0.005, 0.034, 0.012, M.metal, 0.024, y, -0.09), box(0.053, 0.005, 0.012, M.metal, 0, y + 0.018, -0.09),
      box(0.005, 0.03, 0.01, M.metal, -0.024, y - 0.002, -0.035), box(0.005, 0.03, 0.01, M.metal, 0.024, y - 0.002, -0.035), dot(y, -0.09, 0.0012)); sight = y; }
    else if (eq.opt === 'acog' || eq.opt === 'x8') { const y = b + 0.034; P.push(box(0.03, 0.016, 0.09, M.metal, 0, b + 0.008, -0.06), tube(0.02, 0.15, -0.06, y), tube(0.025, 0.04, -0.155, y), ring(0.02, y, 0.015), ring(0.025, y, -0.175), ...(eq.opt === 'x8' ? [tube(0.032, 0.07, -0.205, y), ring(0.032, y, -0.24)] : []),   // 8×: dickes Objektiv vorne
      box(0.0012, 0.03, 0.0008, M.dark, 0, y - 0.012, -0.12), box(0.016, 0.0012, 0.0008, M.dark, 0, y, -0.12), dot(y + 0.002, -0.12, 0.001)); sight = y; }
  }
  const fo = gi.fore || [0, 0, -0.3];
  const gTop = Math.min(my - 0.028, fo[1] + 0.01);   // Unterkante des Handschutzes
  if (eq.grip === 'vert') P.push({ geo: new THREE.CylinderGeometry(0.014, 0.016, 0.085, 12), mat: M.poly, p: [fo[0], gTop - 0.042, fo[2] - 0.03], r: [0, 0, 0] }, box(0.026, 0.01, 0.04, M.metal, fo[0], gTop - 0.003, fo[2] - 0.03));
  else if (eq.grip === 'angle') P.push({ geo: new THREE.BoxGeometry(0.022, 0.03, 0.075), mat: M.poly, p: [fo[0], gTop - 0.014, fo[2] - 0.02], r: [-0.45, 0, 0] });
  if (eq.las === 'laser') P.push(box(0.018, 0.022, 0.05, M.dark, 0.035, my, -L * 0.6), { geo: new THREE.SphereGeometry(0.004, 8, 6), mat: ATT_RED, p: [0.035, my, -L * 0.6 - 0.026], r: [0, 0, 0] });
  return { parts: P, muzzleZ, sight };
}
const ATT_RED = new THREE.MeshBasicMaterial({ color: 0xff2020 });
// Erweitertes Magazin: nach unten verlängern (oben bleibt am Gehäuse)
function longMag(grp) {
  grp.traverse(o => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); const top = o.geometry.boundingBox.max.y; o.geometry.translate(0, -top, 0); o.geometry.scale(1, 1.35, 1); o.geometry.translate(0, top, 0); o.geometry.computeBoundingSphere(); });
}
const ATT_PAINT = new Map();
function attPaint(group, i) {
  const pid = attOf(i).paint; if (!pid) return;
  const o = ATT_SLOTS.find(s => s.k === 'paint').o.find(x => x.id === pid); if (!o) return;
  const M = GUN_MATS, paintable = new Set([M.metal, M.metalDS, M.poly, M.polyGrip, M.tan, M.olive, M.awm, M.wood]);
  group.traverse(ob => {
    if (!ob.isMesh || !paintable.has(ob.material)) return;
    const key = ob.material.uuid + pid; let m = ATT_PAINT.get(key);
    if (!m) { m = ob.material.clone(); m.color.set(o.c); if (o.gold) { m.metalness = 0.9; m.roughness = 0.28; } ATT_PAINT.set(key, m); }
    ob.material = m;
  });
}
// Waffe in der Hand: nach dem normalen Aufbau die Aufsätze, Lackierung und längeres Magazin dazu
const _buildViewGun = buildViewGun;
buildViewGun = function (w) {
  _buildViewGun(w);
  if (!attWeapon(w) || !gunInfo) return;
  const a = attParts(w, gunInfo, attTop(vm.main, gunInfo.sight));
  if (a.parts.length) { vm.att = partsToGroup(a.parts); viewGun.add(vm.att); }
  muzzle.position.z = a.muzzleZ; gunInfo.sight = a.sight;
  if (attOf(w).mag === 'ext' && vm.mag) longMag(vm.mag);
  attPaint(vm.main, w); if (vm.mag) attPaint(vm.mag, w);
};
// Schalldämpfer: eigener Schuss leise, kein Mündungsfeuer; Mitspieler hören ihn leise und sehen ihn nicht auf dem Radar
const _sndShot = sndShot;
sndShot = function (w, vol, pos) {
  if (!pos && typeof me === 'object' && w === me.weapon && attSil(w) && (typeof ride !== 'object' || ride.v < 0)) return _sndShot(4, vol * 0.55);
  return _sndShot(w, vol, pos);
};
const _tryShoot = tryShoot;
tryShoot = function (now) {
  const before = me.ammo[me.weapon]; _tryShoot(now);
  if (me.ammo[me.weapon] < before && attSil(me.weapon)) { flash.visible = false; flashLight.intensity = 0; }
};

/* --- Werkstatt-Fenster --- */
(function () {
  const css = document.createElement('style');
  css.textContent = `#attach{position:fixed;inset:0;z-index:26;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6)} #attach.hidden{display:none}
  #attach .attTabs{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}
  #attach .attTabs button{padding:6px 10px;font-size:13px} #attach .attTabs button.on{outline:2px solid #ffcc33}
  #attPrev{width:100%;height:190px;border-radius:10px;background:radial-gradient(#3a3f48,#14161b);display:block}
  #attach .attSlot{margin:10px 0 4px;font-weight:800;color:#ffcc33;font-size:14px}
  #attach .attOpts{display:flex;flex-wrap:wrap;gap:6px}
  #attach .attOpt{flex:1 1 150px;text-align:left;padding:7px 9px;border-radius:9px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#fff;cursor:pointer;font:600 13px system-ui,sans-serif}
  #attach .attOpt small{display:block;font-weight:500;color:#b9c3cf;font-size:11.5px;margin-top:2px}
  #attach .attOpt.eq{border-color:#4cd964;background:rgba(76,217,100,.16)} #attach .attOpt .pr{float:right;color:#ffcc33}
  #attach .attStats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:4px 12px;margin-top:8px;font-size:12.5px}
  #attach .bar{height:7px;background:#2a2e35;border-radius:4px;overflow:hidden;margin-top:2px} #attach .bar i{display:block;height:100%;background:#4cd964}
  #attach .bar i.up{background:#4cd964} #attach .bar i.dn{background:#ff6b5a}`;
  document.head.appendChild(css);
  const el = document.createElement('div'); el.id = 'attach'; el.className = 'hidden';
  el.innerHTML = `<div class="panel shopPanel"><div class="shopHead"><h2>🔧 Waffen-Werkstatt</h2><div class="coinBig"><span class="coin"></span> <span id="attCoins">0</span> Coins</div></div>
    <div class="shopInfo">Bau dir deine perfekte Waffe: Aufsatz anklicken = kaufen bzw. anbauen. Gekaufte Aufsätze bleiben deine – du kannst jederzeit wechseln.</div>
    <div class="attTabs" id="attTabs"></div><canvas id="attPrev"></canvas><div class="attStats" id="attStats"></div><div id="attBody"></div>
    <button id="attClose">Zurück zum Laden</button></div>`;
  document.body.appendChild(el);
  // Knopf im Waffenladen
  const sb = document.createElement('button'); sb.id = 'btnAttach'; sb.textContent = '🔧 Waffen umbauen (Visier, Schalldämpfer …)'; sb.style.cssText = 'width:100%;margin:8px 0 2px';
  const list = $('shopList'); if (list) list.parentNode.insertBefore(sb, list);
  let cur = 0, prev = null, raf = 0;
  const weapons = () => WEAPONS.map((w, i) => i).filter(attWeapon);
  function stats(i) {
    const w = WEAPONS[i], b = ATT_BASE[i];
    const row = (n, v, v0, better) => { const pct = Math.max(4, Math.min(100, v * 100)), diff = better === 'low' ? v0 - v : v - v0;
      return `<div>${n}<div class="bar"><i class="${Math.abs(diff) < 0.001 ? '' : diff > 0 ? 'up' : 'dn'}" style="width:${pct}%"></i></div></div>`; };
    $('attStats').innerHTML = row('Schaden', w.dmg * w.pellets / 100, b.dmg * w.pellets / 100) + row('Stabilität (wenig Rückstoß)', 1 - w.kick * 8, 1 - b.kick * 8)
      + row('Genauigkeit', 1 - w.spread * 6, 1 - b.spread * 6) + row('Magazin', w.mag / 120, b.mag / 120) + row('Nachladen (schnell)', 1 - w.reload / 6, 1 - b.reload / 6)
      + row('Zoom beim Zielen', 1 - w.zoom / 90, 1 - b.zoom / 90)
      + row('Feuerrate', Math.min(1, 0.06 / w.rate), Math.min(1, 0.06 / b.rate)) + row('Kopfschuss-Bonus', w.head / 4, b.head / 4)
      + row('Genauigkeit im Laufen', 1 - w.move * 12, 1 - b.move * 12);
  }
  function render() {
    const ids = weapons(); if (!ids.includes(cur)) cur = ids[0];
    $('attCoins').textContent = fmt(shopState.coins);
    $('attTabs').innerHTML = ids.map(i => `<button class="sec ${i === cur ? 'on' : ''}" data-w="${i}">${WEAPONS[i].name}</button>`).join('');
    const eq = attOf(cur);
    $('attBody').innerHTML = attSlots(cur).map(s => `<div class="attSlot">${s.n}</div><div class="attOpts">${s.o.map(o => {
      const has = !o.p || ATT.owned[cur + ':' + s.k + ':' + o.id], on = (eq[s.k] || '') === o.id;
      const sw = o.c !== undefined ? `<span style="display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-1px;background:#${o.c.toString(16).padStart(6, '0')}"></span>` : '';
      return `<div class="attOpt ${on ? 'eq' : ''}" data-s="${s.k}" data-o="${o.id}" data-p="${o.p}">${sw}${o.n}<span class="pr">${on ? '✓ dran' : has ? 'anbauen' : '🪙 ' + fmt(o.p)}</span>${o.d ? `<small>${o.d}</small>` : ''}</div>`; }).join('')}</div>`).join('');
    stats(cur); buildPrev();
  }
  function choose(sk, oid, price) {
    const key = cur + ':' + sk + ':' + oid, has = !price || ATT.owned[key];
    if (!has) {
      if (shopState.coins < price) { if (typeof showMsg === 'function') showMsg('Nicht genug Coins'); if (typeof sndBeep === 'function') sndBeep(220, 0.15, 0.1, 'square'); return; }
      shopState.coins -= price; ATT.owned[key] = true; saveShop(); if (typeof updateCoins === 'function') updateCoins(true);
      if (typeof sndBeep === 'function') { initAudio(); sndBeep(660, 0.08, 0.1, 'triangle'); setTimeout(() => sndBeep(990, 0.12, 0.1, 'triangle'), 80); }
    }
    ATT.eq[cur] = Object.assign({}, attOf(cur), { [sk]: oid }); attSave(); attApply(cur);
    if (typeof me === 'object' && me.weapon === cur && typeof viewGun !== 'undefined') buildViewGun(cur);
    if (typeof sndClick === 'function') sndClick(0.08, 1.2);
    render();
  }
  el.addEventListener('click', e => {
    const t = e.target.closest('[data-w]'); if (t) { cur = +t.dataset.w; render(); return; }
    const o = e.target.closest('.attOpt'); if (o) choose(o.dataset.s, o.dataset.o, +o.dataset.p);
  });
  // 3D-Vorschau (eigener kleiner Renderer)
  function buildPrev() {
    const cv = $('attPrev'); if (!cv) return;
    if (!prev) {
      const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
      r.toneMappingExposure = 1.35;
      const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, 2.6, 0.01, 10);
      sc.add(new THREE.HemisphereLight(0xeef3ff, 0x4a443c, 2.2)); const d = new THREE.DirectionalLight(0xffffff, 3.2); d.position.set(2, 2.5, 1); sc.add(d); const d2 = new THREE.DirectionalLight(0xa8c4ff, 1.6); d2.position.set(-1.5, 0.6, -2); sc.add(d2);
      try {   // Umgebung für Spiegelungen (Metall, Gold): heller Himmel oben, dunkler Boden
        const es = new THREE.Scene(), geo = new THREE.SphereGeometry(5, 32, 16), col = [];
        for (let k = 0; k < geo.attributes.position.count; k++) { const y = geo.attributes.position.getY(k) / 5, v = y > 0 ? 0.55 + y * 1.4 : 0.12 + (y + 1) * 0.25; col.push(v, v, v * 1.05); }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        es.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
        sc.environment = new THREE.PMREMGenerator(r).fromScene(es).texture;
      } catch (e) {}
      prev = { r, sc, cam, g: null }; window.ATT_PREV = prev;
    }
    if (prev.g) prev.sc.remove(prev.g);
    const gi = makeGun(cur), g = new THREE.Group(), main = partsToGroup(gi.parts.filter(p => !p.mag)), mag = partsToGroup(gi.parts.filter(p => p.mag));
    g.add(main, mag); const a = attParts(cur, gi, attTop(main, gi.sight)); if (a.parts.length) g.add(partsToGroup(a.parts));
    if (attOf(cur).mag === 'ext') longMag(mag);
    attPaint(main, cur); attPaint(mag, cur);
    const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
    const piv = new THREE.Group(); g.position.sub(c); piv.add(g); prev.sc.add(piv); prev.g = piv;
    prev.cam.position.set(size * 1.25, size * 0.18, size * 0.12); prev.cam.lookAt(0, 0, 0);
  }
  function loop() {
    if (el.classList.contains('hidden')) return;
    raf = requestAnimationFrame(loop);
    const cv = $('attPrev'), w = cv.clientWidth | 0, h = cv.clientHeight | 0;
    if (prev && w && h) { if (cv.width !== w || cv.height !== h) { prev.r.setSize(w, h, false); prev.cam.aspect = w / h; prev.cam.updateProjectionMatrix(); }
      if (prev.g) prev.g.rotation.y = Math.sin(performance.now() / 2200) * 0.35; prev.r.render(prev.sc, prev.cam); }
  }
  window.openAttach = () => {
    if (typeof me === 'object' && attWeapon(me.weapon)) cur = me.weapon;
    $('shop').classList.add('hidden'); el.classList.remove('hidden'); render(); cancelAnimationFrame(raf); loop();
  };
  sb.onclick = () => openAttach();
  $('attClose').onclick = () => { el.classList.add('hidden'); cancelAnimationFrame(raf); if (typeof renderShop === 'function') renderShop(); $('shop').classList.remove('hidden'); };
  for (const ev of ['keydown', 'keyup']) el.addEventListener(ev, e => e.stopPropagation());
})();
window.attSil = attSil;
