/* ======================= Karte „Kreppendorf“ (Ortsteil von Veitsbronn) =======================
   Häuser mit echten Dächern aus LoD2 Bayern, Straßen/Wald/Felder/Zenn aus OpenStreetMap (Daten: js/kreppendorf-data.js,
   erzeugt von tools/kreppendorf_extract.py). x = Osten, z = Süden, Mitte = Ortsmitte. Nutzt die Bausteine aus map.js. */
function buildKreppendorfMap() {
  const D = window.KREPP, S = D.R + 2;   // Rand ±262 m
  const P2 = a => { const o = []; for (let i = 0; i < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };
  const inPoly = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const inside = (x, z, m = 0) => Math.abs(x) < S - 4 - m && Math.abs(z) < S - 4 - m;
  /* --- Gelände: echte Höhen (EU-DEM), begehbar über das Hügel-System aus map.js --- */
  const H = window.krepH;
  addHillRegion({ x0: -S - 2, x1: S + 2, z0: -S - 2, z1: S + 2, fn: H });
  hillMeshRect(-S - 2, S + 2, -S - 2, S + 2, pbr('grass', 2, { map: tintedTex('grass', 0x587a34) }), 5, 4);
  // Bauteil(e) aus map.js aufs Gelände heben: alles, was fn() neu in die Szene / Kollision legt, um H(x, z) nach oben
  const lift = (x, z, fn) => {
    const nc = scene.children.length, nb = boxes.length; fn(); const y = H(x, z);
    for (let i = nc; i < scene.children.length; i++) scene.children[i].position.y += y;
    for (let i = nb; i < boxes.length; i++) { boxes[i].min.y += y; boxes[i].max.y += y; }
  };

  /* --- Materialien --- */
  const field = hex => pbr('grass', 4, { map: tintedTex('grass', hex), mat: { color: new THREE.Color(0.74, 0.74, 0.72), polygonOffset: true, polygonOffsetFactor: -1 } });
  const M = {
    road: pbr('asphalt', 3, { mat: { polygonOffset: true, polygonOffsetFactor: -3 } }),
    dirt: pbr('asphalt', 3, { map: tintedTex('asphalt', 0x6e5034), mat: { color: new THREE.Color(0.68, 0.6, 0.52), polygonOffset: true, polygonOffsetFactor: -3 }, normalScale: 1.6 }),
    water: new THREE.MeshStandardMaterial({ color: 0x2f5a6a, roughness: 0.15, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -4 }),
    wheat: field(0xcfae55), green: field(0x7aa645), plow: field(0x6a4a30), meadow: field(0x6c9a3e), forest: field(0x3e5a26), yard: pbr('concrete', 3, { mat: { color: new THREE.Color(0.7, 0.68, 0.64), polygonOffset: true, polygonOffsetFactor: -1 } }),
    // Dachfarben: Ziegelrot, Dunkelrot, Braun, Anthrazit, Schiefergrau, Orange, Engobe-Schwarz (Foto eingefärbt)
    roofs: [0xb8462a, 0x8a2e22, 0x6e4430, 0x3c3c40, 0x5c6066, 0xd0703c, 0x2a2626].map(c => pbr('roof', 2.5, { map: tintedTex('roof', c), mat: { color: new THREE.Color(0.8, 0.8, 0.8), side: THREE.DoubleSide } })),
    // Putzfarben: Weiß, Gelb, Lachs, Hellblau, Grau, Hellgrün, Sandstein, Altrosa
    walls: [0xf6f3ec, 0xf0d78a, 0xeeb59c, 0xbcd2e6, 0xb4b0a8, 0xcfe0b4, 0xdcc096, 0xe2b8bc].map(c => pbr('concrete', 3, { map: tintedTex('concrete', c), mat: { color: new THREE.Color(0.62, 0.62, 0.62), side: THREE.DoubleSide } })),
  };
  const mesh = (pos, uv, mat) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals(); withUv2(g); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; scene.add(m); mapMeshes.push(m); return m;
  };
  const flatPoly = (pts, y, mat, tile) => {   // Fläche (Feld, Wald, Wasser …) in 4-m-Zellen, folgt dem Gelände
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const C = 4, P = [], U = [], v = (x, z) => { P.push(x, H(x, z) + y + 0.03, z); U.push(x / tile, z / tile); };
    for (let x = Math.floor(Math.max(x0, -S) / C) * C; x < Math.min(x1, S); x += C) for (let z = Math.floor(Math.max(z0, -S) / C) * C; z < Math.min(z1, S); z += C) {
      if (!inPoly(x + C / 2, z + C / 2, pts)) continue;
      v(x, z); v(x, z + C); v(x + C, z); v(x + C, z); v(x, z + C); v(x + C, z + C);
    }
    if (P.length) { const m = mesh(P, U, mat); m.castShadow = false; }
  };

  /* --- Flächen aus OSM: Felder, Wiesen, Wald, Höfe --- */
  const forests = [], fieldMats = [M.wheat, M.green, M.plow, M.wheat];
  let fi = 0;
  for (const w of D.ways) {
    if (!w.k.startsWith('l:')) continue;
    const pts = P2(w.p); if (pts.length < 4) continue;
    const t = w.k.slice(2);
    if (t === 'forest' || t === 'wood' || t === 'scrub') { flatPoly(pts, 0.02, M.forest, 4); forests.push(pts); }
    else if (t === 'farmland') flatPoly(pts, 0.015, fieldMats[fi++ % 4], 4);
    else if (t === 'meadow' || t === 'grass' || t === 'grassland' || t === 'orchard' || t === 'park') flatPoly(pts, 0.01, M.meadow, 4);
    else if (t === 'farmyard') flatPoly(pts, 0.025, M.yard, 3);
    else if (t === 'water') flatPoly(pts, 0.04, M.water, 4);
  }

  /* --- Straßen, Wege und die Zenn als Bänder --- */
  const W = { primary: 7.5, secondary: 7, tertiary: 6.5, residential: 5.5, unclassified: 5, living_street: 4.5, service: 3.5, track: 3, path: 1.8, footway: 1.8, cycleway: 2.2 };
  const streets = window.MAP_STREETS = [];
  const band = (pts, w, y, mat, keep) => {
    const P = [], U = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue;
      const nx = -(bz - az) / L * w / 2, nz = (bx - ax) / L * w / 2, ex = (bx - ax) / L * w * 0.25, ez = (bz - az) / L * w * 0.25;   // etwas länger: keine Lücken in Kurven
      const A = [ax - ex + nx, az - ez + nz], B = [ax - ex - nx, az - ez - nz], C = [bx + ex - nx, bz + ez - nz], Dd = [bx + ex + nx, bz + ez + nz];
      const n = Math.max(1, Math.ceil(L / 3)), Lx = L + w * 0.5;   // in ~3-m-Stücke teilen, damit das Band dem Gelände folgt
      const at = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      for (let k = 0; k < n; k++) {
        const a = at(A, Dd, k / n), b = at(B, C, k / n), c = at(B, C, (k + 1) / n), d = at(A, Dd, (k + 1) / n), ua = Lx * k / n / 3, ub = Lx * (k + 1) / n / 3;
        for (const [q, u, v] of [[a, ua, 0], [c, ub, w / 3], [b, ua, w / 3], [a, ua, 0], [d, ub, 0], [c, ub, w / 3]]) { P.push(q[0], H(q[0], q[1]) + y + 0.03, q[1]); U.push(v, u); }
      }
      if (keep) for (let t = 0; t <= L; t += 5) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L, r = w / 2 + 0.5; streets.push([x - r, z - r, x + r, z + r]); }
    }
    if (P.length) { const m = mesh(P, U, mat); m.castShadow = false; }
  };
  const roadPts = [];
  for (const w of D.ways) {
    const pts = P2(w.p);
    if (w.k.startsWith('w:')) { band(pts, w.k === 'w:river' ? 7 : 3.5, 0.05, M.water, false); continue; }
    if (!w.k.startsWith('h:')) continue;
    const t = w.k.slice(2), wd = W[t]; if (!wd) continue;
    const paved = wd >= 3.5;
    band(pts, wd, paved ? 0.06 : 0.055, paved ? M.road : M.dirt, paved);
    if (paved && t !== 'service') roadPts.push(pts);
  }
  window.krepOnRoad = (x, z) => { for (const [x0, z0, x1, z1] of streets) if (x > x0 && x < x1 && z > z0 && z < z1) return true; return false; };

  /* --- Häuser aus LoD2: Dächer + Wände als echte Flächen, Kollision als Streifen über den Grundriss --- */
  const occ = new Set(), ck = (x, z) => Math.round(x) * 10000 + Math.round(z);
  D.houses.forEach((h, hi) => {
    const hash = Math.imul(hi + 17, 2654435761) >>> 0, roofM = M.roofs[hash % 7], wallM = M.walls[(hash >>> 8) % 8];
    // Haus auf das Gelände setzen: tiefster Geländepunkt unter dem Grundriss (hangseitig steckt es etwas im Boden)
    let base = Infinity;
    for (const f of (h.g.length ? h.g : h.r)) for (let i = 0; i < f.length; i += 3) base = Math.min(base, H(f[i], f[i + 1]));
    let top = 0;
    for (const [list, isRoof] of [[h.r, true], [h.w, false]]) {
      const P = [], U = [];
      for (const f of list) {
        const v = []; for (let i = 0; i < f.length; i += 3) v.push(new THREE.Vector3(f[i], f[i + 2], f[i + 1]));   // Daten: x, z, Höhe
        if (v.length < 3) continue;
        const n = new THREE.Vector3();
        for (let i = 0; i < v.length; i++) { const a = v[i], b = v[(i + 1) % v.length]; n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y); }
        n.normalize(); const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
        const proj = ay >= ax && ay >= az ? p => new THREE.Vector2(p.x, p.z) : ax >= az ? p => new THREE.Vector2(p.z, p.y) : p => new THREE.Vector2(p.x, p.y);
        let tris; try { tris = THREE.ShapeUtils.triangulateShape(v.map(proj), []); } catch (e) { continue; }
        const tx = -n.z, tz = n.x, tl = Math.hypot(tx, tz) || 1;
        for (const t of tris) for (const k of t) {
          const p = v[k]; P.push(p.x, p.y + base, p.z); top = Math.max(top, p.y);
          if (isRoof) U.push(p.x / 2.5, p.z / 2.5); else U.push((p.x * tx + p.z * tz) / tl / 3, p.y / 3);
        }
      }
      if (P.length) mesh(P, U, isRoof ? roofM : wallM);
    }
    // Kollision: Grundriss in 1-m-Zeilen, je Zeile ein Quader von Wand zu Wand
    for (const f of h.g) {
      const pts = []; for (let i = 0; i < f.length; i += 3) pts.push([f[i], f[i + 1]]);
      let zmin = Infinity, zmax = -Infinity; for (const [, z] of pts) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
      for (let z = Math.floor(zmin) + 0.5; z < zmax; z += 1) {
        const xs = [];
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z)) xs.push(xi + (z - zi) * (xj - xi) / (zj - zi)); }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const x0 = xs[k], x1 = xs[k + 1]; if (x1 - x0 < 0.2) continue;
          collider((x0 + x1) / 2, base - 3, z, x1 - x0, top + 3, 1);
          for (let x = Math.floor(x0) - 1; x <= x1 + 1; x++) for (let dz = -1; dz <= 1; dz++) occ.add(ck(x, z + dz));
        }
      }
    }
  });
  const freeAt = (x, z, r = 2) => { for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (occ.has(ck(x + dx, z + dz))) return false; return inside(x, z); };
  const onRoad = (x, z) => window.krepOnRoad(x, z);

  /* --- Wald: Bäume in den OSM-Waldflächen + Waldgürtel rund um den Ort zum Verstecken --- */
  let nTree = 0;
  const plant = (x, z) => { if (!freeAt(x, z, 2) || onRoad(x, z)) return; lift(x, z, () => srand() < 0.55 ? tree(x, z, srnd(1.6, 2.6)) : leafTree(x, z, srnd(0.9, 1.4))); nTree++; };
  for (const pts of forests) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let x = Math.max(x0, -S); x < Math.min(x1, S); x += 7) for (let z = Math.max(z0, -S); z < Math.min(z1, S); z += 7) {
      const px = x + srnd(-2.5, 2.5), pz = z + srnd(-2.5, 2.5); if (inPoly(px, pz, pts) && nTree < 700) plant(px, pz);
    }
  }
  for (let x = -S + 8; x < S - 6; x += 8) for (let z = -S + 8; z < S - 6; z += 8) {   // Gürtel am Rand (30 m breit) + Hecken/Baumgruppen auf den Feldern
    const edge = S - Math.max(Math.abs(x), Math.abs(z));
    if ((edge < 34 && srand() < 0.6) || srand() < 0.035) plant(x + srnd(-3, 3), z + srnd(-3, 3));
  }
  for (let i = 0; i < 40; i++) { const x = srnd(-S + 20, S - 20), z = srnd(-S + 20, S - 20); if (freeAt(x, z, 3) && !onRoad(x, z)) { const a = srand() < 0.5; lift(x, z, () => hedge(x, z, a ? srnd(3, 6) : 1, a ? 1 : srnd(3, 6))); } }

  /* --- Rand: Hecke + unsichtbare Wand --- */
  for (const s of [-1, 1]) {
    for (let t = -S; t < S; t += 6) { lift(t + 3, s * S, () => addBox(t + 3, -1, s * S, 6.2, 2.6, 1.2, HEDGE_MAT, 1, { decor: true, round: 0.4 })); lift(s * S, t + 3, () => addBox(s * S, -1, t + 3, 1.2, 2.6, 6.2, HEDGE_MAT, 1, { decor: true, round: 0.4 })); }
    collider(0, -20, s * (S + 0.5), 2 * S + 6, 200, 2); collider(s * (S + 0.5), -20, 0, 2, 200, 2 * S + 6);
  }
  const townSign = (x, z, rot) => lift(x, z, () => { addBox(x, 0, z, 0.12, 2.2, 0.12, MAT.metal, 1, { round: 0.05 }); tkSign(x, 2.3, z, 2.8, 0.9, rot, tkSignMat('KREPPENDORF', '#f2d21b', '#111111', false)); });

  /* --- Autos am Straßenrand, Mopeds, Ortsschilder --- */
  let nCar = 0, nSign = 0;
  for (const pts of roadPts) for (let i = 1; i + 1 < pts.length && nCar < 10; i += 3) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 8) continue;
    const mx = (ax + bx) / 2 + -(bz - az) / L * 4, mz = (az + bz) / 2 + (bx - ax) / L * 4;
    if (!freeAt(mx, mz, 3) || Math.hypot(mx, mz) > 200 || srand() < 0.4) continue;
    carSpot(mx, mz, Math.atan2(bz - az, bx - ax) + (srand() < 0.5 ? Math.PI : 0)); nCar++;
    if (nSign < 2 && Math.hypot(mx, mz) > 120) { townSign(mx, mz + 2, srand() * 6); nSign++; }
  }
  for (let i = 0; i < 40 && MAP_VEHICLES.length < nCar + 4; i++) { const x = srnd(-150, 150), z = srnd(-150, 150); if (onRoad(x, z) && freeAt(x, z, 2)) car(x, z, srand() < 0.5); }

  /* --- Spawnpunkte (über den ganzen Ort verteilt) + Waffen --- */
  const sp = window.KREPP_SPAWNS = [];
  for (let i = 0; i < 4000 && sp.length < 32; i++) {
    const x = Math.round(srnd(-S + 12, S - 12)), z = Math.round(srnd(-S + 12, S - 12));
    if (freeAt(x, z, 3) && !TREE_BOXES.some(b => x > b.min.x - 1.5 && x < b.max.x + 1.5 && z > b.min.z - 1.5 && z < b.max.z + 1.5) && sp.every(([a, b]) => Math.hypot(a - x, b - z) > 40)) sp.push([x, z]);
  }
  sp.forEach(([x, z], i) => { if (i % 2 === 0) MAP_PICKUPS.push({ w: i % 3, x: x + 3, y: H(x + 3, z), z }); });
  window.FIRE_POS = [9999, 9999]; window.SHIP_SMOKE = [9999, 16, 9999];

  /* --- Quellenhinweis (Pflicht für LoD2 Bayern CC BY 4.0 und OSM ODbL) --- */
  const at = document.createElement('div');
  at.textContent = 'Kartendaten: © Bayerische Vermessungsverwaltung (LoD2, CC BY 4.0) · © OpenStreetMap-Mitwirkende (ODbL)';
  at.style.cssText = 'position:fixed;left:50%;bottom:2px;transform:translateX(-50%);z-index:9999;font:10px sans-serif;color:#fff;opacity:.75;background:rgba(0,0,0,.35);padding:1px 6px;border-radius:3px;pointer-events:none;white-space:nowrap';
  document.body.appendChild(at);
}
