'use strict';
/* ======================= Mopeds (im Stil der Simson S51) – fahrbar ======================= */
// Farben wie bei den klassischen Mopeds aus der DDR – glänzender Klarlack
const MOPED_PAINTS = [0x2a6fb5, 0xc0262b, 0x2f8f4a, 0xe8a92a, 0xd9c9a0, 0x1c1c1c, 0x6d8fb0, 0xd25a1e]
  .map(c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3 }));
// Texturen: Reifenprofil, genarbtes Sitzbank-Leder
const TREAD_TEX = canvasTex((g, s) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
  for (let x = 0; x < s; x += 8) { g.fillStyle = '#202020'; g.fillRect(x, 0, 3, s * 0.45); g.fillRect(x + 4, s * 0.55, 3, s * 0.45); }
}, 64);
TREAD_TEX.repeat.set(10, 1);
const SEAT_TEX = canvasTex((g, s) => {
  g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 10) { g.fillStyle = '#3a3a3a'; g.fillRect(0, y, s, 2); }
  speckle(g, s, 3000, '0,0,0', 0.25, 1.2);
}, 64);
const MOPED = {
  seat: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5, bumpMap: SEAT_TEX, bumpScale: 0.004 }),
  alu: new THREE.MeshStandardMaterial({ map: GUN_TEX, color: 0xeeeef0, roughness: 0.38, metalness: 0.85 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.9, bumpMap: TREAD_TEX, bumpScale: 0.01 }),
  lens: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d0, emissiveIntensity: 0.9, roughness: 0.05 }),
  rear: new THREE.MeshStandardMaterial({ color: 0x770000, emissive: 0xff2020, emissiveIntensity: 0.7, roughness: 0.1 }),
  blink: new THREE.MeshStandardMaterial({ color: 0xcc6a00, emissive: 0xff8a00, emissiveIntensity: 0.4, roughness: 0.1 }),
  plate: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 }),
  chain: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.8 }),
  mirror: new THREE.MeshStandardMaterial({ color: 0xe8eef2, roughness: 0.02, metalness: 1 }),
  dial: new THREE.MeshStandardMaterial({ color: 0xf0f0e8, emissive: 0x404038, roughness: 0.4 }),
  hose: new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.75, bumpMap: TREAD_TEX, bumpScale: 0.003 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2c2c2e, roughness: 0.55, metalness: 0.6 }),
};
// Schriftzüge (Tank „SIMSON“, Seitendeckel „S51“) als Aufkleber
function decalMat(text, font, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = h * 0.12; g.strokeStyle = 'rgba(20,20,20,.9)'; g.strokeText(text, w / 2, h / 2 + 2);
  g.fillStyle = '#f4f1e6'; g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO;
  return new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.25, metalness: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
}
const DECAL_TANK = decalMat('SIMSON', 'italic 900 92px Arial', 512, 128);
const DECAL_S51 = decalMat('S51', 'italic 900 100px Arial', 256, 128);
const mDecal = (mat, w, h, x, y, z, side, tilt = 0) => ({ geo: new THREE.PlaneGeometry(w, h), mat, p: [x, y, z], r: [0, side > 0 ? 0 : Math.PI, tilt * side] });
// Bausteine: gebogene Rohre, Spiralfedern, geformte Teile
const tube = (pts, r, mat, seg = 32, radial = 10) => ({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), Math.min(seg, 18), r, Math.min(radial, r > 0.015 ? 7 : 5), false), mat, p: [0, 0, 0], r: [0, 0, 0] });
class HelixCurve extends THREE.Curve {
  constructor(r, h, turns) { super(); this.rad = r; this.h = h; this.turns = turns; }
  getPoint(u, t = new THREE.Vector3()) { const a = u * this.turns * Math.PI * 2; return t.set(Math.cos(a) * this.rad, u * this.h, Math.sin(a) * this.rad); }
}
const spring = (x, y, z, h, tilt, mat) => ({ geo: new THREE.TubeGeometry(new HelixCurve(0.028, h, 8), 56, 0.0055, 4, false), mat, p: [x, y, z], r: [0, 0, tilt] });
const WHEEL_R = 0.3, STEER_RAKE = 0.27;   // Lenkkopfwinkel (Gabel ist nach hinten geneigt)
function makeWheel(front) {
  const g = new THREE.Group();
  const parts = [
    { geo: new THREE.TorusGeometry(WHEEL_R - 0.046, 0.046, 12, 40), mat: MOPED.tire, p: [0, 0, 0], r: [0, 0, 0] },        // Reifen mit Profil
    { geo: new THREE.TorusGeometry(WHEEL_R - 0.088, 0.011, 6, 40), mat: CHROME, p: [0, 0, 0], r: [0, 0, 0] },             // Felge
    { geo: new THREE.CylinderGeometry(WHEEL_R - 0.078, WHEEL_R - 0.078, 0.03, 40, 1, true), mat: CHROME, p: [0, 0, 0], r: [Math.PI / 2, 0, 0] },
    C(0.07, 0.07, 0.08, MOPED.alu, 0, 0, 0, 20), C(0.075, 0.075, 0.012, MOPED.alu, 0, 0, front ? 0.042 : -0.042, 20),     // Trommelbremse
    C(0.022, 0.022, 0.13, CHROME, 0, 0, 0, 10),                                                                           // Achse
  ];
  for (let i = 0; i < 28; i++) {   // 28 gekreuzte Speichen
    const a = i / 28 * Math.PI * 2, s = i % 2 ? 1 : -1, o = s * 0.5;
    parts.push(limbPart([Math.cos(a + o) * 0.055, Math.sin(a + o) * 0.055, s * 0.035], [Math.cos(a) * (WHEEL_R - 0.09), Math.sin(a) * (WHEEL_R - 0.09), 0], 0.0025, 0.0025, CHROME, 4));
  }
  g.add(partsToGroup(parts, true));
  return g;
}
// Moped-Modell: vorne = +x, Räder bei x = +0.62 / -0.6
function makeMoped(paint) {
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const P = MOPED, pt = paint;
  const fender = (cx, start, len, w) => ({ geo: new THREE.CylinderGeometry(WHEEL_R + 0.045, WHEEL_R + 0.045, w, 24, 1, true, start, len), mat: pt, p: [cx, WHEEL_R, 0], r: [Math.PI / 2, 0, 0] });
  // Tank: geformt, unten breiter, mit Knieschutz und Chromleiste
  const tank = { geo: loftGeo(24, 20, u => ({ x: 0.17 + u * 0.26, bottom: 0.71 + 0.03 * u, top: curve([[-1, 0.86], [-0.4, 0.935], [0.5, 0.93], [1, 0.87]], u),
    halfW: curve([[-1, 0.1], [-0.3, 0.145], [0.6, 0.14], [1, 0.09]], u), p: 2.5 }), 6), mat: pt, p: [0, 0, 0], r: [0, 0, 0] };
  const seat = { geo: loftGeo(24, 18, u => ({ x: -0.46 + u * 0.4, bottom: 0.79, top: curve([[-1, 0.875], [-0.6, 0.93], [0.6, 0.94], [1, 0.9]], u),
    halfW: curve([[-1, 0.1], [0, 0.125], [1, 0.115]], u), p: 3.2 }), 8), mat: P.seat, p: [0, 0, 0], r: [0, 0, 0] };
  const body = [
    tank, seat,
    B(0.1, 0.055, 0.01, P.rubber, 0.02, 0.785, 0.133), B(0.1, 0.055, 0.01, P.rubber, 0.02, 0.785, -0.133),        // Knieschutz
    tube([[-0.05, 0.93, 0], [0.18, 0.95, 0], [0.38, 0.9, 0]], 0.006, CHROME, 12, 5),                                 // Zierleiste
    CY(0.028, 0.02, CHROME, 0.25, 0.935, 0, 18),                                                                       // Tankdeckel
    tube([[-0.86, 0.79, 0.12], [-0.46, 0.79, 0.128], [-0.07, 0.79, 0.118]], 0.008, CHROME, 12, 5),                 // Sitzbank-Zierleiste
    tube([[-0.86, 0.79, -0.12], [-0.46, 0.79, -0.128], [-0.07, 0.79, -0.118]], 0.008, CHROME, 12, 5),
    // Rohrrahmen (gebogen)
    tube([[0.43, 0.98, 0], [0.32, 0.86, 0], [0.12, 0.7, 0], [-0.04, 0.56, 0], [-0.06, 0.4, 0]], 0.03, pt),
    tube([[-0.04, 0.6, 0.09], [-0.35, 0.74, 0.1], [-0.84, 0.8, 0.1]], 0.017, pt), tube([[-0.04, 0.6, -0.09], [-0.35, 0.74, -0.1], [-0.84, 0.8, -0.1]], 0.017, pt),
    B(0.34, 0.2, 0.3, pt, -0.27, 0.66, 0),                                                                            // Seitendeckel
    ...[0, 1].map(i => B(0.2, 0.012, 0.31, P.rubber, -0.27, 0.6 + i * 0.03, 0)),                                      // Lüftungsschlitze
    mDecal(DECAL_S51, 0.12, 0.06, -0.27, 0.705, 0.152, 1), mDecal(DECAL_S51, 0.12, 0.06, -0.27, 0.705, -0.152, -1),
    mDecal(DECAL_TANK, 0.16, 0.04, 0.26, 0.845, 0.1465, 1, 0.08), mDecal(DECAL_TANK, 0.16, 0.04, 0.26, 0.845, -0.1465, -1, 0.08),
    // Sitzbank-Haltegurt, Benzinhahn + Spritschlauch, Zündkerzenstecker + Kabel, Hupe, Zündschloss
    tube([[-0.36, 0.84, -0.128], [-0.36, 0.925, -0.09], [-0.36, 0.947, 0], [-0.36, 0.925, 0.09], [-0.36, 0.84, 0.128]], 0.007, P.rubber, 14, 4),
    CY(0.012, 0.04, CHROME, 0.03, 0.69, -0.075, 8), tube([[0.03, 0.67, -0.075], [0.06, 0.62, -0.08], [0.05, 0.58, -0.07]], 0.006, P.hose, 8, 5),
    CY(0.014, 0.045, P.rubber, 0.285, 0.73, 0, 10), tube([[0.285, 0.75, 0], [0.3, 0.8, 0.03], [0.2, 0.74, 0.07], [0.05, 0.7, 0.08]], 0.005, P.rubber, 14, 5),
    // Gepäckträger aus Rohr
    tube([[-0.6, 0.86, 0.11], [-0.92, 0.88, 0.11], [-0.94, 0.88, 0], [-0.92, 0.88, -0.11], [-0.6, 0.86, -0.11]], 0.008, CHROME, 24, 6),
    tube([[-0.68, 0.87, 0.11], [-0.68, 0.87, -0.11]], 0.006, CHROME, 4, 5), tube([[-0.8, 0.875, 0.11], [-0.8, 0.875, -0.11]], 0.006, CHROME, 4, 5),
    tube([[0.44, 1.05, 0.05], [0.4, 0.95, 0.1], [0.2, 0.72, 0.1], [0.05, 0.55, 0.08]], 0.004, P.rubber, 16, 4),       // Bowdenzug
    // Schutzbleche + Streben + Schmutzfänger
    fender(-0.6, Math.PI * 0.86, Math.PI * 0.82, 0.12),
    B(0.012, 0.12, 0.1, P.rubber, -0.97, 0.38, 0),
    // Motor: Kurbelgehäuse, Seitendeckel, Zylinder mit Kühlrippen, Zylinderkopf, Kerze, Vergaser, Luftfilter
    B(0.3, 0.22, 0.2, P.alu, 0.0, 0.42, 0), C(0.11, 0.11, 0.035, P.alu, -0.02, 0.42, 0.11, 24), C(0.095, 0.095, 0.03, P.alu, 0.06, 0.4, -0.11, 24),
    { geo: new THREE.CylinderGeometry(0.045, 0.045, 0.2, 18), mat: P.alu, p: [0.17, 0.54, 0], r: [0, 0, -0.55] },
    ...[0, 1, 2, 3, 4, 5, 6].map(i => ({ geo: new THREE.CylinderGeometry(0.085 - i * 0.002, 0.085 - i * 0.002, 0.007, 20), mat: P.alu, p: [0.13 + i * 0.016, 0.48 + i * 0.024, 0], r: [0, 0, -0.55] })),
    { geo: new THREE.CylinderGeometry(0.06, 0.06, 0.04, 18), mat: P.alu, p: [0.255, 0.665, 0], r: [0, 0, -0.55] }, CY(0.006, 0.04, CHROME, 0.27, 0.7, 0),
    C(0.025, 0.025, 0.07, P.alu, 0.05, 0.56, -0.07, 14), B(0.12, 0.1, 0.1, P.rubber, -0.08, 0.58, -0.07),
    // Auspuff: gebogenes Krümmerrohr + Schalldämpfer mit Endkappe und Hitzeschutz
    tube([[0.24, 0.53, 0.05], [0.33, 0.44, 0.09], [0.3, 0.3, 0.15], [0.12, 0.24, 0.17], [-0.25, 0.27, 0.18], [-0.38, 0.29, 0.18]], 0.022, CHROME, 40, 10),
    { geo: new THREE.CylinderGeometry(0.045, 0.052, 0.5, 20), mat: CHROME, p: [-0.62, 0.32, 0.18], r: [0, 0, Math.PI / 2 - 0.06] },
    { geo: new THREE.CylinderGeometry(0.03, 0.03, 0.02, 14), mat: P.rubber, p: [-0.875, 0.335, 0.18], r: [0, 0, Math.PI / 2 - 0.06] },
    B(0.3, 0.02, 0.07, P.rubber, -0.58, 0.39, 0.19, 0, 0, -0.06),
    // Schwinge, Federbeine mit echten Spiralfedern, Kette mit Ritzeln, Kettenschutz
    tube([[-0.08, 0.42, 0.11], [-0.35, 0.36, 0.115], [-0.6, WHEEL_R, 0.115]], 0.019, pt, 12, 8), tube([[-0.08, 0.42, -0.11], [-0.35, 0.36, -0.115], [-0.6, WHEEL_R, -0.115]], 0.019, pt, 12, 8),
    limbPart([-0.55, 0.36, 0.125], [-0.64, 0.82, 0.125], 0.012, 0.012, CHROME), limbPart([-0.55, 0.36, -0.125], [-0.64, 0.82, -0.125], 0.012, 0.012, CHROME),
    spring(-0.565, 0.42, 0.125, 0.33, 0.19, CHROME), spring(-0.565, 0.42, -0.125, 0.33, 0.19, CHROME),
    CY(0.03, 0.04, P.rubber, -0.555, 0.39, 0.125, 14), CY(0.03, 0.04, P.rubber, -0.555, 0.39, -0.125, 14),
    // vollgekapselte Kette wie bei der S51: Ritzelgehäuse + zwei Gummi-Kettenschutzschläuche
    C(0.075, 0.075, 0.045, P.alu, 0.04, 0.38, -0.135, 20), C(0.125, 0.125, 0.045, P.dark, -0.6, WHEEL_R, -0.145, 28),
    tube([[0.04, 0.45, -0.15], [-0.2, 0.43, -0.155], [-0.45, 0.41, -0.155], [-0.6, 0.41, -0.15]], 0.02, P.hose, 16, 8),
    tube([[0.04, 0.31, -0.15], [-0.2, 0.27, -0.155], [-0.45, 0.21, -0.155], [-0.6, 0.19, -0.15]], 0.02, P.hose, 16, 8),
    // Rücklicht, Kennzeichen, hintere Blinker, Fußrasten, Bremspedal, Kickstarter
    B(0.08, 0.07, 0.11, P.rubber, -0.92, 0.79, 0), B(0.02, 0.05, 0.09, P.rear, -0.965, 0.79, 0), B(0.012, 0.13, 0.17, P.plate, -0.97, 0.62, 0),
    limbPart([-0.88, 0.8, 0.07], [-0.88, 0.8, 0.17], 0.006, 0.006, CHROME, 6), limbPart([-0.88, 0.8, -0.07], [-0.88, 0.8, -0.17], 0.006, 0.006, CHROME, 6),
    SPH(0.024, P.blink, -0.88, 0.8, 0.19, 1.3, 1, 1), SPH(0.024, P.blink, -0.88, 0.8, -0.19, 1.3, 1, 1),
    limbPart([-0.05, 0.33, 0.12], [-0.05, 0.33, 0.25], 0.014, 0.014, P.rubber, 8), limbPart([-0.05, 0.33, -0.12], [-0.05, 0.33, -0.25], 0.014, 0.014, P.rubber, 8),
    limbPart([-0.42, 0.45, 0.13], [-0.42, 0.45, 0.22], 0.01, 0.01, P.rubber, 8), limbPart([-0.42, 0.45, -0.13], [-0.42, 0.45, -0.22], 0.01, 0.01, P.rubber, 8),
    limbPart([0.0, 0.36, 0.13], [0.16, 0.3, 0.16], 0.008, 0.008, P.alu, 6), limbPart([-0.06, 0.45, -0.13], [-0.2, 0.38, -0.17], 0.008, 0.008, P.alu, 6),
  ];
  root.add(partsToGroup(body, true));
  // Vorderbau (Gabel, Scheinwerfer, Lenker, Spiegel, Schutzblech, Vorderrad) – dreht sich beim Lenken um die schräge Lenkachse
  const front = [
    // Gabel: Gabelbrücke, Standrohre, Faltenbälge, Tauchrohre
    B(0.07, 0.04, 0.2, pt, 0.43, 0.99, 0),
    limbPart([0.47, 0.84, 0.075], [0.43, 0.99, 0.075], 0.019, 0.019, CHROME), limbPart([0.47, 0.84, -0.075], [0.43, 0.99, -0.075], 0.019, 0.019, CHROME),
    ...[0, 1, 2, 3, 4, 5, 6].flatMap(i => { const y = 0.6 + i * 0.033, x = 0.555 - i * 0.008; return [0.075, -0.075].map(z => ({ geo: new THREE.TorusGeometry(0.024, 0.009, 4, 10), mat: P.rubber, p: [x, y, z], r: [Math.PI / 2, 0, 0.25] })); }),
    limbPart([0.62, WHEEL_R, 0.075], [0.56, 0.58, 0.075], 0.024, 0.026, P.alu), limbPart([0.62, WHEEL_R, -0.075], [0.56, 0.58, -0.075], 0.024, 0.026, P.alu),
    // Scheinwerfer: Gehäuse, Chromring, Glas; Tacho; Blinker
    SPH(0.095, pt, 0.49, 0.94, 0, 0.75, 1, 1), { geo: new THREE.TorusGeometry(0.083, 0.01, 8, 28), mat: CHROME, p: [0.56, 0.94, 0], r: [0, Math.PI / 2, 0] },
    { geo: new THREE.CircleGeometry(0.078, 28), mat: P.lens, p: [0.562, 0.94, 0], r: [0, Math.PI / 2, 0] },
    CY(0.038, 0.035, P.rubber, 0.45, 1.06, 0, 20), { geo: new THREE.CircleGeometry(0.032, 20), mat: P.dial, p: [0.45, 1.078, 0], r: [-Math.PI / 2 + 0.3, 0, 0] },
    limbPart([0.48, 0.94, 0.08], [0.48, 0.94, 0.17], 0.006, 0.006, CHROME, 6), limbPart([0.48, 0.94, -0.08], [0.48, 0.94, -0.17], 0.006, 0.006, CHROME, 6),
    SPH(0.025, P.blink, 0.49, 0.94, 0.19, 1.3, 1, 1), SPH(0.025, P.blink, 0.49, 0.94, -0.19, 1.3, 1, 1),
    // Lenker (hochgezogen), Griffe, Hebel, Spiegel
    tube([[0.36, 1.1, -0.33], [0.39, 1.09, -0.2], [0.44, 1.03, -0.07], [0.44, 1.03, 0.07], [0.39, 1.09, 0.2], [0.36, 1.1, 0.33]], 0.011, CHROME, 30, 8),
    limbPart([0.36, 1.1, -0.34], [0.37, 1.1, -0.23], 0.017, 0.017, P.rubber), limbPart([0.37, 1.1, 0.23], [0.36, 1.1, 0.34], 0.017, 0.017, P.rubber),
    limbPart([0.39, 1.1, -0.22], [0.42, 1.1, -0.33], 0.005, 0.005, P.alu, 6), limbPart([0.39, 1.1, 0.22], [0.42, 1.1, 0.33], 0.005, 0.005, P.alu, 6),
    tube([[0.39, 1.1, -0.2], [0.38, 1.25, -0.26], [0.36, 1.33, -0.3]], 0.005, CHROME, 10, 5), tube([[0.39, 1.1, 0.2], [0.38, 1.25, 0.26], [0.36, 1.33, 0.3]], 0.005, CHROME, 10, 5),
    C(0.045, 0.045, 0.012, P.mirror, 0.36, 1.35, -0.31, 18), C(0.045, 0.045, 0.012, P.mirror, 0.36, 1.35, 0.31, 18),
    C(0.038, 0.038, 0.03, P.dark, 0.5, 0.8, 0, 18), C(0.022, 0.022, 0.032, CHROME, 0.5, 0.8, 0, 14),
    CY(0.012, 0.015, CHROME, 0.5, 1.03, 0.04, 10),
    fender(0.62, Math.PI * 0.62, Math.PI * 0.72, 0.1),
    limbPart([0.62, WHEEL_R, 0.065], [0.42, 0.52, 0.065], 0.005, 0.005, CHROME, 6), limbPart([0.62, WHEEL_R, -0.065], [0.42, 0.52, -0.065], 0.005, 0.005, CHROME, 6),
  ];
  const steerPivot = new THREE.Group(); steerPivot.position.set(0.43, 0.99, 0); steerPivot.rotation.z = STEER_RAKE; root.add(steerPivot);
  const steer = new THREE.Group(); steerPivot.add(steer);
  const unRake = new THREE.Group(); unRake.rotation.z = -STEER_RAKE; steer.add(unRake);
  const frontG = new THREE.Group(); frontG.position.set(-0.43, -0.99, 0); unRake.add(frontG);
  frontG.add(partsToGroup(front, true));
  const stand = partsToGroup([limbPart([-0.12, 0.32, -0.12], [-0.2, 0.0, -0.26], 0.012, 0.012, P.rubber), B(0.05, 0.01, 0.04, P.rubber, -0.2, 0.005, -0.26)], true);
  root.add(stand);
  const wf = makeWheel(true); wf.position.set(0.62, WHEEL_R, 0); frontG.add(wf);
  const wr = makeWheel(false); wr.position.set(-0.6, WHEEL_R, 0); root.add(wr);
  scene.add(root);
  return { root, wf, wr, stand, steer };
}
/* ---------- Auto (Sportwagen-Karosserie aus map.js), vorne = +x, 4,6 m lang ---------- */
const CAR_WHEEL_R = 0.36;
// EU-Nummernschild (blauer Streifen mit „D“, schwarze Schrift) – ein Material für alle Autos
const PLATE_MAT = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 56; const g = c.getContext('2d');
  g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 256, 56); g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(2, 2, 252, 52);
  g.fillStyle = '#1d3c9a'; g.fillRect(4, 4, 30, 48); g.fillStyle = '#ffd200'; g.font = 'bold 13px Arial'; g.textAlign = 'center'; g.fillText('★', 19, 22); g.fillStyle = '#fff'; g.font = 'bold 16px Arial'; g.fillText('D', 19, 46);
  g.fillStyle = '#111'; g.font = 'bold 34px Arial'; g.textAlign = 'left'; g.fillText('KZ·AR 47', 44, 41);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, metalness: 0.1 });
})();
function makeCar(paint, rim = RIM, type = 'drift') {
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  // Skyline-Form: kantige Karosserie, lackiertes Dach, getönte Scheiben (Formen in map.js)
  const body = [
    { geo: SKY_BODY_GEO, mat: paint, p: [0, 0, 0], r: [0, 0, 0] }, { geo: SKY_CABIN_GEO, mat: CAR_GLASS, p: [0, 0, 0], r: [0, 0, 0] },
    { geo: SKY_ROOF_GEO, mat: paint, p: [0, 0, 0], r: [0, 0, 0] },
    // Front: großer Lufteinlass, schmaler Grill, Carbon-Lippe
    B(0.06, 0.2, 1.1, CAR_BLACK, 2.32, 0.4, 0), B(0.05, 0.08, 0.5, CAR_BLACK, 2.32, 0.62, 0), B(0.28, 0.035, 1.74, CARBON, 2.22, 0.17, 0),
    // Heck: schwarze Blende mit den runden Doppel-Rückleuchten, Diffusor, dickes Endrohr
    B(0.04, 0.25, 1.6, CAR_BLACK, -2.27, 0.83, 0), B(0.45, 0.13, 1.5, CARBON, -2.12, 0.27, 0),
    { geo: new THREE.CylinderGeometry(0.075, 0.075, 0.2, 14), mat: CHROME, p: [-2.28, 0.33, 0.42], r: [0, 0, Math.PI / 2] },
  ];
  const lamp = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 20), ring = new THREE.CylinderGeometry(0.118, 0.118, 0.035, 20);
  for (const s of [-1, 1]) body.push(
    // eckige Scheinwerfer, Motorhauben-Schlitze, Spiegel, Seitenschweller, Kotflügel-Verbreiterungen
    B(0.06, 0.1, 0.42, HEADLIGHT, 2.33, 0.64, s * 0.58), B(0.05, 0.14, 0.46, CAR_BLACK, 2.315, 0.64, s * 0.58),
    B(0.4, 0.02, 0.16, CAR_BLACK, 1.35, 0.915, s * 0.3, 0, 0, -0.14),
    B(0.18, 0.1, 0.13, paint, 0.62, 1.04, s * 0.88), B(0.04, 0.04, 0.12, CAR_BLACK, 0.62, 1.0, s * 0.8),
    B(2.3, 0.09, 0.06, CARBON, -0.02, 0.22, s * 0.93),
    { geo: lamp, mat: TAILLIGHT, p: [-2.3, 0.84, s * 0.42], r: [0, 0, Math.PI / 2] }, { geo: lamp, mat: TAILLIGHT, p: [-2.3, 0.84, s * 0.67], r: [0, 0, Math.PI / 2] },
    { geo: ring, mat: CHROME, p: [-2.29, 0.84, s * 0.42], r: [0, 0, Math.PI / 2] }, { geo: ring, mat: CHROME, p: [-2.29, 0.84, s * 0.67], r: [0, 0, Math.PI / 2] },
    { geo: ARCH_GEO, mat: CAR_BLACK, p: [1.42, CAR_WHEEL_R, s * 0.96], r: [0, 0, 0] }, { geo: ARCH_GEO, mat: CAR_BLACK, p: [-1.45, CAR_WHEEL_R, s * 0.96], r: [0, 0, 0] });
  // Nummernschilder vorne/hinten, Türfugen, Türgriffe, Scheibenwischer (mehr Echtheit)
  body.push({ geo: new THREE.PlaneGeometry(0.52, 0.114), mat: PLATE_MAT, p: [2.375, 0.3, 0], r: [0, Math.PI / 2, 0] }, { geo: new THREE.PlaneGeometry(0.52, 0.114), mat: PLATE_MAT, p: [-2.315, 0.56, 0], r: [0, -Math.PI / 2, 0] },
    B(0.025, 0.02, 0.56, CAR_BLACK, 2.37, 0.3, 0), B(0.025, 0.02, 0.56, CAR_BLACK, -2.31, 0.56, 0));
  for (const s of [-1, 1]) body.push(B(0.012, 0.58, 0.006, CAR_BLACK, 0.82, 0.64, s * 0.952), B(0.012, 0.5, 0.006, CAR_BLACK, -0.78, 0.66, s * 0.952), B(0.11, 0.022, 0.016, CHROME, -0.42, 0.84, s * 0.958),
    B(0.03, 0.012, 0.42, CAR_BLACK, 0.92, 0.99, s * 0.26, 0, s * 0.35, 0));
  if (type === 'muscle') body.push(B(0.8, 0.13, 0.55, paint, 1.25, 0.98, 0, 0, 0, -0.05), B(0.06, 0.1, 0.45, CAR_BLACK, 1.62, 0.99, 0),   // Lufthutze
    { geo: new THREE.CylinderGeometry(0.075, 0.075, 0.2, 14), mat: CHROME, p: [-2.28, 0.33, -0.42], r: [0, 0, Math.PI / 2] });                // zweites Endrohr
  if (type === 'race') body.push(B(0.5, 0.03, 1.9, CARBON, 2.3, 0.13, 0));   // breitere Frontlippe
  const bodyG = partsToGroup(body, true); root.add(bodyG);
  if (type === 'race') bodyG.position.y = -0.05;   // tiefergelegt
  let wing = null;
  if (type !== 'muscle') { wing = makeWing(paint, type === 'race'); wing.userData.isWing = true; if (type === 'race') wing.position.y = -0.05; root.add(wing); }
  const baseY = bodyG.position.y;
  // Räder: Lenk-Gelenk (vorne) → drehendes Rad mit Reifen, Felge, Speichen
  const spinners = [], fronts = [];
  for (const wx of [1.42, -1.45]) for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(wx, CAR_WHEEL_R, s * 0.9); root.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    const parts = [
      { geo: new THREE.CylinderGeometry(CAR_WHEEL_R, CAR_WHEEL_R, 0.3, 24), mat: TIRE, p: [0, 0, 0], r: [Math.PI / 2, 0, 0] },
      { geo: new THREE.CylinderGeometry(CAR_WHEEL_R * 0.74, CAR_WHEEL_R * 0.74, 0.31, 24), mat: rim, p: [0, 0, 0], r: [Math.PI / 2, 0, 0] },
      { geo: new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), mat: CAR_BLACK, p: [0, 0, s * 0.16], r: [Math.PI / 2, 0, 0] },
    ];
    for (let k = 0; k < 10; k++) parts.push({ geo: SPOKE_GEO[0], mat: rim, p: [0, 0, s * 0.15], r: [0, 0, k / 10 * Math.PI] });
    spin.add(partsToGroup(parts, true));
    pivot.add(partsToGroup([B(0.16, 0.1, 0.06, CALIPER, 0.13, 0.08, s * 0.1, 0, 0, 0.6)], true));
    spinners.push(spin); if (wx > 0) fronts.push(pivot);
  }
  scene.add(root);
  const dummy = new THREE.Group();
  return { root, spinners, fronts, steer: dummy, stand: dummy, wf: dummy, wr: dummy, car: true, paint, rim, bodyG, wing, baseY };
}
// Optik-Tuning (nur bei dir sichtbar): Felgen, Neon-Unterboden, Heckflügel, Tieferlegung
const RIM_COLS = [0xc8ccd2, 0x18191b, 0xd4af37, 0xff2e9a, 0x00e5ff, 0x9dff00, 0xff3b30, 0xffffff];
const RIM_MATS = RIM_COLS.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.28, metalness: 0.85, emissive: c, emissiveIntensity: 0.05 }));
const NEON_COLS = [0x00e5ff, 0xff2e9a, 0x9dff00, 0x8a2be2, 0xff7a00, 0xffffff];
function applyLook(v, type) {
  const m = v.mesh; if (!m.car) return;
  const T = tuneOf(type);
  if (!v.origPaint) v.origPaint = m.paint;
  if (!v.origRim) v.origRim = m.rim;
  setCarPaint(v, T.liv >= 0 ? paintFor(type, T.liv) : v.origPaint);
  const rim = T.rim >= 0 ? RIM_MATS[T.rim] : v.origRim;
  if (m.rim !== rim) { const old = m.rim; m.root.traverse(o => { if (o.isMesh && o.material === old) o.material = rim; }); m.rim = rim; }
  if (T.neon >= 0) {
    if (!m.neon) {
      m.neon = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.3), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, map: NEON_TEX }));
      m.neon.rotation.x = -Math.PI / 2; m.neon.position.y = 0.04; m.root.add(m.neon);
    }
    m.neon.material.color.setHex(NEON_COLS[T.neon]); m.neon.visible = true;
  } else if (m.neon) m.neon.visible = false;
  if (m.wing) m.wing.visible = T.wing !== false;
  const low = 0.035 * T.susp; m.bodyG.position.y = m.baseY - low; if (m.wing) m.wing.position.y = (type === 'race' ? -0.05 : 0) - low;
}
// weicher Lichtfleck für das Neon (in der Mitte hell, zum Rand hin aus)
const NEON_TEX = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
// Nitro (Lachgas): 3 s mehr Schub, danach 12 s aufladen
const NITRO_T = 3, NITRO_CD = 12;
function useNitro() {
  if (ride.v < 0 || ride.kind !== 'car') return;
  if (!tuneOf(ride.ctype).nitro) { showMsg('🔥 Kein Nitro eingebaut – im Tuning-Menü kaufen (' + kbK('tune') + ')'); return; }
  if ((ride.nitroCd || 0) > 0) { showMsg(`🔥 Nitro lädt noch (${Math.ceil(ride.nitroCd)} s)`); return; }
  ride.nitroT = NITRO_T; ride.nitroCd = NITRO_T + NITRO_CD; sndBoom(ride.pos.clone()); me.shake = Math.max(me.shake, 0.25);
}
/* ---------- Panzer (vorne = +x): Wanne, Ketten mit Laufrollen, drehbarer Turm, Kanone hebt/senkt sich ---------- */
const TANK_MAT = {
  olive: new THREE.MeshStandardMaterial({ color: 0x4f5a34, roughness: 0.8, metalness: 0.25 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2c2f25, roughness: 0.85, metalness: 0.2 }),
  track: new THREE.MeshStandardMaterial({ color: 0x1c1c1a, roughness: 0.95 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x55574f, roughness: 0.5, metalness: 0.7 }),
};
const TANK_WHEEL_R = 0.42;
function makeTank() {
  const T = TANK_MAT, root = new THREE.Group(); root.rotation.order = 'YXZ';
  const hull = [
    B(6.2, 0.9, 3.0, T.olive, 0, 1.15, 0), B(1.4, 0.6, 3.0, T.olive, 2.95, 1.05, 0, 0, 0, -0.5), B(0.9, 0.7, 3.0, T.olive, -3.0, 1.15, 0, 0, 0, 0.35),
    B(6.0, 0.12, 3.6, T.dark, 0, 1.62, 0),                                          // Kettenabdeckung
    B(0.6, 0.35, 0.6, T.dark, -2.6, 1.85, 1.1), B(0.6, 0.35, 0.6, T.dark, -2.6, 1.85, -1.1),   // Motorgitter
    B(0.5, 0.25, 0.3, T.steel, -3.3, 1.35, 1.0),                                    // Auspuff
  ];
  for (const s of [-1, 1]) {
    hull.push(B(6.6, 0.95, 0.7, T.track, 0, 0.55, s * 1.45));                      // Kette
    hull.push(B(6.2, 0.08, 0.72, T.track, 0, 1.05, s * 1.45));
    for (const x of [-3.1, 3.1]) hull.push({ geo: new THREE.CylinderGeometry(0.42, 0.42, 0.72, 14), mat: T.track, p: [x, 0.6, s * 1.45], r: [Math.PI / 2, 0, 0] });
  }
  root.add(partsToGroup(hull, true));
  // Laufrollen (drehen sich beim Fahren)
  const spinners = [];
  for (const s of [-1, 1]) for (let k = 0; k < 6; k++) {
    const pv = new THREE.Group(); pv.position.set(-2.4 + k * 0.96, TANK_WHEEL_R + 0.02, s * 1.83); root.add(pv);
    const w = partsToGroup([{ geo: new THREE.CylinderGeometry(TANK_WHEEL_R, TANK_WHEEL_R, 0.12, 16), mat: T.dark, p: [0, 0, 0], r: [Math.PI / 2, 0, 0] },
      { geo: new THREE.CylinderGeometry(0.14, 0.14, 0.14, 10), mat: T.steel, p: [0, 0, 0], r: [Math.PI / 2, 0, 0] },
      B(0.5, 0.06, 0.13, T.steel, 0, 0, 0)], true);
    pv.add(w); spinners.push(w);
  }
  // Turm mit Kanone
  const turret = new THREE.Group(); turret.position.set(-0.3, 1.68, 0); root.add(turret);
  turret.add(partsToGroup([
    B(3.0, 0.85, 2.5, T.olive, 0, 0.42, 0), B(1.0, 0.7, 2.3, T.olive, 1.6, 0.38, 0, 0, 0, -0.35), B(0.8, 0.6, 2.2, T.dark, -1.75, 0.45, 0),
    { geo: new THREE.CylinderGeometry(0.4, 0.42, 0.25, 16), mat: T.dark, p: [-0.4, 0.95, 0.55], r: [0, 0, 0] },      // Luke
    B(0.5, 0.35, 0.5, T.dark, 0.3, 1.0, -0.65), B(0.08, 0.08, 0.9, T.steel, 0.6, 1.2, -0.65, 0, Math.PI / 2, 0),      // Optik + MG
    B(0.15, 0.4, 0.08, T.steel, -1.2, 1.1, -0.9), B(0.02, 1.4, 0.02, T.steel, -1.2, 1.7, -0.9),                       // Antenne
  ], true));
  const barrel = new THREE.Group(); barrel.position.set(1.55, 0.45, 0); turret.add(barrel);
  barrel.add(partsToGroup([
    { geo: new THREE.CylinderGeometry(0.22, 0.26, 0.5, 14), mat: T.olive, p: [0.25, 0, 0], r: [0, 0, Math.PI / 2] },
    { geo: new THREE.CylinderGeometry(0.1, 0.12, 4.2, 14), mat: T.steel, p: [2.4, 0, 0], r: [0, 0, Math.PI / 2] },
    { geo: new THREE.CylinderGeometry(0.16, 0.16, 0.45, 14), mat: T.dark, p: [4.4, 0, 0], r: [0, 0, Math.PI / 2] },   // Mündungsbremse
  ], true));
  scene.add(root);
  const dummy = new THREE.Group();
  return { root, spinners, fronts: [], turret, barrel, steer: dummy, stand: dummy, wf: dummy, wr: dummy, tank: true };
}
/* ---------- Schwerer Gustav: riesiges Eisenbahngeschütz auf zwei Gleisen (vorne = +x) ---------- */
const GUSTAV_RAIL = { yaw: 0, z: 0, x0: 0, x1: 0 };
const RAIL_NEW = { k: 0 };
// Schienen legen: alle 1,5 m Fahrweg ein Stück Gleis in Fahrtrichtung (bei allen Spielern gleich, aus der Bewegung des Gustav)
function layRail(v, x, y, z) {
  const R = RAIL_NEW; if (!R.sl) return;
  if (v.lrx === undefined) { v.lrx = x; v.lrz = z; return; }
  const dx = x - v.lrx, dz = z - v.lrz, d = Math.hypot(dx, dz);
  if (d > 30) { v.lrx = x; v.lrz = z; return; }   // Neustart / Sprung: nicht quer über die Karte legen
  if (d < 1.5) return;
  const mx = v.lrx + dx / 2 + dx / d * 16, mz = v.lrz + dz / 2 + dz / d * 16; v.lrx = x; v.lrz = z;   // 16 m voraus: Gleis liegt schon, bevor er drüberfährt
  const r = R.rect; if (mx > r.x0 && mx < r.x1 && mz > r.z0 && mz < r.z1) return;   // altes Gleis liegt hier schon
  const yaw = Math.atan2(-dz, dx), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), s = new THREE.Vector3(1, 1, 1), m = new THREE.Matrix4();
  const at = (ox, oy, oz) => new THREE.Vector3(ox, oy, oz).applyQuaternion(q).add(new THREE.Vector3(mx, y, mz));
  const i = R.k % R.N; R.k++;
  R.bd.setMatrixAt(i, m.compose(at(0, 0.06, 0), q, s)); R.sl.setMatrixAt(i, m.compose(at(0, 0.17, 0), q, s));
  let j = 0; for (const sd of [-1, 1]) for (const zz of [-0.72, 0.72]) R.rl.setMatrixAt(i * 4 + j++, m.compose(at(0, 0.26, sd * 1.8 + zz), q, s));
  R.bd.count = R.sl.count = Math.min(R.k, R.N); R.rl.count = R.bd.count * 4;
  for (const im of [R.bd, R.sl, R.rl]) im.instanceMatrix.needsUpdate = true;
}
function makeGustav(v) {
  const T = TANK_MAT, root = new THREE.Group(); root.rotation.order = 'YXZ';
  const C = (r1, r2, len, mat, x, y, z, rx = 0, rz = Math.PI / 2, seg = 16) => ({ geo: new THREE.CylinderGeometry(r1, r2, len, seg), mat, p: [x, y, z], r: [rx, 0, rz] });
  const P = [
    B(22, 1.6, 5.2, T.olive, 0, 3.2, 0), B(16, 2.4, 4.4, T.olive, 0, 5.1, 0),                 // Rahmen + Lafette
    B(4, 1.2, 4.8, T.dark, 9.5, 2.9, 0), B(4, 1.2, 4.8, T.dark, -9.5, 2.9, 0),
    B(3.2, 2.2, 4.2, T.olive, -9.5, 5.2, 0), B(2.6, 0.2, 4.6, T.steel, -9.5, 6.4, 0),               // Bedienhaus hinten
    B(0.12, 2.8, 4.2, T.steel, 6, 7.5, 2.25), B(0.12, 2.8, 4.2, T.steel, 6, 7.5, -2.25),
  ];
  for (const s of [-1, 1]) for (const x of [-8.5, -5, 5, 8.5]) {          // 8 Drehgestelle mit je 3 Achsen (auf zwei Gleisen)
    P.push(B(3.0, 0.9, 1.6, T.dark, x, 1.7, s * 1.8));
    for (const dx of [-1, 0, 1]) for (const zz of [-0.72, 0.72]) P.push(C(0.48, 0.48, 0.22, T.track, x + dx, 0.5, s * 1.8 + zz, Math.PI / 2, 0, 14));
  }
  for (let k = -4; k <= 4; k++) P.push(B(0.25, 0.8, 5.3, T.dark, k * 2.2, 4.2, 0));   // Nieten-/Rahmenrippen
  root.add(partsToGroup(P, true));
  const turret = new THREE.Group(); turret.position.set(1.5, 6.3, 0); root.add(turret);
  turret.add(partsToGroup([B(8, 3.2, 3.6, T.olive, 0, 1.6, 0), { geo: new THREE.CylinderGeometry(2.2, 2.2, 3.8, 20), mat: T.dark, p: [1.2, 2.6, 0], r: [Math.PI / 2, 0, 0] }], true));
  const barrel = new THREE.Group(); barrel.position.set(1.2, 2.6, 0); turret.add(barrel);
  barrel.add(partsToGroup([
    C(1.5, 1.5, 4, T.olive, 0, 0, 0), C(1.25, 1.35, 6, T.steel, 5, 0, 0), C(0.95, 1.2, 18, T.steel, 17, 0, 0),
    C(1.1, 1.1, 1.2, T.dark, 26.2, 0, 0), C(0.6, 0.6, 0.06, T.track, 26.82, 0, 0, 0, Math.PI / 2, 20),
    C(0.5, 0.5, 4, T.dark, -3, 0, 0),                                                  // Verschluss hinten
  ], true));
  scene.add(root);
  // Gleise: zwei Schienenpaare mit Schwellen, 140 m lang
  const L = 150, yaw = v.yaw, cx = v.x, cz = v.z;
  Object.assign(GUSTAV_RAIL, { yaw, z: cz, x0: cx - L / 2 + 13, x1: cx + L / 2 - 13 });
  const rails = new THREE.Group(); rails.position.set(cx, 0, cz); rails.rotation.y = yaw; scene.add(rails);
  const rp = []; for (const s of [-1, 1]) for (const zz of [-0.72, 0.72]) rp.push(B(L, 0.16, 0.12, T.steel, 0, 0.26, s * 1.8 + zz));
  rp.push(B(L, 0.12, 7.2, new THREE.MeshStandardMaterial({ color: 0x6d675e, roughness: 1 }), 0, 0.06, 0));   // Schotterbett
  rails.add(partsToGroup(rp, true));
  const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.12, 6.4), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.95 }), Math.floor(L / 1.2));
  const mm = new THREE.Matrix4(); for (let k = 0; k < sl.count; k++) { mm.makeTranslation(-L / 2 + k * 1.2, 0.17, 0); sl.setMatrixAt(k, mm); }
  sl.receiveShadow = true; rails.add(sl);
  rails.updateMatrixWorld(true); rails.traverse(o => { o.matrixAutoUpdate = false; });   // fest: Gras wächst hier nicht durch
  // neue Schienen (beim Fahren abseits des Gleises gelegt): Schwellen + Schienenstücke als InstancedMesh, Ringpuffer
  const N = 3000;
  RAIL_NEW.sl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.12, 6.4), sl.material, N);
  RAIL_NEW.rl = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.16, 0.12), T.steel, N * 4);
  RAIL_NEW.bd = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.12, 7.2), rp[rp.length - 1].mat, N);
  for (const im of [RAIL_NEW.sl, RAIL_NEW.rl, RAIL_NEW.bd]) { im.count = 0; im.frustumCulled = false; im.receiveShadow = true; scene.add(im); }
  RAIL_NEW.N = N; RAIL_NEW.rect = { x0: cx - L / 2, x1: cx + L / 2, z0: cz - 4, z1: cz + 4 };
  const dummy = new THREE.Group();
  return { root, spinners: [], fronts: [], turret, barrel, barrelX: 1.2, muzzleX: 27, gustav: true, steer: dummy, stand: dummy, wf: dummy, wr: dummy, tank: true };
}
/* ---------- Helikopter (vorne = +x): Rumpf, Glaskanzel, Heckausleger, Haupt- und Heckrotor, Kufen, Raketenkästen ---------- */
const HELI_MAT = {
  body: new THREE.MeshStandardMaterial({ color: 0x3b4636, roughness: 0.55, metalness: 0.35 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1d201c, roughness: 0.6, metalness: 0.4 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x15222c, roughness: 0.05, metalness: 0.6, envMapIntensity: 1.6 }),
  blade: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 }),
};
function makeHeli() {
  const H = HELI_MAT, root = new THREE.Group(); root.rotation.order = 'YXZ';
  const body = [
    { geo: new THREE.SphereGeometry(1, 18, 12), mat: H.body, p: [0.2, 1.75, 0], r: [0, 0, 0], s: [2.3, 1.15, 1.1] },          // Rumpf
    { geo: new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat: H.glass, p: [1.25, 1.75, 0], r: [0, 0, -Math.PI / 2], s: [1.05, 1.25, 0.95] },   // Kanzel
    { geo: new THREE.CylinderGeometry(0.22, 0.42, 4.6, 12), mat: H.body, p: [-3.7, 2.05, 0], r: [0, 0, Math.PI / 2] },       // Heckausleger
    B(1.2, 1.3, 0.12, H.body, -5.9, 2.6, 0, 0, 0, 0.35), B(0.7, 0.08, 1.4, H.body, -5.6, 2.15, 0),                          // Seitenleitwerk, Höhenleitwerk
    B(1.6, 0.4, 0.9, H.dark, -0.4, 2.85, 0), { geo: new THREE.CylinderGeometry(0.16, 0.16, 0.5, 10), mat: H.dark, p: [0, 3.15, 0], r: [0, 0, 0] },   // Triebwerk, Rotormast
    B(1.4, 0.12, 3.1, H.body, -0.1, 1.35, 0),                                                                               // Stummelflügel
  ];
  for (const s of [-1, 1]) body.push(
    { geo: new THREE.CylinderGeometry(0.06, 0.06, 3.6, 8), mat: H.dark, p: [0.1, 0.12, s * 1.0], r: [0, 0, Math.PI / 2] },   // Kufe
    { geo: new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), mat: H.dark, p: [0.9, 0.65, s * 0.85], r: [s * 0.25, 0, 0] },
    { geo: new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), mat: H.dark, p: [-0.8, 0.65, s * 0.85], r: [s * 0.25, 0, 0] },
    { geo: new THREE.CylinderGeometry(0.2, 0.2, 1.3, 12), mat: H.dark, p: [0.1, 1.15, s * 1.45], r: [0, 0, Math.PI / 2] });  // Raketenkasten
  root.add(partsToGroup(body, true));
  const rotor = new THREE.Group(); rotor.position.set(0, 3.42, 0); root.add(rotor);
  const blades = [{ geo: new THREE.CylinderGeometry(0.22, 0.22, 0.14, 12), mat: H.dark, p: [0, 0, 0], r: [0, 0, 0] }];
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; blades.push(B(5.6, 0.04, 0.32, H.blade, Math.cos(a) * 2.9, 0, -Math.sin(a) * 2.9, 0, a, 0)); }
  rotor.add(partsToGroup(blades, true));
  const tail = new THREE.Group(); tail.position.set(-6.1, 2.75, 0.18); root.add(tail);
  tail.add(partsToGroup([B(0.14, 1.5, 0.03, H.blade, 0, 0, 0), B(1.5, 0.14, 0.03, H.blade, 0, 0, 0)], true));
  scene.add(root);
  const dummy = new THREE.Group();
  return { root, spinners: [], fronts: [], rotor, tail, steer: dummy, stand: dummy, wf: dummy, wr: dummy, heli: true };
}
/* ---------- Kleinflugzeug (Hochdecker wie eine Cessna, vorne = +x, ~8 m lang, 11 m Spannweite) ---------- */
const PLANE_COLS = [0xc8102e, 0x1a4fa0, 0x0a7a4a, 0xff8000];
const PLANE_WHITE = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.35, metalness: 0.15 });
function makePlane(i) {
  const W = PLANE_WHITE, C = new THREE.MeshStandardMaterial({ color: PLANE_COLS[i % 4], roughness: 0.35, metalness: 0.2 }), G = HELI_MAT.glass, D = HELI_MAT.dark;
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const body = [
    B(3.6, 1.25, 1.15, W, 0.4, 1.3, 0), B(0.95, 0.95, 1.0, W, 2.6, 1.2, 0),                    // Rumpf, Motorhaube
    B(3.8, 0.62, 0.6, W, -3.2, 1.5, 0, 0, 0, 0.06), B(1.3, 0.5, 0.45, W, -5.3, 1.62, 0),       // Heckausleger
    B(1.7, 0.55, 1.17, G, 0.85, 1.68, 0), B(0.08, 0.6, 1.0, G, 1.72, 1.7, 0, 0, 0, -0.55),    // Seitenfenster, Frontscheibe
    B(4.6, 0.16, 1.17, C, -0.2, 0.95, 0), B(3.9, 0.12, 0.62, C, -3.2, 1.25, 0, 0, 0, 0.06),   // Zierstreifen
    B(1.55, 0.12, 11.2, W, 0.75, 2.24, 0), B(1.56, 0.13, 0.7, C, 0.75, 2.24, 5.3), B(1.56, 0.13, 0.7, C, 0.75, 2.24, -5.3),   // Tragfläche mit farbigen Spitzen
    B(0.95, 0.08, 3.7, W, -5.55, 1.62, 0), B(1.15, 1.35, 0.08, C, -5.45, 2.35, 0, 0, 0, 0.42), // Höhen- und Seitenleitwerk
    { geo: new THREE.ConeGeometry(0.28, 0.45, 14), mat: D, p: [3.3, 1.2, 0], r: [0, 0, -Math.PI / 2] },   // Propeller-Nabe
    { geo: new THREE.CylinderGeometry(0.3, 0.3, 0.2, 14), mat: TIRE, p: [2.45, 0.3, 0], r: [Math.PI / 2, 0, 0] }, B(0.08, 0.6, 0.08, D, 2.45, 0.6, 0),   // Bugrad
  ];
  for (const s of [-1, 1]) body.push(
    B(0.07, 2.4, 0.07, D, 0.75, 1.5, s * 1.6, s * 0.96, 0, 0),                                 // Flügelstrebe
    { geo: new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14), mat: TIRE, p: [0.1, 0.32, s * 1.15], r: [Math.PI / 2, 0, 0] },   // Haupträder
    B(0.12, 0.08, 0.75, D, 0.1, 0.55, s * 0.78, s * 0.5, 0, 0),                                 // Fahrwerksbein
    B(0.6, 0.35, 0.3, C, 0.1, 0.38, s * 1.15));                                                // Radverkleidung
  root.add(partsToGroup(body, true));
  const prop = new THREE.Group(); prop.position.set(3.42, 1.2, 0); root.add(prop);
  prop.add(partsToGroup([B(0.05, 1.9, 0.16, D, 0, 0, 0), B(0.05, 0.16, 1.9, D, 0, 0, 0, Math.PI / 4, 0, 0)], true));
  scene.add(root);
  const dummy = new THREE.Group();
  return { root, spinners: [], fronts: [], prop, steer: dummy, stand: dummy, wf: dummy, wr: dummy, plane: true };
}
/* ---------- Kampfjets: vier Typen mit glattem Rumpf, Profil-Flügeln, Bubble-Kanzel und Lackierung (vorne = +x) ----------
   Rumpf = Querschnitte (Superellipse) entlang der Länge, Flügel/Leitwerke = echtes Tragflächenprofil (vorne dick, hinten dünn),
   Lackierung = Bild mit Tarnfarben-Verlauf (oben dunkler), Blechfugen, Nieten, Wartungsklappen, Abgasruß, Abzeichen, Kennnummer.
   Falke: leichter Einstrahler, ein Seitenleitwerk, Lufteinlauf unter dem Rumpf · Adler: großer Zweistrahler, zwei Seitenleitwerke
   Milan: Deltaflügel mit Canards · Schatten: Tarnkappen-Jet, kantiger Rumpf, schräge Leitwerke, eckige Düsen.
   Alle fliegen gleich (gleiche Steuerung), sehen aber verschieden aus. */
