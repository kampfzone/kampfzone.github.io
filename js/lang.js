'use strict';
/* ======================= Sprache: Deutsch (Original) oder Englisch =======================
   Das Spiel ist auf Deutsch geschrieben. Im englischen Modus ersetzt diese Datei jeden sichtbaren Text der Seite
   (Menüs, Anzeigen, Meldungen, Knöpfe, Platzhalter) über das Wörterbuch in lang-en.js – auch Texte, die erst
   während des Spiels erscheinen (beobachtet die Seite). Feste Sätze: genaue Treffer; Sätze mit Zahlen/Namen: Muster.
   Sprache: Menü → 🌐 (gespeichert); sonst Browser-Sprache; auf Spieleportalen Englisch (außer deutsche Spieler). */
(function () {
  const D = window.KZ_EN || { exact: {}, rules: [] };
  let lang = null;
  try { lang = localStorage.getItem('kz_lang'); } catch (e) {}
  if (lang !== 'de' && lang !== 'en') lang = /^de\b/i.test(navigator.language || '') && !window.KZ_PORTAL_FORCE_EN ? 'de' : 'en';
  window.LANG = lang;
  const norm = s => s.replace(/\s+/g, ' ');
  const exact = new Map(); for (const k in D.exact) exact.set(norm(k).trim(), D.exact[k]);
  const rules = (D.rules || []).map(([re, rep]) => [new RegExp('^' + re.replace(/ {2,}/g, ' ') + '$', 's'), rep]);   // Texte werden auf einfache Leerzeichen vereinfacht
  const memo = new Map();
  function one(core) {   // ganzer Text: genauer Treffer oder Muster
    let t = exact.get(core);
    if (t === undefined) for (const [re, rep] of rules) if (re.test(core)) { t = core.replace(re, rep); break; }
    if (typeof t === 'string') t = t.replace(/\{T:([^}]*)\}/g, (_, x) => T(x));   // verschachtelte Übersetzung (z. B. Tastennamen)
    return t;
  }
  // einen Text übersetzen (Leerzeichen am Anfang/Ende bleiben); unbekannt → unverändert
  function T(s) {
    if (lang !== 'en' || !s) return s;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = norm(m[2]);
    if (!core || !/[A-Za-zÄÖÜäöüß]/.test(core)) return s;
    let t = memo.get(core);
    if (t === undefined) {
      t = one(core);
      if (t === undefined && core.includes('·')) {   // zusammengesetzte Anzeige: Stück für Stück (an den „·“)
        const parts = core.split(/\s*·\s*/); let any = false;
        const tr = parts.map(p => { if (!/[A-Za-zÄÖÜäöüß]/.test(p)) return p; const x = one(p); if (x !== undefined) { any = true; return x; } return p; });
        if (any) t = tr.join(' · ').trim();
      }
      if (t === undefined) t = null;
      memo.set(core, t);
    }
    return t === null ? s : m[1] + t + m[3];
  }
  window.T = T;
  if (lang !== 'en') return;
  document.documentElement.lang = 'en';
  const ATTR = ['placeholder', 'title', 'aria-label', 'alt'];
  function fixText(n) { const v = n.data, t = T(v); if (t !== v) n.data = t; }
  function fixEl(el) { for (const a of ATTR) { const v = el.getAttribute && el.getAttribute(a); if (v) { const t = T(v); if (t !== v) el.setAttribute(a, t); } } }
  function walk(root) {
    if (root.nodeType === 3) return fixText(root);
    if (root.nodeType !== 1 || /^(SCRIPT|STYLE)$/.test(root.tagName)) return;
    fixEl(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: x => x.nodeType === 1 && /^(SCRIPT|STYLE)$/.test(x.tagName) ? 2 : 1 });
    let x; while ((x = w.nextNode())) { if (x.nodeType === 3) fixText(x); else fixEl(x); }
  }
  walk(document.body); document.title = T(document.title);
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'characterData') fixText(m.target);
      else if (m.type === 'attributes') fixEl(m.target);
      else for (const n of m.addedNodes) walk(n);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR });
  // Meldungsfenster (z. B. „Verbindung getrennt“)
  const al = window.alert.bind(window), cf = window.confirm.bind(window);
  window.alert = s => al(T(String(s))); window.confirm = s => cf(T(String(s)));
})();
// Sprachauswahl im Menü (🌐 Deutsch / English) – Wechsel lädt die Seite neu
(function () {
  const opt = document.getElementById('menuSide');
  if (!opt) return;
  if (window.LANG === 'en') { const n = document.getElementById('menuNews'); if (n) n.style.display = 'none'; }   // Neuigkeiten-Liste gibt es nur auf Deutsch
  const row = document.createElement('div'); row.id = 'langRow'; row.style.cssText = 'margin:8px 0;display:flex;gap:6px;justify-content:center;align-items:center;font-size:14px';
  row.innerHTML = '<span>🌐</span><button class="sec small" data-l="de">Deutsch</button><button class="sec small" data-l="en">English</button>';
  for (const b of row.querySelectorAll('button')) {
    if (b.dataset.l === window.LANG) b.style.outline = '2px solid #ffcc33';
    b.onclick = () => { try { localStorage.setItem('kz_lang', b.dataset.l); } catch (e) {} location.reload(); };
  }
  opt.appendChild(row);
})();
