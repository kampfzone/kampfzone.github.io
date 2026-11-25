/* ======================= Karte „Kreppendorf“ (Ortsteil von Veitsbronn) =======================
   Häuser mit echten Dächern aus LoD2 Bayern, Straßen/Wald/Felder/Zenn aus OpenStreetMap (Daten: js/kreppendorf-data.js,
   erzeugt von tools/kreppendorf_extract.py). x = Osten, z = Süden, Mitte = Ortsmitte. Nutzt die Bausteine aus map.js. */
function buildKreppendorfMap() {
  const D = window.KREPP, S = D.R + 2;   // Rand ±262 m
  const P2 = a => { const o = []; for (let i = 0; i < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };
  const inPoly = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const inside = (x, z, m = 0) => Math.abs(x) < S - 4 - m && Math.abs(z) < S - 4 - m;
  /* --- Gelände: echte Höhen (DGM1 Bayern, 2-m-Raster), begehbar über das Hügel-System aus map.js --- */
  /* Zenn: echtes Bachbett ins Gelände graben (DGM1 zeigt nur die Wasseroberfläche). Abstand zur Bachlinie als 2-m-Raster */
  const X = window.KREPPX || { stops: [], roads: [], trees: [] }, H0 = window.KREPP_H0 || window.krepH; window.KREPP_H0 = H0;
  const RIV = D.ways.filter(w => w.k === 'w:river').map(w => P2(w.p)), BRIDGES = X.roads.filter(r => r.b).map(r => P2(r.p));
  const segDist = (x, z, [ax, az], [bx, bz]) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(ax + dx * t - x, az + dz * t - z); };
  const RG = { o: -(D.R + 40), s: 2, n: D.R + 41 }, RD = new Float32Array(RG.n * RG.n).fill(99);
  for (const pts of RIV) for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], c0 = v => Math.max(0, Math.floor((v - RG.o - 10) / RG.s)), c1 = v => Math.min(RG.n - 1, Math.ceil((v - RG.o + 10) / RG.s));
    for (let r = c0(Math.min(a[1], b[1])); r <= c1(Math.max(a[1], b[1])); r++) for (let c = c0(Math.min(a[0], b[0])); c <= c1(Math.max(a[0], b[0])); c++) {
      const k = r * RG.n + c; RD[k] = Math.min(RD[k], segDist(RG.o + c * RG.s, RG.o + r * RG.s, a, b)); }
  }
  const rDist = (x, z) => { const fx = Math.min(RG.n - 1.001, Math.max(0, (x - RG.o) / RG.s)), fz = Math.min(RG.n - 1.001, Math.max(0, (z - RG.o) / RG.s)), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, n = RG.n;
    return (RD[j * n + i] * (1 - u) + RD[j * n + i + 1] * u) * (1 - v) + (RD[(j + 1) * n + i] * (1 - u) + RD[(j + 1) * n + i + 1] * u) * v; };
  const carve = d => d < 2.4 ? 1.5 : d < 6 ? 1.5 * (1 - (d - 2.4) / 3.6) ** 1.6 : 0;   // 1,5 m tief, steile Uferböschung
  window.krepH = (x, z) => H0(x, z) - carve(rDist(x, z));
  const H = window.krepH;
  addHillRegion({ x0: -S - 2, x1: S + 2, z0: -S - 2, z1: S + 2, fn: H });
  // Bauteil(e) aus map.js aufs Gelände heben: alles, was fn() neu in die Szene / Kollision legt, um H(x, z) nach oben
  const lift = (x, z, fn) => {
    const nc = scene.children.length, nb = boxes.length; fn(); const y = H(x, z);
    for (let i = nc; i < scene.children.length; i++) scene.children[i].position.y += y;
    for (let i = nb; i < boxes.length; i++) { boxes[i].min.y += y; boxes[i].max.y += y; }
  };

  /* --- Echtes Luftbild (DOP20 Bayern, 20 cm/Pixel) für Boden und Dächer; Feinstruktur aus der Grastextur --- */
  const DOP = new THREE.TextureLoader().load('textures/' + MAP_ID + '-dop20.jpg');
  DOP.encoding = THREE.sRGBEncoding; DOP.anisotropy = renderer.capabilities.getMaxAnisotropy(); DOP.wrapS = DOP.wrapT = THREE.ClampToEdgeWrapping;
  const DR = D.R + 4, dopUv = (x, z) => [(x + DR) / (2 * DR), (DR - z) / (2 * DR)];
  const dopMat = (detailScale, detailAmt, extra = {}) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ map: DOP, roughness: 0.95, color: new THREE.Color(0.5, 0.5, 0.5) }, extra)), det = tintedTex('grass', 0xffffff);
    m.onBeforeCompile = sh => { sh.uniforms.detailMap = { value: det };
      sh.fragmentShader = 'uniform sampler2D detailMap;\n' + sh.fragmentShader.replace('#include <map_fragment>',
        `vec4 texelColor = mapTexelToLinear(texture2D(map, vUv)); texelColor.rgb = pow(texelColor.rgb, vec3(1.3)) * 1.45;
         float lum = dot(texelColor.rgb, vec3(0.299, 0.587, 0.114)); texelColor.rgb = max(vec3(0.0), mix(vec3(lum), texelColor.rgb, 1.1));
         if (texelColor.r > texelColor.g * 1.2 && texelColor.r > texelColor.b * 1.3) texelColor.rgb = vec3(0.09, 0.16, 0.05) * (0.8 + lum);   /* Dachkante im Luftbild -> Rasen */
         vec3 dd = texture2D(detailMap, vUv * ${detailScale.toFixed(1)}).rgb;
         texelColor.rgb *= mix(1.0, clamp(dot(dd, vec3(0.333)) * 3.2, 0.25, 1.9), ${detailAmt.toFixed(2)}); diffuseColor *= texelColor;`); };
    return m; };
  /* --- Materialien --- */
  const qc = hex => { const n = parseInt(hex, 16); return ((n >> 16 & 255) >> 4 << 20) | ((n >> 8 & 255) >> 4 << 12) | ((n & 255) >> 4 << 4); };   // Dachfarben auf 16er-Stufen (weniger Materialien)
  const ROOF_MATS = new Map();
  const roofMat = hex => {   // echte Dachfarbe aus dem Luftbild, etwas kräftiger (Luftbild ist hell und blass)
    const k = qc(hex); if (ROOF_MATS.has(k)) return ROOF_MATS.get(k);
    const c = new THREE.Color(k); const hsl = {}; c.getHSL(hsl); const warm = hsl.h < 0.12 || hsl.h > 0.94;   // Ziegelrot/-braun kräftiger, graue/anthrazit Dächer (bläulich im Luftbild) entsättigen
    c.setHSL(warm ? hsl.h : 0.6, warm ? Math.min(1, hsl.s * 1.6) : Math.min(0.08, hsl.s * 0.4), hsl.l * 0.8);
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
    plinth: pbr('concrete', 1.5, { mat: { color: new THREE.Color(0.32, 0.31, 0.3), polygonOffset: true, polygonOffsetFactor: -2 } }),
  };
  const mesh = (pos, uv, mat) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals(); withUv2(g); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; scene.add(m); mapMeshes.push(m); return m;
  };

  /* --- Boden: echtes Gras (mit Halmen aus grass.js) auf dem DGM1-Gelände, eingefärbt mit den Farben aus dem Luftbild (Felder, Gärten, Höfe) */
  { const R0 = D.R + 4, C = 2, n = R0 * 2 / C, pos = [], uv = [], col = [], idx = [], G = D.gc, raw = atob(G.b), tmp = new THREE.Color();
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const x = -R0 + j * C, z = -R0 + i * C, k = (i * G.n + j) * 3; pos.push(x, H(x, z) + 0.03, z); uv.push(...dopUv(x, z));
      tmp.setRGB(raw.charCodeAt(k) / 255, raw.charCodeAt(k + 1) / 255, raw.charCodeAt(k + 2) / 255).convertSRGBToLinear();
      const hsl = {}; tmp.getHSL(hsl); if ((hsl.h < 0.07 || hsl.h > 0.85) && hsl.s > 0.08) { hsl.h = 0.25; hsl.s = 0.45; hsl.l = 0.12; }   // Dächer im Luftbild (rötlich) → Gartenrasen
      tmp.setHSL(hsl.h, Math.min(1, hsl.s * 1.25), Math.min(0.2, hsl.l * 0.6)); col.push(tmp.r * 2.2, tmp.g * 2.2, tmp.b * 2.2);   // durch Grastextur geteilt → echte Farbe
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = i * (n + 1) + j, b = a + n + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const gm = dopMat(176, 0.9); gm.userData.grassGround = true;   // stehende Halme (grass.js) wie vorher
    const m = new THREE.Mesh(withUv2(g), gm); m.receiveShadow = true; scene.add(m); mapMeshes.push(m); }

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
  // Pflaster (OSM surface=paving_stones): Betonstein-Verbund als eigene Textur
  MR.pave = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
    g.fillStyle = '#6d6862'; g.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 16; r++) for (let c = -1; c < 9; c++) { const l = 150 + ((r * 7 + c * 13) % 5) * 9 - 10; g.fillStyle = `rgb(${l},${l - 4},${l - 10})`; g.fillRect(c * 32 + (r & 1) * 16 + 1, r * 16 + 1, 30, 14); }
    const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 8; if (THREE.SRGBColorSpace) tx.colorSpace = THREE.SRGBColorSpace; else tx.encoding = THREE.sRGBEncoding;
    return new THREE.MeshStandardMaterial({ map: tx, color: new THREE.Color(0.42, 0.41, 0.4), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3 }); })();
  const surf = new Map(); for (const r of X.roads) surf.set(Math.round(r.p[0]) + ',' + Math.round(r.p[1]), r);
  const onBridge = (x, z) => BRIDGES.some(b => b.some((p, i) => i + 1 < b.length && segDist(x, z, p, b[i + 1]) < 1));
  const resi = [];
  for (const w of D.ways) {
    if (!w.k.startsWith('h:')) continue;
    const t = w.k.slice(2), xr = surf.get(Math.round(w.p[0]) + ',' + Math.round(w.p[1])) || {}; let wd = parseFloat(xr.w) || W[t]; if (!wd) continue;
    let pts = P2(w.p); if (xr.b || pts.every(([x, z]) => onBridge(x, z))) continue;   // Brücke wird extra gebaut
    const paved = wd >= 3.5 || t === 'cycleway' || /asphalt|paved|concrete|paving/.test(xr.s || '');
    band(pts, wd, paved ? 0.06 : 0.055, xr.s === 'paving_stones' ? MR.pave : paved ? MR.road : MR.dirt, paved);
    if (paved && t !== 'service' && wd >= 3) roadPts.push(pts);
    if (t === 'residential' && xr.s !== 'paving_stones') resi.push([pts, wd]);
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
  const homes = [];   // Wohnhäuser für die Gärten (Straßenseite, Bodenhöhe, Grundriss)
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
        if (isRoof && Math.abs(n.y) > 0.15) for (const p of v) {   // Dachüberstand: Ecke 0,55 m vom Hausmittelpunkt weg, auf der Dachebene bleibend
          const dx = p.x - cxs / cn, dz = p.z - czs / cn, dl = Math.hypot(dx, dz) || 1, ox = dx / dl * 0.55, oz = dz / dl * 0.55;
          p.x += ox; p.z += oz; p.y -= (n.x * ox + n.z * oz) / n.y; }
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
    { let area = 0; for (const f of h.g) for (let i = 0, n3 = f.length; i < n3; i += 3) { const j = (i + 3) % n3; area += f[i] * f[j + 1] - f[j] * f[i + 1]; }
      if (fac.length && !small && top < 13 && Math.abs(area / 2) < 300) homes.push({ f: fac[0], base, hash, g: h.g }); }
    fac.forEach((w, wi) => {
      const { n, t, L, eave, peak, P0 } = w;
      const cols = Math.max(1, Math.floor((L - 1.2) / 2.7)), step = L / cols;
      if (!small) { quad(M.plinth, P0, t, n, L / 2, -0.4, L, 0.95, 0.02); quad(M.frame, P0, t, n, L / 2, eave - 0.32, L + 0.2, 0.32, 0.25); }   // Sockel + Traufkasten
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

  /* --- Gärten: Zaun/Hecke zur Straße mit Tor, Briefkasten, Mülltonnen, Weg zur Tür; Seiten-/Rückzäune; hinten Beete, Sitzplatz & Co. --- */
  const GM = {
    wood: pbr('wood', 1.5, { mat: { color: new THREE.Color(0.75, 0.6, 0.45) } }), woodW: new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.7 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2e3236, roughness: 0.45, metalness: 0.7 }), wire: new THREE.MeshStandardMaterial({ color: 0x5a6a5a, roughness: 0.6, metalness: 0.5, transparent: true, opacity: 0.55 }),
    hedge: HEDGE_MAT, stone: pbr('concrete', 1.5, { mat: { color: new THREE.Color(0.75, 0.72, 0.66) } }), soil: pbr('asphalt', 1, { map: tintedTex('asphalt', 0x4a3020), mat: { color: new THREE.Color(0.5, 0.4, 0.32) } }),
    paving: pbr('concrete', 1, { mat: { color: new THREE.Color(0.62, 0.6, 0.56), polygonOffset: true, polygonOffsetFactor: -3 } }),
    flowers: [0xd23a3a, 0xf2c232, 0xb05ad8, 0xffffff, 0xf07ab0].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })),
    bins: [0x2a2a2a, 0x2a56a8, 0x7a4a26, 0xe0c020].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })),
    cloth: [0xc83c32, 0x2e6eb8, 0xe8d8a0, 0x3c8a4a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide })),
    bush: new THREE.MeshStandardMaterial({ color: 0x3c6a2c, roughness: 1 }), tramp: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }),
  };
  const cyl = (mat, x, y, z, r0, r1, h, seg = 10) => { const m = new THREE.Mesh(withUv2(new THREE.CylinderGeometry(r0, r1, h, seg)), mat); m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); mapMeshes.push(m); };
  const blob = (x, y, z, r) => { const m = new THREE.Mesh(withUv2(new THREE.IcosahedronGeometry(r, 1)), GM.bush); m.position.set(x, y + r * 0.7, z); m.scale.y = 0.8; m.castShadow = true; scene.add(m); mapMeshes.push(m); };
  const blocked = (x, z) => occ.has(ck(x, z)) || !inside(x, z, 2);
  // Zaun von A nach B (Bodenhöhe folgt dem Gelände); type: 0 Holzlatten, 1 Metall, 2 Hecke, 3 Maschendraht, 4 Mäuerchen + Holz
  const fence = (ax, az, bx, bz, type, gapAt = -1) => {
    const L = Math.hypot(bx - ax, bz - az); if (L < 0.8) return;
    const tx = (bx - ax) / L, tz = (bz - az) / L, rot = -Math.atan2(tz, tx), seg = type === 2 ? 1.5 : 2;
    for (let s = 0; s < L - 0.05; s += seg) {
      const e = Math.min(L, s + seg), m = (s + e) / 2, x = ax + tx * m, z = az + tz * m, y = H(x, z), len = e - s;
      if (gapAt >= 0 && Math.abs(m - gapAt) < 0.9) continue;   // Gartentor / Einfahrt
      if (blocked(x, z) || window.krepOnRoad(x, z)) continue;   // kein Zaun quer über Straßen
      { const sx0 = ax + tx * s, sz0 = az + tz * s, sx1 = ax + tx * e, sz1 = az + tz * e, ch = type === 4 ? 0.95 : 1.05;   // Kollision: nicht durchlaufen, aber drüberspringen/-klettern (1 m hoch)
        if (Math.abs(tx) > 0.96 || Math.abs(tz) > 0.96) collider(x, y - 0.3, z, Math.abs(sx1 - sx0) + 0.25, ch + 0.3, Math.abs(sz1 - sz0) + 0.25);
        else for (let q = s + 0.25; q < e; q += 0.5) { const qx = ax + tx * q, qz = az + tz * q; collider(qx, H(qx, qz) - 0.3, qz, 0.45, ch + 0.3, 0.45); } }
      if (type === 2) { box(GM.hedge, x, y - 0.1, z, len + 0.1, 1.35, 0.7, rot); continue; }
      const px = ax + tx * s, pz = az + tz * s, py = H(px, pz);
      if (type === 4) { box(GM.stone, x, y - 0.2, z, len, 0.6, 0.3, rot); box(GM.wood, px, py + 0.4, pz, 0.12, 0.75, 0.12, rot); box(GM.wood, x, y + 0.85, z, len, 0.08, 0.04, rot); continue; }
      box(type === 1 ? GM.metal : type === 3 ? GM.metal : GM.wood, px, py - 0.1, pz, 0.1, type === 3 ? 1.35 : 1.15, 0.1, rot);   // Pfosten
      if (type === 3) { box(GM.wire, x, y, z, len, 1.2, 0.02, rot); continue; }
      for (const ry of [0.3, 0.85]) box(type === 1 ? GM.metal : GM.wood, x, y + ry, z, len, 0.06, 0.04, rot);   // Querlatten
      const slat = type === 1 ? 0.14 : 0.12, step = type === 1 ? 0.14 : 0.22;
      for (let q = s + step / 2; q < e; q += step) { const sx = ax + tx * q, sz = az + tz * q; box(type === 1 ? GM.metal : (homesHash & 1 ? GM.woodW : GM.wood), sx, H(sx, sz), sz, type === 1 ? 0.025 : slat * 0.8, type === 1 ? 1.0 : 1.0, 0.025, rot); }
    }
  };
  let homesHash = 0;
  for (const hm of homes) {   // an der Haustür: Briefkasten und Mülltonnen (stehen bei jedem Haus)
    const { f: w, hash } = hm, n = w.n, t = w.t, L = w.L; homesHash = hash;
    const P = (u, o) => [w.P0.x + t.x * u + n.x * o, w.P0.z + t.z * u + n.z * o], r = -Math.atan2(t.z, t.x);
    if (w.road < 4.5) continue;
    { const [x, z] = P(L / 2 + 1.1, Math.min(6, w.road - 4)); if (!blocked(x, z)) { box(GM.metal, x, H(x, z), z, 0.08, 1.0, 0.08, 0); box(GM.bins[(hash >>> 2) % 2 ? 0 : 3], x, H(x, z) + 1.0, z, 0.4, 0.32, 0.22, r); } }
    for (let b = 0; b < 3; b++) { const [x, z] = P(L + 1.0 + b * 0.75, 0.9); if (!blocked(x, z)) box(GM.bins[b], x, H(x, z), z, 0.6, 1.05, 0.7, r); }
  }
  /* Zäune genau auf den echten Grundstücksgrenzen (ALKIS-Parzellarkarte): zur Straße Gartenzaun mit Tor, sonst Hecke/Maschendraht/Holz */
  const GF = D.gard.f, hcs0 = homes.map(hm => [hm.f.mid.x, hm.f.mid.z]);
  for (let i = 0; i < GF.length; i += 4) {
    const ax = GF[i], az = GF[i + 1], bx = GF[i + 2], bz = GF[i + 3], mx = (ax + bx) / 2, mz = (az + bz) / 2, L = Math.hypot(bx - ax, bz - az);
    if (window.krepOnRoad(mx, mz)) continue;
    const hh = Math.imul(Math.round(mx * 7 + mz * 13), 2654435761) >>> 0, street = roadDist(mx, mz) < 7;
    homesHash = hh;
    let gap = -1;
    if (street) {   // Gartentor dort, wo die Grenze dem nächsten Haus am nächsten ist
      let best = 1e9; for (const [hx, hz] of hcs0) { const tt = Math.max(0, Math.min(1, ((hx - ax) * (bx - ax) + (hz - az) * (bz - az)) / (L * L))); const d = Math.hypot(ax + (bx - ax) * tt - hx, az + (bz - az) * tt - hz); if (d < best) { best = d; gap = tt * L; } }
      if (best > 25) gap = L / 2;
    }
    fence(ax, az, bx, bz, street ? [0, 0, 1, 4, 2, 0][hh % 6] : [2, 3, 3, 0, 2][hh % 5], gap);
  }
  /* Gartenflächen aus dem Luftbild: Pflaster (Hof, Terrasse, Einfahrt), Beete mit Pflanzen, Pools */
  { const G = D.gard, GD = new Map(), cell = (arr, mat, y, flowers) => {
      for (let i = 0; i < arr.length; i += 2) { const x = arr[i], z = arr[i + 1]; if (occ.has(ck(x + 0.5, z + 0.5)) || window.krepOnRoad(x + 0.5, z + 0.5)) continue;
        let a = GD.get(mat); if (!a) GD.set(mat, a = [[], []]);
        const v = (dx, dz) => { a[0].push(x + dx, H(x + dx, z + dz) + y, z + dz); a[1].push((x + dx) / 1.5, (z + dz) / 1.5); };
        v(0, 0); v(0, 1); v(1, 0); v(1, 0); v(0, 1); v(1, 1);
        if (flowers && ((x * 7 + z * 3) & 3) === 0) blob(x + 0.5, H(x + 0.5, z + 0.5) + y, z + 0.5, 0.28);   // Gemüse/Stauden im Beet
      } };
    cell(G.pave, GM.paving, 0.07, false); cell(G.bed, GM.soil, 0.08, true);
    const water = new THREE.MeshStandardMaterial({ color: 0x3fa6c8, roughness: 0.05, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -4 });
    cell(G.pool, water, 0.1, false);
    for (let i = 0; i < G.pool.length; i += 2) { const x = G.pool[i] + 0.5, z = G.pool[i + 1] + 0.5; box(GM.woodW, x, H(x, z) - 0.2, z, 1.02, 0.28, 1.02, 0); }   // Beckenrand
    for (const [mat, [P, U]] of GD) { const m = mesh(P, U, mat); m.castShadow = false; }
  }
  /* --- Zenn: Wasserband im Bachbett, Schilf und Ufergebüsch, Betonbrücke --- */
  const offsetLine = (pts, o) => pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [p[0] - (b[1] - a[1]) / L * o, p[1] + (b[0] - a[0]) / L * o]; });
  { const wm = TKM.water.clone(); wm.color = new THREE.Color(0x26342a); wm.metalness = 0; wm.roughness = 0.12; wm.envMapIntensity = 0.6; wm.polygonOffset = true; wm.polygonOffsetFactor = -1;   // Zenn ist eher bräunlich-grün
    const P = [], U = [], reeds = [], RW = 4.4;
    for (const pts0 of RIV) {
      const pts = []; for (let i = 0; i + 1 < pts0.length; i++) { const [ax, az] = pts0[i], [bx, bz] = pts0[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 3)); for (let k = 0; k < n; k++) pts.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]); }
      pts.push(pts0[pts0.length - 1]);
      const ins = pts.filter(([x, z]) => Math.abs(x) < S + 10 && Math.abs(z) < S + 10); if (ins.length < 2) continue;
      const L = offsetLine(ins, -RW), R = offsetLine(ins, RW); let lvl = 1e9, s = 0;
      const ys = ins.map(([x, z]) => (lvl = Math.min(lvl, H0(x, z) - 0.75)));   // fließt nach Osten: Wasserspiegel fällt nur
      for (let i = 0; i + 1 < ins.length; i++) {
        const ds = Math.hypot(ins[i + 1][0] - ins[i][0], ins[i + 1][1] - ins[i][1]);
        for (const [q, y, u, v] of [[L[i], ys[i], 0, s], [R[i], ys[i], 1, s], [R[i + 1], ys[i + 1], 1, s + ds], [L[i], ys[i], 0, s], [R[i + 1], ys[i + 1], 1, s + ds], [L[i + 1], ys[i + 1], 0, s + ds]]) { P.push(q[0], y, q[1]); U.push(u * 2, v / 4); }
        s += ds;
        // Schilf/Gebüsch auf beiden Ufern (nicht auf Straßen, nicht unter der Brücke)
        for (const side of [-1, 1]) {
          const h = Math.imul(i * 31 + side * 7 + 1000, 2654435761) >>> 0; const o = side * (3.6 + (h % 100) / 60), [x, z] = offsetLine([ins[i], ins[i + 1]], o)[0];
          if (!inside(x, z) || window.krepOnRoad(x, z) || BRIDGES.some(b => segDist(x, z, b[0], b[b.length - 1]) < 6)) continue;
          if (h % 3) reeds.push(x, H(x, z), z, (h >>> 4) % 7); else if (h % 5 === 0) blob(x, H(x, z) - 0.3, z, 0.9 + (h >>> 8) % 5 * 0.15);
        }
      }
    }
    if (P.length) { const m = mesh(P, U, wm); m.castShadow = false; m.receiveShadow = true; m.userData.noMerge = true; }
    // Schilf: gekreuzte Halm-Büschel, alles in einem Mesh
    const RP = [], RU = [], reedM = new THREE.MeshStandardMaterial({ color: 0x5a6e30, roughness: 1, side: THREE.DoubleSide });
    for (let i = 0; i < reeds.length; i += 4) { const [x, y, z, k] = reeds.slice(i, i + 4);
      for (let b = 0; b < 16; b++) { const a = k + b * 2.39, r = 0.15 + (b % 5) * 0.13, ox = Math.cos(a) * r, oz = Math.sin(a) * r, dx = Math.cos(a + 1.6) * 0.045, dz = Math.sin(a + 1.6) * 0.045, h = 1.1 + ((b * 7) % 5) * 0.16, lx = ox * 0.5, lz = oz * 0.5;
        for (const [px, py, pz] of [[x + ox - dx, y, z + oz - dz], [x + ox + dx, y, z + oz + dz], [x + ox * 1.5 + lx, y + h, z + oz * 1.5 + lz]]) { RP.push(px, py, pz); RU.push(0, 0); } } }
    if (RP.length) { const m = mesh(RP, RU, reedM); m.castShadow = false; const nr = m.geometry.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0); }
  }
  for (const b of BRIDGES) {   // Betonbrücke: Fahrbahn auf Uferhöhe, Brüstung mit Geländer, begehbar
    const pts = b.filter(([x, z]) => inside(x, z, -20)); if (pts.length < 2) continue;
    const [ax, az] = pts[0], [bx, bz] = pts[pts.length - 1], L = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / L, tz = (bz - az) / L, rot = -Math.atan2(tz, tx);
    const e = 2.5, x0 = ax - tx * e, z0 = az - tz * e, x1 = bx + tx * e, z1 = bz + tz * e, LL = L + 2 * e, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, y = Math.max(H0(x0, z0), H0(x1, z1), H0(cx, cz)) + 0.1, BW = 6;
    box(M.slab, cx, y - 0.6, cz, LL, 0.6, BW, rot); box(MR.road, cx, y - 0.02, cz, LL, 0.04, BW - 1.2, rot);
    for (const s of [-1, 1]) { const px = cx - tz * s * (BW / 2 - 0.2), pz = cz + tx * s * (BW / 2 - 0.2);
      box(M.slab, px, y, pz, LL, 0.35, 0.4, rot); box(M.rail, px, y + 0.35, pz, LL, 0.06, 0.08, rot); box(M.rail, px, y + 0.35 + 0.55, pz, LL, 0.06, 0.08, rot);
      for (let q = -LL / 2; q <= LL / 2 + 0.01; q += 1.5) box(M.rail, px + tx * q, y + 0.35, pz + tz * q, 0.06, 0.6, 0.06, rot); }
    for (let q = -LL / 2 + 0.5; q < LL / 2; q += 1) collider(cx + tx * q, y - 3, cz + tz * q, 1.1, 3, BW - 0.6);   // Fahrbahn
    for (const s of [-1, 1]) for (let q = -LL / 2 + 0.5; q < LL / 2; q += 1) collider(cx + tx * q - tz * s * (BW / 2 - 0.2), y, cz + tz * q + tx * s * (BW / 2 - 0.2), 1, 1, 0.4);
    roadPts.push([[x0, z0], [x1, z1]]); for (let q = 0; q <= LL; q += 3) { const x = x0 + tx * q, z = z0 + tz * q; streets.push([x - 3, z - 3, x + 3, z + 3]); }
  }

  /* --- Rinnstein (Granit-Bordstein + Pflasterrinne) an den Dorfstraßen, wo Häuser stehen --- */
  { const curbM = pbr('concrete', 1, { mat: { color: new THREE.Color(0.78, 0.77, 0.74), polygonOffset: true, polygonOffsetFactor: -4 } }), hc = homes.map(hm => [hm.f.mid.x, hm.f.mid.z]);
    for (const [pts, wd] of resi) {
      let run = [];
      const flush = () => { if (run.length > 1) for (const s of [-1, 1]) band(offsetLine(run, s * (wd / 2 - 0.2)), 0.45, 0.075, curbM, false); run = []; };
      for (let i = 0; i < pts.length; i++) { const [x, z] = pts[i]; if (hc.some(([a, b]) => Math.hypot(a - x, b - z) < 40)) run.push(pts[i]); else { if (run.length) run.push(pts[i]); flush(); } }
      flush();
    }
  }

  /* --- Bushäuschen an der Haltestelle „Kreppendorf“ (OSM, shelter=yes): Glas-Wartehalle, Bank, Haltestellenschild --- */
  for (const st of X.stops) {
    let [x, z] = st.p; if (!inside(x, z, 2) || !st.sh) continue;
    let best = 1e9, nx = 0, nz = 0, rx = 0, rz = 0;   // nächster Straßenpunkt
    for (const pts of roadPts) for (let i = 0; i + 1 < pts.length; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))), qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(qx - x, qz - z); if (d < best) { best = d; rx = qx; rz = qz; const L = Math.hypot(dx, dz); nx = -dz / L; nz = dx / L; } }
    if ((x - rx) * nx + (z - rz) * nz < 0) { nx = -nx; nz = -nz; }   // n zeigt von der Straße zum Häuschen
    const tx = -nz, tz = nx, sx = rx + nx * 5.2, sz = rz + nz * 5.2, y = H(sx, sz), rot = -Math.atan2(tz, tx), Wd = 3.2, Dp = 1.6, Hh = 2.4;
    const glass = new THREE.MeshStandardMaterial({ color: 0xa8c4cc, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const P = (u, o) => [sx + tx * u + nx * o, sz + tz * u + nz * o];
    box(GM.paving, sx - nx * 0.4, y - 0.15, sz - nz * 0.4,Wd + 1.6, 0.2, Dp + 2.4, rot);   // Pflasterfläche
    for (const [u, o] of [[-Wd / 2, Dp / 2], [Wd / 2, Dp / 2], [-Wd / 2, -Dp / 2], [Wd / 2, -Dp / 2]]) { const [px, pz] = P(u, o); box(GM.metal, px, y, pz, 0.08, Hh, 0.08, rot); }
    { const [px, pz] = P(0, Dp / 2); box(glass, px, y + 0.1, pz, Wd, Hh - 0.2, 0.03, rot); collider(px, y, pz, Math.abs(tx) * Wd + 0.2, Hh, Math.abs(tz) * Wd + 0.2); }   // Rückwand
    for (const s of [-1, 1]) { const [px, pz] = P(s * Wd / 2, 0); box(glass, px, y + 0.1, pz, 0.03, Hh - 0.2, Dp, rot); }   // Seitenwände
    { const [px, pz] = P(0, 0); box(GM.metal, px, y + Hh, pz, Wd + 0.4, 0.12, Dp + 0.5, rot); }   // Dach
    { const [px, pz] = P(0, Dp / 2 - 0.3); box(GM.wood, px, y + 0.45, pz, Wd - 0.6, 0.06, 0.4, rot); for (const s of [-1, 1]) { const [qx, qz] = P(s * (Wd / 2 - 0.5), Dp / 2 - 0.3); box(GM.metal, qx, y, qz, 0.06, 0.45, 0.35, rot); } }   // Bank
    { const [px, pz] = P(Wd / 2 + 0.9, -1.4); box(GM.metal, px, y, pz, 0.07, 2.4, 0.07, 0);   // Haltestellenschild (grünes H auf gelb) + Fahrplan
      const sg = document.createElement('canvas'); sg.width = sg.height = 128; const g = sg.getContext('2d'); g.fillStyle = '#f2d21b'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.strokeStyle = '#1d7a3a'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 55, 0, 7); g.stroke(); g.fillStyle = '#1d7a3a'; g.font = 'bold 80px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 64, 68);
      const sm = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(sg), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), sm); sign.position.set(px, y + 2.25, pz); sign.rotation.y = rot; scene.add(sign);
      box(GM.woodW, px + tx * 0.05, y + 1.3, pz + tz * 0.05, 0.4, 0.5, 0.04, rot); }
  }

  const freeAt = (x, z, r = 2) => { for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (occ.has(ck(x + dx, z + dz))) return false; return inside(x, z); };
  const onRoad = (x, z) => window.krepOnRoad(x, z);

  /* --- Bäume genau dort, wo sie im Luftbild stehen --- */
  for (let i = 0; i < D.trees.length; i += 2) {
    const x = D.trees[i], z = D.trees[i + 1]; if (!freeAt(x, z, 1) || !inside(x, z)) continue;
    lift(x, z, () => srand() < 0.3 ? tree(x, z, srnd(1.5, 2.3)) : leafTree(x, z, srnd(0.9, 1.35)));
  }

  for (let i = 0; i < (X.trees || []).length; i += 2) { const x = X.trees[i], z = X.trees[i + 1]; if (inside(x, z) && freeAt(x, z, 1) && !TREE_BOXES.some(b => x > b.min.x - 3 && x < b.max.x + 3 && z > b.min.z - 3 && z < b.max.z + 3)) lift(x, z, () => leafTree(x, z, 1.3)); }   // Einzelbäume aus OSM
  /* --- Rand: Hecke + unsichtbare Wand --- */
  for (const s of [-1, 1]) {
    for (let t = -S; t < S; t += 6) { lift(t + 3, s * S, () => addBox(t + 3, -1, s * S, 6.2, 2.6, 1.2, HEDGE_MAT, 1, { decor: true, round: 0.4 })); lift(s * S, t + 3, () => addBox(s * S, -1, t + 3, 1.2, 2.6, 6.2, HEDGE_MAT, 1, { decor: true, round: 0.4 })); }
    collider(0, -20, s * (S + 0.5), 2 * S + 6, 200, 2); collider(s * (S + 0.5), -20, 0, 2, 200, 2 * S + 6);
  }
  const townSign = (x, z, rot) => lift(x, z, () => { addBox(x, 0, z, 0.12, 2.2, 0.12, MAT.metal, 1, { round: 0.05 }); tkSign(x, 2.3, z, 2.8, 0.9, rot, tkSignMat(MAP_ID === 'sonnenhof' ? 'VEITSBRONN' : 'KREPPENDORF', '#f2d21b', '#111111', false)); });

  /* --- Fahrzeuge wie auf den anderen Karten: Autos am Straßenrand, Mopeds, 2 Panzer, 2 Helis auf Landeplätzen --- */
  const hcs = homes.map(hm => [hm.f.mid.x, hm.f.mid.z]);
  const nearHome = (x, z, r) => hcs.some(([a, b]) => Math.hypot(a - x, b - z) < r);
  const treeNear = (x, z, r) => TREE_BOXES.some(b => x > b.min.x - r && x < b.max.x + r && z > b.min.z - r && z < b.max.z + r);
  const vspot = (x, z, yaw, kind, ctype) => MAP_VEHICLES.push({ x, z, y: H(x, z) + 0.3, yaw, kind, ctype });
  let nCar = 0, nSign = 0, nTank = 0;
  for (const pts of roadPts) for (let i = 1; i + 1 < pts.length; i += 2) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 7) continue;
    const yaw = Math.atan2(bz - az, bx - ax), mx = (ax + bx) / 2 + -(bz - az) / L * 3.6, mz = (az + bz) / 2 + (bx - ax) / L * 3.6;
    if (!freeAt(mx, mz, 3) || srand() < 0.35) continue;
    if (nTank < 2 && !nearHome(mx, mz, 25) && Math.hypot(mx, mz) > 90) { vspot((ax + bx) / 2, (az + bz) / 2, -yaw, 'tank'); nTank++; continue; }   // Panzer am Ortsrand
    if (nCar < 14 && nearHome(mx, mz, 30)) { vspot(mx, mz, -yaw + (srand() < 0.5 ? Math.PI : 0), 'car'); nCar++; }
    if (nSign < 2 && Math.hypot(mx, mz) > 120) { townSign(mx, mz + 2, srand() * 6); nSign++; }
  }
  for (let i = 0, nm = 0; i < 400 && nm < 8; i++) { const [x, z] = hcs[i % hcs.length]; const px = x + srnd(-12, 12), pz = z + srnd(-12, 12); if (onRoad(px, pz) && freeAt(px, pz, 2)) { vspot(px, pz, srand() * 6.28); nm++; } }   // Mopeds im Dorf
  { const pad = new THREE.MeshStandardMaterial({ color: 0x5d6168, roughness: 0.85 }), ring = new THREE.MeshStandardMaterial({ color: 0xf2d21b, roughness: 0.8 });
    for (let i = 0, nh = 0; i < 3000 && nh < 2; i++) {   // Heli-Landeplätze auf freien, flachen Wiesen nahe am Dorf
      const x = srnd(-(D.R - 40), D.R - 40), z = srnd(-(D.R - 40), D.R - 40);
      if (!freeAt(x, z, 8) || onRoad(x, z) || treeNear(x, z, 10) || !nearHome(x, z, 80) || nearHome(x, z, 25) || Math.abs(H(x + 6, z) - H(x - 6, z)) + Math.abs(H(x, z + 6) - H(x, z - 6)) > 1.2) continue;
      if (MAP_VEHICLES.some(v => v.kind === 'heli' && Math.hypot(v.x - x, v.z - z) < 80)) continue;
      cyl(pad, x, H(x, z) - 0.3, z, 7, 7, 0.4, 24); cyl(ring, x, H(x, z) - 0.28, z, 6.2, 6.2, 0.4, 24); cyl(pad, x, H(x, z) - 0.26, z, 5.6, 5.6, 0.4, 24);
      for (const [dx, w, d] of [[-1.6, 0.7, 4.4], [1.6, 0.7, 4.4], [0, 3.9, 0.7]]) box(GM.woodW, x + dx, H(x, z) + 0.12, z, w, 0.04, d, 0);   // „H“
      vspot(x, z, Math.PI / 2, 'heli'); nh++;
    }
  }

  /* --- Spawnpunkte: immer im Dorf (auf Straßen/Wegen nah an den Häusern) + Waffen --- */
  const sp = window.KREPP_SPAWNS = [];
  const med = a => a.slice().sort((p, q) => p - q)[a.length >> 1], VX = med(hcs.map(p => p[0])), VZ = med(hcs.map(p => p[1]));   // Dorfmitte
  for (const sep of [22, 14, 8]) for (const pts of roadPts) for (let i = 0; i + 1 < pts.length && sp.length < 32; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az);
    for (let s = 0; s < L && sp.length < 32; s += 4) {
      const x = Math.round(ax + (bx - ax) * s / L), z = Math.round(az + (bz - az) * s / L);
      if (Math.hypot(x - VX, z - VZ) < 140 && nearHome(x, z, 28) && freeAt(x, z, 2) && !treeNear(x, z, 1.5) && sp.every(([a, b]) => Math.hypot(a - x, b - z) > sep)) sp.push([x, z]);
    }
  }
  sp.forEach(([x, z], i) => { if (i % 2 === 0) MAP_PICKUPS.push({ w: i % 3, x: x + 3, y: H(x + 3, z), z }); });
  window.FIRE_POS = [9999, 9999]; window.SHIP_SMOKE = [9999, 16, 9999];

  /* --- Quellenhinweis (Pflicht für LoD2 Bayern CC BY 4.0 und OSM ODbL) --- */
  const at = document.createElement('div');
  at.textContent = 'Kartendaten: © Bayerische Vermessungsverwaltung (LoD2, DGM1, CC BY 4.0) · © OpenStreetMap-Mitwirkende (ODbL)';
  at.style.cssText = 'position:fixed;left:50%;bottom:2px;transform:translateX(-50%);z-index:9999;font:10px sans-serif;color:#fff;opacity:.75;background:rgba(0,0,0,.35);padding:1px 6px;border-radius:3px;pointer-events:none;white-space:nowrap';
  document.body.appendChild(at);
}
