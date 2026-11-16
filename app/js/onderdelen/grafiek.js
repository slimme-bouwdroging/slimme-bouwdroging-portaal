// =====================================================================
// Grafiek met keuze meetwaarde + periode (eigen SVG, geen bibliotheek)
// =====================================================================
import { db, maak, getal, MEETWAARDEN, KLEUR } from '../lib.js';

export function grafiekBlok(toestelId, beginWaarde = 'co2') {
  const blok = maak('div', null, 'grafiek');
  const balk = maak('div', null, 'grafiek-balk');
  const tabsW = maak('div', null, 'tabs');
  const tabsP = maak('div', null, 'tabs periode');
  const vak = maak('div', null, 'grafiek-vak');
  balk.append(tabsW, tabsP);
  blok.append(balk, vak);

  let keuze = beginWaarde;
  let periode = '24u';
  const cache = {};

  async function laad() {
    vak.innerHTML = '';
    vak.appendChild(maak('div', 'Grafiek laden...', 'grafiek-leeg'));
    if (!cache[periode]) {
      const { data, error } = await db.rpc('metingen_reeks', { p_toestel: toestelId, p_periode: periode });
      if (error) { vak.innerHTML = ''; vak.appendChild(maak('div', 'Fout: ' + error.message, 'grafiek-leeg')); return; }
      cache[periode] = data || [];
    }
    tekenGrafiek(vak, cache[periode], keuze, periode);
  }

  function maakTabs(houder, opties, huidig, bijKlik) {
    houder.innerHTML = '';
    for (const [waarde, tekst] of opties) {
      const b = maak('button', tekst, waarde === huidig ? 'actief' : '');
      b.type = 'button';
      b.addEventListener('click', () => bijKlik(waarde));
      houder.appendChild(b);
    }
  }
  function herteken() {
    maakTabs(tabsW, Object.entries(MEETWAARDEN).map(([k, c]) => [k, c.label]), keuze, (k) => { keuze = k; herteken(); laad(); });
    maakTabs(tabsP, [['24u', '24 u'], ['7d', '7 d'], ['30d', '30 d']], periode, (p) => { periode = p; herteken(); laad(); });
  }
  herteken();
  // pas laden als het blok in de pagina staat (voor de juiste breedte)
  requestAnimationFrame(() => laad());
  return blok;
}

