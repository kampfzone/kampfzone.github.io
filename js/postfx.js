/* ======================= Kino-Look (Nachbearbeitung des fertigen Bildes) =======================
   Die Szene wird zuerst in ein Bild gerendert (mit Kantenglättung), dann kommt dazu:
   - weiches Leuchten heller Stellen (Sonne, Himmel, Lichter, Spiegelungen) – „Bloom“
   - Farblook wie in modernen Open-World-Spielen: mehr Kontrast, kräftigere Farben, warme Lichter, leicht kühle Schatten
   - leichte Randabdunklung (Vignette)
   Grafikstufe „Hoch/Mittel“: alles · „Leistung“/„Klar & schnell“: nur Farblook · „Niedrig/Sehr niedrig“ (Handy): aus. */
(function () {
  const LEVEL = { high: 2, medium: 2, perf: 1, clean: 1, low: 0, potato: 0 };
  const isGL2 = renderer.capabilities.isWebGL2;
  const sz = new THREE.Vector2();
  let rtScene = null, rtA = null, rtB = null, W = 0, H = 0, ms = false;
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), qScene = new THREE.Scene();
  quad.frustumCulled = false; qScene.add(quad);
  const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const mk = (u, fs) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false });
  // helle Stellen herausfiltern (4 Messpunkte → kein Flimmern beim Verkleinern)
  const brightMat = mk({ tDiffuse: { value: null }, uPx: { value: new THREE.Vector2() }, uThr: { value: 0.72 } }, `uniform sampler2D tDiffuse; uniform vec2 uPx; uniform float uThr; varying vec2 vUv;
    void main() {
      vec3 c = (texture2D(tDiffuse, vUv + uPx * vec2(-1.0, -1.0)).rgb + texture2D(tDiffuse, vUv + uPx * vec2(1.0, -1.0)).rgb
              + texture2D(tDiffuse, vUv + uPx * vec2(-1.0, 1.0)).rgb + texture2D(tDiffuse, vUv + uPx * vec2(1.0, 1.0)).rgb) * 0.25;
      float l = max(c.r, max(c.g, c.b));
      gl_FragColor = vec4(c * smoothstep(uThr, 1.0, l), 1.0);
    }`);
  // weichzeichnen (9 Punkte, Richtung uDir)
  const blurMat = mk({ tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } }, `uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb * 0.2270270;
      c += (texture2D(tDiffuse, vUv + uDir * 1.3846154).rgb + texture2D(tDiffuse, vUv - uDir * 1.3846154).rgb) * 0.3162162;
      c += (texture2D(tDiffuse, vUv + uDir * 3.2307692).rgb + texture2D(tDiffuse, vUv - uDir * 3.2307692).rgb) * 0.0702703;
      gl_FragColor = vec4(c, 1.0);
    }`);
  // Endbild: Leuchten dazu, Kontrast-Kurve, Sättigung, warm/kühl, Vignette
  // + günstige Kantenglättung (FXAA), wenn die Szene ohne Mehrfach-Abtastung gerendert wurde
  const finalMat = mk({ tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.55 }, uCon: { value: 0.3 }, uSat: { value: 1.08 }, uGrade: { value: 1 }, uVig: { value: 0.32 }, uFxaa: { value: 0 }, uPx: { value: new THREE.Vector2() } },
    `uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uBloom, uCon, uSat, uGrade, uVig, uFxaa; uniform vec2 uPx; varying vec2 vUv;
    vec3 fxaa(vec2 uv) {
      const vec3 L = vec3(0.299, 0.587, 0.114);
      vec3 cM = texture2D(tScene, uv).rgb;
      float nw = dot(texture2D(tScene, uv + vec2(-1.0, -1.0) * uPx).rgb, L), ne = dot(texture2D(tScene, uv + vec2(1.0, -1.0) * uPx).rgb, L);
      float sw = dot(texture2D(tScene, uv + vec2(-1.0, 1.0) * uPx).rgb, L), se = dot(texture2D(tScene, uv + vec2(1.0, 1.0) * uPx).rgb, L), m = dot(cM, L);
      float lMin = min(m, min(min(nw, ne), min(sw, se))), lMax = max(m, max(max(nw, ne), max(sw, se)));
      if (lMax - lMin < max(0.07, lMax * 0.16)) return cM;                // keine deutliche Kante → nichts tun (Texturen bleiben scharf)
      vec2 dir = vec2(-((nw + ne) - (sw + se)), (nw + sw) - (ne + se));
      float red = max((nw + ne + sw + se) * 0.03125, 1.0 / 128.0);
      dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + red), -4.0, 4.0) * uPx;
      vec3 a = 0.5 * (texture2D(tScene, uv - dir * 0.1667).rgb + texture2D(tScene, uv + dir * 0.1667).rgb);
      vec3 b = a * 0.5 + 0.25 * (texture2D(tScene, uv - dir * 0.5).rgb + texture2D(tScene, uv + dir * 0.5).rgb);
      float lb = dot(b, L); return (lb < lMin || lb > lMax) ? a : b;
    }
    void main() {
      vec3 c = uFxaa > 0.5 ? fxaa(vUv) : texture2D(tScene, vUv).rgb;
      if (uBloom > 0.0) c += texture2D(tBloom, vUv).rgb * uBloom;
      c = clamp(c, 0.0, 1.0);
      c = mix(c, c * c * (3.0 - 2.0 * c), uCon);                       // S-Kurve: mehr Kontrast
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, uSat);                                          // kräftigere Farben
      c += uGrade * (vec3(0.04, 0.018, -0.028) * smoothstep(0.45, 1.0, l) // warme Lichter
                   + vec3(-0.018, 0.004, 0.03) * (1.0 - smoothstep(0.0, 0.42, l)));   // kühle Schatten
      vec2 d = vUv - 0.5; c *= 1.0 - uVig * dot(d, d) * 1.7;              // Randabdunklung
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`);
  function makeRT(w, h, multi) {
    const o = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, encoding: THREE.sRGBEncoding, depthBuffer: !!multi || multi === null, stencilBuffer: false, generateMipmaps: false };
    if (multi && isGL2 && THREE.WebGLMultisampleRenderTarget) { const rt = new THREE.WebGLMultisampleRenderTarget(w, h, o); rt.samples = 4; return rt; }
    return new THREE.WebGLRenderTarget(w, h, o);
  }
  function ensure(level) {
    renderer.getDrawingBufferSize(sz);
    const w = sz.x | 0, h = sz.y | 0, wantMs = gfx === 'high';   // echte Kantenglättung (teuer) nur in „Hoch“, sonst FXAA
    if (rtScene && w === W && h === H && ms === wantMs) return;
    for (const r of [rtScene, rtA, rtB]) if (r) r.dispose();
    W = w; H = h; ms = wantMs;
    rtScene = makeRT(w, h, wantMs ? true : null);
    const bw = Math.max(16, w >> 2), bh = Math.max(16, h >> 2);
    rtA = makeRT(bw, bh, false); rtB = makeRT(bw, bh, false);
    brightMat.uniforms.uPx.value.set(1 / w, 1 / h); finalMat.uniforms.uPx.value.set(1 / w, 1 / h);
  }
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qScene, qCam); };
  window.postRender = () => {
    const level = LEVEL[gfx] || 0;
    if (!level) { renderer.render(scene, camera); return; }
    ensure(level);
    renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
    const bloom = level >= 2;
    if (bloom) {
      brightMat.uniforms.tDiffuse.value = rtScene.texture; pass(brightMat, rtA);
      const px = 1 / rtA.width, py = 1 / rtA.height;
      for (const k of [1, 2]) {   // zweimal: weiches, breites Leuchten
        blurMat.uniforms.tDiffuse.value = rtA.texture; blurMat.uniforms.uDir.value.set(px * k, 0); pass(blurMat, rtB);
        blurMat.uniforms.tDiffuse.value = rtB.texture; blurMat.uniforms.uDir.value.set(0, py * k); pass(blurMat, rtA);
      }
    }
    finalMat.uniforms.tScene.value = rtScene.texture; finalMat.uniforms.tBloom.value = rtA.texture; finalMat.uniforms.uBloom.value = bloom ? 0.55 : 0;
    finalMat.uniforms.uFxaa.value = rtScene.isWebGLMultisampleRenderTarget ? 0 : 1;
    pass(finalMat, null);
  };
  window.POSTFX = { finalMat, brightMat };   // zum Feinjustieren
})();