const JET_GLASS = new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.08, metalness: 0.9, envMapIntensity: 1.6 });   // goldbedampfte Kanzel
const JET_GLASS_CLEAR = new THREE.MeshStandardMaterial({ color: 0x23323e, roughness: 0.04, metalness: 0.7, envMapIntensity: 1.8 });   // getönte Kanzel
const JET_FLAME = new THREE.MeshBasicMaterial({ color: 0xff9a40, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
const JET_FLAME_IN = new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
const JET_NOZ = new THREE.MeshStandardMaterial({ color: 0x5a5550, roughness: 0.45, metalness: 0.85 });     // Schubdüse (hitzeverfärbtes Metall)
const JET_INNER = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 });                      // Einlauf/Düse innen
const JET_GEAR = new THREE.MeshStandardMaterial({ color: 0xd9dbd6, roughness: 0.5, metalness: 0.3 });       // Fahrwerk (weiß lackiert)
const JET_TYPES = [
  { name: 'Falke', base: '#8f98a1', top: '#7a838c', low: '#aab2b9', L: 16.6, circ: 4.2 },
  { name: 'Adler', base: '#6f7c88', top: '#5b6874', low: '#8995a0', L: 18.6, circ: 5.6 },
  { name: 'Milan', base: '#858d94', top: '#717a81', low: '#a0a8ae', L: 15.8, circ: 4.4 },
  { name: 'Schatten', base: '#50555a', top: '#464a4f', low: '#5d6267', L: 18.2, circ: 5.8 },
];
// Rumpf aus Querschnitten: st = [x, halbe Breite, Höhe oben, Höhe unten, Mitte y, Eckigkeit (2 = rund, 4+ = kantig)]
// Bild-Koordinaten: u entlang der Länge (Nase = 1), v rundherum (0 unten, .25 rechts, .5 oben, .75 links)
function jetLoft(st, seg = 32) {
  const pos = [], uv = [], idx = [], x0 = st[st.length - 1][0], x1 = st[0][0];
  for (const [x, a, bt, bb, yc, n = 2.2] of st) for (let k = 0; k <= seg; k++) {
    const t = k / seg * Math.PI * 2 - Math.PI / 2, c = Math.cos(t), s = Math.sin(t), e = 2 / n;
    pos.push(x, yc + (s >= 0 ? bt : bb) * Math.sign(s) * Math.pow(Math.abs(s), e), a * Math.sign(c) * Math.pow(Math.abs(c), e));
    uv.push((x - x0) / (x1 - x0), k / seg);
  }
  for (let i = 0; i < st.length - 1; i++) for (let k = 0; k < seg; k++) { const a = i * (seg + 1) + k, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const mid = Math.floor(st.length / 2) * (seg + 1) + Math.floor(seg / 4);   // Punkt rechts in der Mitte: Fläche muss nach außen (+z) zeigen
  return jetGeo(pos, uv, idx, mid, [0, 0, 1]);
}
// Dreiecke so drehen, dass die Fläche bei Punkt p nach „out“ zeigt; Normalen weich
function jetGeo(pos, uv, idx, p, out) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  const nr = g.attributes.normal; if (nr.getX(p) * out[0] + nr.getY(p) * out[1] + nr.getZ(p) * out[2] < 0) {
    for (let j = 0; j < idx.length; j += 3) { const t = idx[j + 1]; idx[j + 1] = idx[j + 2]; idx[j + 2] = t; }
    g.setIndex(idx); g.computeVertexNormals();
  }
  return withUv2(g);
}
// Flügel mit NACA-Profil zwischen Wurzel und Spitze: { z, le (Vorderkante x), te (Hinterkante x), y, t (relative Dicke) }
function jetWing(root, tip, N = 12) {
  const xs = []; for (let k = 0; k <= N; k++) xs.push((1 - Math.cos(k / N * Math.PI)) / 2);
  const yt = x => 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
  const pos = [], uv = [], idx = [], loop = [];
  for (let k = N; k >= 0; k--) loop.push([xs[k], 1]); for (let k = 1; k <= N; k++) loop.push([xs[k], -1]);   // oben: Hinterkante → Vorderkante, unten zurück
  const xmin = Math.min(root.te, tip.te), xmax = Math.max(root.le, tip.le);
  for (const S of [root, tip]) { const c = S.le - S.te;
    for (const [xc, sg] of loop) { const x = S.le - xc * c; pos.push(x, S.y + sg * S.t * c * yt(xc) * 0.5, S.z); uv.push((x - xmin) / (xmax - xmin), S === root ? 0 : 1); } }
  const M = loop.length;
  for (let k = 0; k < M - 1; k++) idx.push(k, k + M, k + 1, k + M, k + M + 1, k + 1);
  const ct = pos.length / 3; pos.push((tip.le + tip.te) / 2, tip.y, tip.z); uv.push(0.5, 1);   // Spitze schließen
  for (let k = 0; k < M - 1; k++) idx.push(M + k, ct, M + k + 1);
  return jetGeo(pos, uv, idx, Math.floor(N / 2), [0, 1, 0]);   // Punkt N = Vorderkante oben → nach oben
}
function jetMirror(g) {   // Spiegelbild für die linke Seite (Dreiecke umdrehen)
  const m = g.clone(); m.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, -1));
  const ix = m.index.array.slice(); for (let j = 0; j < ix.length; j += 3) { const t = ix[j + 1]; ix[j + 1] = ix[j + 2]; ix[j + 2] = t; }
  m.setIndex(Array.from(ix)); m.computeVertexNormals(); return withUv2(m);
}
// Seitenleitwerk: Profil in der Ebene, dann aufrecht gestellt, um „cant“ nach außen geneigt, an (z, y)
function jetFin(rootLe, rootTe, tipLe, tipTe, h, t, z, y, cant) {
  const g = jetWing({ z: 0, le: rootLe, te: rootTe, y: 0, t }, { z: h, le: tipLe, te: tipTe, y: 0, t: t * 0.8 });
  g.rotateX(-Math.PI / 2); g.rotateX(cant); g.translate(0, y, z); return g;
}
// Lackierung (für alle Jets eines Typs gleich, Kennnummer je Jet)
const JET_WING_TEX = {};
function jetBodyTex(ti, num) {
  const T = JET_TYPES[ti], W = 1024, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H);   // Bild-y = (1 - v) · H: unten hell, oben dunkel (Tarnanstrich gegen Schatten)
  gr.addColorStop(0, T.low); gr.addColorStop(0.25, T.base); gr.addColorStop(0.5, T.top); gr.addColorStop(0.75, T.base); gr.addColorStop(1, T.low);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { const x = Math.random() * W, y = Math.random() * H, r = 20 + Math.random() * 70, q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},.05)`); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  const stealth = ti === 3;
  g.strokeStyle = 'rgba(20,24,28,.35)'; g.lineWidth = 1.2;
  for (const v of [0.12, 0.2, 0.36, 0.44, 0.56, 0.64, 0.8, 0.88]) { g.beginPath(); g.moveTo(0, (1 - v) * H); g.lineTo(W, (1 - v) * H); g.stroke(); }   // Längsfugen
  for (let k = 0; k < 16; k++) { const x = 40 + k * 60 + Math.random() * 20; g.beginPath();   // Spante (Querfugen), bei „Schatten“ als Sägezahn
    if (stealth) { for (let y = 0; y <= H; y += 16) g.lineTo(x + ((y / 16) % 2 ? 8 : -8), y); } else { g.moveTo(x, 0); g.lineTo(x, H); } g.stroke(); }
  for (let k = 0; k < 26; k++) { const x = Math.random() * W, y = Math.random() * H, w = 14 + Math.random() * 40, h = 8 + Math.random() * 22; g.strokeRect(x, y, w, h); }   // Wartungsklappen
  g.fillStyle = 'rgba(230,235,240,.25)'; for (let k = 0; k < 1400; k++) g.fillRect(Math.random() * W, Math.random() * H, 1.3, 1.3);   // Nieten
  if (stealth) { g.fillStyle = 'rgba(140,150,160,.12)'; for (let k = 0; k < 18; k++) g.fillRect(Math.random() * W, Math.random() * H, 30 + Math.random() * 60, 6 + Math.random() * 14); }   // Tarnbeschichtung (Flicken)
  const soot = g.createLinearGradient(0, 0, W * 0.16, 0); soot.addColorStop(0, 'rgba(25,22,20,.75)'); soot.addColorStop(1, 'rgba(25,22,20,0)'); g.fillStyle = soot; g.fillRect(0, 0, W * 0.16, H);   // Abgasruß hinten
  // Abzeichen (unauffällig grau) und Kennnummer auf beiden Seiten, lesbar; Schrift wird wegen der Abbildung in der Breite gestreckt
  const sx = (W / T.L) / (H / T.circ), side = (fn, u, v) => { g.save(); g.translate(u * W, (1 - v) * H); if (v > 0.5) g.rotate(Math.PI); g.scale(sx, 1); fn(); g.restore(); };
  const roundel = () => { g.fillStyle = 'rgba(40,46,52,.55)'; g.beginPath(); g.arc(0, 0, 15, 0, 7); g.fill(); g.fillStyle = 'rgba(200,206,212,.6)'; g.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 4.5 : 11; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.fill(); };
  const text = () => { g.fillStyle = 'rgba(30,34,40,.75)'; g.font = 'bold 20px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(num, 0, 0); };
  for (const v of [0.27, 0.73]) { side(roundel, 0.33, v); side(text, 0.76, v - 0.03 * (v > 0.5 ? -1 : 1)); }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO; return t;
}
function jetWingTex(ti) {
  if (JET_WING_TEX[ti]) return JET_WING_TEX[ti];
  const T = JET_TYPES[ti], S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = T.top; g.fillRect(0, 0, S, S);   // u = Profiltiefe (Vorderkante = 1 → rechts), v = Spannweite (Wurzel unten)
  g.strokeStyle = 'rgba(20,24,28,.16)'; g.lineWidth = 1;
  for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(0, k * S / 4); g.lineTo(S, k * S / 4); g.stroke(); }
  for (const u of [0.2, 0.55]) { g.beginPath(); g.moveTo(u * S, 0); g.lineTo(u * S, S); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, S * 0.2, S);   // Ruder/Klappen
  g.fillStyle = 'rgba(60,64,68,.5)'; g.fillRect(S * 0.94, 0, S * 0.06, S);   // Vorderkante
  g.fillStyle = 'rgba(230,235,240,.22)'; for (let k = 0; k < 500; k++) g.fillRect(Math.random() * S, Math.random() * S, 1.2, 1.2);
  g.save(); g.translate(S * 0.5, S * 0.42); g.fillStyle = 'rgba(40,46,52,.5)'; g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill();   // Abzeichen
  g.fillStyle = 'rgba(200,206,212,.55)'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 7 : 17; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.fill(); g.restore();
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO; return JET_WING_TEX[ti] = t;
}
function makeJet(i, jt) {
  const ti = ((jt !== undefined ? jt : i) % 4 + 4) % 4, T = JET_TYPES[ti];
  const body = new THREE.MeshStandardMaterial({ map: jetBodyTex(ti, 'KZ-' + (100 + (i * 37) % 900)), roughness: 0.55, metalness: 0.3, envMapIntensity: 0.9, side: THREE.DoubleSide });
  const wingM = new THREE.MeshStandardMaterial({ map: jetWingTex(ti), roughness: 0.58, metalness: 0.28, envMapIntensity: 0.9, side: THREE.DoubleSide });
  const D = HELI_MAT.dark, Wm = PLANE_WHITE, glass = ti === 0 ? JET_GLASS_CLEAR : JET_GLASS;
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const P = (geo, mat) => ({ geo, mat, p: [0, 0, 0], r: [0, 0, 0] });
  const parts = [], wingPair = (r, t) => { const g = jetWing(r, t); parts.push(P(g, wingM), P(jetMirror(g), wingM)); };
  const finPair = (a, b, c, d, h, th, z, y, cant) => { const g = jetFin(a, b, c, d, h, th, z, y, cant); parts.push(P(g, wingM), P(jetMirror(g), wingM)); };
  const alongX = (geo, mat, x, y, z) => ({ geo, mat, p: [x, y, z], r: [0, 0, -Math.PI / 2] });   // Zylinder/Kegel entlang x (Spitze nach +x)
  const nozzle = (x, y, z, r, len) => parts.push(alongX(new THREE.CylinderGeometry(r * 0.92, r, len, 20, 1, true), JET_NOZ, x, y, z), alongX(new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.05, 20), JET_INNER, x - len / 2 + 0.3, y, z),
    alongX(new THREE.CylinderGeometry(r * 0.75, r * 0.75, 0.04, 16), JET_FLAME, x - len / 2 + 0.32, y, z));
  const missile = (x, y, z, len = 2.9) => parts.push(B(1.1, 0.2, 0.08, wingM, x, y + 0.2, z), alongX(new THREE.CylinderGeometry(0.1, 0.1, len, 12), Wm, x - 0.1, y, z), alongX(new THREE.ConeGeometry(0.1, 0.38, 12), D, x - 0.1 + len / 2 + 0.19, y, z),
    B(0.36, 0.42, 0.02, Wm, x - 0.1 - len / 2 + 0.25, y, z), B(0.36, 0.02, 0.42, Wm, x - 0.1 - len / 2 + 0.25, y, z));
  const gear = (x, z, h, r, w) => parts.push(CY(0.07, h, JET_GEAR, x, h / 2 + r * 0.6, z), { geo: new THREE.CylinderGeometry(r, r, w, 16), mat: TIRE, p: [x, r, z], r: [Math.PI / 2, 0, 0] },
    ...(z ? [B(0.7, 0.4, 0.02, wingM, x, h * 0.62, z + (z > 0 ? 0.3 : -0.3))] : []));   // Strebe, Rad, Fahrwerksklappe (nur Hauptfahrwerk)
  let burnX, burnY, burnZ;
  if (ti === 0) {   // FALKE: schlanker Einstrahler, großer Lufteinlauf unter dem Rumpf, Flügel-Rumpf-Übergang, ein Seitenleitwerk
    parts.push(P(jetLoft([[8.4, 0.02, 0.02, 0.02, 1.86, 2], [7.8, 0.24, 0.24, 0.22, 1.84, 2], [6.8, 0.42, 0.42, 0.38, 1.82, 2.1], [5.6, 0.56, 0.52, 0.5, 1.8, 2.3], [4.2, 0.64, 0.6, 0.58, 1.8, 2.4],
      [2.8, 0.74, 0.6, 0.62, 1.78, 2.6], [1.0, 0.86, 0.6, 0.66, 1.76, 2.9], [-1.5, 0.86, 0.6, 0.64, 1.76, 2.9], [-4.0, 0.74, 0.56, 0.6, 1.78, 2.5], [-6.0, 0.6, 0.52, 0.52, 1.8, 2.2], [-6.9, 0.56, 0.5, 0.5, 1.8, 2.1]]), body));
    parts.push(P(jetLoft([[3.4, 0.5, 0.2, 0.34, 1.12, 4], [2.4, 0.56, 0.26, 0.38, 1.14, 3.6], [0.0, 0.56, 0.3, 0.36, 1.18, 3.2], [-2.4, 0.4, 0.3, 0.2, 1.3, 2.6]]), body));   // Einlaufkanal
    parts.push({ geo: new THREE.PlaneGeometry(0.98, 0.62), mat: JET_INNER, p: [3.41, 1.06, 0], r: [0, Math.PI / 2, 0] });                                                            // Einlauföffnung
    parts.push(P(jetLoft([[6.1, 0.03, 0.03, 0.02, 2.2, 2], [5.5, 0.34, 0.3, 0.02, 2.24, 2], [4.4, 0.44, 0.48, 0.02, 2.24, 2], [3.2, 0.4, 0.4, 0.02, 2.22, 2], [2.2, 0.2, 0.14, 0.02, 2.24, 2]].map(c => [c[0], c[1] * 1.15, c[2], c[3], c[4], c[5]])), glass));   // Kanzel
    wingPair({ z: 0.6, le: 4.6, te: 0.2, y: 1.72, t: 0.03 }, { z: 1.4, le: 0.9, te: 0.1, y: 1.72, t: 0.04 });          // Strake (Übergang vorn)
    wingPair({ z: 0.8, le: 1.3, te: -2.7, y: 1.68, t: 0.05 }, { z: 4.6, le: -1.6, te: -2.9, y: 1.68, t: 0.04 });         // Flügel
    wingPair({ z: 0.6, le: -4.4, te: -6.9, y: 1.62, t: 0.05 }, { z: 2.9, le: -6.1, te: -7.4, y: 1.52, t: 0.04 });        // Höhenleitwerk
    parts.push(P(jetFin(-3.4, -6.6, -5.9, -7.15, 2.7, 0.06, 0, 2.2, 0), wingM));                                          // Seitenleitwerk
    finPair(-4.2, -5.8, -4.9, -6.0, 0.7, 0.05, 0.45, 1.25, Math.PI + 0.45);                                                // Bauchflossen
    nozzle(-7.35, 1.8, 0, 0.55, 1.0); burnX = -7.9; burnY = 1.8; burnZ = [0];
    for (const s of [-1, 1]) { missile(-2.5, 1.62, s * 4.75, 2.6); missile(-1.6, 1.32, s * 3.2); }                        // Spitzen- und Flügelraketen
    parts.push(alongX(new THREE.CylinderGeometry(0.34, 0.34, 3.4, 16), wingM, -0.6, 0.85, 0), alongX(new THREE.ConeGeometry(0.34, 0.8, 16), wingM, 1.5, 0.85, 0));   // Zusatztank
    gear(5.0, 0, 1.0, 0.24, 0.16); for (const s of [-1, 1]) gear(-1.0, s * 1.15, 1.05, 0.36, 0.24);
  } else if (ti === 1) {   // ADLER: breiter Zweistrahler, kastenförmige Seiteneinläufe, zwei Seitenleitwerke
    parts.push(P(jetLoft([[9.4, 0.02, 0.02, 0.02, 1.9, 2], [8.6, 0.32, 0.3, 0.28, 1.88, 2], [7.4, 0.52, 0.5, 0.46, 1.86, 2.1], [5.8, 0.66, 0.62, 0.56, 1.84, 2.3], [4.2, 0.74, 0.66, 0.6, 1.84, 2.4],
      [2.6, 0.9, 0.64, 0.6, 1.82, 2.8], [0.6, 1.5, 0.6, 0.5, 1.8, 3.6], [-2.4, 1.6, 0.56, 0.5, 1.8, 3.8], [-5.0, 1.45, 0.52, 0.5, 1.82, 3.4], [-7.0, 1.3, 0.5, 0.48, 1.82, 3], [-7.6, 1.25, 0.48, 0.46, 1.82, 3]]), body));
    for (const s of [-1, 1]) { parts.push(P(jetLoft([[3.6, 0.4, 0.42, 0.42, 1.55, 3.6], [2.0, 0.46, 0.46, 0.44, 1.56, 3.4], [-1.0, 0.4, 0.42, 0.4, 1.6, 3]]).translate(0, 0, s * 1.15), body));   // Einläufe
      parts.push({ geo: new THREE.PlaneGeometry(0.76, 0.78), mat: JET_INNER, p: [3.61, 1.55, s * 1.15], r: [0, Math.PI / 2, 0] }); }
    parts.push(P(jetLoft([[6.9, 0.03, 0.03, 0.02, 2.26, 2], [6.2, 0.36, 0.34, 0.02, 2.3, 2], [4.9, 0.48, 0.55, 0.02, 2.3, 2], [3.4, 0.44, 0.44, 0.02, 2.3, 2], [2.4, 0.22, 0.16, 0.02, 2.3, 2]].map(c => [c[0], c[1] * 1.15, c[2], c[3], c[4], c[5]])), glass));
    wingPair({ z: 1.4, le: 1.8, te: -4.4, y: 1.82, t: 0.045 }, { z: 6.3, le: -3.4, te: -5.0, y: 1.82, t: 0.035 });
    wingPair({ z: 1.3, le: -5.4, te: -7.9, y: 1.68, t: 0.05 }, { z: 3.8, le: -7.4, te: -8.5, y: 1.68, t: 0.04 });
    finPair(-4.4, -7.6, -6.8, -8.2, 2.9, 0.055, 0.95, 2.2, 0.12);
    for (const z of [0.72, -0.72]) nozzle(-8.05, 1.8, z, 0.58, 1.1); burnX = -8.6; burnY = 1.8; burnZ = [0.72, -0.72];
    for (const s of [-1, 1]) { missile(-1.6, 1.4, s * 3.1); missile(-2.1, 1.45, s * 4.6); missile(0.8, 1.05, s * 0.9, 3.4); }
    gear(5.6, 0, 1.05, 0.3, 0.2); for (const s of [-1, 1]) gear(-1.6, s * 1.6, 1.05, 0.4, 0.28);
  } else if (ti === 2) {   // MILAN: Deltaflügel, Canards vorn, breiter Einlauf unten, großes Seitenleitwerk
    parts.push(P(jetLoft([[8.2, 0.02, 0.02, 0.02, 1.86, 2], [7.5, 0.26, 0.26, 0.24, 1.84, 2], [6.4, 0.46, 0.44, 0.42, 1.82, 2.1], [5.0, 0.6, 0.56, 0.54, 1.8, 2.3], [3.4, 0.7, 0.6, 0.6, 1.8, 2.5],
      [1.4, 0.82, 0.6, 0.66, 1.78, 2.8], [-1.4, 0.92, 0.6, 0.64, 1.78, 3.0], [-4.2, 0.88, 0.56, 0.6, 1.8, 2.8], [-6.2, 0.8, 0.5, 0.52, 1.82, 2.6], [-6.8, 0.78, 0.48, 0.5, 1.82, 2.6]]), body));
    parts.push(P(jetLoft([[3.0, 0.62, 0.18, 0.36, 1.12, 4.5], [1.8, 0.7, 0.26, 0.4, 1.14, 4], [-0.8, 0.66, 0.3, 0.36, 1.2, 3.4], [-3.0, 0.5, 0.3, 0.2, 1.32, 2.8]]), body));
    parts.push({ geo: new THREE.PlaneGeometry(1.2, 0.6), mat: JET_INNER, p: [3.01, 1.04, 0], r: [0, Math.PI / 2, 0] });
    parts.push(P(jetLoft([[5.9, 0.03, 0.03, 0.02, 2.2, 2], [5.3, 0.34, 0.3, 0.02, 2.24, 2], [4.2, 0.44, 0.46, 0.02, 2.24, 2], [2.9, 0.4, 0.38, 0.02, 2.22, 2], [2.0, 0.2, 0.12, 0.02, 2.24, 2]].map(c => [c[0], c[1] * 1.15, c[2], c[3], c[4], c[5]])), glass));
    wingPair({ z: 0.85, le: 1.2, te: -6.6, y: 1.62, t: 0.04 }, { z: 5.3, le: -5.5, te: -6.6, y: 1.62, t: 0.03 });   // Delta
    wingPair({ z: 0.6, le: 4.6, te: 3.2, y: 1.98, t: 0.05 }, { z: 2.1, le: 3.6, te: 3.0, y: 2.02, t: 0.04 });        // Canards
    parts.push(P(jetFin(-2.6, -6.6, -5.6, -6.9, 3.1, 0.06, 0, 2.25, 0), wingM));
    for (const z of [0.4, -0.4]) nozzle(-7.25, 1.82, z, 0.42, 0.95); burnX = -7.7; burnY = 1.82; burnZ = [0.4, -0.4];
    for (const s of [-1, 1]) { missile(-3.6, 1.32, s * 2.6); missile(-4.6, 1.38, s * 4.0, 2.5); missile(-2.8, 1.1, s * 1.1, 3.2); }
    gear(4.8, 0, 1.0, 0.26, 0.18); for (const s of [-1, 1]) gear(-2.4, s * 1.25, 1.05, 0.36, 0.24);
  } else {   // SCHATTEN: Tarnkappe – kantiger Rumpf mit Kanten (Chines), schräge Leitwerke, eckige Düsen, Waffen innen
    parts.push(P(jetLoft([[9.0, 0.03, 0.02, 0.02, 1.84, 4], [8.2, 0.42, 0.22, 0.2, 1.82, 5], [6.8, 0.8, 0.42, 0.34, 1.8, 6], [5.0, 1.05, 0.56, 0.42, 1.8, 6], [3.0, 1.35, 0.62, 0.5, 1.8, 7],
      [0.8, 1.9, 0.6, 0.5, 1.8, 8], [-2.6, 2.0, 0.56, 0.5, 1.8, 8], [-5.4, 1.7, 0.5, 0.46, 1.82, 7], [-7.3, 1.35, 0.42, 0.4, 1.82, 6], [-7.9, 1.25, 0.36, 0.34, 1.82, 6]], 40), body));
    for (const s of [-1, 1]) { parts.push(P(jetLoft([[3.2, 0.45, 0.4, 0.36, 1.6, 8], [1.4, 0.52, 0.42, 0.38, 1.62, 7], [-1.2, 0.46, 0.4, 0.36, 1.64, 6]]).translate(0, 0, s * 1.55), body));
      parts.push({ geo: new THREE.PlaneGeometry(0.85, 0.72), mat: JET_INNER, p: [3.22, 1.6, s * 1.55], r: [0, Math.PI / 2 + s * 0.35, 0] }); }
    parts.push(P(jetLoft([[6.7, 0.03, 0.03, 0.02, 2.2, 2], [6.0, 0.36, 0.32, 0.02, 2.24, 2], [4.6, 0.48, 0.5, 0.02, 2.25, 2], [3.2, 0.42, 0.4, 0.02, 2.24, 2], [2.4, 0.18, 0.1, 0.02, 2.25, 2]].map(c => [c[0], c[1] * 1.15, c[2], c[3], c[4], c[5]])), glass));
    wingPair({ z: 1.6, le: 1.0, te: -5.2, y: 1.78, t: 0.04 }, { z: 6.4, le: -3.7, te: -5.6, y: 1.78, t: 0.03 });
    wingPair({ z: 1.4, le: -5.8, te: -8.2, y: 1.72, t: 0.04 }, { z: 3.5, le: -7.3, te: -8.4, y: 1.72, t: 0.03 });
    finPair(-3.6, -6.6, -5.5, -7.3, 2.5, 0.05, 1.45, 2.15, 0.45);
    for (const z of [0.7, -0.7]) { parts.push(B(1.0, 0.42, 1.0, JET_NOZ, -8.3, 1.8, z), { geo: new THREE.PlaneGeometry(0.85, 0.3), mat: JET_FLAME, p: [-8.81, 1.8, z], r: [0, -Math.PI / 2, 0] }); }
    burnX = -8.8; burnY = 1.8; burnZ = [0.7, -0.7];
    gear(5.4, 0, 1.0, 0.28, 0.2); for (const s of [-1, 1]) gear(-1.8, s * 1.7, 1.05, 0.4, 0.28);
    for (const s of [-1, 1]) parts.push(B(4.2, 0.03, 0.9, D, -1.0, 1.28, s * 0.8));   // Waffenschacht-Klappen (geschlossen)
  }
  root.add(partsToGroup(parts, true));
  // Nachbrenner: Flammen hinter den Düsen (Länge = Schub)
  const burner = new THREE.Group(); burner.position.set(burnX, burnY, 0);
  for (const z of burnZ) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(ti === 3 ? 0.36 : 0.45, 3, 14, 1, true), JET_FLAME); f.rotation.z = Math.PI / 2; f.position.set(-1.5, 0, z); f.userData.noShadow = true; burner.add(f);
    const fi = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.6, 12, 1, true), JET_FLAME_IN); fi.rotation.z = Math.PI / 2; fi.position.set(-0.8, 0, z); fi.userData.noShadow = true; burner.add(fi);
  }
  burner.scale.set(0.2, 1, 1); root.add(burner);
  scene.add(root);
  const dummy = new THREE.Group();
  return { root, spinners: [], fronts: [], prop: dummy, burner, steer: dummy, stand: dummy, wf: dummy, wr: dummy, plane: true, jet: true, jetType: T.name };
}
// Folierung eines Autos tauschen (nur bei dir sichtbar)
function setCarPaint(v, mat) {
  const m = v.mesh; if (!m.car || !mat || m.paint === mat) return;
  const old = m.paint; m.root.traverse(o => { if (o.isMesh && o.material === old) o.material = mat; }); m.paint = mat;
}
function paintFor(type, liv) { return type === 'f1' ? F1_PAINTS[liv % 4] : type === 'race' ? RACE_PAINTS[liv % 4] : type === 'muscle' ? MUSCLE_PAINTS[liv % 4] : CAR_PAINTS[liv % CAR_PAINTS.length]; }
/* ---------- Drift-Look: bunte Folierung (Livery), Neon-Felgen, großer Heckflügel ----------
   Die Folierung wird von der Seite auf die Karosserie projiziert (braucht keine Textur-Koordinaten des Modells),
   auf Dach/Motorhaube bleibt die Grundfarbe. Auf beiden Seiten ist die Schrift lesbar. */
const LIV_BASE = [0x1f5fe0, 0x7b2ff7, 0x18191b, 0xf2f2f2, 0xff5a00, 0x0bb3a6, 0xd4145a, 0xffc300];
const LIV_RIM = [0x9dff00, 0xffe600, 0xff2e9a, 0x00e5ff, 0x9dff00, 0xff7a00, 0xffffff, 0x39ff14];
const LIV_WORDS = ['DRIFT', 'SIDEWAYS', 'KAMPFZONE', 'TURBO', 'NEON', 'SMOKE', 'ZONE 47', 'SLIDE'];
function liveryTex(i) {
  let s = 1234567 + i * 7919; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
  const hex = n => '#' + n.toString(16).padStart(6, '0'), base = LIV_BASE[i % LIV_BASE.length];
  g.fillStyle = hex(base); g.fillRect(0, 0, 1024, 256);
  const cols = ['#ff2e9a', '#ffe600', '#39ff14', '#00e5ff', '#8a2be2', '#ff7a00', '#ffffff', '#ff3b3b'].filter(x => x !== hex(base));
  // Schwünge und Streifen in Neonfarben (vorne stärker, nach hinten auslaufend)
  g.lineCap = 'round';
  for (let k = 0; k < 26; k++) {
    g.strokeStyle = cols[Math.floor(r() * cols.length)]; g.lineWidth = 6 + r() * 34; g.globalAlpha = 0.85;
    const x0 = r() * 1100 - 40, y0 = 40 + r() * 200, dx = 120 + r() * 380;
    g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(x0 + dx * 0.3, y0 - 90 + r() * 180, x0 + dx * 0.7, y0 - 90 + r() * 180, x0 + dx, y0 - 60 + r() * 120); g.stroke();
  }
  for (let k = 0; k < 60; k++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.globalAlpha = 0.9; g.beginPath(); g.arc(r() * 1024, 30 + r() * 220, 2 + r() * 9, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  // dunkler Schweller unten
  g.fillStyle = 'rgba(10,10,14,0.9)'; g.fillRect(0, 222, 1024, 34);
  // großer Schriftzug auf der Tür
  const word = LIV_WORDS[i % LIV_WORDS.length];
  g.font = 'italic 900 92px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 12; g.strokeStyle = '#111'; g.strokeText(word, 540, 150);
  g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillText(word, 540, 150);
  // Startnummer im Kreis
  g.fillStyle = '#fff'; g.beginPath(); g.arc(300, 112, 46, 0, 7); g.fill(); g.lineWidth = 6; g.strokeStyle = '#111'; g.stroke();
  g.fillStyle = '#111'; g.font = '900 54px Arial Black, sans-serif'; g.fillText(String(11 + i * 7 % 89), 300, 115);
  // kleine Aufkleber am Schweller
  const st = ['RACING', 'GRIP', 'BOOST', 'SPEED', 'TURBO', 'APEX', 'SLIDE'];
  g.font = 'bold 20px Arial, sans-serif';
  for (let k = 0; k < 6; k++) { const x = 230 + k * 110; g.fillStyle = k % 2 ? '#fff' : '#ffe600'; g.fillRect(x, 226, 96, 26); g.fillStyle = '#111'; g.fillText(st[(k + i) % st.length], x + 48, 240); }
  const t = new THREE.CanvasTexture(c); t.anisotropy = MAX_ANISO; t.wrapS = THREE.ClampToEdgeWrapping;
  return t;
}
// cfg: long/up = Achse + Maßstab, lat = Querachse + Höhen-Versatz
function liveryMat(tex, base, cfg) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 });
  const baseLin = new THREE.Color(base).convertSRGBToLinear();
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uLiv: { value: tex }, uBase: { value: baseLin }, uLong: { value: new THREE.Vector4(...cfg.long) }, uLat: { value: new THREE.Vector4(...cfg.lat) }, uUp: { value: new THREE.Vector4(...cfg.up) } });
    sh.vertexShader = 'varying vec3 vLivP;\nvarying vec3 vLivN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLivP = position; vLivN = normal;');
    sh.fragmentShader = 'uniform sampler2D uLiv;\nuniform vec3 uBase;\nuniform vec4 uLong;\nuniform vec4 uLat;\nuniform vec4 uUp;\nvarying vec3 vLivP;\nvarying vec3 vLivN;\n' +
      sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  {
    vec3 ln = normalize(vLivN);
    float sd = dot(ln, uLat.xyz) < 0.0 ? -1.0 : 1.0;
    vec2 luv = vec2(dot(vLivP, uLong.xyz) * uLong.w * sd + 0.5, dot(vLivP, uUp.xyz) * uUp.w + uLat.w);
    vec3 lc = pow(texture2D(uLiv, clamp(luv, 0.001, 0.999)).rgb, vec3(2.2));
    float top = max(smoothstep(0.5, 0.85, abs(dot(ln, uUp.xyz))), smoothstep(0.5, 0.85, abs(dot(ln, uLong.xyz))));   // Dach, Haube, Front und Heck: Grundfarbe
    diffuseColor.rgb *= mix(lc, uBase, top);
  }`);
  };
  m.customProgramCacheKey = () => 'livery1';
  return m;
}
const LIV_TEX = [], CAR_PAINTS = [], CAR_RIMS = [];
for (let i = 0; i < 8; i++) {
  LIV_TEX.push(liveryTex(i));
  CAR_PAINTS.push(liveryMat(LIV_TEX[i], LIV_BASE[i], { long: [1, 0, 0, 1 / 4.7], lat: [0, 0, 1, -0.26], up: [0, 1, 0, 1.3] }));   // einfaches Auto
  CAR_RIMS.push(new THREE.MeshStandardMaterial({ color: LIV_RIM[i], roughness: 0.3, metalness: 0.45, emissive: LIV_RIM[i], emissiveIntensity: 0.08 }));
}
// Großer GT-Heckflügel (Auto-Koordinaten: vorne = +x), für beide Detailstufen; big = Rennwagen (höher, breiter)
function makeWing(paint, big) {
  const y = big ? 1.52 : 1.36, w = big ? 1.95 : 1.8;
  const parts = [B(big ? 0.56 : 0.48, 0.045, w, CARBON, -2.1, y, 0, 0, 0, 0.14), B(0.16, 0.035, w, paint, -2.33, y + 0.03, 0, 0, 0, 0.5)];
  for (const s of [-1, 1]) parts.push(B(0.1, y - 0.96, 0.05, CARBON, -2.03, 0.96 + (y - 0.96) / 2 - 0.02, s * 0.45, 0, 0, -0.25), B(0.6, 0.3, 0.03, CARBON, -2.13, y - 0.02, s * (w / 2 + 0.015)));
  return partsToGroup(parts, true);
}
/* ---------- Autotypen: Drift-Auto, Rennwagen, Muscle-Car (eigene Fahrphysik + Aussehen) ---------- */
// Rennwagen-Folierung: Grundfarbe, breiter Rennstreifen, Startnummer, Sponsoren
function raceTex(i) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
  const base = ['#f4f4f4', '#d81e2c', '#0f3d91', '#ffd21f'][i % 4], stripe = ['#d81e2c', '#ffffff', '#ffd21f', '#111111'][i % 4];
  g.fillStyle = base; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = stripe; g.fillRect(0, 96, 1024, 46); g.fillStyle = '#111'; g.fillRect(0, 142, 1024, 8);
  g.fillStyle = 'rgba(10,10,14,0.92)'; g.fillRect(0, 222, 1024, 34);
  g.fillStyle = '#fff'; g.fillRect(470, 60, 150, 120); g.lineWidth = 8; g.strokeStyle = '#111'; g.strokeRect(470, 60, 150, 120);
  g.fillStyle = '#111'; g.font = '900 96px Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String([7, 23, 44, 91][i % 4]), 545, 124);
  g.font = 'italic 900 40px Impact, Arial Black, sans-serif';
  for (const [t, x] of [['GRIP', 250], ['APEX', 790], ['RACING', 380]]) { g.fillStyle = stripe === '#ffffff' ? '#111' : '#fff'; g.fillText(t, x, x === 380 ? 200 : 120); }
  const t = new THREE.CanvasTexture(c); t.anisotropy = MAX_ANISO; t.wrapS = THREE.ClampToEdgeWrapping; return t;
}
// Muscle-Car: dunkle Farbe mit Flammen hinter den Vorderrädern
function muscleTex(i) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = ['#151515', '#7a0e12', '#1f4a2a', '#d06a12'][i % 4]; g.fillRect(0, 0, 1024, 256);
  const fl = g.createLinearGradient(1024, 0, 300, 0); fl.addColorStop(0, '#ffe24a'); fl.addColorStop(0.5, '#ff7a00'); fl.addColorStop(1, '#c4120c');
  g.fillStyle = fl;
  for (let k = 0; k < 7; k++) { const y = 110 + k * 14; g.beginPath(); g.moveTo(1030, y - 10); g.bezierCurveTo(800, y - 40, 650, y + 30, 360 + k * 30 + (k % 2) * 60, y - 20 + (k % 3) * 12); g.bezierCurveTo(620, y + 10, 820, y + 30, 1030, y + 18); g.fill(); }
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 214, 1024, 6); g.fillStyle = 'rgba(10,10,14,0.92)'; g.fillRect(0, 222, 1024, 34);
  const t = new THREE.CanvasTexture(c); t.anisotropy = MAX_ANISO; t.wrapS = THREE.ClampToEdgeWrapping; return t;
}
const LIV_CFG = { long: [1, 0, 0, 1 / 4.7], lat: [0, 0, 1, -0.26], up: [0, 1, 0, 1.3] };
const RACE_PAINTS = [0, 1, 2, 3].map(i => liveryMat(raceTex(i), [0xf4f4f4, 0xd81e2c, 0x0f3d91, 0xffd21f][i], LIV_CFG));
const MUSCLE_PAINTS = [0, 1, 2, 3].map(i => liveryMat(muscleTex(i), [0x151515, 0x7a0e12, 0x1f4a2a, 0xd06a12][i], LIV_CFG));
const SILVER_RIM = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.25, metalness: 0.9 });
/* ---------- Formel 1: offener Monoposto (vorne = +x, ~6 m lang), Frontflügel, Halo, großer Heckflügel ---------- */
const F1_BASE = [0xc8102e, 0x1a2a6c, 0xff8000, 0x00a19c], F1_ACC = ['#ffd21f', '#e8002d', '#1b1b1b', '#c8ccd2'];
function f1Tex(i) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d'), base = '#' + F1_BASE[i].toString(16).padStart(6, '0');
  g.fillStyle = base; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = F1_ACC[i]; g.beginPath(); g.moveTo(0, 150); g.lineTo(1024, 90); g.lineTo(1024, 130); g.lineTo(0, 200); g.fill();
  g.fillStyle = 'rgba(10,10,14,0.9)'; g.fillRect(0, 210, 1024, 46);
  g.fillStyle = '#fff'; g.font = 'italic 900 110px Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = '#111'; const nr = String([16, 4, 81, 1][i]); g.strokeText(nr, 420, 110); g.fillText(nr, 420, 110);
  g.font = 'italic 900 42px Impact, Arial Black, sans-serif'; g.fillStyle = F1_ACC[i] === '#1b1b1b' ? '#fff' : F1_ACC[i]; g.fillText('KAMPFZONE GP', 690, 175);
  const t = new THREE.CanvasTexture(c); t.anisotropy = MAX_ANISO; t.wrapS = THREE.ClampToEdgeWrapping; return t;
}
const F1_PAINTS = [0, 1, 2, 3].map(i => liveryMat(f1Tex(i), F1_BASE[i], { long: [1, 0, 0, 1 / 5.6], lat: [0, 0, 1, -0.1], up: [0, 1, 0, 1.6] }));
const F1_HELMET = new THREE.MeshStandardMaterial({ color: 0xffd21f, roughness: 0.3, metalness: 0.2 });
function makeF1(paint) {
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const R = CAR_WHEEL_R, body = [
    B(4.3, 0.05, 1.45, CARBON, -0.15, 0.07, 0),                                   // Unterboden
    B(1.5, 0.15, 0.3, paint, 2.3, 0.3, 0, 0, 0, -0.07), B(0.25, 0.1, 0.22, paint, 3.05, 0.22, 0),   // Nase
    B(0.42, 0.035, 1.95, paint, 3.08, 0.11, 0), B(0.3, 0.03, 1.9, CARBON, 2.96, 0.19, 0, 0, 0, 0.3),  // Frontflügel
    B(1.55, 0.42, 0.74, paint, 0.85, 0.42, 0),                                    // Cockpit
    B(1.8, 0.5, 0.5, paint, -0.95, 0.55, 0), B(1.25, 0.3, 0.03, paint, -1.45, 0.88, 0),           // Motorabdeckung, Finne
    B(0.5, 0.36, 0.3, paint, -0.05, 0.92, 0), B(0.06, 0.2, 0.2, CAR_BLACK, 0.21, 0.98, 0),        // Airbox
    B(0.34, 0.035, 1.0, paint, -2.35, 0.95, 0, 0, 0, 0.16), B(0.24, 0.03, 1.0, CARBON, -2.45, 1.07, 0, 0, 0, 0.45),   // Heckflügel
    B(0.1, 0.42, 0.05, CARBON, -2.22, 0.62, 0), B(0.5, 0.2, 1.1, CARBON, -2.3, 0.17, 0),          // Pylon, Diffusor
    B(0.03, 0.08, 0.12, TAILLIGHT, -2.62, 0.36, 0),
    B(0.07, 0.24, 0.06, CARBON, 1.08, 0.76, 0, 0, 0, 0.35),                       // Halo-Mittelstrebe
    { geo: new THREE.SphereGeometry(0.15, 14, 10), mat: F1_HELMET, p: [0.5, 0.84, 0], r: [0, 0, 0] },
    B(0.05, 0.05, 0.22, CAR_BLACK, 0.62, 0.86, 0),                                // Visier
  ];
  for (const s of [-1, 1]) body.push(
    B(0.55, 0.24, 0.03, CARBON, 3.0, 0.18, s * 0.97),                            // Frontflügel-Endplatten
    B(1.6, 0.4, 0.44, paint, -0.3, 0.36, s * 0.56), B(0.04, 0.28, 0.34, CAR_BLACK, 0.52, 0.38, s * 0.56),   // Seitenkästen + Kühler-Einlass
    B(0.6, 0.48, 0.03, CARBON, -2.35, 0.86, s * 0.51),                            // Heckflügel-Endplatten
    B(0.62, 0.04, 0.04, CARBON, 0.74, 0.9, s * 0.22, 0, s * 0.42, 0),             // Halo-Bügel
    B(0.05, 0.03, 0.72, CARBON, 1.92, 0.42, s * 0.42, 0.12 * s, 0, 0), B(0.05, 0.03, 0.72, CARBON, 1.78, 0.3, s * 0.42, -0.08 * s, 0, 0),   // Querlenker vorne
    B(0.05, 0.03, 0.62, CARBON, -1.78, 0.42, s * 0.5, 0.12 * s, 0, 0), B(0.05, 0.03, 0.62, CARBON, -1.7, 0.3, s * 0.5, -0.08 * s, 0, 0));  // hinten
  const bodyG = partsToGroup(body, true); root.add(bodyG);
  const spinners = [], fronts = [];
  for (const [wx, wd] of [[1.85, 0.36], [-1.75, 0.45]]) for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(wx, R, s * 0.84); root.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    spin.add(partsToGroup([
      { geo: new THREE.CylinderGeometry(R, R, wd, 24), mat: TIRE, p: [0, 0, 0], r: [Math.PI / 2, 0, 0] },
      { geo: new THREE.CylinderGeometry(R * 0.66, R * 0.66, wd + 0.01, 20), mat: CAR_BLACK, p: [0, 0, 0], r: [Math.PI / 2, 0, 0] },
      { geo: new THREE.CylinderGeometry(R * 0.82, R * 0.82, wd + 0.006, 24, 1, true), mat: F1_HELMET, p: [0, 0, 0], r: [Math.PI / 2, 0, 0] },   // farbiger Reifenstreifen
      B(0.5, 0.05, 0.02, CAR_BLACK, 0, 0, s * (wd / 2 + 0.01)),
    ], true));
    spinners.push(spin); if (wx > 0) fronts.push(pivot);
  }
  scene.add(root);
  const dummy = new THREE.Group();
  return { root, spinners, fronts, steer: dummy, stand: dummy, wf: dummy, wr: dummy, car: true, f1: true, paint, rim: CAR_BLACK, bodyG, wing: null, baseY: 0 };
}
const CAR_TYPES = {
  drift: { name: 'Drift-Auto', info: 'Heck bricht leicht aus, großer Lenkeinschlag', p: {} },
  race: { name: 'Rennwagen', info: 'viel Grip und Tempo, starke Bremsen – schwer zu driften',
    p: { m: 1150, Iz: 1950, muF: 1.32, muR: 1.45, BF: 9, BR: 11.5, P: 265000, Fmax: 9300, drag: 0.92, brake: 1.35, maxSteer: 0.5, h: 0.42, tc: 0.75 } },
  muscle: { name: 'Muscle-Car', info: 'viel Kraft, Burnouts – bei Vollgas kommt das Heck',
    p: { m: 1600, Iz: 2950, muF: 0.98, muR: 1.06, P: 290000, Fmax: 10800, drag: 1.25, brake: 0.95, maxSteer: 0.58, steerFade: 9, h: 0.55 } },
  f1: { name: PORTAL ? 'Grand-Prix-Renner' : 'Formel 1', info: 'über 330 km/h, Abtrieb und enormer Grip – sehr enge Kurven möglich',
    // enge Kurven: viel Lenkeinschlag, der erst bei sehr hohem Tempo abnimmt (fadePow 2), sehr griffige Reifen, Bremskraft vor allem vorne
    p: { m: 800, a: 1.8, b: 1.8, h: 0.25, Iz: 1050, muF: 3.3, muR: 3.9, BF: 13, BR: 16, P: 640000, Fmax: 10500, drag: 0.8, roll: 120, brake: 2.6, brakeRear: 0.12,
      maxSteer: 0.62, steerFade: 40, fadePow: 2, tc: 0.8, rev: 96, mw: 40, aero: 2.4 } },
};
// Tuning (im Browser gespeichert, pro Autotyp): Motor, Reifen, Fahrwerk, Lenkeinschlag, Bremse, Folierung
const TIRES = [{ n: 'Drift-Reifen', muR: 0.86, muF: 0.97, price: 300 }, { n: 'Serienreifen', muR: 1, muF: 1, price: 0 }, { n: 'Sportreifen', muR: 1.1, muF: 1.07, price: 500 }, { n: 'Rennreifen (Slicks)', muR: 1.22, muF: 1.16, price: 1200 }];
const TUNE_COST = { eng: [400, 900, 1800], susp: [300, 700], steer: [250, 600], brake: [250, 600] };
let TUNE = {};
try { TUNE = JSON.parse(localStorage.getItem('kz_tune') || '{}'); } catch (e) {}
const TUNE_DEF = { eng: 0, susp: 0, steer: 0, brake: 0, tire: 1, tires: [1], liv: -1, rim: -1, neon: -1, neonOwn: false, wing: true, nitro: false };
// immer dasselbe Objekt pro Autotyp (fehlende Werte werden ergänzt)
const tuneOf = t => { const o = TUNE[t] || (TUNE[t] = {}); for (const k in TUNE_DEF) if (o[k] === undefined) o[k] = Array.isArray(TUNE_DEF[k]) ? TUNE_DEF[k].slice() : TUNE_DEF[k]; return o; };
const saveTune = () => { try { localStorage.setItem('kz_tune', JSON.stringify(TUNE)); } catch (e) {} };
function carParams(type) {
  const T = tuneOf(type), K = Object.assign({}, CARP, (CAR_TYPES[type] || CAR_TYPES.drift).p), tr = TIRES[T.tire] || TIRES[1];
  K.P *= 1 + 0.13 * T.eng; K.Fmax *= 1 + 0.1 * T.eng; K.rev *= 1 + 0.06 * T.eng;   // Motor: mehr Leistung und höhere Drehzahl
  K.muR *= tr.muR; K.muF *= tr.muF;
  K.h -= 0.05 * T.susp; K.Iz *= 1 - 0.05 * T.susp;
  K.maxSteer += 0.09 * T.steer;
  K.brake *= 1 + 0.18 * T.brake; K.absD = 1.3 * T.brake;   // Bremsen-Tuning: stärkere Beläge + ABS (zusätzliche Verzögerung)
  return K;
}

