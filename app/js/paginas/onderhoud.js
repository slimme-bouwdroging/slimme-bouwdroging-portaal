// =====================================================================
// VERNAST — Onderhoud: filters bijna op, planning, recent uitgevoerd
// =====================================================================
import { db, maak, bus, paginaKop, filterOordeel, ONDERHOUD_TEKST } from '../lib.js';

export async function render(el) {
  const opruimen = [];
  el.appendChild(paginaKop('Onderhoud', 'Filters, geplande onderhoudsbeurten en wat recent gebeurde.'));

  const filterKaart = maak('div', null, 'kaart');
  filterKaart.appendChild(maak('h2', 'Filters bijna op'));
  filterKaart.appendChild(maak('p', 'Toestellen met een filter van 35 % of minder.', 'adres'));
  const filterVak = maak('div', null, 'tabel-wrap');
  filterKaart.appendChild(filterVak);

  const kolommen = maak('div', null, 'twee-kolommen');
  const planKaart = maak('div', null, 'kaart');
  planKaart.appendChild(maak('h2', 'Onderhoudsplanning'));
  planKaart.appendChild(maak('p', 'Volgend jaarlijks onderhoud per toestel (1 jaar na installatie of laatste onderhoud).', 'adres'));
  const planVak = maak('div', null, 'tabel-wrap');
  planKaart.appendChild(planVak);
  const recentKaart = maak('div', null, 'kaart');
  recentKaart.appendChild(maak('h2', 'Recent uitgevoerd'));
  const recentVak = maak('div', null, 'actielijst');
  recentKaart.appendChild(recentVak);
  kolommen.append(planKaart, recentKaart);

  el.append(filterKaart, kolommen);

  async function laad() {
    const [{ data: vloot }, { data: onderhoud }] = await Promise.all([
      db.rpc('vloot_overzicht'),
      db.from('onderhoud')
        .select('toestel_id, soort, omschrijving, uitgevoerd_op, toestellen(naam, woningen(naam))')
        .order('uitgevoerd_op', { ascending: false }).limit(500)
    ]);
    const v = vloot || [];
    const o = onderhoud || [];

    // ---------- Filters ----------
    const filters = v.filter(r => r.filter_procent !== null && r.filter_procent <= 35).sort((a, b) => a.filter_procent - b.filter_procent);
    filterVak.innerHTML = '';
    if (filters.length === 0) filterVak.appendChild(maak('p', '✓ Alle filters zijn in orde.', 'leeg'));
    else filterVak.appendChild(tabel(['Filter', 'Klant', 'Woning', 'Kamer', 'Serienummer'], filters.map(r => {
      const f = filterOordeel(r.filter_procent);
      return { href: '#/toestel/' + r.toestel_id, cellen: [maak('span', r.filter_procent + ' %', 'badge ' + (f[0] === 'slecht' ? 'open' : 'behandeling')), r.klant || '—', r.woning || '', r.kamer || '', r.serienummer || ''] };
    })));

    // ---------- Planning ----------
    const basis = {};
    for (const x of o) {
      if ((x.soort === 'onderhoud' || x.soort === 'installatie') && !basis[x.toestel_id]) basis[x.toestel_id] = x.uitgevoerd_op;
    }
    const plan = v.filter(r => basis[r.toestel_id]).map(r => {
      const volgend = new Date(basis[r.toestel_id]);
      volgend.setFullYear(volgend.getFullYear() + 1);
      return { r, volgend, dagen: Math.round((volgend - Date.now()) / 86400000) };
    }).sort((a, b) => a.volgend - b.volgend);
    planVak.innerHTML = '';
    if (plan.length === 0) planVak.appendChild(maak('p', 'Geen gegevens.', 'leeg'));
    else planVak.appendChild(tabel(['Datum', 'Over', 'Klant', 'Woning · kamer'], plan.map(p => ({
      href: '#/toestel/' + p.r.toestel_id,
      cellen: [p.volgend.toLocaleDateString('nl-BE'), maak('span', p.dagen < 0 ? 'te laat' : p.dagen + ' d', 'status ' + (p.dagen <= 30 ? 'matig' : 'goed')), p.r.klant || '—', (p.r.woning || '') + ' · ' + (p.r.kamer || '')]
    }))));

    // ---------- Recent ----------
    recentVak.innerHTML = '';
    if (o.length === 0) recentVak.appendChild(maak('p', 'Nog niets uitgevoerd.', 'leeg'));
    for (const x of o.slice(0, 12)) {
      const r = maak('a', null, 'actie-item'); r.href = '#/toestel/' + x.toestel_id;
      const tekst = maak('div', null, 'tekst');
      tekst.appendChild(maak('strong', (ONDERHOUD_TEKST[x.soort] || x.soort) + ' · ' + (x.toestellen?.woningen?.naam || '') + ' · ' + (x.toestellen?.naam || '')));
      tekst.appendChild(maak('span', new Date(x.uitgevoerd_op).toLocaleDateString('nl-BE') + (x.omschrijving ? ' · ' + x.omschrijving : '')));
      r.append(tekst, maak('span', '→', 'pijl'));
      recentVak.appendChild(r);
    }
  }

  await laad();
  let timer = null;
  opruimen.push(bus.on('status', () => { clearTimeout(timer); timer = setTimeout(laad, 800); }), () => clearTimeout(timer));
  return opruimen;
}

function tabel(koppen, rijen) {
  const t = maak('table');
  t.className = 'klik-tabel';
  const kop = maak('tr');
  for (const k of koppen) kop.appendChild(maak('th', k));
  t.appendChild(kop);
  for (const r of rijen) {
    const rij = maak('tr', null, 'klikbaar');
    for (const c of r.cellen) {
      const td = maak('td');
      if (c instanceof Node) td.appendChild(c); else td.textContent = c;
      rij.appendChild(td);
    }
    rij.addEventListener('click', () => { location.hash = r.href; });
    t.appendChild(rij);
  }
  return t;
}
