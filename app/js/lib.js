// =====================================================================
// Gedeelde hulpmiddelen voor alle pagina's
// =====================================================================
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Gegevens van de ingelogde gebruiker (ingevuld door app.js)
export const sessie = { id: null, email: '', naam: '', rol: null };

// ---------- Kleine hulpjes ----------
export const $ = (id) => document.getElementById(id);

export function maak(tag, tekst, klasse) {
  const el = document.createElement(tag);
  if (tekst !== undefined && tekst !== null) el.textContent = tekst;
  if (klasse) el.className = klasse;
  return el;
}

export function link(href, tekst, klasse) {
  const a = maak('a', tekst, klasse);
  a.href = href;
  return a;
}

export const datum = (t) => new Date(t).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' });
export const dag = (t) => new Date(t).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' });

export function getal(v, dec = 0) {
  if (v === null || v === undefined) return '–';
  return Number(v).toLocaleString('nl-BE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function sindsTekst(t) {
  const min = Math.round((Date.now() - new Date(t).getTime()) / 60000);
  if (min < 2) return 'net nog';
  if (min < 60) return min + ' min geleden';
  const u = Math.round(min / 60);
  if (u < 48) return u + ' uur geleden';
  return Math.round(u / 24) + ' dagen geleden';
}

// ---------- Vaste teksten ----------
export const MEETWAARDEN = {
  temperatuur: { label: 'Temperatuur', eenheid: '°C', dec: 1, drempels: [] },
  vochtigheid: { label: 'Vochtigheid', eenheid: '%', dec: 0, drempels: [{ w: 60, k: 'matig' }, { w: 70, k: 'slecht' }] },
  co2:         { label: 'CO₂', eenheid: 'ppm', dec: 0, drempels: [{ w: 800, k: 'matig' }, { w: 1200, k: 'slecht' }] },
  tvoc:        { label: 'TVOC', eenheid: 'mg/m³', dec: 2, drempels: [{ w: 0.3, k: 'matig' }], extra: true },
  pm25:        { label: 'Fijnstof', eenheid: 'µg/m³', dec: 0, drempels: [{ w: 15, k: 'matig' }, { w: 35, k: 'slecht' }], extra: true }
};
export const KLEUR = { goed: '#22D3EE', matig: '#F5B544', slecht: '#F87171' };
export const MODUS_TEKST = { automatisch: 'Automatisch', handmatig: 'Handmatig', sleep: 'Sleep Air', boost: 'Boost', afwezig: 'Afwezig' };
export const CATEGORIE = { geen_werking: 'Geen werking', lawaai: 'Lawaai', filter: 'Filter', app: 'App / bediening', onderhoud: 'Onderhoud', ander: 'Ander' };
export const ONDERHOUD_TEKST = { installatie: 'Installatie', filter_vervangen: 'Filter vervangen', onderhoud: 'Onderhoud', interventie: 'Interventie' };
export const ACTIE_TEKST = {
  aan: () => 'Aangezet', uit: () => 'Uitgezet',
  stand: (w) => 'Stand ' + w, modus: (w) => 'Modus ' + (MODUS_TEKST[w] || w),
  boost: (w) => 'Boost ' + (w || 30) + ' min', filter_reset: () => 'Filter vervangen'
};

// ---------- Beoordelingen (indicatieve grenzen, geen norm) ----------
export function beoordeel(soort, waarde) {
  if (waarde === null || waarde === undefined) return null;
  const v = Number(waarde);
  if (soort === 'co2') return v < 800 ? ['goed', 'Frisse lucht'] : v < 1200 ? ['matig', 'Ventileren aangeraden'] : ['slecht', 'Muffe lucht'];
  if (soort === 'vochtigheid') return v < 40 ? ['matig', 'Droog'] : v <= 60 ? ['goed', 'Comfortabel'] : v <= 70 ? ['matig', 'Vrij vochtig'] : ['slecht', 'Te vochtig'];
  if (soort === 'temperatuur') return v < 16 ? ['matig', 'Koel'] : v <= 24 ? ['goed', 'Aangenaam'] : ['matig', 'Warm'];
  if (soort === 'tvoc') return v < 0.3 ? ['goed', 'Laag'] : v < 1 ? ['matig', 'Verhoogd'] : ['slecht', 'Hoog'];
  if (soort === 'pm25') return v < 15 ? ['goed', 'Zuiver'] : v < 35 ? ['matig', 'Matig'] : ['slecht', 'Slecht'];
  return null;
}

// Filter: inschatting uitgaande van ± 26 weken per filter
export function filterOordeel(pct) {
  const weken = Math.round(pct * 26 / 100);
  if (pct <= 15) return ['slecht', 'Vervangen aangeraden'];
  if (pct <= 35) return ['matig', 'Nog ± ' + weken + ' weken'];
  return ['goed', 'Nog ± ' + weken + ' weken'];
}

// ---------- Bouwstenen ----------
export function statusBadge(status) {
  const klasse = status === 'open' ? 'open' : status === 'opgelost' ? 'opgelost' : 'behandeling';
  return maak('span', status, 'badge ' + klasse);
}

export function tegel(label, waarde, eenheid, oordeel) {
  const t = maak('div', null, 'tegel');
  t.appendChild(maak('div', label, 'label'));
  const w = maak('div', null, 'waarde');
  w.appendChild(document.createTextNode(waarde));
  if (waarde !== '–') w.appendChild(maak('span', eenheid, 'eenheid'));
  t.appendChild(w);
  if (oordeel) t.appendChild(maak('div', oordeel[1], 'status ' + oordeel[0]));
  return t;
}

export function vulChips(chips, st) {
  chips.innerHTML = '';
  if (!st) return;
  chips.appendChild(maak('span', st.online ? 'Online' : 'Offline · ' + sindsTekst(st.laatst_gezien), 'chip ' + (st.online ? 'online' : 'offline')));
  if (!st.aan) chips.appendChild(maak('span', 'Uit', 'chip uit'));
  else {
    chips.appendChild(maak('span', MODUS_TEKST[st.modus] || st.modus, 'chip'));
    chips.appendChild(maak('span', 'Stand ' + st.stand, 'chip'));
  }
}

export function aantalBerichten(m) {
  const r = m.melding_berichten;
  if (Array.isArray(r)) return r[0]?.count ?? 0;
  return r?.count ?? 0;
}

export const eersteStatus = (t) => Array.isArray(t.toestel_status) ? t.toestel_status[0] : t.toestel_status;

export function paginaKop(titel, ondertitel, eyebrow) {
  const kop = maak('div', null, 'pagina-kop');
  const links = maak('div');
  if (eyebrow) links.appendChild(maak('p', eyebrow, 'eyebrow'));
  links.appendChild(maak('h1', titel));
  if (ondertitel) links.appendChild(maak('p', ondertitel, 'ondertitel'));
  kop.appendChild(links);
  return kop;
}

// ---------- Eenvoudige berichtenbus voor realtime ----------
const luisteraars = {};
export const bus = {
  on(naam, fn) {
    (luisteraars[naam] = luisteraars[naam] || []).push(fn);
    return () => { luisteraars[naam] = (luisteraars[naam] || []).filter(f => f !== fn); };
  },
  emit(naam, data) { for (const fn of (luisteraars[naam] || [])) fn(data); },
  leeg() { for (const k of Object.keys(luisteraars)) delete luisteraars[k]; }
};

// ---------- Melding rechtsonder ----------
export function toast(tekst, soort, href) {
  const t = maak('div', tekst, 'toast' + (soort ? ' ' + soort : ''));
  t.addEventListener('click', () => { if (href) location.hash = href; t.remove(); });
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 7000);
}
