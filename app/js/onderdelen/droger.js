// =====================================================================
// Bouwdrogers: gedeelde teksten, badges en de vermogensgrafiek
// =====================================================================
import { maak, getal } from '../lib.js';

// Toestand zoals de databank hem kent -> tekst + kleur (badge-klasse)
export const TOESTAND = {
  DRAAIT:  { tekst: 'Drogen',     klasse: 'opgelost',    uitleg: 'Compressor draait: telt mee voor de garantie' },
  LAAG:    { tekst: 'Ventilator', klasse: 'behandeling', uitleg: 'Alleen ventilator (ontdooien of hygrostaat): normaal, telt niet als drogen' },
  UIT:     { tekst: 'Gestopt',    klasse: 'open',        uitleg: 'Bijna geen verbruik terwijl de stekker aan staat (tank vol, schakelaar uit of storing)' },
  OFFLINE: { tekst: 'Offline',    klasse: 'open',        uitleg: 'Al meer dan 5 minuten geen bericht van de stekker' }
};

export const actieNodig = (r) => r.toestand === 'UIT' || r.toestand === 'OFFLINE';

export function toestandBadge(toestand) {
  const t = TOESTAND[toestand] || { tekst: toestand || '?', klasse: 'behandeling' };
  return maak('span', t.tekst, 'badge ' + t.klasse);
}

// "2 u 10 min" uit milliseconden
export function duurTekst(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return min + ' min';
  const u = Math.floor(min / 60);
  if (u < 48) return u + ' u ' + (min % 60) + ' min';
  return Math.floor(u / 24) + ' d ' + (u % 24) + ' u';
}

// Balk "612 / 800 u"
export function urenBalk(draai, garantie) {
  const vak = maak('div');
  const pct = Math.min(100, Math.round((Number(draai) || 0) / (garantie || 800) * 100));
  const meter = maak('div', null, 'meter');
  const vul = maak('div', null, pct >= 100 ? 'matig' : 'goed');
  vul.style.width = pct + '%';
  meter.appendChild(vul);
  vak.appendChild(meter);
  vak.appendChild(maak('div', getal(draai, 0) + ' / ' + (garantie || 800) + ' u', 'voetnoot num'));
  return vak;
}

// Eenvoudige lijngrafiek van het vermogen (eigen SVG)
export function vermogenGrafiek(vak, punten) {
  vak.innerHTML = '';
  const reeks = punten.filter(p => p.watt !== null).map(p => ({ t: new Date(p.gemeten_op).getTime(), v: Number(p.watt), s: p.toestand }));
  if (reeks.length < 2) { vak.appendChild(maak('div', 'Nog te weinig metingen voor een grafiek.', 'grafiek-leeg')); return; }

  const W = Math.max(320, Math.round(vak.clientWidth || 800));
  const H = W < 500 ? 200 : 240, L = 58, R = 12, T = 12, B = 24;
  const t0 = reeks[0].t, t1 = reeks[reeks.length - 1].t;
  const maxV = Math.max(10, ...reeks.map(p => p.v));
  const stap = maxV > 1000 ? 500 : maxV > 400 ? 200 : maxV > 100 ? 50 : maxV > 40 ? 20 : 5;
  const top = Math.ceil(maxV / stap) * stap;
  const x = (t) => L + (W - L - R) * (t - t0) / Math.max(1, t1 - t0);
  const y = (v) => T + (H - T - B) * (1 - v / top);

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Vermogen in watt over de gekozen periode">`;
  for (let v = 0; v <= top; v += stap) {
    s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#1D1D1B"/>`;
    s += `<text x="${L - 6}" y="${y(v) + 3}" text-anchor="end" class="as">${v} W</text>`;
  }
  const uren = Math.max(1, Math.round((t1 - t0) / 3600000));
  const elke = uren > 12 ? 6 : uren > 4 ? 2 : 1;
  const eerste = new Date(t0); eerste.setMinutes(0, 0, 0);
  for (let t = eerste.getTime() + 3600000; t < t1; t += 3600000 * elke) {
    s += `<text x="${x(t)}" y="${H - 6}" text-anchor="middle" class="as">${String(new Date(t).getHours()).padStart(2, '0')}u</text>`;
  }
  // Rode stukjes onderaan waar de droger niet droogde
  for (let i = 0; i < reeks.length - 1; i++) {
    if (reeks[i].s === 'UIT' || reeks[i].s === 'OFFLINE') {
      s += `<rect x="${x(reeks[i].t)}" y="${H - B - 4}" width="${Math.max(1, x(reeks[i + 1].t) - x(reeks[i].t))}" height="4" fill="#F87171"/>`;
    }
  }
  // Treden: een stekker meet stapsgewijs
  let d = `M${x(reeks[0].t)},${y(reeks[0].v)}`;
  for (let i = 1; i < reeks.length; i++) d += ` H${x(reeks[i].t)} V${y(reeks[i].v)}`;
  const vlak = d + ` V${y(0)} H${x(reeks[0].t)} Z`;
  s += `<path d="${vlak}" fill="rgba(34,211,238,0.10)"/>`;
  s += `<path d="${d}" fill="none" stroke="#22D3EE" stroke-width="1.6"/>`;
  const laatste = reeks[reeks.length - 1];
  s += `<circle cx="${x(laatste.t)}" cy="${y(laatste.v)}" r="3.5" fill="#22D3EE"/>`;
  s += '</svg>';
  vak.innerHTML = s;
}
