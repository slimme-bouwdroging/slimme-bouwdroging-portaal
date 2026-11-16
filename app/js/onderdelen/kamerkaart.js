// =====================================================================
// Compacte kaart per kamer/toestel (Home, klantpagina)
// =====================================================================
import { db, maak, getal, beoordeel, filterOordeel, vulChips, sindsTekst, eersteStatus } from '../lib.js';

// Haalt voor een lijst toestellen de laatste meting en open alarmen op
export async function laadKaartData(toestellen) {
  const ids = toestellen.map(t => t.id);
  const metingen = {};
  await Promise.all(ids.map(async (id) => {
    const { data } = await db.from('metingen')
      .select('gemeten_op, temperatuur, vochtigheid, co2')
      .eq('toestel_id', id).order('gemeten_op', { ascending: false }).limit(1);
    metingen[id] = data && data[0];
  }));
  const alarmen = {};
  if (ids.length) {
    const { data } = await db.from('alarmen')
      .select('toestel_id, ernst, bericht, aangemaakt_op')
      .in('toestel_id', ids).is('opgelost_op', null)
      .order('aangemaakt_op', { ascending: false });
    for (const a of (data || [])) (alarmen[a.toestel_id] = alarmen[a.toestel_id] || []).push(a);
  }
  return { metingen, alarmen };
}

export function kamerkaart(t, m, alarmen, href, subtekst) {
  const st = eersteStatus(t);
  const a = maak('a', null, 'kamerkaart');
  a.href = href;

  const kop = maak('div', null, 'kop');
  const titel = maak('div');
  titel.appendChild(maak('h3', t.naam));
  if (subtekst) titel.appendChild(maak('div', subtekst, 'sub'));
  const chips = maak('div', null, 'chips');
  vulChips(chips, st);
  kop.append(titel, chips);
  a.appendChild(kop);

  const w = maak('div', null, 'mini-waarden');
  for (const [sleutel, label, eenheid, dec] of [['co2', 'CO₂', 'ppm', 0], ['vochtigheid', 'Vocht', '%', 0], ['temperatuur', 'Temp', '°C', 1]]) {
    const d = maak('div');
    d.appendChild(maak('div', label, 'label'));
    const waarde = maak('div', null, 'waarde');
    waarde.appendChild(document.createTextNode(m ? getal(m[sleutel], dec) : '–'));
    if (m && m[sleutel] != null) waarde.appendChild(maak('span', eenheid, 'eenheid'));
    d.appendChild(waarde);
    const o = m ? beoordeel(sleutel, m[sleutel]) : null;
    if (o) d.appendChild(maak('div', o[1], 'status ' + o[0]));
    w.appendChild(d);
  }
  a.appendChild(w);

  for (const al of (alarmen || []).slice(0, 2)) {
    a.appendChild(maak('div', '⚠ ' + (al.bericht || 'Alarm'), 'alarm ' + al.ernst));
  }

  const voet = maak('div', null, 'voet');
  if (st) {
    const f = filterOordeel(st.filter_procent);
    const fs = maak('span');
    fs.appendChild(document.createTextNode('Filter '));
    fs.appendChild(maak('strong', st.filter_procent + ' %', 'status ' + f[0]));
    voet.appendChild(fs);
  }
  voet.appendChild(maak('span', m ? 'Gemeten ' + sindsTekst(m.gemeten_op) + ' →' : 'Openen →'));
  a.appendChild(voet);
  return a;
}