/* ---------- Zustand ---------- */
// Für alle Spieler gleich (Abstellplätze aus der Karte); Host verteilt Position/Fahrer per Snapshot
const vehicles = MAP_VEHICLES.map((v, i) => {
  const kind = v.kind || 'moped';
  // Autotyp: an Drift-Strecken Drift-Autos, sonst abwechselnd Drift / Rennwagen / Muscle-Car (für alle Spieler gleich)
  const ctype = kind === 'car' ? (v.ctype || ['drift', 'race', 'muscle'][i % 3]) : kind === 'plane' || kind === 'tank' ? (v.ctype || null) : null;
  const m = kind === 'tank' ? (ctype === 'gustav' ? makeGustav(v) : makeTank()) : kind === 'heli' ? makeHeli() : kind === 'plane' ? (ctype === 'jet' ? makeJet(i, v.jt) : makePlane(i)) : kind !== 'car' ? makeMoped(MOPED_PAINTS[i % MOPED_PAINTS.length])
    : ctype === 'f1' ? makeF1(F1_PAINTS[i % 4])
    : ctype === 'race' ? makeCar(RACE_PAINTS[i % 4], SILVER_RIM, 'race')
    : ctype === 'muscle' ? makeCar(MUSCLE_PAINTS[i % 4], CAR_BLACK, 'muscle')
    : makeCar(CAR_PAINTS[(i + 5) % CAR_PAINTS.length], CAR_RIMS[(i + 5) % CAR_RIMS.length], 'drift');
  return { i, kind, ctype, x: v.x, y: v.y || 0, z: v.z, yaw: v.yaw, lean: 0, d: 0, mesh: m, spin: 0, rx: v.x, rz: v.z, ry: 0 };
});
// Echtes 3D-Modell (Ferrari aus den three.js-Beispielen, wie in Drift-Welt) – ersetzt die einfachen Autos, sobald es geladen ist
(function loadFerrari() {
  if (true) return;   // ersetzt durch die eigene Skyline-Form (makeCar)
  if (!vehicles.some(v => v.kind === 'car') || !THREE.GLTFLoader || !THREE.DRACOLoader) return;
  const BASE = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/models/gltf/';
  const draco = new THREE.DRACOLoader(); draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/gltf/');
  const loader = new THREE.GLTFLoader(); loader.setDRACOLoader(draco);
  loader.load(BASE + 'ferrari.glb', g => {
    const src = g.scene.children[0];
    const detail = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.35 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x141c25, metalness: 0.3, roughness: 0.02, transparent: true, opacity: 0.88 });
    // Innenraum (Sitze, Leder, Lenkrad, Armaturen) weglassen: ~120.000 Dreiecke, hinter getönten Scheiben kaum zu sehen
    const inner = o => /interior|leather|steering|seat|dash|brake/i.test((o.name || '') + ' ' + ((o.material && o.material.name) || ''));
    const drop = []; src.traverse(o => { if (o.isMesh && inner(o)) drop.push(o); });
    for (const o of drop) o.parent.remove(o);
    let ao = null;
    new THREE.TextureLoader().load(BASE + 'ferrari_ao.png', t => {
      ao = new THREE.MeshBasicMaterial({ map: t, blending: THREE.MultiplyBlending, toneMapped: false, transparent: true, depthWrite: false });
      for (const v of vehicles) if (v.mesh.gltf && !v.mesh.aoAdded) addAO(v.mesh);
    });
    const addAO = m => { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4), ao); p.rotation.x = -Math.PI / 2; p.position.y = 0.05; p.renderOrder = 2; m.model.add(p); m.aoAdded = true; };
    for (const v of vehicles) {
      if (v.kind !== 'car') continue;
      const m = v.mesh, model = src.clone(true);
      const set = (n, mat) => { const o = model.getObjectByName(n); if (o) o.material = mat; };
      const li = (v.i + 5) % LIV_TEX.length;   // gleiche Folierung wie beim einfachen Modell (Auto an der Drift-Arena-Startlinie = blau)
      set('body', liveryMat(LIV_TEX[li], LIV_BASE[li], { long: [1, 0, 0, 1 / 4.7], lat: [0, 1, 0, 0.5], up: [0, 0, 1, 1 / 1.1] })); set('glass', glass);
      for (const n of ['rim_fl', 'rim_fr', 'rim_rr', 'rim_rl']) set(n, CAR_RIMS[li]);
      set('trim', detail);
      const wheels = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map(n => model.getObjectByName(n));
      if (wheels.some(w => !w)) return;
      wheels.forEach(w => w.rotation.order = 'YXZ');
      model.traverse(o => { if (o.isMesh) { o.castShadow = false; o.userData.noShadow = true; } });   // Schatten kommt aus dem AO-Bild
      const holder = new THREE.Group(); holder.rotation.y = -Math.PI / 2; holder.add(model);   // Modell schaut nach -z, bei uns ist vorne +x
      // Detailstufen: einfaches Auto (weit weg) ↔ Ferrari (eigenes Auto + die 2 nächsten)
      m.lo = m.root.children.filter(c => !c.userData.isWing); holder.visible = false; m.root.add(holder); m.hi = holder;
      m.gltf = true; m.model = model; m.wheels = wheels; m.frontW = [wheels[0], wheels[1]]; m.shadow = undefined;
      if (ao) addAO(m);
    }
  }, undefined, () => {});
})();
// Fahrzeuge, die unsichtbar (weit weg) sind oder stillstehen, werden bei der Lage-Berechnung übersprungen (spart viel Rechenzeit)
{ const UMW = THREE.Object3D.prototype.updateMatrixWorld;
  for (const v of vehicles) v.mesh.root.updateMatrixWorld = function (force) {
    if (!this.visible) return;
    if (!force && (this.userData.still || 0) > 2) return;
    UMW.call(this, force);
  }; }
