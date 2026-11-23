/* ======================= Karte „Kreppendorf“ (Ortsteil von Veitsbronn) =======================
   Häuser mit echten Dächern aus LoD2 Bayern, Straßen/Wald/Felder/Zenn aus OpenStreetMap (Daten: js/kreppendorf-data.js,
   erzeugt von tools/kreppendorf_extract.py). x = Osten, z = Süden, Mitte = Ortsmitte. Nutzt die Bausteine aus map.js. */
function buildKreppendorfMap() {
  const D = window.KREPP, S = D.R + 2;   // Rand ±262 m
  const P2 = a => { const o = []; for (let i = 0; i < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };
  const inPoly = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const inside = (x, z, m = 0) => Math.abs(x) < S - 4 - m && Math.abs(z) < S - 4 - m;
  /* --- Gelände: echte Höhen (DGM1 Bayern, 2-m-Raster), begehbar über das Hügel-System aus map.js --- */
  const H = window.krepH;
  addHillRegion({ x0: -S - 2, x1: S + 2, z0: -S - 2, z1: S + 2, fn: H });
  // Bauteil(e) aus map.js aufs Gelände heben: alles, was fn() neu in die Szene / Kollision legt, um H(x, z) nach oben
  const lift = (x, z, fn) => {
    const nc = scene.children.length, nb = boxes.length; fn(); const y = H(x, z);
    for (let i = nc; i < scene.children.length; i++) scene.children[i].position.y += y;
    for (let i = nb; i < boxes.length; i++) { boxes[i].min.y += y; boxes[i].max.y += y; }
  };

  /* --- Materialien --- */
  const qc = hex => { const n = parseInt(hex, 16); return ((n >> 16 & 255) >> 4 << 20) | ((n >> 8 & 255) >> 4 << 12) | ((n & 255) >> 4 << 4); };   // Dachfarben auf 16er-Stufen (weniger Materialien)
  const ROOF_MATS = new Map();
  const roofMat = hex => {   // echte Dachfarbe aus dem Luftbild, etwas kräftiger (Luftbild ist hell und blass)
    const k = qc(hex); if (ROOF_MATS.has(k)) return ROOF_MATS.get(k);
    const c = new THREE.Color(k); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, Math.min(1, hsl.s * 1.6), hsl.l * 0.8);
    const m = pbr('roof', 2.5, { map: tintedTex('roof', c.getHex()), mat: { side: THREE.DoubleSide } }); ROOF_MATS.set(k, m); return m;
  };
  const M = {
    // Putzfarben: Weiß, Cremegelb, Hellgrau, Sandstein, Lachs (ländliche Häuser in Franken)
    walls: [0xf6f3ec, 0xf0e0b0, 0xd8d6d0, 0xdcc096, 0xeec2a8, 0xf2ece0].map(c => pbr('concrete', 3, { map: tintedTex('concrete', c), mat: { color: new THREE.Color(0.4, 0.4, 0.4), side: THREE.DoubleSide } })),
    glass: new THREE.MeshStandardMaterial({ color: 0x1d2a36, roughness: 0.08, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -4 }),
    frame: new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
    door: pbr('wood', 2, { mat: { color: new THREE.Color(0.55, 0.38, 0.25), polygonOffset: true, polygonOffsetFactor: -3 } }),
    shutter: new THREE.MeshStandardMaterial({ color: 0x3f5a3c, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.5, metalness: 0.6 }),
    slab: pbr('concrete', 3, { mat: { color: new THREE.Color(0.7, 0.7, 0.68) } }),
    chimney: pbr('brick', 2, {}),
  };
  const mesh = (pos, uv, mat) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals(); withUv2(g); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; scene.add(m); mapMeshes.push(m); return m;
  };

  /* --- Boden: echtes Gras (mit Halmen aus grass.js) auf dem DGM1-Gelände, eingefärbt mit den Farben aus dem Luftbild (Felder, Gärten, Höfe) */
  { const R0 = 264, C = 2, n = R0 * 2 / C, pos = [], uv = [], col = [], idx = [], G = D.gc, raw = atob(G.b), tmp = new THREE.Color();
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const x = -R0 + j * C, z = -R0 + i * C, k = (i * G.n + j) * 3; pos.push(x, H(x, z) + 0.03, z); uv.push(x / 3, z / 3);
      tmp.setRGB(raw.charCodeAt(k) / 255, raw.charCodeAt(k + 1) / 255, raw.charCodeAt(k + 2) / 255).convertSRGBToLinear();
      const hsl = {}; tmp.getHSL(hsl); if ((hsl.h < 0.07 || hsl.h > 0.85) && hsl.s > 0.08) { hsl.h = 0.25; hsl.s = 0.45; hsl.l = 0.12; }   // Dächer im Luftbild (rötlich) → Gartenrasen
      tmp.setHSL(hsl.h, Math.min(1, hsl.s * 1.25), Math.min(0.2, hsl.l * 0.6)); col.push(tmp.r * 2.2, tmp.g * 2.2, tmp.b * 2.2);   // durch Grastextur geteilt → echte Farbe
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = i * (n + 1) + j, b = a + n + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(withUv2(g), pbr('grass', 3, { map: tintedTex('grass', 0x9a9a9a), mat: { vertexColors: true } })); m.receiveShadow = true; scene.add(m); mapMeshes.push(m); }

  /* --- Straßen und Wege aus OSM als echte Asphalt-/Schotterbänder (folgen dem Gelände) --- */
  const MR = { road: pbr('asphalt', 3, { mat: { polygonOffset: true, polygonOffsetFactor: -3 } }),
    dirt: pbr('asphalt', 3, { map: tintedTex('asphalt', 0x7a6248), mat: { color: new THREE.Color(0.7, 0.64, 0.56), polygonOffset: true, polygonOffsetFactor: -3 }, normalScale: 1.6 }) };
  const W = { primary: 7.5, secondary: 7, tertiary: 6.5, residential: 5.5, unclassified: 5, living_street: 4.5, service: 3.5, track: 3, path: 1.8, footway: 1.8, cycleway: 3 };
  const streets = window.MAP_STREETS = [], roadPts = [];
  const band = (pts, w, y, mat, keep) => {
    const P = [], U = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue;
      const nx = -(bz - az) / L * w / 2, nz = (bx - ax) / L * w / 2, ex = (bx - ax) / L * w * 0.25, ez = (bz - az) / L * w * 0.25;
      const A = [ax - ex + nx, az - ez + nz], B = [ax - ex - nx, az - ez - nz], C = [bx + ex - nx, bz + ez - nz], Dd = [bx + ex + nx, bz + ez + nz];
      const n = Math.max(1, Math.ceil(L / 2)), Lx = L + w * 0.5, at = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      for (let k = 0; k < n; k++) {
        const a = at(A, Dd, k / n), b = at(B, C, k / n), c = at(B, C, (k + 1) / n), d = at(A, Dd, (k + 1) / n), ua = Lx * k / n / 3, ub = Lx * (k + 1) / n / 3;
        for (const [q, u, v] of [[a, ua, 0], [c, ub, w / 3], [b, ua, w / 3], [a, ua, 0], [d, ub, 0], [c, ub, w / 3]]) { P.push(q[0], H(q[0], q[1]) + y + 0.03, q[1]); U.push(v, u); }
      }
      if (keep) for (let s = 0; s <= L; s += 5) { const x = ax + (bx - ax) * s / L, z = az + (bz - az) * s / L, r = w / 2 + 0.5; streets.push([x - r, z - r, x + r, z + r]); }
    }
    if (P.length) { const m = mesh(P, U, mat); m.castShadow = false; }
  };
  for (const w of D.ways) {
    if (!w.k.startsWith('h:')) continue;
    const pts = P2(w.p), t = w.k.slice(2), wd = W[t]; if (!wd) continue;
    const paved = wd >= 3.5 || t === 'cycleway';
    band(pts, wd, paved ? 0.06 : 0.055, paved ? MR.road : MR.dirt, paved);
    if (paved && t !== 'service') roadPts.push(pts);
  }
  window.krepOnRoad = (x, z) => { for (const [x0, z0, x1, z1] of streets) if (x > x0 && x < x1 && z > z0 && z < z1) return true; return false; };
  const roadDist = (x, z) => { let d = 1e9; for (const pts of roadPts) for (let i = 0; i + 1 < pts.length; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); d = Math.min(d, Math.hypot(ax + dx * t - x, az + dz * t - z)); } return d; };

  /* --- Häuser aus LoD2: Dächer + Wände als echte Flächen; dazu Fenster, Haustür, Fensterläden, Balkone, Schornsteine --- */
  const occ = new Set(), ck = (x, z) => Math.round(x) * 10000 + Math.round(z);
  const DET = new Map();   // Material → [Positionen, UVs] für alle Häuser zusammen
  const quad = (mat, P0, t, n, u, y, w, h, off) => {   // Rechteck auf der Wand: Mitte u (entlang t), unten y, Breite w, Höhe h, off vor der Wand
    let a = DET.get(mat); if (!a) DET.set(mat, a = [[], []]);
    const c = (du, dy) => [P0.x + t.x * (u + du) + n.x * off, P0.y + y + dy, P0.z + t.z * (u + du) + n.z * off];
    const A = c(-w / 2, 0), B = c(w / 2, 0), Cc = c(w / 2, h), Dd = c(-w / 2, h);
    for (const [q, uu, vv] of [[A, 0, 0], [B, 1, 0], [Cc, 1, 1], [A, 0, 0], [Cc, 1, 1], [Dd, 0, 1]]) { a[0].push(...q); a[1].push(uu * w / 2, vv * h / 2); }
  };
  const box = (mat, x, y, z, w, h, d, rot) => { const m = new THREE.Mesh(boxGeo(w, h, d, 1, 0), mat); m.position.set(x, y + h / 2, z); m.rotation.y = rot; m.castShadow = true; m.receiveShadow = true; scene.add(m); mapMeshes.push(m); };
  D.houses.forEach((h, hi) => {
    const hash = Math.imul(hi + 17, 2654435761) >>> 0, roofM = roofMat(h.c || '8a5040'), wallM = M.walls[(hash >>> 8) % M.walls.length];
    const base = h.b;   // echte Bodenhöhe aus LoD2 (gleiche Bezugshöhe wie das DGM1-Gelände)
    let top = 0, cxs = 0, czs = 0, cn = 0, roofTop = null;
    for (const f of h.r) for (let i = 0; i < f.length; i += 3) { cxs += f[i]; czs += f[i + 1]; cn++; if (!roofTop || f[i + 2] > roofTop[2]) roofTop = [f[i], f[i + 1], f[i + 2]]; }
    const hc = new THREE.Vector3(cxs / cn, 0, czs / cn);
    const walls = [];
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
        if (!isRoof && ay < 0.2) walls.push({ v, n });
      }
      if (P.length) mesh(P, U, isRoof ? roofM : wallM);
    }
    // Fassaden-Details je Wand
    const small = top < 4.2, shutters = (hash >>> 3) % 10 < 3;
    let doorDone = small, balcDone = top < 5.5 || (hash >>> 5) % 10 < 5;
    const fac = walls.map(({ v, n }) => {
      n = new THREE.Vector3(n.x, 0, n.z).normalize();
      const mid = v.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / v.length);
      if (n.dot(new THREE.Vector3(mid.x - hc.x, 0, mid.z - hc.z)) < 0) n.negate();   // nach außen
      const t = new THREE.Vector3(-n.z, 0, n.x), us = v.map(p => p.x * t.x + p.z * t.z), u0 = Math.min(...us), u1 = Math.max(...us), L = u1 - u0;
      const ymin = Math.min(...v.map(p => p.y)), side = uu => Math.max(...v.filter((p, i) => Math.abs(us[i] - uu) < 0.3).map(p => p.y));
      const eave = Math.min(side(u0), side(u1)), peak = Math.max(...v.map(p => p.y));
      const p0 = v[us.indexOf(u0)], P0 = new THREE.Vector3(p0.x - t.x * 0 , base, p0.z);   // Wand-Anfang (u = 0) auf Bodenhöhe
      return { n, t, L, ymin, eave, peak, P0, mid, road: roadDist(mid.x, mid.z) };
    }).filter(w => w.L > 2.2 && w.ymin < 0.6 && w.eave - w.ymin > 2.2);
    fac.sort((a, b) => a.road - b.road);   // Haustür an der Straßenseite
    fac.forEach((w, wi) => {
      const { n, t, L, eave, peak, P0 } = w;
      const cols = Math.max(1, Math.floor((L - 1.2) / 2.7)), step = L / cols;
      const doorCol = !doorDone && wi === 0 ? Math.floor(cols / 2) : -1;
      if (doorCol >= 0) { quad(M.door, P0, t, n, step * (doorCol + 0.5), 0, 1.1, 2.15, 0.05); quad(M.frame, P0, t, n, step * (doorCol + 0.5), 0, 1.35, 2.3, 0.03); doorDone = true; }
      for (let y = 0.95; y + 1.35 < eave - 0.35; y += 2.8) for (let c = 0; c < cols; c++) {
        if (y < 1 && c === doorCol) continue;
        const u = step * (c + 0.5);
        if (small) { quad(M.glass, P0, t, n, u, y + 0.3, 0.8, 0.6, 0.06); continue; }   // Garage/Schuppen: kleines Fenster
        quad(M.frame, P0, t, n, u, y - 0.06, 1.32, 1.47, 0.03); quad(M.glass, P0, t, n, u, y, 1.15, 1.35, 0.06);
        quad(M.frame, P0, t, n, u, y - 0.12, 1.4, 0.08, 0.12);   // Fensterbank
        if (shutters) { quad(M.shutter, P0, t, n, u - 0.95, y, 0.6, 1.35, 0.05); quad(M.shutter, P0, t, n, u + 0.95, y, 0.6, 1.35, 0.05); }
      }
      if (!small && peak > eave + 2.4) { quad(M.frame, P0, t, n, L / 2, eave + 0.5, 1.0, 1.15, 0.03); quad(M.glass, P0, t, n, L / 2, eave + 0.57, 0.85, 1.0, 0.06); }   // Giebelfenster
      // Balkon im 1. Stock: zur Sonnenseite (Süden = +z) oder zum Garten
      if (!balcDone && L > 5 && eave > 5.2 && (n.z > 0.5 || wi === fac.length - 1)) {
        const bw = Math.min(4.5, L - 1.5), u = L / 2, y = 2.75, rot = Math.atan2(-n.z, n.x) + Math.PI / 2;
        const at = (du, out) => [P0.x + t.x * (u + du) + n.x * out, P0.z + t.z * (u + du) + n.z * out];
        let [x, z] = at(0, 0.7); box(M.slab, x, y, z, bw, 0.18, 1.4, rot);
        [x, z] = at(0, 1.38); box(M.rail, x, y + 0.18, z, bw, 1.0, 0.05, rot);
        for (const s of [-1, 1]) { [x, z] = at(s * (bw / 2 - 0.03), 0.7); box(M.rail, x, y + 0.18, z, 0.05, 1.0, 1.4, rot); }
        quad(M.door, P0, t, n, u, y + 0.18, 1.0, 2.1, 0.05);   // Balkontür
        balcDone = true;
      }
    });
    // Schornstein am First (Wohnhäuser)
    if (!small && roofTop && (hash >>> 11) % 10 < 7) box(M.chimney, roofTop[0] + (hc.x - roofTop[0]) * 0.25, base + roofTop[2] - 1.2, roofTop[1] + (hc.z - roofTop[1]) * 0.25, 0.55, 2.0, 0.55, 0);
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
  for (const [mat, [P, U]] of DET) { mat.side = THREE.DoubleSide; const m = mesh(P, U, mat); m.castShadow = false; }
  const freeAt = (x, z, r = 2) => { for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (occ.has(ck(x + dx, z + dz))) return false; return inside(x, z); };
  const onRoad = (x, z) => window.krepOnRoad(x, z);

  /* --- Bäume genau dort, wo sie im Luftbild stehen --- */
  for (let i = 0; i < D.trees.length; i += 2) {
    const x = D.trees[i], z = D.trees[i + 1]; if (!freeAt(x, z, 1) || !inside(x, z)) continue;
    lift(x, z, () => srand() < 0.3 ? tree(x, z, srnd(1.5, 2.3)) : leafTree(x, z, srnd(0.9, 1.35)));
  }

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
  at.textContent = 'Kartendaten: © Bayerische Vermessungsverwaltung (LoD2, DGM1, CC BY 4.0) · © OpenStreetMap-Mitwirkende (ODbL)';
  at.style.cssText = 'position:fixed;left:50%;bottom:2px;transform:translateX(-50%);z-index:9999;font:10px sans-serif;color:#fff;opacity:.75;background:rgba(0,0,0,.35);padding:1px 6px;border-radius:3px;pointer-events:none;white-space:nowrap';
  document.body.appendChild(at);
}
