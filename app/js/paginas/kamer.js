// =====================================================================
// KAMER / TOESTEL — detailpagina met tabbladen
// (klant: #/kamer/:id  ·  Vernast: #/toestel/:id)
// =====================================================================
import { db, maak, link, bus, sessie, datum, dag, getal, beoordeel, filterOordeel, tegel, vulChips, sindsTekst, eersteStatus, MEETWAARDEN } from '../lib.js';
import { bedieningBlok } from '../onderdelen/bediening.js';
import { grafiekBlok } from '../onderdelen/grafiek.js';
import { onderhoudBlok } from '../onderdelen/onderhoud.js';

export async function render(el, id) {
  const opruimen = [];
  const beheer = sessie.rol === 'beheerder';
  const toestelId = Number(id);

  const { data: t, error } = await db.from('toestellen')
    .select('id, naam, model, serienummer, geinstalleerd_op, woning_id, toestel_status(*), woningen(id, naam, adres, klant_id, profielen(id, naam, email))')
    .eq('id', toestelId).single();

  el.appendChild(link(beheer ? '#/toestellen' : '#/home', beheer ? '← Toestellen' : '← Home', 'terug'));
  if (error || !t) { el.appendChild(maak('p', 'Dit toestel bestaat niet of u hebt er geen toegang toe.', 'fout')); return opruimen; }

  let st = eersteStatus(t);
  const w = t.woningen || {};

  // ---------- Kop ----------
  const kop = maak('div', null, 'pagina-kop');
  const links = maak('div');
  links.appendChild(maak('p', beheer ? (t.serienummer || 'Toestel') : 'Kamer', 'eyebrow'));
  links.appendChild(maak('h1', t.naam));
  links.appendChild(maak('p', [w.naam, w.adres].filter(Boolean).join(' · ') + (beheer && w.profielen ? ' · ' + w.profielen.naam : ''), 'ondertitel'));
  const chips = maak('div', null, 'chips');
  vulChips(chips, st);
  kop.append(links, chips);
  el.appendChild(kop);

  // ---------- Alarmen ----------
  const alarmVak = maak('div');
  el.appendChild(alarmVak);
  async function laadAlarmen() {
    const { data: alarmen } = await db.from('alarmen')
      .select('soort, ernst, bericht, aangemaakt_op')
      .eq('toestel_id', t.id).is('opgelost_op', null)
      .order('aangemaakt_op', { ascending: false });
    alarmVak.innerHTML = '';
    for (const a of (alarmen || [])) alarmVak.appendChild(maak('div', '⚠ ' + (a.bericht || a.soort) + ' · ' + sindsTekst(a.aangemaakt_op), 'alarm ' + a.ernst));
  }
  await laadAlarmen();

  // ---------- Strook met actuele waarden ----------
  const { data: laatste } = await db.from('metingen')
    .select('gemeten_op, temperatuur, vochtigheid, co2, tvoc, pm25')
    .eq('toestel_id', t.id).order('gemeten_op', { ascending: false }).limit(1);
  const m = laatste && laatste[0];

  const tegels = maak('div', null, 'tegels');
  let filterTegel = null;
  if (m) {
    for (const sleutel of ['co2', 'tvoc', 'pm25', 'temperatuur', 'vochtigheid']) {
      const cfg = MEETWAARDEN[sleutel];
      tegels.appendChild(tegel(cfg.label + (cfg.extra ? ' *' : ''), getal(m[sleutel], cfg.dec), cfg.eenheid, beoordeel(sleutel, m[sleutel])));
    }
  }
  if (st) { filterTegel = tegel('Filter', st.filter_procent, '%', filterOordeel(st.filter_procent)); tegels.appendChild(filterTegel); }
  el.appendChild(tegels);
  el.appendChild(maak('p', m ? 'Laatst gemeten: ' + datum(m.gemeten_op) + ' · * TVOC en fijnstof vragen een extra sensor (testdata)' : 'Nog geen metingen ontvangen.', 'voetnoot'));

  // ---------- Tabbladen ----------
  const tabs = maak('div', null, 'paginatabs');
  const vakken = {};
  const tabLijst = [['bediening', 'Bediening'], ['grafieken', 'Grafieken'], ['onderhoud', 'Filter & onderhoud']];
  if (beheer) tabLijst.push(['info', 'Info']);

  for (const [k] of tabLijst) { vakken[k] = maak('div'); }
  if (st) vakken.bediening.appendChild(bedieningBlok(t, st, opruimen));
  else vakken.bediening.appendChild(maak('p', 'Geen status beschikbaar voor dit toestel.', 'adres'));
  vakken.grafieken.appendChild(grafiekBlok(t.id));
  if (st) vakken.onderhoud.appendChild(onderhoudBlok(t, st, w.id, opruimen));
  if (beheer) vakken.info.appendChild(infoBlok(t, w, st));

  const gekozen = sessionStorage.getItem('kamerTab') || 'bediening';
  function kies(k) {
    for (const [sleutel] of tabLijst) vakken[sleutel].classList.toggle('verborgen', sleutel !== k);
    for (const b of tabs.children) b.classList.toggle('actief', b.dataset.tab === k);
    try { sessionStorage.setItem('kamerTab', k); } catch (e) { /* geen opslag */ }
  }
  for (const [k, tekst] of tabLijst) {
    const b = maak('button', tekst); b.type = 'button'; b.dataset.tab = k;
    b.addEventListener('click', () => kies(k));
    tabs.appendChild(b);
  }
  el.appendChild(tabs);
  for (const [k] of tabLijst) el.appendChild(vakken[k]);
  kies(vakken[gekozen] ? gekozen : 'bediening');

  // ---------- Realtime ----------
  opruimen.push(bus.on('status', (nieuw) => {
    if (nieuw.toestel_id !== t.id) return;
    st = { ...st, ...nieuw };
    vulChips(chips, st);
    if (filterTegel && nieuw.filter_procent !== undefined) {
      const n = tegel('Filter', st.filter_procent, '%', filterOordeel(st.filter_procent));
      filterTegel.replaceWith(n); filterTegel = n;
    }
    laadAlarmen();
  }));
  opruimen.push(bus.on('alarm', (p) => { const r = p.new || p.old; if (r && r.toestel_id === t.id) laadAlarmen(); }));
  return opruimen;
}

function infoBlok(t, w, st) {
  const raster = maak('div', null, 'info-raster');
  const veld = (label, waarde, href) => {
    const d = maak('div');
    d.appendChild(maak('div', label, 'label'));
    const v = maak('div', null, 'waarde');
    if (href) v.appendChild(link(href, waarde)); else v.textContent = waarde;
    d.appendChild(v);
    raster.appendChild(d);
  };
  veld('Klant', w.profielen?.naam || '— geen klant —', w.profielen ? '#/klant/' + w.profielen.id : null);
  veld('E-mail klant', w.profielen?.email || '—');
  veld('Woning', [w.naam, w.adres].filter(Boolean).join(' · ') || '—');
  veld('Model', t.model || '—');
  veld('Serienummer', t.serienummer || '—');
  veld('Geïnstalleerd op', t.geinstalleerd_op ? dag(t.geinstalleerd_op) : '—');
  veld('Laatst gezien', st?.laatst_gezien ? datum(st.laatst_gezien) : '—');
  return raster;
}