const RIDER_BACK = 0.42, RIDER_UP = 0.1;   // Sitzposition des Fahrers relativ zum Moped
const RIDE_GRAV = 15;   // etwas weniger Schwerkraft fürs Moped = schönere Sprünge
// Fahrzeug-Eigenschaften: Sitz, Größe, Tempo, Lenkung, Kamera, Ein-/Ausstieg
const VK = {
  moped: { name: 'Moped', back: RIDER_BACK, up: RIDER_UP, r: PR, h: 1.3, max: 16.8, acc: 6.5, top: 18, brake: 14, rev: -3.5, coast: 1.6, steer: 2.1, steerHi: 14,
    camD: 4.2, camH: 1.55, eyeUp: 1.5, eyeF: 0.08, eyeSide: 0, exitSide: 1.1, exitBack: 1.5, enter: 3.0, farDraw: 70 },
  car: { name: 'Auto', back: 0.1, up: 0, r: 1.25, h: 1.4, max: 32, acc: 8.5, top: 35, brake: 22, rev: -7, coast: 2.6, steer: 1.6, steerHi: 34,
    camD: 7.2, camH: 2.4, eyeUp: 1.08, eyeF: -0.15, eyeSide: -0.38, exitSide: 2.0, exitBack: 3.3, enter: 3.8, farDraw: 140 },
  tank: { name: 'Panzer', back: 0.3, up: 0, r: 1.9, h: 2.6, max: 11, acc: 3.6, top: 11.5, brake: 9, rev: -4.5, coast: 4, steer: 0.85, steerHi: 999,
    camD: 11, camH: 4.6, eyeUp: 2.6, eyeF: 0, eyeSide: 0, exitSide: 2.9, exitBack: 4.6, enter: 4.6, farDraw: 260 },
  heli: { name: 'Helikopter', back: 0, up: 0.6, r: 1.7, h: 2.9, max: 45, acc: 16, top: 45, brake: 10, rev: -10, coast: 3, steer: 1.3, steerHi: 999,
    camD: 13, camH: 3.4, eyeUp: 2, eyeF: 0, eyeSide: 0, exitSide: 2.6, exitBack: 5, enter: 4.8, farDraw: 400 },
  plane: { name: 'Flugzeug', back: 0, up: 0.8, r: 1.6, h: 2.6, max: 62, acc: 0, top: 62, brake: 6, rev: 0, coast: 0, steer: 0.6, steerHi: 999,
    camD: 14, camH: 3.6, eyeUp: 2, eyeF: 0, eyeSide: 0, exitSide: 3.2, exitBack: 4, enter: 5, farDraw: 450 },
};
const ride = { v: -1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, speed: 0, lean: 0, onGround: true, h: 1.3, lastMouse: 0 };
let myRider = null;

// Gerade abgestiegen: dieses Moped gilt kurz als frei, auch wenn ein älteres Netzwerk-Update noch „besetzt“ meldet
const rideLeft = { v: -1, t: 0 };
const freeForMe = v => !v.d || v.d === myId && ride.v !== v.i || (rideLeft.v === v.i && performance.now() - rideLeft.t < 1500);
function nearestFreeVehicle() {
  let best = -1, bd = 1e9;
  for (const v of vehicles) {
    if (!freeForMe(v) || v.wreck) continue;
    const d = Math.hypot(v.x - me.pos.x, v.z - me.pos.z);
    if (d < (v.ctype === 'gustav' ? 13 : VK[v.kind].enter) && d < bd && Math.abs(v.y - me.pos.y) < 2.2) { bd = d; best = v.i; }
  }
  return best;
}
// E: auf-/absteigen
let enterPending = 0;
function toggleRide() {
  if (!me.alive) return;
  if (ride.v >= 0) return exitRide();
  if (performance.now() - enterPending < 400) return;   // Anfrage läuft noch
  const i = nearestFreeVehicle();
  if (i < 0) {
    // Moped in der Nähe, aber besetzt?
    const busy = vehicles.find(v => v.d && v.d !== myId && Math.hypot(v.x - me.pos.x, v.z - me.pos.z) < VK[v.kind].enter); if (busy) showMsg('Dieses Fahrzeug ist besetzt');
    return;
  }
  const t0 = enterPending = performance.now();
  net.send({ t: 'enter', v: i, p: [+me.pos.x.toFixed(2), +me.pos.y.toFixed(2), +me.pos.z.toFixed(2)] });
  // Keine Antwort vom Host (z. B. alte Spielversion beim Host)
  setTimeout(() => { if (enterPending === t0 && ride.v < 0) { enterPending = 0; showMsg('Keine Antwort vom Host – alle Spieler bitte neu laden (F5)'); } }, 1500);
}
// Antwort vom Host, wenn das Aufsteigen nicht geklappt hat
function enterFailed(reason) {
  enterPending = 0;
  showMsg(reason === 'busy' ? 'Das ist schon besetzt' : reason === 'wreck' ? '💥 Das Fahrzeug ist zerstört' : 'Zu weit weg – näher rangehen');
}
/* ---------- Fahrzeuge zerstören: Raketen (Raketenwerfer, Panzer, Heli) sprengen Fahrzeuge ----------
   Panzer halten 3 Treffer aus, alles andere explodiert beim ersten. Wer drinsitzt, stirbt. Das Wrack brennt,
   nach 30 s steht ein neues Fahrzeug am Startplatz. Der Host entscheidet (net.js), alle sehen dasselbe. */
