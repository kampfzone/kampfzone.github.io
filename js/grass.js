/* ======================= Stehendes Gras: dichte Halme rund um den Spieler =======================
   Die Halme wiegen sich im Wind, weichen dem Spieler aus und werden unter Fahrzeugen plattgedrückt.
   Wo Gras wachsen darf, wird pro 64-m-Kachel einmal von oben „fotografiert“: Alle festen Kartenteile sind schwarz,
   Wiesenboden (Gras-Material) ist weiß und enthält seine Höhe. So stehen keine Halme auf Straßen, in Häusern oder im Wasser,
   und jeder Halm steht genau auf dem Boden (auch auf Hügeln). Funktioniert auf allen Karten ohne eigene Listen. */
(function () {
  // Grafikstufe → [Radius in m, Abstand der Grasbüschel in m]; „Klar & schnell“ und „Sehr niedrig“: kein stehendes Gras
  // (gemessen auf einer Radeon R5 340X: „Mittel“ kostet so rund 1–2 ms pro Bild)
  const LEVELS = { high: [36, 0.34], medium: [26, 0.4], perf: [18, 0.46], low: [13, 0.52] };
  const TILE = 64, TP = 256, L_OCC = 7, L_GRASS = 6, H0 = -64, HR = 256, MAXN = 36000, MAXV = 6;

  /* --- 1) Grasbüschel: 10 schmale, schräg stehende Halme (je 1 Dreieck = sparsam), dunkel unten, hell an der Spitze --- */
  const base = new THREE.BufferGeometry();
  { const pos = [], col = [], hh = [], nb = 10;
    const cB = [0.02, 0.038, 0.009], cT = [0.09, 0.165, 0.032];   // linearer Farbraum (passt zum Wiesen-Foto)
    for (let b = 0; b < nb; b++) {
      const a = b / nb * Math.PI * 2 + Math.random() * 0.6, r = 0.02 + Math.random() * 0.17, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const fa = Math.random() * Math.PI, w = 0.02 + Math.random() * 0.016, h = 0.6 + Math.random() * 0.45;
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
  const U = { uTime: { value: 0 }, uR: { value: 28 }, uCam: { value: new THREE.Vector3() }, uPush: { value: new THREE.Vector3(0, 0, 0) }, uVeh: { value: Array.from({ length: MAXV }, () => new THREE.Vector4(0, 0, 0, 0)) } };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = `attribute vec4 aOff; attribute float aH; uniform float uTime, uR; uniform vec3 uPush, uCam; uniform vec4 uVeh[${MAXV}];
float grDens(float f) { return f < 0.4 ? 1.0 : 1.0 - (f - 0.4) / 0.6 * 0.65; }
` + sh.vertexShader
      .replace('#include <begin_vertex>', `
  vec3 wp = aOff.xyz; float sd = aOff.w;
  float ang = fract(sd * 91.7) * 6.2831, cs = cos(ang), sn = sin(ang);
  vec3 transformed = vec3(cs * position.x - sn * position.z, position.y, sn * position.x + cs * position.z);
  float sc = 0.34 + fract(sd * 53.3) * 0.26;                       // Halmhöhe ~0,2 … 0,6 m
  float dc = distance(uCam, wp), fade = 1.0 - smoothstep(uR * 0.72, uR, dc);
  if (sd > grDens(dc / uR)) fade = 0.0;                             // weiter weg weniger Büschel
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
  vColor.xyz *= (0.82 + fract(aOff.w * 17.9) * 0.36) * mix(vec3(1.0), vec3(1.35, 1.2, 0.7), step(0.86, fract(aOff.w * 31.7)));   // hellere/trockene Büschel`)
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
  let tagged = false; const occList = [];
  function tagMap() {
    const fol = typeof foliageList === 'function' ? new Set(foliageList()) : new Set();
    scene.traverse(o => {
      if (!o.isMesh || o === mesh || o === skyMesh || o.isSkinnedMesh || o.matrixAutoUpdate !== false || fol.has(o) || o === window.grassI) return;
      const mats = [].concat(o.material);
      if (mats.some(m => !m || (m.transparent && m.opacity < 0.95) || m.alphaTest > 0 || m.depthWrite === false)) return;   // Flecken, Scheiben, Halm-Bilder verdecken nichts
      o.layers.enable(!o.isInstancedMesh && mats.every(isGrassMat) ? L_GRASS : L_OCC); occList.push(o);
    });
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
  const tiles = new Map(), _cc = new THREE.Color();
  function renderTile(tx, tz) {
    const cx = (tx + 0.5) * TILE, cz = (tz + 0.5) * TILE;
    ocam.position.set(cx, 120, cz); ocam.lookAt(cx, 0, cz); ocam.updateMatrixWorld(); ocam.updateProjectionMatrix();
    const bg = scene.background, ov = scene.overrideMaterial, ac = renderer.autoClear, ca = renderer.getClearAlpha(), oldRT = renderer.getRenderTarget(), sh = renderer.shadowMap.autoUpdate;
    renderer.getClearColor(_cc);
    // gerade per Entfernung ausgeblendete Kartenstücke (z. B. direkt nach dem Spawnen) für das Foto kurz einblenden
    const forced = []; for (const o of occList) if (!o.visible && (o.userData.cull || o.isInstancedMesh)) { o.visible = true; forced.push(o); }
    scene.background = null; renderer.autoClear = false; renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true);
    // erst die Wiesen (weiß + Höhe), dann alles Feste darüber (schwarz) – bei Gleichstand gewinnt „kein Gras“
    ocam.layers.set(L_GRASS); scene.overrideMaterial = hMat; renderer.render(scene, ocam);
    ocam.layers.set(L_OCC); scene.overrideMaterial = occMat; renderer.render(scene, ocam);
    const buf = new Uint8Array(TP * TP * 4); renderer.readRenderTargetPixels(rt, 0, 0, TP, TP, buf);
    for (const o of forced) o.visible = false;
    renderer.setRenderTarget(oldRT); scene.overrideMaterial = ov; scene.background = bg; renderer.autoClear = ac; renderer.shadowMap.autoUpdate = sh; renderer.setClearColor(_cc, ca);
    tiles.set(tx + ',' + tz, buf);
    if (tiles.size > 30) tiles.delete(tiles.keys().next().value);   // älteste Kachel vergessen
  }
  // Bodenhöhe der Wiese an (x, z) – NaN, wenn dort kein Gras wachsen darf (oder die Kachel noch fehlt)
  function groundAt(x, z) {
    const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE), b = tiles.get(tx + ',' + tz); if (!b) return NaN;
    const c = Math.min(TP - 1, Math.floor((x - tx * TILE) / TILE * TP)), r = TP - 1 - Math.min(TP - 1, Math.floor((z - tz * TILE) / TILE * TP)), i = (r * TP + c) * 4;
    return b[i] < 128 ? NaN : H0 + (b[i + 1] * 256 + b[i + 2]) / 65535 * HR;
  }
  window.grassGroundAt = groundAt;

  /* --- 4) Büschel um den Spieler verteilen (festes Raster mit Zufallsversatz → nichts springt beim Neuaufbau) --- */
  const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const dens = f => f < 0.4 ? 1 : 1 - (f - 0.4) / 0.6 * 0.65;
  let bx = 1e9, bz = 1e9, bLevel = '', dirty = true;
  function rebuild(cx, cz, R, sp) {
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

  /* --- 5) Jedes Bild: fehlende Kacheln aufnehmen (höchstens eine pro Bild), bei Bewegung neu verteilen --- */
  window.grassTick = dt => {
    const L = LEVELS[typeof gfx === 'string' ? gfx : 'medium'];
    const cp = camera.position;
    const tH = window.terrainHeight ? Math.max(0, window.terrainHeight(cp.x, cp.z)) : 0;
    patchTufts(); TU.uCam.value.copy(cp);
    if (!L || !running || cp.y - tH > L[0]) { mesh.visible = false; TU.uR.value = 0; return; }
    TU.uR.value = L[0];
    if (!tagged) tagMap();
    const R = L[0], sp = L[1];
    if (bLevel !== gfx) { bLevel = gfx; dirty = true; }
    U.uR.value = R; U.uTime.value += dt; U.uCam.value.copy(cp);   // (Lambert bekommt cameraPosition von three.js nicht)
    // Kacheln rund um die Kamera (die nächste fehlende zuerst)
    let need = null, nd = 1e9;
    for (let tx = Math.floor((cp.x - R - 6) / TILE); tx <= Math.floor((cp.x + R + 6) / TILE); tx++)
      for (let tz = Math.floor((cp.z - R - 6) / TILE); tz <= Math.floor((cp.z + R + 6) / TILE); tz++) {
        if (tiles.has(tx + ',' + tz)) continue;
        const d = Math.hypot((tx + 0.5) * TILE - cp.x, (tz + 0.5) * TILE - cp.z); if (d < nd) { nd = d; need = [tx, tz]; }
      }
    if (need) { renderTile(need[0], need[1]); dirty = true; }
    if (dirty || Math.hypot(cp.x - bx, cp.z - bz) > 3) { rebuild(cp.x, cp.z, R, sp); dirty = false; }
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