export function tekenGrafiek(vak, punten, sleutel, periode) {
  vak.innerHTML = '';
  const cfg = MEETWAARDEN[sleutel];
  const reeks = punten.filter(p => p[sleutel] !== null && p[sleutel] !== undefined)
    .map(p => ({ t: new Date(p.tijd).getTime(), v: Number(p[sleutel]) }));
  if (reeks.length < 2) { vak.appendChild(maak('div', 'Te weinig metingen voor een grafiek.', 'grafiek-leeg')); return; }

  // Breedte volgt het scherm, zodat tekst leesbaar blijft op gsm
  const W = Math.max(320, Math.round(vak.clientWidth || 800));
  const H = W < 500 ? 220 : 260, L = 46, R = 14, T = 14, B = 26;
  vak._laatst = { punten, sleutel, periode, W };
  if (!vak._observer && window.ResizeObserver) {
    vak._observer = new ResizeObserver(() => {
      const l = vak._laatst;
      if (l && vak.clientWidth && Math.abs(vak.clientWidth - l.W) > 40) tekenGrafiek(vak, l.punten, l.sleutel, l.periode);
    });
    vak._observer.observe(vak);
  }

  const tMin = reeks[0].t, tMax = reeks[reeks.length - 1].t;
  let vMin = Math.min(...reeks.map(p => p.v)), vMax = Math.max(...reeks.map(p => p.v));
  for (const d of cfg.drempels) { if (d.w <= vMax * 1.15) vMax = Math.max(vMax, d.w); }
  const marge = (vMax - vMin) * 0.12 || 1;
  vMin = Math.max(0, vMin - marge); vMax = vMax + marge;
  const x = (t) => L + (t - tMin) / (tMax - tMin) * (W - L - R);
  const y = (v) => T + (1 - (v - vMin) / (vMax - vMin)) * (H - T - B);

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const el = (tag, attrs, tekst) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (tekst !== undefined) e.textContent = tekst;
    svg.appendChild(e); return e;
  };

  const defs = document.createElementNS(ns, 'defs');
  const id = 'verloop' + Math.random().toString(36).slice(2);
  defs.innerHTML = `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22D3EE" stop-opacity="0.28"/><stop offset="1" stop-color="#22D3EE" stop-opacity="0"/></linearGradient>`;
  svg.appendChild(defs);

  for (let i = 0; i <= 4; i++) {
    const v = vMin + (vMax - vMin) * i / 4;
    el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: '#1D1D1B' });
    el('text', { x: L - 8, y: y(v) + 3, 'text-anchor': 'end', class: 'as' }, getal(v, cfg.dec > 0 ? cfg.dec : 0));
  }
  for (let i = 0; i <= 4; i++) {
    const t = tMin + (tMax - tMin) * i / 4;
    const d = new Date(t);
    const tekst = periode === '24u'
      ? d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit' });
    el('text', { x: x(t), y: H - 6, 'text-anchor': i === 0 ? 'start' : i === 4 ? 'end' : 'middle', class: 'as' }, tekst);
  }
  for (const d of cfg.drempels) {
    if (d.w < vMin || d.w > vMax) continue;
    el('line', { x1: L, x2: W - R, y1: y(d.w), y2: y(d.w), stroke: KLEUR[d.k], 'stroke-opacity': 0.55, 'stroke-dasharray': '4 4' });
    el('text', { x: W - R - 2, y: y(d.w) - 4, 'text-anchor': 'end', class: 'drempel-label', fill: KLEUR[d.k] }, getal(d.w, cfg.dec) + ' ' + cfg.eenheid);
  }

  const pad = reeks.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ');
  el('path', { d: pad + ` L ${x(tMax).toFixed(1)} ${H - B} L ${x(tMin).toFixed(1)} ${H - B} Z`, fill: `url(#${id})` });
  el('path', { d: pad, fill: 'none', stroke: '#22D3EE', 'stroke-width': 2, 'stroke-linejoin': 'round' });

  const hl = el('line', { y1: T, y2: H - B, stroke: '#3A3A37', visibility: 'hidden' });
  const pt = el('circle', { r: 4, fill: '#22D3EE', stroke: '#0B0B0A', 'stroke-width': 2, visibility: 'hidden' });
  const tip = maak('div', null, 'tip verborgen');
  const vang = el('rect', { x: L, y: T, width: W - L - R, height: H - T - B, fill: 'transparent' });
  vak.append(svg, tip);

  function toon(evt) {
    const r = svg.getBoundingClientRect();
    const bron = evt.touches ? evt.touches[0] : evt;
    const sx = (bron.clientX - r.left) / r.width * W;
    const tWaarde = tMin + (sx - L) / (W - L - R) * (tMax - tMin);
    let best = reeks[0];
    for (const p of reeks) if (Math.abs(p.t - tWaarde) < Math.abs(best.t - tWaarde)) best = p;
    const px = x(best.t), py = y(best.v);
    hl.setAttribute('x1', px); hl.setAttribute('x2', px); hl.setAttribute('visibility', 'visible');
    pt.setAttribute('cx', px); pt.setAttribute('cy', py); pt.setAttribute('visibility', 'visible');
    tip.innerHTML = '';
    tip.appendChild(document.createTextNode(getal(best.v, cfg.dec) + ' ' + cfg.eenheid));
    tip.appendChild(maak('small', new Date(best.t).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })));
    tip.style.left = (px / W * r.width) + 'px';
    tip.style.top = (py / H * r.height) + 'px';
    tip.classList.remove('verborgen');
  }
  function verberg() { hl.setAttribute('visibility', 'hidden'); pt.setAttribute('visibility', 'hidden'); tip.classList.add('verborgen'); }
  vang.addEventListener('mousemove', toon);
  vang.addEventListener('touchstart', toon, { passive: true });
  vang.addEventListener('touchmove', toon, { passive: true });
  vang.addEventListener('mouseleave', verberg);
  vang.addEventListener('touchend', verberg);
}