const VEH_HP = { tank: 3, heli: 1, plane: 1, car: 1, moped: 1 }, WRECK_TIME = 30000;
const VEH_HIT = { moped: { r: 1.1, h: 0.8 }, car: { r: 2.1, h: 0.8 }, tank: { r: 2.9, h: 1.3 }, heli: { r: 3.0, h: 1.8 }, plane: { r: 3.6, h: 1.4 } };   // Trefferkugel: Radius, Höhe der Mitte
const WRECK_MAT = new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: 0.95, metalness: 0.25 });
function setWreck(v, on) {
  if (!!v.wreck === on) return;
  v.wreck = on;
  v.mesh.root.traverse(o => {
    if (!o.isMesh) return;
    if (o === v.mesh.neon) { if (on) { o.userData.vis0 = o.visible; o.visible = false; } else o.visible = !!o.userData.vis0; return; }
    if (on) { if (!o.userData.mat0) o.userData.mat0 = o.material; o.material = WRECK_MAT; }   // verkohlt
    else if (o.userData.mat0) { o.material = o.userData.mat0; delete o.userData.mat0; }
  });
  v.mesh.root.userData.still = 0;
}
// Freier Platz für einen neuen Heli nahe der Absturzstelle: kein Haus, keine Mauer, kein Baum im Rotorkreis.
// Sucht in Ringen nach außen (bis 40 m); nichts frei → null (dann am alten Landeplatz)
function heliFreeSpot(x, z) {
  const R = 3.6;
  const free = (px, pz) => {
    if (px < -430 || px > 1750 || pz < -430 || pz > WELT_ZS - 10) return false;   // innerhalb der Karte
    const gh = groundH(px, pz);
    for (const b of nearBoxes(px, pz, R + 1)) if (b.max.x > px - R && b.min.x < px + R && b.max.z > pz - R && b.min.z < pz + R && b.max.y > gh + 0.3 && b.min.y < gh + 4) return false;
    return true;
  };
  for (let r = 0; r <= 40; r += 4) {
    const n = r ? Math.ceil(r * 1.6) : 1;
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (free(px, pz)) return [px, pz]; }
  }
  return null;
}
function vehicleBoomFx(o) {
  const p = new THREE.Vector3(o[0], o[1] + 1, o[2]);
  for (let k = 0; k < 3; k++) setTimeout(() => explosionFx(p.clone().add(new THREE.Vector3(rnd(-1.5, 1.5), rnd(0, 1.5), rnd(-1.5, 1.5)))), k * 150);
  for (let k = 0; k < 10; k++) puff(p.clone(), 0x222222, rnd(0.25, 0.45), rnd(0.8, 1.4), new THREE.Vector3(rnd(-7, 7), rnd(4, 10), rnd(-7, 7)), { opacity: 0.9, grow: 1.2 });   // Trümmer
  sndBoom(p); setTimeout(() => sndBoom(p), 160);
  me.shake = Math.max(me.shake, Math.max(0, 1.3 - p.distanceTo(me.pos) / 30));
}
// Rakete fliegt in ein Fahrzeug? → Abstand bis zum Einschlag (oder null). skip = Fahrzeug des Schützen
function rocketVehicleHit(p, dir, maxD, skip) {
  let best = null;
  for (const v of vehicles) {
    if (v.i === skip || v.wreck || !v.mesh.root.visible) continue;
    const H = VEH_HIT[v.kind] || VEH_HIT.car, c = v.mesh.root.position, R = H.r;
    const ox = c.x - p.x, oy = c.y + H.h - p.y, oz = c.z - p.z, t = ox * dir.x + oy * dir.y + oz * dir.z;
    if (t < -R || t > maxD + R) continue;
    const d2 = ox * ox + oy * oy + oz * oz - t * t; if (d2 > R * R) continue;
    const th = Math.max(0, t - Math.sqrt(R * R - d2));
    if (th <= maxD && (best === null || th < best)) { best = th; lastVehHit = v.i; }
  }
  return best;
}
function startRide(i) {
  const v = vehicles[i]; if (!v || ride.v === i || !me.alive) return;
  enterPending = 0; rideLeft.v = -1;
  ride.v = i; ride.pos.set(v.x, v.y, v.z); ride.vel.set(0, 0, 0); ride.yaw = v.yaw; ride.speed = 0; ride.lean = 0; ride.fp = 0;
  ride.wh = 0; ride.whT = 0; ride.whV = 0;
  ride.kind = v.kind; const K = VK[v.kind]; ride.h = K.h; ride.r = K.r; ride.runT = {};
  ride.cvx = 0; ride.cvz = 0; ride.yawRate = 0; ride.steerS = 0; ride.slip = 0; ride.ax = 0; ride.wspin = 0; ride.wR = 0; ride.gasS = 0; DRIFT.pts = 0; DRIFT.time = 0; lastSkid = null;
  me.scoped = false; me.trigger = false; me.sprintTap = false; me.rideAimT = -9;
  me.yaw = ride.yaw - Math.PI / 2; me.pitch = -0.15;
  if (!myRider) { const mp = world.players[myId] || {}; myRider = makeAvatar({ id: '__me', name: '', color: mp.color || '#ffcc33', team: mp.team, w: me.weapon }); myRider.label.visible = false; myRider.parts.forEach(p => p.userData = {}); }
  myRider.g.visible = v.kind === 'moped'; setAvatarGun(myRider, me.weapon);
  ride.turret = 0; ride.barrelP = 0; ride.tankShot = -9;
  engineSound(true);
  if (v.kind === 'car') {
    ride.ctype = v.ctype || 'drift'; ride.carK = carParams(ride.ctype);
    applyLook(v, ride.ctype); ride.nitroT = 0; ride.nitroCd = 0;
    const ct = CAR_TYPES[ride.ctype];
    showMsg(TOUCH ? ct.name : `${ct.name}: ${ct.info}  ·  ${kbK('tune')} = Tuning`);   // Handy: kurz halten
  } else if (v.kind === 'tank' && v.ctype === 'gustav') { ride.ctype = 'gustav'; ride.turret = 0; ride.barrelP = 0.35; showMsg(TOUCH ? 'SCHWERER GUSTAV!  Zielen = Rohr · FEUER = Riesengranate' : 'SCHWERER GUSTAV!  Maus = Rohr richten · Linksklick = Riesengranate (Bogenschuss) · W/S fahren · A/D lenken = neue Schienen legen · E aussteigen'); }
  else if (v.kind === 'tank') showMsg('PANZER!  Maus = Turm · Linksklick = Kanone · W/S fahren · A/D drehen · E aussteigen');
  else if (v.kind === 'plane' && v.ctype === 'jet') { ride.ctype = 'jet'; ride.thrl = 0; ride.pitch = 0; ride.planeV = 0; ride.q = null; ride.air = false; ride.camQ = null; ride.gunAmmo = JET_AMMO; ride.gunReload = 0; ride.msl = JET_MSL; ride.mslReload = 0; ride.lock = -1; ride.gunHits = {}; showMsg(TOUCH ? 'KAMPFJET!  ▲ Gas (voll = Nachbrenner) · ▲ZIEHEN ab ~170 km/h · FEUER = Kanone · ZOOM = Rakete' : `KAMPFJET!  ${kbK('forward')} Schub (Vollgas = Nachbrenner) · ab ~170 km/h ${kbK('jump')} = hochziehen · Linksklick Kanone · Rechtsklick Lenkrakete`); }
  else if (v.kind === 'plane') { ride.ctype = 'plane'; ride.thrl = 0; ride.pitch = 0; ride.planeV = 0; ride.bombs = PLANE_BOMBS; ride.bombReload = 0; ride.rkts = PLANE_RKTS; ride.rktReload = 0; ride.bombHeld = false; showMsg(TOUCH ? 'FLUGZEUG!  ▲ Gas · ▲ZIEHEN ab ~90 km/h = abheben · ◀ ▶ Kurven' : `FLUGZEUG!  ${kbK('forward')} Gas · ab ~90 km/h ${kbK('jump')} = hochziehen · ${kbK('crouch')} = Nase runter · ${kbK('left')}/${kbK('right')} Kurven`); }
  else if (v.kind === 'heli') { ride.heliAmmo = HELI_AMMO; ride.heliReload = 0; ride.pitch = 0; showMsg('HELIKOPTER!  Leertaste = steigen · C = sinken · W/S vor/zurück · A/D drehen · Linksklick = Raketen'); }
  else showMsg(TOUCH ? 'Moped – WHEELIE antippen!' : 'Aufgestiegen!  W Gas · S Bremse · A/D lenken · Leertaste Wheelie (antippen!) · E absteigen');
}
function exitRide(silent) {
  if (ride.v < 0) return;
  const v = vehicles[ride.v];
  // neben dem Moped absteigen: links, sonst rechts, hinten, vorne – nie in eine Wand oder Schanze
  const fx = Math.cos(ride.yaw), fz = -Math.sin(ride.yaw), sx = Math.sin(ride.yaw), sz = Math.cos(ride.yaw), K = VK[v.kind], S = K.exitSide, Bk = K.exitBack;
  const spots = [[-sx * S, -sz * S], [sx * S, sz * S], [-fx * Bk, -fz * Bk], [fx * Bk * 1.05, fz * Bk * 1.05], [-sx * S * 1.6, -sz * S * 1.6], [sx * S * 1.6, sz * S * 1.6]];
  const p = new THREE.Vector3();
  let placed = false;
  for (const [ox, oz] of spots) {
    p.set(ride.pos.x + ox, 0, ride.pos.z + oz);
    p.y = Math.max(ride.pos.y + 0.05, groundH(p.x, p.z, ride.pos.y));
    if (p.y - ride.pos.y > 0.8) continue;
    _near = nearBoxes(p.x, p.z, 2); _h = PH;
    const blocked = anyOverlap(p) || rayMap(new THREE.Vector3(ride.pos.x, ride.pos.y + 1, ride.pos.z), new THREE.Vector3(ox, 0, oz).normalize(), Math.hypot(ox, oz) + PR);
    _near = boxes;
    if (!blocked) { placed = true; break; }
  }
  if (!placed) p.set(ride.pos.x, ride.pos.y + 0.05, ride.pos.z);
  me.pos.copy(p); me.vel.set(0, 0, 0);
  if (v.kind === 'heli' || v.kind === 'plane') ride.pos.y = groundH(ride.pos.x, ride.pos.z, ride.pos.y);   // ohne Pilot landet der Heli/das Flugzeug (man selbst fällt aus der Höhe)
  if (v.kind === 'plane') { ride.pitch = 0; ride.lean = 0; BOMB_AIM.visible = false; JET_LOCK.visible = false; ride.lock = -1; }
  net.send({ t: 'exit', v: ride.v, s: [ride.pos.x, ride.pos.y, ride.pos.z, ride.yaw] });
  v.x = ride.pos.x; v.y = ride.pos.y; v.z = ride.pos.z; v.yaw = ride.yaw; v.d = 0; v.lean = 0;
  rideLeft.v = ride.v; rideLeft.t = performance.now();
  DRIFT.pts = 0; DRIFT.time = 0; driftHud.classList.remove('on'); lastSkid = null; lapReset();
  ride.v = -1; ride.speed = 0;
  if (myRider) myRider.g.visible = false;
  engineSound(false);
  if (!silent) sndThud(0.4);
}

/* ---------- Fahrphysik (eigenes Moped) ---------- */
function updateRide(dt) {
  if (ride.kind === 'heli') return heliRide(dt);
  if (ride.kind === 'plane') return ride.ctype === 'jet' ? jetRide(dt) : planeRide(dt);
  let thr =(keys.KeyW || keys.Gas ? 1 : 0) - (keys.KeyS ? 1 : 0), steer = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
  // Joystick/Lenkrad/Pedale ersetzen nur die Richtung, die sie gerade benutzen (Lenkrad lenkt, W/S gibt weiter Gas)
  if (touchIn.my) thr = -touchIn.my;
  if (touchIn.mx) steer = -touchIn.mx;
  // Gas / Bremse / Rückwärts
  const K = VK[ride.kind || 'moped'], isCar = ride.kind === 'car', isTank = ride.kind === 'tank';
  if (isCar) carDrive(dt, thr, steer, !!keys.Handbrake,!!(touchIn.mx || touchIn.my));   // Auto: Drift-Physik (wie in Drift-Welt)
  else {
    const GU = isTank && ride.ctype === 'gustav', kAcc = GU ? 7 : K.acc, kTop = GU ? 41 : K.top, kMax = GU ? 140 / 3.6 : K.max;   // Schwerer Gustav: bis 140 km/h
    if (thr > 0) ride.speed += (ride.speed < 0 ? K.brake : kAcc * (1 - ride.speed / kTop)) * thr * dt;
    else if (thr < 0) ride.speed += (ride.speed > 0.3 ? -K.brake : -K.acc * 0.45) * -thr * dt;
    else ride.speed -= Math.sign(ride.speed) * Math.min(Math.abs(ride.speed), K.coast * dt);
    ride.speed = Math.max(K.rev, Math.min(kMax, ride.speed));   // Moped ca. 60 km/h
  }
  // Lenken: bei Tempo weniger stark, rückwärts umgekehrt
  const sp = isCar ? Math.hypot(ride.vel.x, ride.vel.z) : Math.abs(ride.speed);
  // Wheelie: Leertaste (Handy: SPRUNG) während der Fahrt → Vorderrad hoch. Mit W geht es höher,
  // S drückt es runter. Wer zu lange Vollgas gibt, kippt nach hinten über.
  const now0 = performance.now() / 1000;
  // Wheelie mit echter Kippbewegung: gehaltene Taste hebt das Vorderrad immer weiter; ab dem Gleichgewichtspunkt (0,75)
  // zieht die Schwerkraft nach hinten → wer nicht loslässt, kippt nach ~1 s über. Halten = um den Kipppunkt antippen.
  const wantW = !isCar && !isTank && keys.Space && ride.onGround && ride.speed > 2.2 && now0 > (ride.whBlock || 0);
  const BAL = 0.75, wh0 = ride.wh || 0;
  if (!isCar && !isTank && (wantW || wh0 > 0)) {
    let acc = wh0 > BAL ? (wh0 - BAL) * 16 : -(BAL - wh0) * 0.8;                     // Schwerkraft: über dem Kipppunkt nach hinten
    if (wantW) acc += 1.7 + Math.max(0, thr) * 1.1 + Math.min(0.4, sp * 0.02);       // Leertaste (+ Gas) hebt
    else acc -= 6.5;                                                                  // losgelassen: Vorderrad fällt
    if (thr < 0) acc -= 9;                                                            // Bremse holt es runter
    ride.whV = ((ride.whV || 0) + acc * dt) * Math.max(0, 1 - 1.6 * dt);
    ride.wh = wh0 + ride.whV * dt;
    if (ride.wh <= 0) { ride.wh = 0; ride.whV = 0; }
  } else { ride.wh = 0; ride.whV = 0; }
  if (ride.wh > 1.0) {   // Überschlag
    ride.wh = 0; ride.whV = 0; ride.whBlock = now0 + 1.4; ride.speed *= 0.1;
    sndThud(0.9); me.shake = Math.max(me.shake, 0.7); showMsg('Überschlag! Leertaste kurz loslassen, um den Wheelie zu halten');
    ride.whT = 0;
  }
  if (ride.wh > 0.3 && ride.onGround) {
    const before = ride.whT || 0; ride.whT = before + dt;
    if (Math.floor(ride.whT / 5) > Math.floor(before / 5)) { shopState.coins += 10; saveShop(); updateCoins(true); showMsg(`WHEELIE ${Math.floor(ride.whT)} s!  +10 Coins`); }
  } else if (ride.wh < 0.15 && (ride.whT || 0) > 0) {
    if (ride.whT > 1.5 && ride.whT < 5) showMsg(`Wheelie ${ride.whT.toFixed(1)} s`);
    ride.whT = 0;
  }
  if (isTank && ride.ctype === 'gustav') {   // Schwerer Gustav: fährt nur auf den Schienen, Rohr schwenkt wenig, steigt hoch
    ride.speed = Math.max(-11, Math.min(140 / 3.6, ride.speed)); ride.lean = 0;
    ride.yaw += steer * 0.3 * dt * Math.min(1, Math.abs(ride.speed) / 1.5) * Math.sign(ride.speed || 1);   // lenkt nur in der Fahrt (wie ein Zug in der Kurve), legt dabei neue Schienen
    ride.vel.x = Math.cos(ride.yaw) * ride.speed; ride.vel.z = -Math.sin(ride.yaw) * ride.speed;
    let d = (me.yaw + Math.PI / 2 - ride.yaw) - (ride.turret || 0); d = Math.atan2(Math.sin(d), Math.cos(d));
    ride.turret = Math.max(-0.45, Math.min(0.45, (ride.turret || 0) + Math.max(-0.35 * dt, Math.min(0.35 * dt, d))));
    const pt = Math.max(-0.12, Math.min(0.9, me.pitch + 0.35));   // auch flach / leicht nach unten (Ziele in der Nähe)
    ride.barrelP = (ride.barrelP || 0) + Math.max(-0.25 * dt, Math.min(0.25 * dt, pt - (ride.barrelP || 0)));
    ride.st = ride.turret;
  } else if (isTank) {   // Panzer: dreht auch im Stand (Ketten gegenläufig), Turm folgt der Blickrichtung
    ride.yaw += steer * K.steer * dt; ride.lean = 0;
    ride.vel.x = Math.cos(ride.yaw) * ride.speed; ride.vel.z = -Math.sin(ride.yaw) * ride.speed;
    let d = (me.yaw + Math.PI / 2 - ride.yaw) - (ride.turret || 0); d = Math.atan2(Math.sin(d), Math.cos(d));
    ride.turret = (ride.turret || 0) + Math.max(-1.3 * dt, Math.min(1.3 * dt, d));
    const pt = Math.max(-0.12, Math.min(0.35, me.pitch + 0.06));
    ride.barrelP = (ride.barrelP || 0) + Math.max(-0.6 * dt, Math.min(0.6 * dt, pt - (ride.barrelP || 0)));
    ride.st = ride.turret;
  } else if (!isCar) {
    const turn = steer * Math.min(1, sp / 3) * (K.steer - Math.min(K.steer * 0.57, sp / K.steerHi)) * Math.sign(ride.speed || 1) * (1 - Math.min(0.5, ride.wh * 0.6));
    ride.yaw += turn * dt;
    ride.lean += ((-steer * Math.min(1, sp / 9) * 0.42) - ride.lean) * Math.min(1, dt * 6);
    // Lenker sichtbar einschlagen: langsam weit, schnell nur wenig
    ride.st = (ride.st || 0) + (steer * (0.1 + 0.36 * Math.max(0, 1 - sp / 9)) - (ride.st || 0)) * Math.min(1, dt * 9);
    ride.vel.x = Math.cos(ride.yaw) * ride.speed; ride.vel.z = -Math.sin(ride.yaw) * ride.speed;
  }
  // Eintauchen beim Bremsen, Heck runter beim Gasgeben
  const diveT = (thr < 0 && ride.speed > 1 ? -0.045 : thr > 0 && sp < 12 ? 0.018 : 0) * (isCar ? 0.45 : 1);
  ride.dive = (ride.dive || 0) + (diveT - (ride.dive || 0)) * Math.min(1, dt * 6);
  ride.thr = thr;
  // Schanzen: am Boden übernimmt das Moped die Steigung als Aufwärtstempo → an der Kante hebt es ab
  const gh0 = groundH(ride.pos.x, ride.pos.z, ride.pos.y), wasAir = !ride.onGround;
  if (ride.onGround) ride.vel.y = ride.climb || 0;
  ride.vel.y = Math.max(-30, ride.vel.y - RIDE_GRAV * dt);
  const vyBefore = ride.vel.y;
  moveBody(ride, ride.vel.x * dt, ride.vel.y * dt, ride.vel.z * dt);
  ride.climb = ride.onGround ? Math.max(-12, Math.min(12, (groundH(ride.pos.x, ride.pos.z, ride.pos.y) - gh0) / Math.max(dt, 1e-3))) : 0;
  if (!ride.onGround) ride.air = (ride.air || 0) + dt;
  else {
    if (wasAir && ride.air > 0.25) {   // Landung
      const hard = Math.min(1, -vyBefore / 16);
      sndThud(0.3 + hard * 0.6); me.shake = Math.max(me.shake, hard * 0.5); ride.land = hard;
      if (ride.air > 0.6) showMsg(ride.air > 1.2 ? 'MEGA-SPRUNG! ' + ride.air.toFixed(1) + ' s' : 'Sprung! ' + ride.air.toFixed(1) + ' s');
    }
    ride.air = 0;
  }
  ride.land = Math.max(0, (ride.land || 0) - dt * 3);
  // Neigung nach vorne/hinten: am Boden = Steigung, in der Luft langsam nach vorne kippen
  const fx = Math.cos(ride.yaw), fz = -Math.sin(ride.yaw);
  const pitchT = ride.onGround ? Math.atan2(groundH(ride.pos.x + fx * 0.6, ride.pos.z + fz * 0.6, ride.pos.y) - groundH(ride.pos.x - fx * 0.6, ride.pos.z - fz * 0.6, ride.pos.y), 1.2)
    : Math.atan2(ride.vel.y, Math.max(4, sp)) * 0.7;
  ride.pitch = (ride.pitch || 0) + (pitchT - (ride.pitch || 0)) * Math.min(1, dt * (ride.onGround ? 14 : 3));
  if (ride.blocked && sp > 2.5) {
    if (sp > 8) { sndThud(0.8); me.shake = Math.max(me.shake, 0.4); }
    ride.speed *= 0.25;
    if (isCar) { ride.cvx *= 0.3; ride.cvz *= 0.3; ride.yawRate *= 0.3; if (sp > 6 && DRIFT.pts > 0) { showMsg('💥 CRASH! Drift verloren'); DRIFT.pts = 0; DRIFT.time = 0; } }
  }
  if (isCar) {
    driftScore(dt); trackLap(dt);
    if (ride.nitroT > 0) {   // Nitro-Flammen aus dem Auspuff
      ride.nitroT -= dt;
      const ex = vehicles[ride.v].mesh.root.localToWorld(new THREE.Vector3(-2.45, 0.33, 0.42));
      puff(ex, Math.random() < 0.5 ? 0x4aa8ff : 0xff8a20, 0.28, 0.25, new THREE.Vector3(-Math.cos(ride.yaw) * 6, 0.3, Math.sin(ride.yaw) * 6), { opacity: 0.9, grow: 2.5 });
    }
    if (ride.nitroCd > 0) ride.nitroCd -= dt;
  }
  if (ride.pos.y < -10) ride.pos.set(0, 2, 0);
  // Spielerposition = auf dem Sitz
  me.pos.set(ride.pos.x - Math.cos(ride.yaw) * K.back, ride.pos.y + K.up, ride.pos.z + Math.sin(ride.yaw) * K.back);
  me.vel.set(ride.vel.x, 0, ride.vel.z); me.onGround = true;
  const v = vehicles[ride.v]; v.x = ride.pos.x; v.y = ride.pos.y; v.z = ride.pos.z; v.yaw = ride.yaw; v.lean = ride.lean; v.wh = ride.wh; v.st = ride.st;
  if (isTank) v.wh = ride.barrelP || 0;   // Panzer: wh = Rohrhöhe, st = Turmdrehung (gehen übers Netz an alle)
  // Kamera: hinter dem Fahrer, Maus schaut sich um; ohne Maus richtet sie sich langsam nach vorne aus
  const aiming = riderAiming() && !isTank;
  if (!isTank && performance.now() - ride.lastMouse > (isCar ? 700 : 1500) && sp > (isCar ? 1 : 3) && !aiming) {
    let d = (ride.yaw - Math.PI / 2) - me.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    me.yaw += d * Math.min(1, dt * (isCar ? 3.5 : 2.5)); me.pitch += ((isCar ? -0.2 : -0.15) - me.pitch) * Math.min(1, dt * 2);
  }
  // Zielen (Schießen / Rechtsklick) = Ego-Ansicht mit der Waffe direkt neben dir, sonst Ansicht von hinten
  ride.fp = (ride.fp || 0) + ((aiming ? 1 : 0) - (ride.fp || 0)) * Math.min(1, dt * 11);
  const fpK = ride.fp * ride.fp * (3 - 2 * ride.fp);
  const gus = ride.ctype === 'gustav';
  const target = new THREE.Vector3(ride.pos.x, ride.pos.y + (gus ? 11 : K.camH) - (ride.land || 0) * 0.3 + (ride.wh || 0) * 0.5, ride.pos.z);
  const back = new THREE.Vector3(Math.sin(me.yaw) * Math.cos(me.pitch), -Math.sin(me.pitch), Math.cos(me.yaw) * Math.cos(me.pitch));
  let dist = gus ? 36 : K.camD;
  const hit = rayMap(target, back, dist + 0.3); if (hit) dist = Math.max(0.6, hit.dist - 0.3);   // nicht durch Wände schauen
  camera.position.copy(target).addScaledVector(back, dist);
  const [ef0, eu] = wheelieShift(ride.wh || 0, 0.6 - RIDER_BACK, RIDER_UP + 1.5), ef = ef0 + K.eyeF - 0.08;
  const eyeSx = Math.sin(ride.yaw) * K.eyeSide, eyeSz = Math.cos(ride.yaw) * K.eyeSide;
  const eye = new THREE.Vector3(me.pos.x + Math.cos(ride.yaw) * (0.08 + ef) + eyeSx, me.pos.y + (isCar ? K.eyeUp : 1.5 + eu) + Math.sin(performance.now() / 45) * 0.003 * Math.min(1, sp / 4), me.pos.z - Math.sin(ride.yaw) * (0.08 + ef) + eyeSz);  camera.position.lerp(eye, fpK);
  camera.rotation.set(me.pitch, me.yaw, ride.lean * 0.45 * fpK);
  // Schießen und Nachladen während der Fahrt
  const w = WEAPONS[me.weapon], now = performance.now() / 1000;
  me.drawT = Math.max(0, me.drawT - dt); me.inspectT = 0; me.landT = 0; me.shake = Math.max(0, me.shake - dt * 1.6);
  if (me.pumpT > 0) { const b = me.pumpT; me.pumpT = Math.max(0, me.pumpT - dt); if (b > 0.3 && me.pumpT <= 0.3) sndClick(0.08, 0.7); }
  if (me.boltT > 0) { const b = me.boltT; me.boltT = Math.max(0, me.boltT - dt); if (b > 0.55 && me.boltT <= 0.55) sndClick(0.08, 0.9); }
  if (me.reloading > 0) { me.reloading -= dt; if (me.reloading <= 0) { me.reloading = 0; me.ammo[me.weapon] = w.mag; } }
  if (isTank) tankFire(now);
  else if (me.trigger && (w.auto || !me.firedPress)) tryShoot(now);
  me.recoilP *= Math.exp(-9 * dt); me.recoilY *= Math.exp(-9 * dt);
  camera.rotation.x += me.recoilP; camera.rotation.y += me.recoilY;
  const targetFov = ride.fp > 0.5 ? (me.scoped ? w.zoom : fovBase + Math.min(4, sp * 0.25)) : fovBase + Math.min(10, sp * 0.6);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10); camera.updateProjectionMatrix();
  engineSound(true, sp * Math.sign(ride.speed || 1), thr, ride.kind, isCar && (ride.drifting || ride.hand));
  if (isCar) carSkids(dt);
  if ((isCar && sp > 7) || (isTank && sp > 2)) runOver(isTank ? Math.max(sp, 25) : sp);
  viewKnife.visible = false; viewNade.visible = false;
  if (ride.fp > 0.6) { me.bob += dt * sp * 0.6; animateViewModel(dt, w); }   // Waffe in der Hand wie zu Fuß
  else viewGun.visible = false;
}
document.addEventListener('mousemove', () => { if (ride.v >= 0) ride.lastMouse = performance.now(); });
/* ---------- Helikopter fliegen: W/S vor/zurück (Nase kippt), A/D drehen, Leertaste steigen, C/Strg sinken ----------
   Ohne Eingabe bleibt er in der Luft stehen (Schwebeflug). Linksklick: Raketen abwechselnd links/rechts (16, dann nachladen). */
const HELI_AMMO = 16, HELI_RELOAD = 4;
function heliHint() {
  const nowS = performance.now() / 1000, rl = ride.heliReload > nowS ? ride.heliReload - nowS : 0;
  return `🚁 <b>Helikopter</b> · <b>${kbK('forward')}/${kbK('back')}</b> vor/zurück · <b>${kbK('left')}/${kbK('right')}</b> drehen · <b>${kbK('jump')}</b> steigen · <b>${kbK('crouch')}</b> sinken · <b>Linksklick</b> Raketen ${rl > 0 ? `<span style="color:#ff9a3a">(lädt … ${rl.toFixed(1)} s)</span>` : `(${ride.heliAmmo}/${HELI_AMMO})`} · <b>${kbK('ride')}</b> aussteigen`;
}
function heliRide(dt) {
  const K = VK.heli, now = performance.now() / 1000;
  let thr = (keys.KeyW || keys.Gas ? 1 : 0) - (keys.KeyS ? 1 : 0), steer = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
  if (touchIn.my) thr = -touchIn.my;
  if (touchIn.mx) steer = -touchIn.mx;
  const up = (keys.Space ? 1 : 0) - (keys.KeyC || keys.ControlLeft ? 1 : 0);
  const gh = groundH(ride.pos.x, ride.pos.z, ride.pos.y), air = ride.pos.y - gh > 0.25 || up > 0;
  ride.yaw += steer * K.steer * dt * (air ? 1 : 0.4);
  const fx = Math.cos(ride.yaw), fz = -Math.sin(ride.yaw), rx = Math.sin(ride.yaw), rz = Math.cos(ride.yaw);
  if (air) { ride.vel.x += fx * thr * K.acc * dt; ride.vel.z += fz * thr * K.acc * dt; }
  // Luftwiderstand: längs wenig, quer stark (er „rutscht“ nicht seitlich)
  const vf = ride.vel.x * fx + ride.vel.z * fz, vs = ride.vel.x * rx + ride.vel.z * rz;
  const nvf = vf * Math.exp(-0.38 * dt), nvs = vs * Math.exp(-2.2 * dt);
  ride.vel.x = fx * nvf + rx * nvs; ride.vel.z = fz * nvf + rz * nvs;
  const hs = Math.hypot(ride.vel.x, ride.vel.z);
  if (hs > K.max) { ride.vel.x *= K.max / hs; ride.vel.z *= K.max / hs; }
  ride.vel.y += (up * 8 - ride.vel.y) * Math.min(1, 2.5 * dt);
  if (ride.pos.y > 110 && ride.vel.y > 0) ride.vel.y = 0;
  if (!air) { ride.vel.x *= Math.exp(-6 * dt); ride.vel.z *= Math.exp(-6 * dt); if (ride.vel.y < 0) ride.vel.y = 0; }
  moveBody(ride, ride.vel.x * dt, ride.vel.y * dt, ride.vel.z * dt);
  if (ride.blocked && hs > 4) { if (hs > 14) { sndThud(0.9); me.shake = Math.max(me.shake, 0.6); } ride.vel.x *= -0.25; ride.vel.z *= -0.25; }
  if (ride.pos.y < -10) ride.pos.set(0, 5, 0);
  // Neigung: Nase runter beim Vorwärtsfliegen, seitlich in der Kurve
  ride.pitch = (ride.pitch || 0) + ((-thr * 0.2 - Math.max(-0.1, Math.min(0.1, (vf - nvf) * 0))) - (ride.pitch || 0)) * Math.min(1, dt * 3);
  ride.lean += ((air ? -steer * 0.16 * Math.min(1, hs / 8) : 0) - ride.lean) * Math.min(1, dt * 3);
  ride.speed = vf; ride.wh = 0; ride.dive = 0; ride.thr = thr; ride.onGround = !air;
  // Rotor-Abwind: Staub am Boden, wenn er tief fliegt
  if (ride.pos.y - gh < 8) { ride.dustT = (ride.dustT || 0) - dt; if (ride.dustT <= 0) { ride.dustT = 0.06; const a = Math.random() * 6.28; puff(new THREE.Vector3(ride.pos.x + Math.cos(a) * 3, gh + 0.2, ride.pos.z + Math.sin(a) * 3), 0xc8b89a, 0.6, 1.0, new THREE.Vector3(Math.cos(a) * 5, 0.4, Math.sin(a) * 5), { opacity: 0.3, grow: 3 }); } }
  me.pos.set(ride.pos.x, ride.pos.y + K.up, ride.pos.z); me.vel.set(0, 0, 0); me.onGround = true;
  const v = vehicles[ride.v]; v.x = ride.pos.x; v.y = ride.pos.y; v.z = ride.pos.z; v.yaw = ride.yaw; v.lean = ride.lean; v.wh = ride.pitch; v.st = 0;
  // Kamera: hinten oben, Maus schaut frei; ohne Maus langsam hinter den Heli
  if (performance.now() - ride.lastMouse > 1200 && hs > 4 && !me.trigger) {
    let d = (ride.yaw - Math.PI / 2) - me.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); me.yaw += d * Math.min(1, dt * 2);
  }
  const target = new THREE.Vector3(ride.pos.x, ride.pos.y + K.camH, ride.pos.z);
  const back = new THREE.Vector3(Math.sin(me.yaw) * Math.cos(me.pitch), -Math.sin(me.pitch), Math.cos(me.yaw) * Math.cos(me.pitch));
  let dist = K.camD; const hit = rayMap(target, back, dist + 0.3); if (hit) dist = Math.max(1, hit.dist - 0.3);
  camera.position.copy(target).addScaledVector(back, dist);
  camera.rotation.set(me.pitch, me.yaw, 0);
  // Raketen
  if (ride.heliAmmo === undefined) ride.heliAmmo = HELI_AMMO;
  if (ride.heliReload && now >= ride.heliReload) { ride.heliReload = 0; ride.heliAmmo = HELI_AMMO; }
  if (me.trigger && !ride.heliReload && now - (ride.heliShot || -9) > 0.28) {
    ride.heliShot = now; ride.heliSide = -(ride.heliSide || 1);
    const cp = Math.cos(me.pitch), dir = new THREE.Vector3(-Math.sin(me.yaw) * cp, Math.sin(me.pitch), -Math.cos(me.yaw) * cp);
    const pod = new THREE.Vector3(ride.pos.x + fx * 0.9 + rx * ride.heliSide * 1.5, ride.pos.y + 1.15, ride.pos.z + fz * 0.9 + rz * ride.heliSide * 1.5);
    fireRocket(pod, dir.multiplyScalar(85), true, HELI_W);
    sndShot(10, 0.45); me.shake = Math.max(me.shake, 0.15);
    if (--ride.heliAmmo <= 0) ride.heliReload = now + HELI_RELOAD;
  }
  me.shake = Math.max(0, me.shake - dt * 1.6);
  const targetFov = me.scoped ? 40 : fovBase + Math.min(10, hs * 0.2);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix();
  engineSound(true, hs, Math.max(Math.abs(thr), Math.abs(up)), 'heli');
  viewKnife.visible = false; viewNade.visible = false; viewGun.visible = false;
}
/* ---------- Flugzeug fliegen (einfach zu lernen, aber wie ein echtes Kleinflugzeug):
   W/S = Gas mehr/weniger (am Boden S = bremsen), A/D = Kurve (Querlage), Leertaste = hochziehen, C/Strg = Nase runter.
   Abheben ab ~90 km/h, zu langsam in der Luft = Strömungsabriss (Nase kippt, sinkt). Zu hart aufsetzen = Bruchlandung. */
