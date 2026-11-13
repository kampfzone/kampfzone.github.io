/* ======================= Stehendes Gras: dichte Halme rund um den Spieler =======================
   Die Halme wiegen sich im Wind, weichen dem Spieler aus und werden unter Fahrzeugen plattgedrückt.
   Wo Gras wachsen darf, wird pro 64-m-Kachel einmal von oben „fotografiert“: Alle festen Kartenteile sind schwarz,
   Wiesenboden (Gras-Material) ist weiß und enthält seine Höhe. So stehen keine Halme auf Straßen, in Häusern oder im Wasser,
   und jeder Halm steht genau auf dem Boden (auch auf Hügeln). Funktioniert auf allen Karten ohne eigene Listen. */
(function () {
  // Grafikstufe → [Radius in m, Abstand der Grasbüschel in m]; „Klar & schnell“ und „Sehr niedrig“: kein stehendes Gras
  // (gemessen auf einer Radeon R5 340X: „Mittel“ kostet so rund 1–2 ms pro Bild)
  const LEVELS = { high: [28, 0.29, 10], medium: [21, 0.32, 9], perf: [15, 0.36, 7], low: [11, 0.42, 5] };   // + Radius der extra dichten Nahzone
  const TILE = 256, TP = 1024, BS = 4, H0 = -64, HR = 256, MAXN = 36000, MAXV = 6;   // Kachel 256 m, 0,25 m pro Bildpunkt, Höhe im 1-m-Raster

  /* --- 1) Grasbüschel: 12 schmale, schräg stehende Halme (je 1 Dreieck = sparsam), dunkel unten, hell an der Spitze --- */
  const base = new THREE.BufferGeometry();
  { const pos = [], col = [], hh = [], nb = 12;
    const cB = [0.02, 0.038, 0.009], cT = [0.09, 0.165, 0.032];   // linearer Farbraum (passt zum Wiesen-Foto)
    for (let b = 0; b < nb; b++) {
      const a = b / nb * Math.PI * 2 + Math.random() * 0.6, r = 0.02 + Math.random() * 0.2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const fa = Math.random() * Math.PI, w = 0.026 + Math.random() * 0.02, h = 0.6 + Math.random() * 0.45;
      const dx = Math.cos(fa) * w, dz = Math.sin(fa) * w, lean = 0.06 + Math.random() * 0.2, lx = Math.cos(a) * lean, lz = Math.sin(a) * lean;
      pos.push(x - dx, 0, z - dz, x + dx, 0, z + dz, x + lx, h, z + lz); hh.push(0, 0, h);
      col.push(...cB, ...cB, ...cT);
    }
    base.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    base.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    base.setAttribute('aH', new THREE.Float32BufferAttribute(hh, 1));
    const nrm = new Float32Array(pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;   // Normalen nach oben → hell wie der Boden
    base.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  }
  const geo = new THREE.InstancedBufferGeometry();
  for (const k of ['position', 'color', 'aH', 'normal']) geo.setAttribute(k, base.getAttribute(k));
  const offArr = new Float32Array(MAXN * 4), offAttr = new THREE.InstancedBufferAttribute(offArr, 4);
  offAttr.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aOff', offAttr); geo.instanceCount = 0;

  /* --- 2) Shader: Drehung/Größe je Büschel, Ausdünnen und Einsinken zum Rand, Wind, Ausweichen --- */
  const U = { uTime: { value: 0 }, uR: { value: 28 }, uRn: { value: 9 }, uCam: { value: new THREE.Vector3() }, uPush: { value: new THREE.Vector3(0, 0, 0) }, uVeh: { value: Array.from({ length: MAXV }, () => new THREE.Vector4(0, 0, 0, 0)) } };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = `attribute vec4 aOff; attribute float aH; uniform float uTime, uR, uRn; uniform vec3 uPush, uCam; uniform vec4 uVeh[${MAXV}];
float grDens(float f) { return f < 0.3 ? 1.0 : 1.0 - (f - 0.3) / 0.7 * 0.75; }
` + sh.vertexShader
      .replace('#include <begin_vertex>', `
  vec3 wp = aOff.xyz; float sd = fract(aOff.w), near = step(1.0, aOff.w);   // aOff.w ≥ 1: zweite, nur nahe Lage
  float ang = fract(sd * 91.7) * 6.2831, cs = cos(ang), sn = sin(ang);
  vec3 transformed = vec3(cs * position.x - sn * position.z, position.y, sn * position.x + cs * position.z);
  float sc = 0.34 + fract(sd * 53.3) * 0.26;                       // Halmhöhe ~0,2 … 0,6 m
  float dc = distance(uCam, wp), fade = 1.0 - smoothstep(uR * 0.6, uR, dc);   // weit hinten wachsen die Halme langsam heraus
  if (sd > grDens(dc / uR)) fade = 0.0;                             // weiter weg weniger Büschel
  fade *= 1.0 - near * smoothstep(uRn * 0.55, uRn, dc);            // Nahzone läuft weich aus
  transformed *= vec3(sc * 1.4 * fade, sc * fade, sc * 1.4 * fade);
  float tip = aH * aH;
  float wv = sin(uTime * 1.5 + wp.x * 0.31 + wp.z * 0.19) * 0.55 + sin(uTime * 2.6 + wp.x * 0.87 - wp.z * 0.63) * 0.25 + 0.3;
  transformed.xz += vec2(0.82, 0.57) * wv * 0.16 * tip;              // Wind
  vec2 pd = wp.xz + transformed.xz - uPush.xy; float pl = length(pd);
  float pu = 0.0; if (uPush.z > 0.01) pu = 1.0 - smoothstep(uPush.z * 0.35, uPush.z, pl);
  transformed.xz += pd / max(pl, 0.001) * pu * 0.45 * aH;           // dem Spieler ausweichen
  transformed.y *= 1.0 - pu * 0.55;
  for (int i = 0; i < ${MAXV}; i++) {                                // unter Fahrzeugen plattgedrückt
    if (uVeh[i].z > 0.01) transformed.y *= mix(0.12, 1.0, smoothstep(uVeh[i].z * 0.75, uVeh[i].z, length(wp.xz - uVeh[i].xy)));
  }
  transformed += wp;`)
      .replace('#include <color_vertex>', `#include <color_vertex>
  vColor.xyz *= (0.82 + fract(fract(aOff.w) * 17.9) * 0.36) * mix(vec3(1.0), vec3(1.35, 1.2, 0.7), step(0.86, fract(fract(aOff.w) * 31.7)));   // hellere/trockene Büschel`)
      .replace('#include <lights_lambert_vertex>', `#include <lights_lambert_vertex>
#ifdef DOUBLE_SIDED
  vLightBack = vLightFront; vIndirectBack = vIndirectFront;   // Rückseiten genauso hell
#endif`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.visible = false; mesh.name = 'grassBlades';
  scene.add(mesh);

  /* --- 3) Wo darf Gras wachsen? Kacheln von oben aufnehmen (schwarz = fest, weiß + Höhe = Wiese) --- */
  const isGrassMat = m => !!(m && ((m.userData && m.userData.grassGround) || (m.userData && m.userData.orig && m.userData.orig.userData && m.userData.orig.userData.grassGround)));
  // Schlanke Kopie der Karte nur für das „Foto“: Wiesen-Boden (gScene) und alles Feste (oScene) – teilt die Formen mit der
  // echten Karte (kein extra Grafikspeicher), aber ohne die >5000 übrigen Objekte → jede Kachel ist viel schneller fertig
  let tagged = false;
  const gScene = new THREE.Scene(), oScene = new THREE.Scene();
  gScene.autoUpdate = oScene.autoUpdate = false;
  const shown = o => { for (let p = o; p && p !== scene; p = p.parent) if (!p.visible && !p.userData.cull && !p.isInstancedMesh) return false; return true; };
  function tagMap() {
    const fol = typeof foliageList === 'function' ? new Set(foliageList()) : new Set();
    scene.updateMatrixWorld(true);
    scene.traverse(o => {
      if (!o.isMesh || o === mesh || o === skyMesh || o.isSkinnedMesh || o.matrixAutoUpdate !== false || fol.has(o) || o === window.grassI || !shown(o)) return;
      const mats = [].concat(o.material);
      if (mats.some(m => !m || (m.transparent && m.opacity < 0.95) || m.alphaTest > 0 || m.depthWrite === false)) return;   // Flecken, Scheiben, Halm-Bilder verdecken nichts
      let p;
      if (o.isInstancedMesh) { p = new THREE.InstancedMesh(o.geometry, occMat, o.count); p.instanceMatrix = o.instanceMatrix; p.frustumCulled = false; }
      else p = new THREE.Mesh(o.geometry, occMat);
      p.matrixAutoUpdate = false; p.matrix.copy(o.matrixWorld); p.matrixWorld.copy(o.matrixWorld);
      (!o.isInstancedMesh && mats.every(isGrassMat) ? gScene : oScene).add(p);
    });
    gScene.overrideMaterial = hMat; oScene.overrideMaterial = occMat;
    tagged = true;
  }
  const VS = `varying float vY; void main() { vec4 p = vec4(position, 1.0);
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
#endif
  vec4 w = modelMatrix * p; vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const occMat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: 'void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }', side: THREE.DoubleSide });
  const hMat = new THREE.ShaderMaterial({ vertexShader: VS, side: THREE.DoubleSide,
    fragmentShader: `varying float vY; void main() { float h = clamp((vY - (${H0}.0)) / ${HR}.0, 0.0, 1.0) * 65535.0, hi = floor(h / 256.0);
  gl_FragColor = vec4(1.0, hi / 255.0, (h - hi * 256.0) / 255.0, 1.0); }` });
  const rt = new THREE.WebGLRenderTarget(TP, TP, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true, stencilBuffer: false });
  // kurzer Tiefenbereich (y +120 … -120): genau genug, damit eine Straße 1 cm über der Wiese sicher „gewinnt“
  const ocam = new THREE.OrthographicCamera(-TILE / 2, TILE / 2, TILE / 2, -TILE / 2, 0.5, 240); ocam.up.set(0, 0, -1);
  const tiles = new Map(), _cc = new THREE.Color(), RAW = new Uint8Array(TP * TP * 4), HB = TP / BS;
  // Kachel sparsam speichern: null = kein Gras · { flat } = überall Wiese auf gleicher Höhe ·
  // { bits, hq } = 1 Bit pro Bildpunkt (Gras ja/nein) + Höhe im 1-m-Raster (reicht für Hügel, wird weich gemischt)
  function pack(buf) {
    const N = TP * TP, bits = new Uint8Array(N >> 3), hs = new Float32Array(HB * HB), hc = new Uint16Array(HB * HB);
    let cnt = 0, hmin = 1e9, hmax = -1e9;
    for (let r = 0; r < TP; r++) for (let c = 0; c < TP; c++) {
      const i = r * TP + c, b = i * 4; if (buf[b] < 128) continue;
      const hv = buf[b + 1] * 256 + buf[b + 2]; bits[i >> 3] |= 1 << (i & 7); cnt++;
      if (hv < hmin) hmin = hv; if (hv > hmax) hmax = hv;
      const k = ((r / BS) | 0) * HB + ((c / BS) | 0); hs[k] += hv; hc[k]++;
    }
    if (!cnt) return null;
    if (hmax - hmin <= 4) return cnt === N ? { flat: hmin } : { bits, flat: hmin };   // flache Wiese: Höhe reicht einmal
    let hq = new Uint16Array(HB * HB);
    for (let k = 0; k < hq.length; k++) hq[k] = hc[k] ? Math.max(1, Math.round(hs[k] / hc[k])) : 0;
    for (let pass = 0; pass < 3; pass++) {   // Lücken (Straßen, Häuser) mit Nachbarhöhen füllen → weiches Mischen am Rand
      const n2 = hq.slice();
      for (let r = 0; r < HB; r++) for (let c = 0; c < HB; c++) {
        const k = r * HB + c; if (hq[k]) continue;
        const v = (c > 0 && hq[k - 1]) || (c < HB - 1 && hq[k + 1]) || (r > 0 && hq[k - HB]) || (r < HB - 1 && hq[k + HB]); if (v) n2[k] = v;
      }
      hq = n2;
    }
    return { bits, hq };
  }
  const dec = v => H0 + v / 65535 * HR;
  function renderTile(tx, tz) {
    const cx = (tx + 0.5) * TILE, cz = (tz + 0.5) * TILE;
    ocam.position.set(cx, 120, cz); ocam.lookAt(cx, 0, cz); ocam.updateMatrixWorld(); ocam.updateProjectionMatrix();
    const ac = renderer.autoClear, ca = renderer.getClearAlpha(), oldRT = renderer.getRenderTarget();
    renderer.getClearColor(_cc);
    renderer.autoClear = false;
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true);
    // erst die Wiesen (weiß + Höhe), dann alles Feste darüber (schwarz) – bei Gleichstand gewinnt „kein Gras“
    renderer.render(gScene, ocam);
    renderer.render(oScene, ocam);
    renderer.readRenderTargetPixels(rt, 0, 0, TP, TP, RAW);
    renderer.setRenderTarget(oldRT); renderer.autoClear = ac; renderer.setClearColor(_cc, ca);
    tiles.set(tx + ',' + tz, pack(RAW));
  }
  // Bodenhöhe der Wiese an (x, z) – NaN, wenn dort kein Gras wachsen darf (oder die Kachel noch fehlt)
  function groundAt(x, z) {
    const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE), t = tiles.get(tx + ',' + tz); if (!t) return NaN;
    if (!t.bits) return dec(t.flat);
    const fx = (x - tx * TILE) / TILE * TP, fz = (z - tz * TILE) / TILE * TP;
    const c = Math.min(TP - 1, fx | 0), r = TP - 1 - Math.min(TP - 1, fz | 0), i = r * TP + c;
    if (!(t.bits[i >> 3] & (1 << (i & 7)))) return NaN;
    if (t.flat !== undefined) return dec(t.flat);
    // Höhe weich aus den vier nächsten 1-m-Feldern (nur gültige)
    const bu = Math.max(0, Math.min(HB - 1.001, (fx - BS / 2) / BS)), bv = Math.max(0, Math.min(HB - 1.001, (TP - fz - BS / 2) / BS));
    const u0 = bu | 0, v0 = bv | 0, fu = bu - u0, fv = bv - v0, hq = t.hq;
    let s = 0, w = 0;
    const add = (u, v, ww) => { const h = hq[v * HB + u]; if (h && ww > 0) { s += h * ww; w += ww; } };
    add(u0, v0, (1 - fu) * (1 - fv)); add(u0 + 1, v0, fu * (1 - fv)); add(u0, v0 + 1, (1 - fu) * fv); add(u0 + 1, v0 + 1, fu * fv);
    return w > 0 ? dec(s / w) : NaN;
  }
  window.grassGroundAt = groundAt;

  /* --- Ganze Karte gleich am Anfang vorbereiten (im Menü, mit Anzeige) → im Spiel muss nichts mehr nachladen --- */
  const TB = MAP_ID === 'welt' ? [-2, 4, -2, 1] : [-1, 0, -1, 0];   // Kachel-Nummern (je 256 m), Welt: x -512 … 1280, z -512 … 512
  const queue = [];
  { const ox = MAP_ID === 'welt' ? 100 : 0;
    for (let tx = TB[0]; tx <= TB[1]; tx++) for (let tz = TB[2]; tz <= TB[3]; tz++) queue.push([tx, tz, Math.hypot((tx + 0.5) * TILE - ox, (tz + 0.5) * TILE)]);
    queue.sort((a, b) => a[2] - b[2]); }
  const total = queue.length;
  let label = null, doneAt = 0;
  function showProgress() {
    if (!label) {
      const v = document.getElementById('verInfo'); if (!v) return;
      label = document.createElement('div'); label.id = 'grassInfo';
      label.style.cssText = 'text-align:center;font-size:11.5px;color:#9fd37f;margin-top:2px';
      v.parentNode.insertBefore(label, v.nextSibling);
    }
    if (queue.length) label.textContent = 'Gras wird geladen … ' + Math.round((1 - queue.length / total) * 100) + ' %';
    else { label.textContent = 'Gras geladen ✓'; if (!doneAt) doneAt = performance.now(); else if (performance.now() - doneAt > 4000) label.style.display = 'none'; }
  }
  function preload(budgetMs) {
    if (!tagged) tagMap();
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < budgetMs) { const q = queue.shift(); if (!tiles.has(q[0] + ',' + q[1])) renderTile(q[0], q[1]); }
    showProgress();
  }
  window.grassLoadState = () => ({ geladen: total - queue.length, gesamt: total, kb: Math.round([...tiles.values()].reduce((s, t) => s + (t ? (t.bits ? t.bits.length : 0) + (t.hq ? t.hq.length * 2 : 0) + 8 : 0), 0) / 1024) });

  /* --- 4) Büschel um den Spieler verteilen (festes Raster mit Zufallsversatz → nichts springt beim Neuaufbau) --- */
  const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const dens = f => f < 0.3 ? 1 : 1 - (f - 0.3) / 0.7 * 0.75;
  let bx = 1e9, bz = 1e9, bLevel = '', dirty = true, bgT = 0;
  function rebuild(cx, cz, R, sp, Rn) {
    const M = 3, RR = (R + M) * (R + M); let n = 0;
    const i0 = Math.floor((cx - R - M) / sp), i1 = Math.ceil((cx + R + M) / sp), j0 = Math.floor((cz - R - M) / sp), j1 = Math.ceil((cz + R + M) / sp);
    for (let i = i0; i <= i1 && n < MAXN; i++) for (let j = j0; j <= j1; j++) {
      const s = hash(i, j), x = (i + hash(i + 71, j - 33)) * sp, z = (j + hash(i - 19, j + 57)) * sp;
      const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz; if (d2 > RR) continue;
      if (s > dens(Math.max(0, Math.sqrt(d2) - M) / R)) continue;
      const h = groundAt(x, z); if (h !== h) continue;
      const k = n * 4; offArr[k] = x; offArr[k + 1] = h - 0.02; offArr[k + 2] = z; offArr[k + 3] = s;
      if (++n >= MAXN) break;
    }
    // Nahzone: zweites, versetztes Raster → doppelt so dicht direkt um den Spieler
    const RN = (Rn + M) * (Rn + M), a0 = Math.floor((cx - Rn - M) / sp), a1 = Math.ceil((cx + Rn + M) / sp), b0 = Math.floor((cz - Rn - M) / sp), b1 = Math.ceil((cz + Rn + M) / sp);
    for (let i = a0; i <= a1 && n < MAXN; i++) for (let j = b0; j <= b1; j++) {
      const x = (i + hash(i - 307, j + 131)) * sp, z = (j + hash(i + 211, j - 97)) * sp, dx = x - cx, dz = z - cz; if (dx * dx + dz * dz > RN) continue;
      const h = groundAt(x, z); if (h !== h) continue;
      const k = n * 4; offArr[k] = x; offArr[k + 1] = h - 0.02; offArr[k + 2] = z; offArr[k + 3] = 1 + hash(i + 59, j + 83) * 0.999;
      if (++n >= MAXN) break;
    }
    geo.instanceCount = n; offAttr.updateRange.offset = 0; offAttr.updateRange.count = n * 4; offAttr.needsUpdate = true;
    bx = cx; bz = cz;
  }

  /* --- Die alten flachen Grasbüschel (Bilder) nur noch weiter weg zeigen, wo die echten Halme ausdünnen --- */
  const TU = { uCam: { value: new THREE.Vector3() }, uR: { value: 0 } };
  let tuftMat = null;
  function patchTufts() {
    const g = window.grassI; if (!g || !g.material || g.material === tuftMat) return;
    tuftMat = g.material;
    tuftMat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { uTuftCam: TU.uCam, uTuftR: TU.uR });
      sh.vertexShader = 'uniform vec3 uTuftCam; uniform float uTuftR;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  if (uTuftR > 0.0) { vec3 ip = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; transformed *= smoothstep(uTuftR * 0.55, uTuftR * 0.85, distance(uTuftCam, ip)); }
#endif`);
    };
    tuftMat.needsUpdate = true;
  }

  /* --- 5) Jedes Bild: im Menü die Karte vorbereiten; im Spiel bei Bewegung neu verteilen --- */
  window.grassTick = dt => {
    const L = LEVELS[typeof gfx === 'string' ? gfx : 'medium'];
    const cp = camera.position;
    const tH = window.terrainHeight ? Math.max(0, window.terrainHeight(cp.x, cp.z)) : 0;
    patchTufts(); TU.uCam.value.copy(cp);
    if (L && queue.length && !running) preload(TOUCH ? 30 : 22);   // Menü: ganze Karte vorbereiten
    else if (label && !queue.length) showProgress();
    if (!L || !running || cp.y - tH > L[0]) { mesh.visible = false; TU.uR.value = 0; return; }
    TU.uR.value = L[0];
    if (!tagged) tagMap();
    const R = L[0], sp = L[1];
    if (bLevel !== gfx) { bLevel = gfx; dirty = true; }
    U.uR.value = R; U.uRn.value = L[2]; U.uTime.value += dt; U.uCam.value.copy(cp);   // (Lambert bekommt cameraPosition von three.js nicht)
    // Was in der Nähe noch fehlt, sofort komplett aufnehmen (kein stückweises Erscheinen); Rest der Karte nebenbei
    for (let tx = Math.floor((cp.x - R - 40) / TILE); tx <= Math.floor((cp.x + R + 40) / TILE); tx++)
      for (let tz = Math.floor((cp.z - R - 40) / TILE); tz <= Math.floor((cp.z + R + 40) / TILE); tz++)
        if (!tiles.has(tx + ',' + tz)) { if (!tagged) tagMap(); renderTile(tx, tz); dirty = true; }
    if (queue.length && (bgT = (bgT || 0) + 1) % 3 === 0) preload(4);
    if (dirty || Math.hypot(cp.x - bx, cp.z - bz) > 3) { rebuild(cp.x, cp.z, R, sp, L[2]); dirty = false; }
    mesh.visible = geo.instanceCount > 0;
    // Spieler zu Fuß drückt die Halme zur Seite; Fahrzeuge in der Nähe drücken sie platt
    const onFoot = !(typeof ride !== 'undefined' && ride.v >= 0);
    U.uPush.value.set(cp.x, cp.z, onFoot && typeof me === 'object' && me.alive ? 0.9 : 0);
    let k = 0;
    if (typeof vehicles !== 'undefined') for (const v of vehicles) {
      if (k >= MAXV || !v.mesh || !v.mesh.visible) continue;
      const p = v.mesh.position; if (Math.abs(p.x - cp.x) > R || Math.abs(p.z - cp.z) > R) continue;
      const gy = window.terrainHeight ? Math.max(0, window.terrainHeight(p.x, p.z)) : 0; if (p.y - gy > 1.5) continue;   // fliegt
      const r = v.kind === 'moped' ? 0.9 : v.kind === 'tank' ? 3.6 : v.kind === 'plane' ? 4.5 : v.kind === 'heli' ? 3.2 : 2.4;
      U.uVeh.value[k++].set(p.x, p.z, r, 0);
    }
    for (; k < MAXV; k++) U.uVeh.value[k].set(0, 0, 0, 0);
  };
})();