const PLANE = { stall: 24, rot: 25, vmax: 62, thrust: 4.6, ceil: 320 };
// Bomben: 6 an Bord, Abwurf alle 0,35 s, dann 8 s Nachladen (nach der Landung sofort voll). Roter Kreis = Einschlagstelle
const PLANE_BOMBS = 6, BOMB_RELOAD = 8;
const BOMB_AIM = (() => {
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.3, 40), mat); ring.rotation.x = -Math.PI / 2; g.add(ring);
  for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 2.2), mat); b.rotation.x = -Math.PI / 2; b.rotation.z = k * Math.PI / 2; b.position.set(Math.cos(k * Math.PI / 2) * 1.6, 0, -Math.sin(k * Math.PI / 2) * 1.6); g.add(b); }
  g.visible = false; g.renderOrder = 5; scene.add(g); return g;
})();
function planeHint() {
  const v = ride.planeV || 0, alt = ride.pos.y - groundH(ride.pos.x, ride.pos.z, ride.pos.y), nowS = performance.now() / 1000;
  const warn = alt > 2 && v < PLANE.stall + 3 ? ' <span style="color:#ff6b6b">⚠ ZU LANGSAM – Nase runter, Gas!</span>' : alt < 2 && v > PLANE.rot ? ` <span style="color:#7dff7a">✈ Jetzt ${TOUCH ? '▲ZIEHEN' : kbK('jump')} – abheben!</span>` : '';
  const rr = ride.rktReload > nowS ? ride.rktReload - nowS : 0, rl = ride.bombReload > nowS ? ride.bombReload - nowS : 0;
  const rkt = `🚀 <b>${TOUCH ? 'FEUER' : 'Linksklick'}</b> Raketen ${rr > 0 ? `<span style="color:#ff9a3a">(lädt … ${rr.toFixed(1)} s)</span>` : `(${ride.rkts === undefined ? PLANE_RKTS : ride.rkts}/${PLANE_RKTS})`}`;
  const bombs = TOUCH ? '' : ` · 💣 <b>Rechtsklick</b> Bombe ${rl > 0 ? `<span style="color:#ff9a3a">(lädt … ${rl.toFixed(1)} s)</span>` : `(${ride.bombs === undefined ? PLANE_BOMBS : ride.bombs}/${PLANE_BOMBS})`}`;
  return `✈ <b>Flugzeug</b> · Gas ${Math.round((ride.thrl || 0) * 100)} % (<b>${kbK('forward')}/${kbK('back')}</b>) · <b>${kbK('jump')}</b> hochziehen · <b>${kbK('crouch')}</b> Nase runter · <b>${kbK('left')}/${kbK('right')}</b> Kurve · ${rkt}${bombs} · <b>${kbK('ride')}</b> aussteigen${warn}`;
}
// Raketen wie beim Heli: abwechselnd aus beiden Flügeln, dorthin, wo man hinschaut; 16 Stück, dann 4 s nachladen
const PLANE_RKTS = 16, PLANE_RKT_RELOAD = 4;
function planeRockets(now) {
  if (ride.rkts === undefined) ride.rkts = PLANE_RKTS;
  if (ride.rktReload && now >= ride.rktReload) { ride.rktReload = 0; ride.rkts = PLANE_RKTS; }
  if (!me.trigger || ride.rktReload || ride.rkts <= 0 || now - (ride.rktShot || -9) < 0.28) return;
  ride.rktShot = now; ride.rktSide = -(ride.rktSide || 1);
  const fx = Math.cos(ride.yaw), fz = -Math.sin(ride.yaw), rx = Math.sin(ride.yaw), rz = Math.cos(ride.yaw);
  const cp = Math.cos(me.pitch), dir = new THREE.Vector3(-Math.sin(me.yaw) * cp, Math.sin(me.pitch), -Math.cos(me.yaw) * cp);
  const pod = new THREE.Vector3(ride.pos.x + fx * 1.2 + rx * ride.rktSide * 2.4, ride.pos.y + 1.9, ride.pos.z + fz * 1.2 + rz * ride.rktSide * 2.4);
  fireRocket(pod, dir.multiplyScalar(85 + Math.max(0, ride.vel.dot(dir))), true, PLANE_W);   // + Fluggeschwindigkeit (nur Tempo, Richtung bleibt exakt)
  sndShot(10, 0.45); me.shake = Math.max(me.shake, 0.12);
  if (--ride.rkts <= 0) ride.rktReload = now + PLANE_RKT_RELOAD;
}
// Bomben abwerfen + Einschlagstelle anzeigen (gleiche Flugbahn wie in updateRockets)
function planeBombs(onG) {
  const now = performance.now() / 1000;
  if (ride.bombs === undefined) ride.bombs = PLANE_BOMBS;
  if (ride.bombReload && now >= ride.bombReload) { ride.bombReload = 0; ride.bombs = PLANE_BOMBS; }
  if (onG && (ride.planeV || 0) < 3 && (ride.bombs < PLANE_BOMBS || ride.rkts < PLANE_RKTS)) { ride.bombs = PLANE_BOMBS; ride.bombReload = 0; ride.rkts = PLANE_RKTS; ride.rktReload = 0; }   // gelandet: neu beladen
  if (!onG) planeRockets(now);   // Linksklick / FEUER: Raketen wie beim Heli
  const o = new THREE.Vector3(ride.pos.x, ride.pos.y + 0.45, ride.pos.z), v = ride.vel.clone().add(new THREE.Vector3(0, -1.5, 0));
  const bombKey = me.scoped && !TOUCH;   // Bomben: Rechtsklick halten (Zielkreis), loslassen = Abwurf
  if (!onG && bombKey) {   // Zielhilfe: Flugbahn vorausrechnen
    const p = o.clone(), q = v.clone(), d = new THREE.Vector3(); let hit = false;
    for (let t = 0; t < 15; t += 0.1) {
      q.y -= 9.81 * 0.1; q.multiplyScalar(1 - 0.002);
      const len = q.length() * 0.1; d.copy(q).normalize();
      const h = rayMap(p, d, len); if (h) { p.copy(h.point); hit = true; break; }   // Dach/Wand im Weg → dort schlägt sie ein
      p.addScaledVector(q, 0.1); const gh = groundH(p.x, p.z, p.y); if (p.y <= gh) { p.y = gh; hit = true; break; }
    }
    BOMB_AIM.visible = hit; if (hit) { BOMB_AIM.position.set(p.x, p.y + 0.12, p.z); BOMB_AIM.rotation.y += 0.02; }
  } else BOMB_AIM.visible = false;
  if (ride.bombHeld && !bombKey && !onG && !ride.bombReload && ride.bombs > 0 && now - (ride.bombShot || -9) > 0.35) {   // Rechtsklick losgelassen → Bombe fällt
    ride.bombShot = now;
    fireRocket(o, v, true, BOMB_W);
    if (--ride.bombs <= 0) ride.bombReload = now + BOMB_RELOAD;
  }
  ride.bombHeld = bombKey;
}
/* ---------- Kampfjet: viel schneller und wendiger, Vollgas = Nachbrenner; Bordkanone + Lenkraketen ---------- */
const JET = { stall: 40, rot: 46, vmax: 115, thrust: 15, ceil: 450 };
const JET_K = Object.assign({}, VK.plane, { name: 'Kampfjet', camD: 17, camH: 4.4 });
const JET_AMMO = 400, JET_GUN_RATE = 0.066, JET_GUN_RELOAD = 6, JET_MSL = 6, JET_MSL_RELOAD = 8;
// Zielmarkierung (rote Ecken) über dem erfassten Fahrzeug
const JET_LOCK = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.strokeStyle = '#ff2a1a'; g.lineWidth = 9; g.lineCap = 'square';
  for (const [x, y, dx, dy] of [[10, 10, 1, 1], [118, 10, -1, 1], [10, 118, 1, -1], [118, 118, -1, -1]]) { g.beginPath(); g.moveTo(x, y + dy * 34); g.lineTo(x, y); g.lineTo(x + dx * 34, y); g.stroke(); }
  g.beginPath(); g.arc(64, 64, 6, 0, 7); g.fillStyle = '#ff2a1a'; g.fill();
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.visible = false; s.renderOrder = 10; scene.add(s); return s;
})();
function jetHint() {
  const v = ride.planeV || 0, alt = ride.pos.y - groundH(ride.pos.x, ride.pos.z, ride.pos.y), nowS = performance.now() / 1000;
  const warn = alt > 2 && v < JET.stall + 4 ? ' <span style="color:#ff6b6b">⚠ ZU LANGSAM – Nase runter, Schub!</span>' : alt < 2 && v > JET.rot ? ` <span style="color:#7dff7a">✈ Jetzt ${TOUCH ? '▲ZIEHEN' : kbK('jump')} – abheben!</span>` : '';
  const gr = ride.gunReload > nowS ? ride.gunReload - nowS : 0, mr = ride.mslReload > nowS ? ride.mslReload - nowS : 0;
  const gun = `🔫 <b>${TOUCH ? 'FEUER' : 'Linksklick'}</b> Kanone ${gr > 0 ? `<span style="color:#ff9a3a">(lädt … ${gr.toFixed(1)} s)</span>` : `(${ride.gunAmmo})`}`;
  const msl = `🚀 <b>${TOUCH ? 'ZOOM' : 'Rechtsklick'}</b> Lenkrakete ${mr > 0 ? `<span style="color:#ff9a3a">(lädt … ${mr.toFixed(1)} s)</span>` : `(${ride.msl}/${JET_MSL})`}${ride.lock >= 0 ? ' <span style="color:#ff5a4a"><b>🎯 ZIEL ERFASST</b></span>' : ''}`;
  const ab = ride.thrl > 0.97 ? ' <span style="color:#ffb347">🔥 NACHBRENNER</span>' : '';
  return `✈ <b>Kampfjet</b> · Schub ${Math.round((ride.thrl || 0) * 100)} %${ab} (<b>${kbK('forward')}/${kbK('back')}</b>) · <b>${kbK('jump')}</b> ziehen (halten = Looping) · <b>${kbK('crouch')}</b> drücken · <b>${kbK('left')}/${kbK('right')}</b> Rolle (kippen + ${kbK('jump')} = enge Kurve) · ${gun} · ${msl} · <b>${kbK('ride')}</b> aussteigen${warn}`;
}
// Zielrichtung = Fadenkreuz (Kamera), Startpunkt am Jet; fwd/right = Achsen des Jets
// Achsen des Jets + Rumpfmitte c (Drehpunkt, 1,7 m über den Rädern)
const JET_PIVOT = 1.7, _jetUp = new THREE.Vector3();
// Schub von Flugzeug/Jet: steigt, solange Gas gedrückt ist (Handy: so weit wie der Regler); loslassen = geht zurück auf Leerlauf, S/Bremse = schneller
const THR_HOLD = { on: false };   // Option: Schubhebel bleibt stehen
try { THR_HOLD.on = localStorage.getItem('kz_thrhold') === '1'; } catch (e) {}
function planeThrottle(cur, thr, dt) {
  if (THR_HOLD.on) return Math.max(0, Math.min(1, cur + (thr > 0 ? 0.6 : thr < 0 ? -0.8 : 0) * dt));
  const tgt = Math.max(0, thr), rate = cur < tgt ? 0.9 : thr < 0 ? 1.4 : 0.5;
  return cur < tgt ? Math.min(tgt, cur + rate * dt) : Math.max(tgt, cur - rate * dt);
}
function jetAxes() {
  const c = new THREE.Vector3(ride.pos.x, ride.pos.y + JET_PIVOT, ride.pos.z);
  if (ride.air && ride.q) return { c, fwd: new THREE.Vector3(1, 0, 0).applyQuaternion(ride.q), right: new THREE.Vector3(0, 0, 1).applyQuaternion(ride.q), up: new THREE.Vector3(0, 1, 0).applyQuaternion(ride.q) };
  const cp = Math.cos(ride.pitch || 0), fwd = new THREE.Vector3(Math.cos(ride.yaw) * cp, Math.sin(ride.pitch || 0), -Math.sin(ride.yaw) * cp);
  const right = new THREE.Vector3(Math.sin(ride.yaw), 0, Math.cos(ride.yaw));
  return { c, fwd, right, up: new THREE.Vector3(0, 1, 0) };
}
const _jo = new THREE.Vector3(), _jr = new THREE.Vector3(), _ju = new THREE.Vector3(), _jf = new THREE.Vector3();
let lastVehHit = -1;   // von rocketVehicleHit gesetzt: welches Fahrzeug getroffen wurde
// Bordkanone: Dauerfeuer (~15 Schuss/s) genau aufs Fadenkreuz; Leuchtspur von der Nase. 8 Treffer zerstören ein Fahrzeug
function jetCannon(now) {
  if (ride.gunReload && now >= ride.gunReload) { ride.gunReload = 0; ride.gunAmmo = JET_AMMO; }
  if (!me.trigger || ride.gunReload || now - (ride.gunShot || -9) < JET_GUN_RATE) return;
  ride.gunShot = now;
  camera.updateMatrixWorld(); camera.getWorldPosition(_jo); camera.matrixWorld.extractBasis(_jr, _ju, _jf); _jf.negate();
  const dir = _jf.clone().addScaledVector(_jr, (Math.random() - 0.5) * 0.014).addScaledVector(_ju, (Math.random() - 0.5) * 0.014).normalize();
  const origin = _jo.clone().addScaledVector(dir, JET_K.camD - 2);   // vor dem eigenen Jet beginnen
  const R = 700, mh = rayMap(origin, dir, R); let maxD = mh ? mh.dist : R, end = null, what = 'map';
  const parts = avatarParts(); ray.set(origin, dir); ray.far = maxD;
  const ah = parts.length ? ray.intersectObjects(parts, false)[0] : null;
  if (ah) { maxD = ah.distance; what = 'player'; }
  lastVehHit = -1; const vt = rocketVehicleHit(origin, dir, maxD, ride.v);
  if (vt !== null) { maxD = vt; what = 'veh'; }
  end = origin.clone().addScaledVector(dir, maxD);
  if (what === 'player' && ah.object.userData.pid && !friendly(ah.object.userData.pid)) {
    net.send({ t: 'hit', target: ah.object.userData.pid, dmg: 20, w: JET_W, head: false }); bloodFx(end); showHitmarker(false);
  } else if (what === 'veh' && lastVehHit >= 0) {
    impactFx(end, dir.clone().negate()); showHitmarker(false);
    const n = ride.gunHits[lastVehHit] = (ride.gunHits[lastVehHit] || 0) + 1;
    if (n >= 8) { ride.gunHits[lastVehHit] = 0; const c = vehicles[lastVehHit].mesh.root.position; blast(new THREE.Vector3(c.x, c.y + 1.2, c.z), true, PLANE_W, 2.5, 40); }
  } else if (mh && what === 'map') impactFx(mh.point, mh.normal);
  const { c, fwd, right, up } = jetAxes(), side = (ride.gunSide = -(ride.gunSide || 1));
  const mz = c.addScaledVector(fwd, 6.8).addScaledVector(right, 0.55 * side).addScaledVector(up, 0.05);
  if ((ride.gunN = (ride.gunN || 0) + 1) % 2 === 0) addTracer(mz, end);
  const fl = new THREE.Sprite(flashMat.clone()); fl.position.copy(mz); fl.scale.set(1.1, 1.1, 1); fl.material.rotation = Math.random() * 6;
  scene.add(fl); effects.push({ o: fl, life: 0.05, max: 0.05 });
  net.send({ t: 'shot', id: myId, w: 9, o: [+mz.x.toFixed(2), +mz.y.toFixed(2), +mz.z.toFixed(2)], e: [[+end.x.toFixed(2), +end.y.toFixed(2), +end.z.toFixed(2)]] });
  sndShot(9, 0.42); me.shake = Math.max(me.shake, 0.06);
  if (--ride.gunAmmo <= 0) ride.gunReload = now + JET_GUN_RELOAD;
}
// Lenkraketen: zielen aufs Fahrzeug unter dem Fadenkreuz (Kegel ~11°, bis 800 m, freie Sicht) und fliegen ihm hinterher
function jetLockTarget() {
  camera.getWorldPosition(_jo); camera.matrixWorld.extractBasis(_jr, _ju, _jf); _jf.negate();
  let best = -1, bs = 0.19;
  for (const v of vehicles) {
    if (v.i === ride.v || v.wreck || !v.mesh.root.visible) continue;
    const H = VEH_HIT[v.kind] || VEH_HIT.car, c = v.mesh.root.position, to = new THREE.Vector3(c.x - _jo.x, c.y + H.h - _jo.y, c.z - _jo.z), d = to.length();
    if (d < 25 || d > 800) continue;
    const ang = Math.acos(Math.min(1, to.dot(_jf) / d)); if (ang > bs) continue;
    if (rayMap(_jo, to.clone().divideScalar(d), d - 4)) continue;   // Haus/Berg dazwischen
    best = v.i; bs = ang;
  }
  return best;
}
function jetMissiles(now) {
  if (ride.mslReload && now >= ride.mslReload) { ride.mslReload = 0; ride.msl = JET_MSL; }
  camera.updateMatrixWorld();
  ride.lock = jetLockTarget();
  if (ride.lock >= 0) {
    const t = vehicles[ride.lock].mesh.root.position, H = VEH_HIT[vehicles[ride.lock].kind] || VEH_HIT.car;
    JET_LOCK.visible = true; JET_LOCK.position.set(t.x, t.y + H.h, t.z);
    const s = Math.max(3, camera.position.distanceTo(JET_LOCK.position) * 0.07); JET_LOCK.scale.set(s, s, 1); JET_LOCK.material.rotation += 0.02;
  } else JET_LOCK.visible = false;
  const press = me.scoped && !ride.mslHeld; ride.mslHeld = me.scoped;
  if (!press || ride.mslReload || ride.msl <= 0 || now - (ride.mslShot || -9) < 0.45) return;
  ride.mslShot = now; ride.mslSide = -(ride.mslSide || 1);
  const { c, fwd, right, up } = jetAxes();
  const pod = c.addScaledVector(right, 3.3 * ride.mslSide).addScaledVector(fwd, 0.3).addScaledVector(up, -0.7);
  const dir = _jf.clone();
  fireRocket(pod, dir.multiplyScalar(110 + Math.max(0, ride.vel.dot(dir))), true, PLANE_W, ride.v, ride.lock);
  sndShot(10, 0.5); me.shake = Math.max(me.shake, 0.15);
  if (--ride.msl <= 0) ride.mslReload = now + JET_MSL_RELOAD;
}
function jetWeapons(onG) {
  const now = performance.now() / 1000;
  if (onG && (ride.planeV || 0) < 3 && (ride.gunAmmo < JET_AMMO || ride.msl < JET_MSL)) { ride.gunAmmo = JET_AMMO; ride.gunReload = 0; ride.msl = JET_MSL; ride.mslReload = 0; }   // gelandet: neu beladen
  jetCannon(now); jetMissiles(now);
}
/* ---------- Kampfjet in der Luft: freie Drehung in alle Richtungen (Quaternion) → Loopings, Rollen, Rückenflug ----------
   Leertaste = Nase hoch (ziehen), C = drücken, A/D = Rolle um die Längsachse. Die Bahn folgt immer der Nase:
   in Schräglage ziehen = enge Kurve, dauerhaft ziehen = Looping, A/D halten = Rolle. Ohne Querruder richtet er sich
   aus leichter Schräglage langsam waagerecht aus (nicht im Looping oder Rückenflug). Am Boden rollt er wie bisher. */
const AX_X = new THREE.Vector3(1, 0, 0), AX_Y = new THREE.Vector3(0, 1, 0), AX_Z = new THREE.Vector3(0, 0, 1);
const _jq = new THREE.Quaternion(), _jeu = new THREE.Euler(0, 0, 0, 'YXZ'), _jfw = new THREE.Vector3(), _jup = new THREE.Vector3(), _jri = new THREE.Vector3(), _jm4 = new THREE.Matrix4();
function jetRide(dt) {
  const K = JET_K, P = JET;
  let thr = (keys.KeyW || keys.Gas ? 1 : 0) - (keys.KeyS ? 1 : 0), steer = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
  if (touchIn.my) thr = -touchIn.my;
  if (touchIn.mx) steer = -touchIn.mx;
  const pull = (keys.Space ? 1 : 0) - (keys.KeyC || keys.ControlLeft ? 1 : 0);
  ride.thrl = planeThrottle(ride.thrl || 0, thr, dt);   // Schub nur, solange Gas gedrückt wird
  const ab = ride.thrl > 0.97, T = P.thrust * (ab ? 1.6 : 1), VM = P.vmax * (ab ? 1.35 : 1);
  let v = ride.planeV || 0;
  const gh = groundH(ride.pos.x, ride.pos.z, ride.pos.y);
  if (!ride.q) { ride.q = new THREE.Quaternion(); ride.air = false; ride.pitchRate = 0; ride.rollRate = 0; }
  const q = ride.q;
  let crash = false, landed = false;
  if (!ride.air) {
    // --- am Boden: Bugrad lenkt, ab Abhebetempo mit Leertaste Nase hoch ---
    v += (ride.thrl * T - v * v * (T / (VM * VM)) - 0.6) * dt;
    if (thr < 0) v -= 14 * dt;
    v = Math.max(0, v);
    ride.yaw += steer * 0.7 * Math.min(1, v / 4) * Math.max(0.25, 1 - v / 70) * dt;
    const want = pull > 0 && v > P.rot ? 0.16 : 0;
    ride.pitch = (ride.pitch || 0) + (want - (ride.pitch || 0)) * Math.min(1, 4 * dt); ride.lean = 0;
    const cp = Math.cos(ride.pitch);
    ride.vel.set(Math.cos(ride.yaw) * v * cp, v > P.rot ? v * Math.sin(ride.pitch) : 0, -Math.sin(ride.yaw) * v * cp);
    moveBody(ride, ride.vel.x * dt, ride.vel.y * dt, ride.vel.z * dt);
    if (ride.blocked && v > 8) crash = true;
    if (ride.pos.y - groundH(ride.pos.x, ride.pos.z, ride.pos.y) > 0.3) {   // abgehoben → freie Flugsteuerung
      ride.air = true; q.setFromEuler(_jeu.set(ride.lean, ride.yaw, ride.pitch, 'YXZ')); ride.pitchRate = 0; ride.rollRate = 0;
    }
  } else {
    // --- in der Luft ---
    _jfw.copy(AX_X).applyQuaternion(q); _jup.copy(AX_Y).applyQuaternion(q); _jri.copy(AX_Z).applyQuaternion(q);
    const auth = Math.max(0.2, Math.min(1, (v - 25) / 35));   // Ruder wirken erst mit Fahrt
    const pr = pull > 0 ? 1.9 * pull * auth : 0.95 * pull * auth;            // Ziehen bis 1,9 rad/s → Kurvenradius ~55 m bei 400 km/h
    const rr = -steer * 3.4 * Math.min(1, 0.4 + v / 80);                    // Rolle: volle Umdrehung in ~1,9 s
    ride.pitchRate = (ride.pitchRate || 0) + (pr - (ride.pitchRate || 0)) * Math.min(1, 7 * dt);
    ride.rollRate = (ride.rollRate || 0) + (rr - (ride.rollRate || 0)) * Math.min(1, 9 * dt);
    q.multiply(_jq.setFromAxisAngle(AX_X, ride.rollRate * dt)).multiply(_jq.setFromAxisAngle(AX_Z, ride.pitchRate * dt));
    const bank = Math.asin(Math.max(-1, Math.min(1, -_jri.y)));          // > 0 = rechte Fläche unten
    if (_jup.y > -0.1 && Math.abs(_jfw.y) < 0.85)   // Schräglage allein lenkt schon in die Kurve (90° gekippt ≈ 22°/s bei 400 km/h)
      q.premultiply(_jq.setFromAxisAngle(AX_Y, -Math.sin(bank) * 9.81 / Math.max(v, 30) * 4 * dt));
    if (_jup.y > 0.25 && Math.abs(_jfw.y) < 0.8 && !steer && Math.abs(bank) < 1.1)   // ohne A/D langsam waagerecht (nicht im Looping/Rückenflug)
      q.multiply(_jq.setFromAxisAngle(AX_X, -bank * 1.1 * dt));
    const lift = Math.min(1.3, (v / P.stall) ** 2);
    if (lift < 0.85) {   // Strömungsabriss: Nase fällt nach unten
      _jm4.identity(); const ax = new THREE.Vector3().crossVectors(_jfw, new THREE.Vector3(0, -1, 0));
      if (ax.lengthSq() > 1e-4) q.premultiply(_jq.setFromAxisAngle(ax.normalize(), (0.85 - lift) * 2.2 * dt));
    }
    q.normalize();
    _jfw.copy(AX_X).applyQuaternion(q); _jup.copy(AX_Y).applyQuaternion(q);
    // Tempo: Schub – Luftwiderstand – Steigung – Kurvenwiderstand (enges Ziehen kostet Fahrt)
    const flaps = (0.35 - Math.min(0.35, ride.thrl)) * 0.04 * v;
    v += (ride.thrl * T - v * v * (T / (VM * VM)) - flaps - 9.81 * _jfw.y - 0.035 * Math.abs(ride.pitchRate) * v) * dt;
    v = Math.max(0, v);
    ride.vel.copy(_jfw).multiplyScalar(v); ride.vel.y -= (1 - Math.min(1, lift)) * 9;
    if (ride.pos.y > P.ceil && ride.vel.y > 0) ride.vel.y = 0;
    const vyBefore = ride.vel.y;
    moveBody(ride, ride.vel.x * dt, ride.vel.y * dt, ride.vel.z * dt);
    if (ride.blocked && v > 8) crash = true;
    // Kartenrand: automatisch wenden
    const XMIN = -430, XMAX = 1750, ZM = 430, ZMAX = WELT_ZS - 10;
    if (ride.pos.x < XMIN || ride.pos.x > XMAX || ride.pos.z < -ZM || ride.pos.z > ZMAX) {
      ride.pos.x = Math.max(XMIN, Math.min(XMAX, ride.pos.x)); ride.pos.z = Math.max(-ZM, Math.min(ZMAX, ride.pos.z));
      q.premultiply(_jq.setFromAxisAngle(AX_Y, Math.PI * 0.9 * dt));
      if (!ride.edgeMsg || performance.now() - ride.edgeMsg > 3000) { ride.edgeMsg = performance.now(); showMsg('Kartenrand – bitte umkehren'); }
    }
    // Boden berührt: Landung (Flächen waagerecht, Nase nicht nach unten, nicht zu hart) oder Bruch
    if (ride.pos.y - groundH(ride.pos.x, ride.pos.z, ride.pos.y) < 0.05 && !crash) {
      if (_jup.y > 0.9 && _jfw.y > -0.22 && vyBefore > -8) {
        landed = true; ride.air = false;
        ride.yaw = Math.atan2(-_jfw.z, _jfw.x); ride.pitch = 0; ride.lean = 0; v = Math.hypot(ride.vel.x, ride.vel.z);
        sndThud(0.35); showMsg(v > 15 ? '✈ Gelandet – S zum Bremsen' : '✈ Gelandet');
      } else crash = true;
    }
    if (ride.air) { _jeu.setFromQuaternion(q, 'YXZ'); ride.lean = _jeu.x; ride.yaw = _jeu.y; ride.pitch = _jeu.z; }
  }
  if (crash) {
    sndThud(1); me.shake = Math.max(me.shake, 1);
    for (let k = 0; k < 8; k++) puff(new THREE.Vector3(ride.pos.x + rnd(-2, 2), ride.pos.y + 1, ride.pos.z + rnd(-2, 2)), k % 2 ? 0x333333 : 0xff8a20, 0.8, 1.6, new THREE.Vector3(rnd(-2, 2), 2, rnd(-2, 2)), { opacity: 0.7, grow: 3 });
    showMsg('💥 BRUCHLANDUNG! Der Jet ist wieder heil – flacher und langsamer aufsetzen');
    v = 0; ride.thrl = 0; ride.pitch = 0; ride.lean = 0; ride.air = false; ride.pitchRate = 0; ride.rollRate = 0;
    _jfw.copy(AX_X).applyQuaternion(q); ride.yaw = Math.atan2(-_jfw.z, _jfw.x);
    ride.pos.y = groundH(ride.pos.x, ride.pos.z, ride.pos.y + 300);
  }
  if (ride.pos.y < -10) { ride.pos.set(950, 1, 300); ride.air = false; }
  const nowOnG = !ride.air;
  ride.planeV = v; ride.speed = v; ride.wh = 0; ride.dive = 0; ride.thr = thr; ride.onGround = nowOnG;
  me.pos.set(ride.pos.x, ride.pos.y + K.up, ride.pos.z); me.vel.set(0, 0, 0); me.onGround = true;
  const veh = vehicles[ride.v]; veh.x = ride.pos.x; veh.y = ride.pos.y; veh.z = ride.pos.z; veh.yaw = ride.yaw; veh.lean = ride.lean; veh.wh = ride.pitch; veh.st = ride.thrl;
  // Kamera: folgt dem Jet in jeder Lage (auch kopfüber im Looping); Maus bewegt = kurz frei umschauen
  if (!ride.air) q.setFromEuler(_jeu.set(ride.lean, ride.yaw, ride.pitch, 'YXZ'));
  if (!ride.camQ) ride.camQ = q.clone();
  ride.camQ.slerp(q, Math.min(1, dt * 5));
  const free = performance.now() - ride.lastMouse < 900;
  _jfw.copy(AX_X).applyQuaternion(ride.camQ); _jup.copy(AX_Y).applyQuaternion(ride.camQ);
  const target = new THREE.Vector3(ride.pos.x, ride.pos.y + 1.7, ride.pos.z);
  if (free) {
    const back = new THREE.Vector3(Math.sin(me.yaw) * Math.cos(me.pitch), -Math.sin(me.pitch), Math.cos(me.yaw) * Math.cos(me.pitch));
    let dist = K.camD; const hit = rayMap(target, back, dist + 0.3); if (hit) dist = Math.max(1.5, hit.dist - 0.3);
    camera.position.copy(target).addScaledVector(back, dist);
    camera.rotation.set(me.pitch, me.yaw, 0);
  } else {
    const off = _jfw.clone().multiplyScalar(-K.camD).addScaledVector(_jup, 3.2), dist = off.length(), dir = off.clone().divideScalar(dist);
    const hit = rayMap(target, dir, dist + 0.3), d = hit ? Math.max(1.5, hit.dist - 0.3) : dist;
    camera.position.copy(target).addScaledVector(dir, d);
    // Blick knapp über den Jet nach vorne (Fadenkreuz = Schussrichtung), Horizont kippt mit dem Jet
    const look = _jfw.clone().multiplyScalar(60).addScaledVector(_jup, 1.5).add(target).sub(camera.position).normalize();
    const xA = new THREE.Vector3().crossVectors(_jup, look.clone().negate()).normalize(), yA = new THREE.Vector3().crossVectors(look.clone().negate(), xA);
    _jm4.makeBasis(xA, yA, look.clone().negate()); camera.quaternion.setFromRotationMatrix(_jm4);
    me.yaw = Math.atan2(-look.x, -look.z); me.pitch = Math.asin(Math.max(-1, Math.min(1, look.y)));   // freier Blick startet von hier
  }
  me.shake = Math.max(0, me.shake - dt * 1.6);
  if (ab) me.shake = Math.max(me.shake, 0.04);
  camera.fov += ((fovBase + Math.min(15, v * 0.11)) - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix();
  engineSound(true, v, ride.thrl + (ab ? 0.35 : 0), 'jet');
  jetWeapons(nowOnG);
  viewKnife.visible = false; viewNade.visible = false; viewGun.visible = false;
}
function planeRide(dt) {
  const jet = ride.ctype === 'jet', K = jet ? JET_K : VK.plane, P = jet ? JET : PLANE;
  let thr = (keys.KeyW || keys.Gas ? 1 : 0) - (keys.KeyS ? 1 : 0), steer = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
  if (touchIn.my) thr = -touchIn.my;
  if (touchIn.mx) steer = -touchIn.mx;
  const pull = (keys.Space ? 1 : 0) - (keys.KeyC || keys.ControlLeft ? 1 : 0);
  const gh = groundH(ride.pos.x, ride.pos.z, ride.pos.y), alt = ride.pos.y - gh, onG = alt < 0.05;
  // Gas nur, solange W gedrückt ist (loslassen = Schub geht zurück), am Boden mit S bremsen
  ride.thrl = planeThrottle(ride.thrl || 0, thr, dt);
  let v = ride.planeV || 0;
  const pitch0 = ride.pitch || 0;
  const flaps = (0.35 - Math.min(0.35, ride.thrl)) * (jet ? 0.04 : 0.06) * v;   // wenig Gas: Landeklappen → langsamer anfliegen (~95 km/h)
  const ab = jet && ride.thrl > 0.97, T = P.thrust * (ab ? 1.6 : 1), VM = P.vmax * (ab ? 1.35 : 1);   // Jet: Vollgas = Nachbrenner (~560 km/h)
  v += (ride.thrl * T - v * v * (T / (VM * VM)) - flaps - 9.81 * Math.sin(pitch0) - (onG ? 0.6 : 0)) * dt;
  if (onG && thr < 0) v -= (jet ? 14 : 8) * dt;   // Radbremse
  v = Math.max(0, v);
  const lift = Math.min(1.3, (v / P.stall) ** 2);
  if (onG) {
    // Rollen: Bugrad lenkt, Nase hoch erst ab Abhebetempo
    ride.yaw += steer * 0.7 * Math.min(1, v / 4) * Math.max(0.25, 1 - v / (jet ? 70 : 40)) * dt;
    const want = pull > 0 && v > P.rot ? 0.14 : 0;
    ride.pitch = pitch0 + (want - pitch0) * Math.min(1, 4 * dt);
    ride.lean += (0 - ride.lean) * Math.min(1, 6 * dt);
  } else {
    // In der Luft: Querlage → Kurve, Höhenruder → Nase hoch/runter (wirkt erst mit Fahrt), ohne Eingabe langsam waagerecht
    const auth = Math.min(1, v / (jet ? 35 : 20));
    // wendig wie ein Kunstflug-Kleinflugzeug: bis ~60° Querlage, schnelles Rollen; Ziehen in der Querlage = noch engere Kurve
    // Kampfjet: bis ~72° Querlage, sehr schnelle Rolle; voll gezogene Kurve bei 400 km/h ≈ 120 m Radius
    ride.lean += ((-steer * (jet ? 1.25 : 1.05)) - ride.lean) * Math.min(1, (jet ? 5.5 : 3.6) * dt);
    const bank = Math.sin(ride.lean), pullT = Math.max(0, pull) * Math.abs(bank);
    ride.yaw += -bank * (jet ? 0.38 + 5 / Math.max(v, 30) + pullT * 0.6 : 0.62 + 6 / Math.max(v, 15) + pullT * 0.45) * auth * dt;   // Wendekreis bei 145 km/h ≈ 60 m (vorher ≈ 190 m)
    let p = pitch0 + pull * (jet ? 0.85 : 0.6) * auth * Math.cos(ride.lean) * dt;   // in Schräglage zieht das Höhenruder eher in die Kurve als nach oben
    if (!pull) p += (-0.13 * (1 - ride.thrl) - p) * Math.min(1, 0.7 * dt);   // loslassen: waagerecht, mit wenig Gas sanfter Gleitflug
    if (lift < 0.85) p += (-0.45 - p) * (0.85 - lift) * 2.2 * dt;   // Strömungsabriss: Nase fällt
    ride.pitch = Math.max(jet ? -0.8 : -0.6, Math.min(jet ? 0.75 : 0.45, p));
  }
  // Bewegung entlang der Nase; zu wenig Auftrieb = zusätzliches Sinken
  const fx = Math.cos(ride.yaw), fz = -Math.sin(ride.yaw), cp = Math.cos(ride.pitch);
  let vy = v * Math.sin(ride.pitch) * (onG ? (v > P.rot ? 1 : 0) : 1) - (onG ? 0 : (1 - Math.min(1, lift)) * 9);
  if (ride.pos.y > P.ceil && vy > 0) vy = 0;
  ride.vel.set(fx * v * cp, vy, fz * v * cp);
  const vyBefore = vy;
  moveBody(ride, ride.vel.x * dt, vy * dt, ride.vel.z * dt);
  // Kartenrand: wenden statt hinausfliegen
  const XMIN = -430, XMAX = 1750, ZM = 430, ZMAX = WELT_ZS - 10;
  if (ride.pos.x < XMIN || ride.pos.x > XMAX || ride.pos.z < -ZM || ride.pos.z > ZMAX) {
    ride.pos.x = Math.max(XMIN, Math.min(XMAX, ride.pos.x)); ride.pos.z = Math.max(-ZM, Math.min(ZMAX, ride.pos.z));
    if (!onG) { ride.yaw += Math.PI * dt * 0.9; if (!ride.edgeMsg || performance.now() - ride.edgeMsg > 3000) { ride.edgeMsg = performance.now(); showMsg('Kartenrand – bitte umkehren'); } }
  }
  const gh2 = groundH(ride.pos.x, ride.pos.z, ride.pos.y), nowOnG = ride.pos.y - gh2 < 0.05;
  // Aufsetzen / Bruchlandung / Aufprall
  let crash = ride.blocked && v > 8;
  if (!onG && nowOnG) {
    if (vyBefore < (jet ? -8 : -6) || Math.abs(ride.lean) > 0.5 || ride.pitch < -0.25) crash = true;
    else { sndThud(0.35); showMsg(v > 15 ? '✈ Gelandet – S zum Bremsen' : '✈ Gelandet'); ride.pitch = 0; }
  }
  if (crash) {
    sndThud(1); me.shake = Math.max(me.shake, 1);
    for (let k = 0; k < 8; k++) puff(new THREE.Vector3(ride.pos.x + rnd(-2, 2), ride.pos.y + 1, ride.pos.z + rnd(-2, 2)), k % 2 ? 0x333333 : 0xff8a20, 0.8, 1.6, new THREE.Vector3(rnd(-2, 2), 2, rnd(-2, 2)), { opacity: 0.7, grow: 3 });
    showMsg(jet ? '💥 BRUCHLANDUNG! Der Jet ist wieder heil – flacher und langsamer aufsetzen' : '💥 BRUCHLANDUNG! Das Flugzeug ist wieder heil – vorsichtiger landen'); v = 0; ride.thrl = 0; ride.pitch = 0; ride.lean = 0;
    ride.pos.y = groundH(ride.pos.x, ride.pos.z, ride.pos.y + 300);
  }
  if (ride.pos.y < -10) ride.pos.set(950, 1, 300);
  ride.planeV = v; ride.speed = v; ride.wh = 0; ride.dive = 0; ride.thr = thr; ride.onGround = nowOnG;
  me.pos.set(ride.pos.x, ride.pos.y + K.up, ride.pos.z); me.vel.set(0, 0, 0); me.onGround = true;
  const veh = vehicles[ride.v]; veh.x = ride.pos.x; veh.y = ride.pos.y; veh.z = ride.pos.z; veh.yaw = ride.yaw; veh.lean = ride.lean; veh.wh = ride.pitch; veh.st = ride.thrl;
  // Kamera: hinter dem Flugzeug (folgt der Nase), Maus schaut frei
  if (performance.now() - ride.lastMouse > 900) {
    let d = (ride.yaw - Math.PI / 2) - me.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); me.yaw += d * Math.min(1, dt * 2.5);
    me.pitch += ((-0.12 - ride.pitch * 0.6) - me.pitch) * Math.min(1, dt * 2);
  }
  const target = new THREE.Vector3(ride.pos.x, ride.pos.y + K.camH, ride.pos.z);
  const back = new THREE.Vector3(Math.sin(me.yaw) * Math.cos(me.pitch), -Math.sin(me.pitch), Math.cos(me.yaw) * Math.cos(me.pitch));
  let dist = K.camD; const hit = rayMap(target, back, dist + 0.3); if (hit) dist = Math.max(1.5, hit.dist - 0.3);
  camera.position.copy(target).addScaledVector(back, dist);
  camera.rotation.set(me.pitch, me.yaw, ride.lean * 0.35);
  me.shake = Math.max(0, me.shake - dt * 1.6);
  camera.fov += ((fovBase + Math.min(jet ? 15 : 12, v * (jet ? 0.11 : 0.18))) - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix();
  if (ab) me.shake = Math.max(me.shake, 0.04);   // Nachbrenner rüttelt leicht
  engineSound(true, v, ride.thrl + (ab ? 0.35 : 0), jet ? 'jet' : 'plane');
  if (jet) jetWeapons(nowOnG); else planeBombs(nowOnG);
  viewKnife.visible = false; viewNade.visible = false; viewGun.visible = false;
}
// Panzerkanone: Linksklick, 2,5 s Nachladen; Granate fliegt aus der Rohrmündung in Rohrrichtung
const TANK_RELOAD = 2.5;
const GUSTAV_RELOAD = 9;
const tankReload = () => ride.ctype === 'gustav' ? GUSTAV_RELOAD : TANK_RELOAD;
function tankFire(now) {
  if (!me.trigger || me.firedPress) return;
  me.firedPress = true;
  if (ride.ctype === 'gustav') {   // Riesengranate: fliegt im hohen Bogen (wie eine Bombe), riesige Explosion
    if (now - (ride.tankShot || -99) < GUSTAV_RELOAD) { sndClick(0.05, 2); return; }
    ride.tankShot = now;
    const m = vehicles[ride.v].mesh; m.root.updateMatrixWorld(true);
    const tip = m.barrel.localToWorld(new THREE.Vector3(m.muzzleX, 0, 0)), dir = tip.clone().sub(m.barrel.localToWorld(new THREE.Vector3(0, 0, 0))).normalize();
    fireRocket(tip, dir.clone().multiplyScalar(115), true, BOMB_W);
    sndBoom(tip); setTimeout(() => sndBoom(tip), 70); me.shake = Math.max(me.shake, 1.4); ride.recoil = 1;
    explosionFx(tip.clone());
    for (let k = 0; k < 14; k++) puff(tip.clone(), 0xcfcfcf, rnd(1, 2), rnd(2, 3.5), dir.clone().multiplyScalar(rnd(3, 9)).add(new THREE.Vector3(rnd(-2, 2), rnd(0, 2), rnd(-2, 2))), { opacity: 0.6, grow: 5 });
    return;
  }
  if (now - (ride.tankShot || -9) < TANK_RELOAD) { sndClick(0.05, 2); return; }
  ride.tankShot = now;
  const ty = ride.yaw + (ride.turret || 0), pit = ride.barrelP || 0, cp = Math.cos(pit);
  const dir = new THREE.Vector3(Math.cos(ty) * cp, Math.sin(pit), -Math.sin(ty) * cp);
  const piv = new THREE.Vector3(ride.pos.x - Math.cos(ride.yaw) * 0.3 + Math.cos(ty) * 1.55, ride.pos.y + 2.13, ride.pos.z + Math.sin(ride.yaw) * 0.3 - Math.sin(ty) * 1.55);
  const tip = piv.clone().addScaledVector(dir, 4.8);
  fireRocket(tip, dir.clone().multiplyScalar(95), true, TANK_W);
  sndBoom(tip); me.shake = Math.max(me.shake, 0.5); ride.recoil = 1;
  for (let k = 0; k < 5; k++) puff(tip.clone(), 0xd0d0d0, 0.6, 1.4, dir.clone().multiplyScalar(rnd(2, 5)).add(new THREE.Vector3(rnd(-1, 1), rnd(0, 1), rnd(-1, 1))), { opacity: 0.55, grow: 4 });
}
/* ---------- Auto-Fahrphysik aus „Drift-Welt“: Längs- und Quergeschwindigkeit, Reifenhaftung, Handbremse ----------
   Gas im Drift hält das Heck draußen, Handbremse (Leertaste / Sprung-Taste) bricht das Heck aus, abseits der Straße bremst Gras. */
function carOnRoad(x, z) {
  if (MAP_ID === 'kreppendorf') return window.krepOnRoad(x, z);
  if (MAP_ID !== 'welt') return true;   // Tokio/Hafen: überall Asphalt
  if (x > 28 && x < 292 && z > -292 && z < -28) return true;   // Großstadt
  if (x > 8 && x < 46 && z > 8 && z < 46) return true;          // Tankstelle
  if (typeof trackDist === 'function' && trackDist(x, z) < 8) return true;   // Rennstrecken
  for (const [x0, z0, x1, z1] of window.MAP_STREETS || []) if (x > x0 - 1 && x < x1 + 1 && z > z0 - 1 && z < z1 + 1) return true;
  return false;
}
/* Realistischeres Fahrmodell (Einspur-Modell mit Hinterradantrieb):
   - Vorder- und Hinterreifen haben je eine Haftungskurve (Pacejka): bis ~10° Schräglauf greift der Reifen immer stärker,
     darüber rutscht er mit weniger Kraft weiter → das Heck kann wirklich ausbrechen
   - Reibungskreis hinten: wer viel Gas gibt, nimmt den Hinterreifen Seitenhalt → Power-Oversteer, Drift mit Gas halten
   - Gewichtsverlagerung: Bremsen belastet vorne (Auto lenkt besser ein), Gas belastet hinten
   - Handbremse blockiert die Hinterräder → Heck kommt sofort
   - Vorderräder richten sich von selbst nach der Fahrtrichtung aus (Nachlauf) → Gegenlenken im Drift fühlt sich natürlich an */
const CARP = { m: 1250, a: 1.42, b: 1.45, h: 0.5, Iz: 2050, muF: 1.0, muR: 1.1, BF: 8, BR: 10, C: 1.45, P: 200000, Fmax: 7600, drag: 1.15, roll: 160, brake: 1.05,
  maxSteer: 0.62, steerFade: 10, spinCap: 0.8, spinLat: 0.15, assist: 1.2, mw: 55, rev: 66, pull: 3 };
/* Hinterreifen mit echter Raddrehzahl: Schlupf längs (Rad dreht schneller als das Auto fährt) und quer (Heck rutscht)
   teilen sich EINEN Haftungskreis. Dreht das Rad durch, bleibt kaum Seitenhalt → Heck kommt; mehr Gas = mehr Driftwinkel,
   Gas weg = Rad greift wieder → Auto fängt sich. So lässt sich der Drift wie bei einem echten Hecktriebler mit dem Gas dosieren. */
function rearTire(wR, u, vyR, Fz, mu, BR = CARP.BR) {
  const d = Math.max(Math.abs(u), 3), sx = (wR - u) / d, sy = vyR / d, s = Math.hypot(sx, sy * 1.15);
  if (s < 1e-6) return [0, 0];
  const F = mu * Fz * Math.sin(CARP.C * Math.atan(BR * s));
  return [F * sx / s, -F * sy * 1.15 / s];
}
const pacejka = (alpha, Fz, mu, B) => -mu * Fz * Math.sin(CARP.C * Math.atan(B * alpha));
function carDrive(dt, thr, steerIn, hand, analog) {
  // Tastatur: Gas kommt weich (statt sofort 100 %), damit sich ein Drift ruhiger halten lässt
  const g0 = Math.max(0, thr);
  ride.gasS = analog ? g0 : (ride.gasS || 0) + (g0 - (ride.gasS || 0)) * Math.min(1, (g0 > (ride.gasS || 0) ? 7 : 14) * dt);
  const K = ride.carK || CARP, L = K.a + K.b, g = 9.81, gas = g0 > 0 ? Math.max(0.05, ride.gasS) : 0, brakeIn = Math.max(0, -thr);
  const fx = () => Math.cos(ride.yaw), fz = () => -Math.sin(ride.yaw);
  // Fahrzeug-Koordinaten: u = vorwärts, vy = nach links, r = Gierrate (links positiv)
  let u = ride.cvx * fx() + ride.cvz * fz(), vy = -(ride.cvx * Math.sin(ride.yaw) + ride.cvz * Math.cos(ride.yaw)), r = ride.yawRate || 0;
  let ax = ride.ax || 0, wheelspin = 0, wR = ride.wR === undefined ? u : ride.wR;
  const N = Math.max(2, Math.ceil(dt / 0.006)), h = dt / N;
  if (analog) steerIn = Math.sign(steerIn) * Math.pow(Math.abs(steerIn), 0.7);   // Lenkrad: kleine Ausschläge wirken schon spürbar
  ride.steerS += (steerIn - ride.steerS) * Math.min(1, (analog ? 20 : 7) * dt);
  for (let k = 0; k < N; k++) {
    const au = Math.max(Math.abs(u), 2.5), sgn = u < -0.5 ? -1 : 1;
    // Lenkwinkel: Fahrer + Selbstausrichtung (Nachlauf) zur Fahrtrichtung der Vorderachse
    const free = Math.atan2(vy + K.a * r, au) * sgn;
    // Lenkung wird mit dem Tempo feiner; fadePow > 1 (F1): bei mittlerem Tempo viel Einschlag, erst sehr schnell deutlich weniger
    const sens = K.fadePow ? 1 / (1 + Math.pow(Math.abs(u) / (analog ? K.steerFade * 1.25 : K.steerFade), K.fadePow))
      : analog ? 1 / (1 + Math.abs(u) / 40) : 1 / (1 + Math.abs(u) / K.steerFade);
    const align = Math.min(1, Math.abs(u) / 6) * (analog ? 0.5 : 0.8);
    const delta = Math.max(-K.maxSteer, Math.min(K.maxSteer, ride.steerS * K.maxSteer * sens + free * align));
    // Radlasten mit Gewichtsverlagerung
    const W = K.m * g, Wa = W + (K.aero || 0) * u * u;   // Abtrieb (Formel 1): drückt mit dem Tempo² auf die Reifen
    const FzF = Math.max(800, Wa * K.b / L - K.m * ax * K.h / L), FzR = Math.max(800, Wa * K.a / L + K.m * ax * K.h / L);
    // Längskräfte: Antrieb hinten, Bremse 65/35, Handbremse blockiert hinten, rückwärts fahren
    let FxF = 0, drive = 0, brakeR = 0;
    const capR = K.muR * FzR;
    if (brakeIn && u > 0.5) { const Fb = brakeIn * K.brake * W, rb = K.brakeRear || 0.35; FxF = -Fb * (1 - rb); brakeR = Fb * rb; }   // Bremskraftverteilung vorne/hinten
    else if (brakeIn) drive = u > -12 ? -brakeIn * 4200 : 0;   // rückwärts
    else if (gas) { const nb = ride.nitroT > 0 ? 1.65 : 1; drive = wR > K.rev * (nb > 1 ? 1.2 : 1) ? 0 : gas * nb * Math.min(K.Fmax, K.P / Math.max(Math.abs(wR), 4)); }   // Nitro: mehr Schub und Drehzahl
    if (K.tc && gas && wR - u > 0.08 * Math.max(Math.abs(u), 3)) drive *= 1 - K.tc;   // Traktionskontrolle (Rennwagen): Gas weg, wenn die Räder durchdrehen
    FxF = Math.max(-K.muF * FzF, FxF);
    if (hand && Math.abs(u) > 1) brakeR = Math.max(brakeR, 2.2 * capR);   // Handbremse blockiert die Hinterräder
    // Hinterrad: Antrieb gegen Reifenkraft (implizit gerechnet, damit es nicht zittert), dann Bremse Richtung Stillstand
    const vyR = vy - K.b * r, lowK = Math.min(1, Math.hypot(u, vy) / 3);   // fast im Stand keine Seitenkräfte (sonst dreht es sich auf der Stelle)
    const t0 = rearTire(wR, u, vyR, FzR, K.muR, K.BR)[0], dF = (rearTire(wR + 0.05, u, vyR, FzR, K.muR, K.BR)[0] - t0) / 0.05;
    wR += h * (drive - t0) / (K.mw + h * Math.max(0, dF));
    if (brakeR) { const dw = brakeR / K.mw * h; wR = Math.abs(wR) <= dw ? 0 : wR - Math.sign(wR) * dw; }
    if (!gas && !brakeIn && !hand) wR += (u - wR) * Math.min(1, 1.5 * h);   // ausgekuppelt rollen
    const [FxR, FyRraw] = rearTire(wR, u, vyR, FzR, K.muR, K.BR);
    const FyR = FyRraw * lowK;
    wheelspin = Math.max(wheelspin, Math.min(1, Math.abs(wR - u) / Math.max(4, Math.abs(u) * 0.5)));
    // Vorderreifen: Schräglauf → Haftungskurve, beim Bremsen weniger Seitenhalt
    const alphaF = Math.atan2(vy + K.a * r, au) - delta * sgn;
    const FyF = pacejka(alphaF, FzF, K.muF, K.BF) * lowK * Math.sqrt(Math.max(0, 1 - (FxF / (K.muF * FzF)) ** 2));
    // Bewegungsgleichungen
    const cd = Math.cos(delta), sd = Math.sin(delta);
    const Fdrag = K.drag * u * Math.abs(u) + K.roll * Math.sign(u) * Math.min(1, Math.abs(u));
    const Fx = FxR + FxF * cd - FyF * sd - Fdrag, Fy = FyR + FxF * sd + FyF * cd;
    const axNew = Fx / K.m;
    u += (axNew + r * vy) * h; vy += (Fy / K.m - r * u) * h;
    if (K.absD && brakeIn && u > 0.5) u = Math.max(0.3, u - K.absD * brakeIn * h);
    r += ((K.a * (FyF * cd + FxF * sd)) - K.b * FyR) / K.Iz * h;
    // Drift-Hilfe (Tastatur stark, Lenkrad schwächer): ab ~40° Querstellung bremst sie das Weiterdrehen, damit man sich nicht sofort dreht
    const beta = Math.atan2(vy, Math.max(Math.abs(u), 1));
    // Drift-Hilfe: bis ~30° frei driften; darüber greift das Heck wieder etwas → Auto dreht nicht weiter auf und
    // die Fahrtrichtung folgt der Nase (Tempo bleibt), damit man in der Kurve nicht nach außen wegrutscht
    const lim = analog ? 0.58 : 0.52, ex = Math.abs(beta) - lim;
    if (Math.abs(u) > 4 && ex > 0) {
      if (Math.sign(r) === -Math.sign(beta)) r -= r * Math.min(1, K.assist * (ex * 9 + ex * ex * 70) * h);   // je weiter drüber, desto stärker
      const sp = Math.hypot(u, vy), nb = beta - Math.sign(beta) * Math.min(ex, ex * K.pull * h);
      u = sp * Math.cos(nb) * Math.sign(u || 1); vy = sp * Math.sin(nb);
    }
    ax += (axNew - ax) * Math.min(1, 10 * h);
    // sehr langsam: stabil wie ein normales Auto (keine Zitter-Bewegungen)
    if (Math.abs(u) < 3 && (!gas || wheelspin < 0.5)) { const k2 = Math.min(1, (Math.abs(u) < 1.5 ? 30 : 6) * h); vy -= vy * k2; r += (u * Math.tan(delta) / L - r) * k2; }
    if (!gas && !brakeIn && Math.abs(u) < 1) u *= 1 - Math.min(1, 8 * h);
    ride.yaw += r * h;
  }
  const sx = Math.sin(ride.yaw), sz = Math.cos(ride.yaw);
  ride.cvx = fx() * u - sx * vy; ride.cvz = fz() * u - sz * vy;
  ride.yawRate = r; ride.ax = ax; ride.wspin = wheelspin; ride.wR = wR;
  const speed = Math.hypot(u, vy);
  ride.onRoad = carOnRoad(ride.pos.x, ride.pos.z);
  ride.vel.x = ride.cvx; ride.vel.z = ride.cvz;
  ride.speed = u; ride.slip = speed > 3 ? Math.abs(Math.atan2(vy, Math.abs(u))) : 0; ride.hand = hand && speed > 4;
  ride.lean += (Math.max(-0.06, Math.min(0.06, r * u * 0.005)) - ride.lean) * Math.min(1, dt * 6);   // Karosserie neigt sich nach außen
  ride.dive = (ride.dive || 0) + (Math.max(-0.04, Math.min(0.04, -ax * 0.004)) - (ride.dive || 0)) * Math.min(1, dt * 5);   // Nicken beim Bremsen/Gasgeben
  ride.st = Math.max(-0.6, Math.min(0.6, ride.steerS * K.maxSteer + Math.atan2(vy + K.a * r, Math.max(Math.abs(u), 2.5)) * (analog ? 0.45 : 0.8)));   // sichtbarer Radeinschlag inkl. Gegenlenken
}
// Drift-Punkte → Coins (lange Drifts geben einen Multiplikator, ein Crash löscht den Drift)
const DRIFT = { pts: 0, time: 0, idle: 0 };
const driftHud = document.createElement('div'); driftHud.id = 'driftHud'; document.getElementById('hud').appendChild(driftHud);
function driftScore(dt) {
  const sp = Math.hypot(ride.vel.x, ride.vel.z), drifting = (ride.slip || 0) > 0.28 && sp > 8 && ride.speed > 0 && ride.onGround;
  if (drifting) { DRIFT.pts += ride.slip * sp * dt * 12; DRIFT.time += dt; DRIFT.idle = 0; }
  else if (DRIFT.pts > 0) {
    DRIFT.idle += dt;
    if (DRIFT.idle > 1) {
      const mult = Math.min(5, 1 + Math.floor(DRIFT.time / 2)), gain = Math.round(DRIFT.pts * mult), coins = Math.floor(gain / 60);
      if (coins > 0) { shopState.coins += coins; saveShop(); updateCoins(true); }
      showMsg(`DRIFT ${gain.toLocaleString('de-DE')} Punkte (×${mult})${coins ? `  +${coins} Coins` : ''}`);
      DRIFT.pts = 0; DRIFT.time = 0;
    }
  }
  const mult = Math.min(5, 1 + Math.floor(DRIFT.time / 2));
  driftHud.classList.toggle('on', DRIFT.pts > 0 && ride.v >= 0);
  if (DRIFT.pts > 0) driftHud.innerHTML = `<b>${Math.round(DRIFT.pts).toLocaleString('de-DE')}</b><span>DRIFT ×${mult}</span>`;
  ride.drifting = drifting;
}
// Drift-Arena: Rundenzeit (Start/Ziel überqueren, mindestens 85 % der Strecke abfahren, keine Abkürzung)
const LAP = { idx: -1, seen: 0, t: 0, on: false, n: 0, best: 0 };
try { LAP.best = +localStorage.getItem('kz_bestlap') || 0; } catch (e) {}
const lapHud = document.createElement('div');
lapHud.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.55);color:#fff;font:700 18px system-ui;padding:6px 14px;border-radius:8px;pointer-events:none;display:none;white-space:nowrap';
document.getElementById('hud').appendChild(lapHud);
const lapFmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
function lapReset() { LAP.on = false; LAP.idx = -1; lapHud.style.display = 'none'; }
// Taste „Zur Startlinie“: Auto auf der Rennstrecke ~22 m vor die Startlinie stellen (in Fahrtrichtung, im Stand), Runde neu
function trackToStart() {
  const TS = window.DRIFT_TRACKS || [];
  const x = ride.v >= 0 ? ride.pos.x : me.pos.x, z = ride.v >= 0 ? ride.pos.z : me.pos.z;
  const T = TS.find(T => T.box[0] <= x && x <= T.box[2] && T.box[1] <= z && z <= T.box[3]);
  if (!T) return;   // nicht auf einer Strecke: Taste macht nichts
  if (ride.v < 0 || ride.kind !== 'car') { showMsg('🏁 Erst in ein Auto steigen – dann bringt dich ' + kbK('trackStart') + ' an den Start'); return; }
  const P = T.pts, N = P.length;
  let i = N - 1, d = 0;
  while (d < 22 && i > N / 2) { d += Math.hypot(P[i][0] - P[(i + 1) % N][0], P[i][1] - P[(i + 1) % N][1]); i--; }
  const [px, pz] = P[i], [qx, qz] = P[(i + 2) % N];
  ride.pos.set(px, groundH(px, pz) + 0.05, pz); ride.yaw = Math.atan2(-(qz - pz), qx - px);
  ride.vel.set(0, 0, 0); ride.cvx = ride.cvz = 0; ride.speed = 0; ride.yawRate = 0; ride.steerS = 0; ride.slip = 0; ride.ax = 0; ride.wspin = 0; ride.wR = 0; ride.gasS = 0;
  ride.lean = 0; ride.dive = 0; lastSkid = null; DRIFT.pts = 0; DRIFT.time = 0;
  me.yaw = ride.yaw - Math.PI / 2;
  lapReset(); LAP.T = T; LAP.n = 0; LAP.seen = 0;
  showMsg(`🏁 ${T.name}: zurück an den Start – fahr los!`);
}
const lapKey = T =>'kz_bestlap' + (T.key ? '_' + T.key : '');
function trackLap(dt) {
  const TS = window.DRIFT_TRACKS; if (!TS) return;
  const x = ride.pos.x, z = ride.pos.z, inB = T => T.box[0] <= x && x <= T.box[2] && T.box[1] <= z && z <= T.box[3];
  const T = LAP.T && inB(LAP.T) ? LAP.T : TS.find(inB);
  if (!T) { if (LAP.T) { lapReset(); LAP.T = null; } return; }
  if (T !== LAP.T) {   // andere Strecke: eigene Bestzeit
    lapReset(); LAP.T = T; LAP.n = 0; LAP.seen = 0;
    try { LAP.best = +localStorage.getItem(lapKey(T)) || 0; } catch (e) { LAP.best = 0; }
  }
  const P = T.pts, N = P.length;
  let best = -1, bd = 1e9;
  const from = LAP.idx < 0 ? 0 : LAP.idx - 30, to = LAP.idx < 0 ? N : LAP.idx + 30;
  for (let k = from; k < to; k++) { const i = (k + N) % N, d = (P[i][0] - x) ** 2 + (P[i][1] - z) ** 2; if (d < bd) { bd = d; best = i; } }
  lapHud.style.display = 'block';
  if (LAP.on) LAP.t += dt;
  lapHud.innerHTML = `🏁 ${T.name} · ${LAP.on ? 'Runde ' + (LAP.n + 1) + ' · ' + lapFmt(LAP.t) : 'Fahr über die Startlinie'}${LAP.best ? ' · Bestzeit ' + lapFmt(LAP.best) : ''}${typeof kbK === 'function' ? ` <span style="opacity:.7;font-weight:500;font-size:14px">· ${kbK('trackStart')} = zum Start</span>` : ''}`;
  if (bd > (T.W / 2 + 7) ** 2) { LAP.idx = -1; return; }   // neben der Strecke: neu suchen, zählt nicht
  if (LAP.idx < 0) { LAP.idx = best; return; }
  const d = (best - LAP.idx + N) % N;
  if (d > N / 2) {   // rückwärts
    LAP.seen -= N - d;
    if (LAP.idx < N * 0.1 && best > N * 0.9) { LAP.on = false; showMsg('Falsche Richtung!'); }
  } else {
    LAP.seen += d;
    if (LAP.idx > N * 0.9 && best < N * 0.1) {   // Start/Ziel überquert
      if (LAP.on && LAP.seen > N * 0.85) {
        const t = LAP.t, rec = !LAP.best || t < LAP.best, coins = rec && LAP.best ? 50 : 20;
        if (rec) { LAP.best = t; try { localStorage.setItem(lapKey(T), t); } catch (e) {} }
        shopState.coins += coins; saveShop(); updateCoins(true);
        showMsg(`🏁 Runde ${lapFmt(t)}${rec ? '  NEUE BESTZEIT!' : ''}  +${coins} Coins`);
        LAP.n++;
      } else if (!LAP.on) LAP.n = 0;
      LAP.on = true; LAP.t = 0; LAP.seen = 0;
    }
  }
  LAP.idx = best;
}
// Reifenspuren (schwarze Streifen auf dem Boden) und Reifenrauch an den Hinterrädern
const SKID = 2500, skidPos = new Float32Array(SKID * 18), skidGeo = new THREE.BufferGeometry();
skidGeo.setAttribute('position', new THREE.BufferAttribute(skidPos, 3));
const skidMesh = new THREE.Mesh(skidGeo, new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }));
skidMesh.frustumCulled = false; scene.add(skidMesh);
let skidIdx = 0, lastSkid = null, skidSmokeT = 0;
function skidQuad(a, b, y) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
  if (L < 0.05 || L > 4) return;
  const nx = -dz / L * 0.16, nz = dx / L * 0.16, o = (skidIdx++ % SKID) * 18;
  skidPos.set([a[0] + nx, y, a[1] + nz, b[0] + nx, y, b[1] + nz, b[0] - nx, y, b[1] - nz, a[0] + nx, y, a[1] + nz, b[0] - nx, y, b[1] - nz, a[0] - nx, y, a[1] - nz], o);
}
function carSkids(dt) {
  const sp = Math.hypot(ride.vel.x, ride.vel.z);
  const marking = ride.onGround && ((sp > 4 && ((ride.slip || 0) > 0.22 || ride.hand)) || (ride.wspin || 0) > 0.45);   // auch beim Durchdrehen (Burnout)
  if (!marking) { lastSkid = null; return; }
  const fx = Math.cos(ride.yaw), fz = -Math.sin(ride.yaw), sx = Math.sin(ride.yaw), sz = Math.cos(ride.yaw);
  const wl = [ride.pos.x - fx * 1.35 - sx * 0.85, ride.pos.z - fz * 1.35 - sz * 0.85], wr = [ride.pos.x - fx * 1.35 + sx * 0.85, ride.pos.z - fz * 1.35 + sz * 0.85];
  const y = ride.pos.y + 0.03;
  if (lastSkid) { skidQuad(lastSkid[0], wl, y); skidQuad(lastSkid[1], wr, y); skidGeo.attributes.position.needsUpdate = true; }
  lastSkid = [wl, wr];
  skidSmokeT -= dt;
  if (skidSmokeT <= 0 && ride.onRoad) {
    skidSmokeT = 0.05;
    for (const w of [wl, wr]) puff(new THREE.Vector3(w[0], ride.pos.y + 0.35, w[1]), 0xe8e8e8, 0.7, 1.4, new THREE.Vector3(rnd(-0.7, 0.7), 0.6, rnd(-0.7, 0.7)), { opacity: 0.32, grow: 3.2, fadeIn: 0.05 });
  }
}
// Mit dem Auto Gegner anfahren: je nach Tempo viel Schaden (pro Gegner höchstens einmal pro Sekunde)
function runOver(sp) {
  const now = performance.now();
  for (const id in world.players) {
    if (id === myId || friendly(id)) continue;
    const p = world.players[id]; if (!p.alive) continue;
    if (Math.hypot(p.x - ride.pos.x, p.z - ride.pos.z) > 2.1 || Math.abs(p.y - ride.pos.y) > 1.6) continue;
    if (now - (ride.runT[id] || 0) < 1000) continue;
    ride.runT[id] = now;
    net.send({ t: 'hit', target: id, dmg: Math.round(Math.min(150, sp * 6)), w: CAR_W, head: false });
    showHitmarker(false); sndThud(0.9); me.shake = Math.max(me.shake, 0.35); ride.speed *= 0.85;
  }
}

/* ---------- Darstellung aller Mopeds ---------- */
function updateVehicles(dt) {
  for (const id in avatars) { const a = avatars[id]; if (!(a.flags & 8) && a.g.rotation.x) a.g.rotation.x = 0; }   // abgestiegen: wieder aufrecht
  // Detailstufe der Autos: das eigene Auto und das nächste (bis 20 m) als Ferrari, alle anderen einfach
  const hiSet = new Set();
  if (ride.v >= 0 && ride.kind === 'car') hiSet.add(ride.v);
  vehicles.filter(v => v.kind === 'car' && v.mesh.gltf && v.i !== ride.v).map(v => [v, Math.hypot(v.x - camera.position.x, v.z - camera.position.z)])
    .filter(a => a[1] < 20).sort((a, b) => a[1] - b[1]).slice(0, gfxLow() ? 0 : 1).forEach(([v]) => hiSet.add(v.i));
  for (const v of vehicles) {
    const m = v.mesh; if (!m.gltf) continue;
    const hi = hiSet.has(v.i);
    if (m.isHi !== hi) { m.isHi = hi; m.hi.visible = hi; for (const c of m.lo) c.visible = !hi; }
  }
  for (const v of vehicles) {
    const m = v.mesh, K = VK[v.kind], isTank = v.kind === 'tank', isPlane = v.kind === 'plane', isHeli = v.kind === 'heli' || isPlane, isCar = v.kind === 'car' || isTank || isHeli;
    if (isPlane && m.burner) {   // Kampfjet: Nachbrennerflamme wird mit dem Schub länger (Vollgas = Nachbrenner), flackert
      const on = v.i === ride.v || !!v.d, th = on ? (v.i === ride.v ? (ride.thrl || 0) : (v.st || 0)) : 0;
      const L = on ? 0.25 + th * 0.55 + (th > 0.97 ? 0.9 : 0) : 0.01;
      v.flame = (v.flame || 0) + (L - (v.flame || 0)) * Math.min(1, dt * 6);
      m.burner.visible = v.flame > 0.03 && !v.wreck; m.burner.scale.set(v.flame * (0.9 + Math.random() * 0.2), 1, 1);
    } else if (isPlane) {   // Propeller: dreht je nach Gas (eigenes Flugzeug) bzw. solange jemand drin sitzt
      const on = v.i === ride.v || !!v.d, tgt = on ? 18 + 40 * (v.i === ride.v ? (ride.thrl || 0) : (v.st || 0.5)) : 0;
      v.rot = (v.rot || 0) + (tgt - (v.rot || 0)) * Math.min(1, dt * (on ? 1.5 : 0.5));
      m.prop.rotation.x += v.rot * dt;
    } else
    if (isHeli && !isPlane) {   // Rotoren drehen, solange jemand drin sitzt (laufen kurz nach)
      const on = v.i === ride.v || !!v.d;
      v.rot = (v.rot || 0) + ((on ? 26 : 0) - (v.rot || 0)) * Math.min(1, dt * (on ? 0.8 : 0.4));
      m.rotor.rotation.y += v.rot * dt; m.tail.rotation.z += v.rot * 1.8 * dt;
    }
    let x = v.x, y = v.y, z = v.z, yaw = v.yaw, lean = v.lean, pitch = 0, wh = 0, rider = null, st = 0;
    if (v.i === ride.v) { x = ride.pos.x; y = ride.pos.y; z = ride.pos.z; yaw = ride.yaw; lean = ride.lean; pitch = (ride.pitch || 0) + (ride.dive || 0); wh = isTank ? ride.barrelP || 0 : ride.wh || 0; st = ride.st || 0; }
    else if (isTank) { v.stS = (v.stS || 0) + ((v.st || 0) - (v.stS || 0)) * Math.min(1, dt * 8); st = v.stS; wh = v.wh || 0; }
    else if (v.d && avatars[v.d] && avatars[v.d].g.visible) {
      // Fremdes Moped: an die (weich abgespielte) Figur des Fahrers koppeln
      rider = avatars[v.d];
      const a = rider.g; yaw = a.rotation.y + Math.PI / 2;
      x = a.position.x + Math.cos(yaw) * K.back; z = a.position.z - Math.sin(yaw) * K.back; y = a.position.y - K.up;
      v.whS = (v.whS || 0) + ((v.wh || 0) - (v.whS || 0)) * Math.min(1, dt * 10); wh = v.whS;
      v.stS = (v.stS || 0) + ((v.st || 0) - (v.stS || 0)) * Math.min(1, dt * 10); st = v.stS;
    }
    m.steer.rotation.y = st;
    if (isTank) {   // Turm drehen, Rohr heben, Rückstoß nach dem Schuss; danach wie ein Auto behandeln (kein Wheelie)
      m.turret.rotation.y = st; m.barrel.rotation.z = wh;
      const rc = v.i === ride.v ? (ride.recoil || 0) : 0; m.barrel.position.x = (m.barrelX || 1.55) - rc * (m.gustav ? 2.2 : 0.5);
      if (v.i === ride.v) ride.recoil = Math.max(0, rc - dt * 2.5);
      wh = 0;
    }
    if (isCar) { for (const f of m.fronts) f.rotation.y = st; if (m.gltf) for (const f of m.frontW) f.rotation.y = st; }
    // Geschwindigkeit fürs Raddrehen
    const moved = Math.hypot(x - v.rx, z - v.rz);
    if (v.i !== ride.v) {   // fremde Mopeds: Neigung aus Bewegung (Schanze hoch/runter, Sprünge)
      const pt = v.d && moved > 0.01 ? Math.atan2(y - (v.ry || y), moved) * 0.8 : 0;
      v.pitch = (v.pitch || 0) + (Math.max(-0.6, Math.min(0.6, pt)) - (v.pitch || 0)) * Math.min(1, dt * 6);
      pitch = v.pitch;
    }
    if (isHeli) { pitch = v.i === ride.v ? (ride.pitch || 0) : (v.d ? v.wh || 0 : 0); wh = 0; }
    if (v.ctype === 'gustav') layRail(v, x, y, z);
    v.rx = x; v.rz = z; v.ry = y;
    const fwd = Math.cos(yaw) * 1, dirSign = ((x - (m.root.position.x)) * Math.cos(yaw) - (z - m.root.position.z) * Math.sin(yaw)) >= 0 ? 1 : -1;
    v.spin += moved / (isTank ? TANK_WHEEL_R : isCar ? CAR_WHEEL_R : WHEEL_R) * dirSign;
    if (isCar) { for (const s of m.spinners) s.rotation.z = -v.spin; if (m.gltf) for (const w of m.wheels) w.rotation.x = v.spin; } else m.wf.rotation.z = m.wr.rotation.z = -v.spin;
    const parked = !v.d && v.i !== ride.v;
    m.stand.visible = parked;
    // Weit entfernte Mopeds nicht zeichnen (sie sind sehr detailliert, aus 70 m sieht man sie kaum)
    const dCam = Math.hypot(x - camera.position.x, z - camera.position.z), far = dCam > K.farDraw * (gfxClean() ? 0.6 : 1) && v.i !== ride.v;   // „Klar & schnell“: Fahrzeuge früher ausblenden
    m.root.visible = !far;
    const shadow = dCam < 32 || v.i === ride.v;   // Schatten nur bei nahen Mopeds
    if (m.shadow !== shadow) { m.shadow = shadow; m.root.traverse(o => { if (o.isMesh && !o.userData.noShadow) o.castShadow = shadow; }); }
    // Wheelie: um den Hinterrad-Aufstandspunkt nach hinten kippen
    if (v.wreck) { lean = v.kind === 'moped' ? 1.35 : v.i % 2 ? 0.16 : -0.16; pitch = 0.05; wh = 0; y -= v.kind === 'moped' ? 0 : 0.15; }   // Wrack: schief, abgesackt
    const [wf, wu] = wheelieShift(wh, 0.6, 0);
    // Motor läuft: leichtes Zittern (Zweitakter)
    const vib = !parked && !far ? Math.sin(performance.now() * 0.09 + v.i) * (isCar ? 0.0008 : 0.0025) : 0;
    const landDip = v.i === ride.v ? -(ride.land || 0) * 0.07 : 0;
    m.root.position.set(x + Math.cos(yaw) * wf, y + wu + vib + landDip, z - Math.sin(yaw) * wf);
    m.root.rotation.set(parked && !isCar && !v.wreck ? 0.12 : lean, yaw, pitch + wh);
    if (m.jet) {   // Jet dreht sich um den Rumpf (1,7 m über den Rädern), nicht um die Räder → saubere Loopings und Rollen
      const u = _jetUp.set(0, 1, 0).applyQuaternion(m.root.quaternion);
      m.root.position.x -= u.x * JET_PIVOT; m.root.position.y += JET_PIVOT - u.y * JET_PIVOT; m.root.position.z -= u.z * JET_PIVOT;
    }
    // steht das Fahrzeug still (gleiche Lage wie im letzten Bild)? → Positionen der ~40 Einzelteile nicht neu berechnen
    const sig = m.root.position.x + m.root.position.y * 7 + m.root.position.z * 13 + yaw * 17 + lean * 19 + pitch * 23 + wh * 29 + st * 31 + v.spin * 37 + (v.rot || 0) * 41;
    m.root.userData.still = Math.abs(sig - (m.root.userData.sig === undefined ? NaN : m.root.userData.sig)) < 1e-7 ? (m.root.userData.still || 0) + 1 : 0;
    m.root.userData.sig = sig;
    if (rider && isCar) rider.g.visible = false;   // im Auto sitzt man drinnen
    else if (rider) {   // fremder Fahrer kippt mit, Fuß runter im Stand, Hände am Lenker
      const [sf] = wheelieShift(wh, 0.6 - RIDER_BACK, RIDER_UP);
      rider.g.rotation.order = 'YXZ'; rider.g.rotation.x = wh * 0.9;
      rider.g.position.x += Math.cos(yaw) * sf; rider.g.position.z -= Math.sin(yaw) * sf;
      rider.footDown = moved / Math.max(dt, 1e-3) < 0.6; rider.steerVis = st;
    }
    // Wrack brennt, angeschossener Panzer qualmt
    if ((v.wreck || v.hitsN > 0) && dCam < 90) {
      v.fireT = (v.fireT || 0) - dt;
      if (v.fireT <= 0) {
        v.fireT = v.wreck ? 0.045 : 0.22;
        const bp = new THREE.Vector3(x + rnd(-1, 1), y + (VEH_HIT[v.kind] || VEH_HIT.car).h + rnd(0, 0.5), z + rnd(-1, 1));
        if (v.wreck && Math.random() < 0.6) puff(bp, [0xff6a10, 0xff9a1a, 0xffc040][Math.floor(Math.random() * 3)], rnd(0.8, 1.3), rnd(0.5, 0.8), new THREE.Vector3(rnd(-0.3, 0.3), rnd(2, 3.2), rnd(-0.3, 0.3)), { opacity: 0.95, grow: 1.6 });
        else puff(bp, 0x2a2826, rnd(1.1, 1.6), 2.8, new THREE.Vector3(rnd(-0.4, 0.4), rnd(2, 3), rnd(-0.4, 0.4)), { opacity: 0.6, grow: 3 });
      }
    }
    // Abgaswolken aus dem Auspuff (nur in der Nähe)
    if (!parked && dCam < 30 && !isHeli) {
      v.smokeT = (v.smokeT || 0) - dt;
      const gas = v.i === ride.v ? (ride.thr || 0) > 0 : moved / Math.max(dt, 1e-3) > 1;
      if (v.smokeT <= 0) {
        v.smokeT = gas ? 0.09 : 0.35;
        const ex = m.root.localToWorld(isTank ? new THREE.Vector3(-3.5, 1.4, 1.0) : isCar ? new THREE.Vector3(-2.4, 0.5, 0.12) : new THREE.Vector3(-0.9, 0.335, 0.18));
        puff(ex, 0xc8c8c8, gas ? 0.22 : 0.14, gas ? 1.1 : 0.8, new THREE.Vector3(-Math.cos(yaw) * 0.6, 0.35, Math.sin(yaw) * 0.6), { opacity: gas ? 0.28 : 0.16, grow: 2.2, fadeIn: 0.05 });
      }
    }
    void fwd;
  }
  // eigene Figur auf dem Moped (nur in der Außenansicht sichtbar)
  if (myRider && ride.v >= 0 && ride.kind !== 'moped') myRider.g.visible = false;
  else if (myRider && ride.v >= 0) {
    myRider.g.visible = (ride.fp || 0) < 0.45;   // in der Ego-Ansicht eigene Figur ausblenden
    myRider.g.rotation.order = 'YXZ';
    const [sf, su] = wheelieShift(ride.wh || 0, 0.6 - RIDER_BACK, RIDER_UP);
    myRider.g.position.set(me.pos.x + Math.cos(ride.yaw) * sf, me.pos.y + su, me.pos.z - Math.sin(ride.yaw) * sf);
    myRider.g.rotation.set((ride.pitch || 0) * 0.8 + (ride.wh || 0) * 0.9, ride.yaw - Math.PI / 2, ride.lean * 0.8);
    const aiming = riderAiming();
    myRider.flags = 8 | (aiming ? 16 : 0);
    myRider.footDown = Math.abs(ride.speed) < 0.6 && ride.onGround; myRider.steerVis = ride.st || 0;
    setAvatarGun(myRider, me.weapon);
    myRider.pivot.rotation.x = aiming ? me.pitch : -0.3;
    animateAvatar(myRider, dt);
    riderTwist(myRider, aiming ? me.yaw : ride.yaw - Math.PI / 2, dt);
  }
}

// Verschiebung (vorwärts, hoch) eines Punktes, der dx vor / dy über dem Hinterrad-Aufstandspunkt liegt,
// wenn das Moped um den Winkel a nach hinten kippt
function wheelieShift(a, dx, dy) {
  if (!a) return [0, 0];
  const c = Math.cos(a), s = Math.sin(a);
  return [dx * c - dy * s - dx, dx * s + dy * c - dy];
}
// Fahrer zielt gerade (Abzug, Zoom oder vor kurzem geschossen)?
function riderAiming() { return ride.v >= 0 && (me.trigger || me.scoped || performance.now() / 1000 - (me.rideAimT || -9) < 1.5); }
// Oberkörper des Fahrers in Zielrichtung drehen (Beine bleiben auf dem Moped)
function riderTwist(a, aimYaw, dt) {
  let d = aimYaw - a.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
  d = Math.max(-1.9, Math.min(1.9, d));
  a.upper.rotation.y += (d - a.upper.rotation.y) * Math.min(1, dt * 12);
}

/* ---------- Motorgeräusch (Zweitakter: knatternd) ---------- */
let eng = null;
// Reifenquietschen beim Driften (gefiltertes Rauschen)
let squealG = null;
function tireSqueal(on) {
  if (!actx) return;
  if (!squealG) {
    const buf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 3;
    squealG = actx.createGain(); squealG.gain.value = 0;
    src.connect(bp); bp.connect(squealG); squealG.connect(master); src.start();
  }
  squealG.gain.setTargetAtTime(on ? 0.06 : 0, actx.currentTime, 0.05);
}
function engineSound(on, speed = 0, thr = 0, kind = 'moped', squeal = false) {
  if (!actx) return;
  tireSqueal(on && squeal);
  if (!on || (eng && eng.kind !== kind)) { if (eng) { const t = actx.currentTime; eng.g.gain.setTargetAtTime(0, t, 0.1); const e = eng; setTimeout(() => { try { e.o.stop(); e.o2.stop(); } catch (x) {} }, 600); eng = null; } if (!on) return; }
  const car = kind === 'car';
  if (!eng) {
    const o = actx.createOscillator(), o2 = actx.createOscillator(), f = actx.createBiquadFilter(), g = actx.createGain(), am = actx.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0;
    o2.frequency.value = 20; am.gain.value = car ? 0.012 : 0.035;   // Moped: „Knattern“ des Zweitakters, Auto: ruhiges Brummen
    o.connect(f); f.connect(g); g.connect(master); o2.connect(am); am.connect(g.gain);
    o.start(); o2.start();
    eng = { o, o2, f, g, kind };
  }
  const t = actx.currentTime, sp = Math.abs(speed);
  if (kind === 'jet') {   // Düsentriebwerk: helles Heulen + Fauchen, mit Nachbrenner tiefes Donnern
    eng.o.frequency.setTargetAtTime(70 + thr * 95 + sp * 0.25, t, 0.25);
    eng.o2.frequency.setTargetAtTime(28 + thr * 34, t, 0.25);
    eng.f.frequency.setTargetAtTime(650 + thr * 2400, t, 0.25);
    eng.g.gain.setTargetAtTime(0.05 + thr * 0.055, t, 0.25);
    return;
  }
  if (kind === 'plane') {   // Kolbenmotor mit Propeller: sonores Brummen, höher mit mehr Gas
    eng.o.frequency.setTargetAtTime(48 + thr * 46 + sp * 0.2, t, 0.15);
    eng.o2.frequency.setTargetAtTime(22 + thr * 26, t, 0.15);
    eng.f.frequency.setTargetAtTime(420 + thr * 520, t, 0.15);
    eng.g.gain.setTargetAtTime(0.05 + thr * 0.045, t, 0.15);
    return;
  }
  if (kind === 'tank' || kind === 'heli') {   // Panzer: tiefes Dieselgrollen · Heli: schnelles Rotor-Wummern
    const heli = kind === 'heli';
    eng.o.frequency.setTargetAtTime(heli ? 55 + thr * 12 : 22 + sp * 2 + thr * 6, t, 0.1);
    eng.o2.frequency.setTargetAtTime(heli ? 17 + thr * 3 : 7 + sp * 0.6, t, 0.1);
    eng.f.frequency.setTargetAtTime(heli ? 480 + thr * 200 : 230 + thr * 170, t, 0.1);
    eng.g.gain.setTargetAtTime(heli ? 0.07 + thr * 0.02 : 0.075 + thr * 0.03, t, 0.1);
    return;
  }
  // Auto: Gänge – die Drehzahl fällt bei jedem Gangwechsel wieder ab
  const rpm = car ? (sp % 8.5) / 8.5 + Math.min(1, sp / 30) * 0.4 : 0;
  eng.o.frequency.setTargetAtTime(car ? 32 + rpm * 46 + thr * 8 : 38 + sp * 7 + thr * 14, t, 0.08);
  eng.o2.frequency.setTargetAtTime(car ? 10 + rpm * 14 : 14 + sp * 2.2 + thr * 5, t, 0.08);
  eng.f.frequency.setTargetAtTime(car ? 320 + rpm * 420 + thr * 260 : 600 + sp * 80 + thr * 500, t, 0.1);
  eng.g.gain.setTargetAtTime(car ? 0.05 + thr * 0.035 : 0.05 + thr * 0.05 + sp * 0.003, t, 0.1);
}
