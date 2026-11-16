// =====================================================================
// VERNAST — Dashboard: cijfers + "Actie nodig"
// =====================================================================
import { db, maak, link, bus, sindsTekst, statusBadge, paginaKop, CATEGORIE } from '../lib.js';

export async function render(el) {
  const opruimen = [];
  el.appendChild(paginaKop('Dashboard', 'Wat vandaag aandacht vraagt.', 'Vernast-app'));

  const kpi = maak('div', null, 'kpi');
  el.appendChild(kpi);

  const kolommen = maak('div', null, 'twee-kolommen');
  const actieKaart = maak('div', null, 'kaart');
  const actieKop = maak('div', null, 'kaart-kop');
  actieKop.appendChild(maak('h2', 'Actie nodig'));
  const actieTeller = maak('span', '', 'adres');
  actieKop.appendChild(actieTeller);
  const actieLijst = maak('div', null, 'actielijst');
  actieKaart.append(actieKop, actieLijst);

  const meldKaart = maak('div', null, 'kaart');
  const meldKop = maak('div', null, 'kaart-kop');
  meldKop.appendChild(maak('h2', 'Laatste meldingen'));
  meldKop.appendChild(link('#/meldingen', 'Alle meldingen →', 'adres'));
  const meldLijst = maak('div', null, 'actielijst');
  meldKaart.append(meldKop, meldLijst);

  kolommen.append(actieKaart, meldKaart);
  el.appendChild(kolommen);

  async function laad() {
    const [{ data: vloot }, { data: meldingen }] = await Promise.all([
      db.rpc('vloot_overzicht'),
      db.from('meldingen')
        .select('id, categorie, bericht, status, bijgewerkt_op, aangemaakt_op, woningen(naam), profielen(naam)')
        .order('bijgewerkt_op', { ascending: false }).limit(30)
    ]);
    const v = vloot || [];
    const ml = meldingen || [];

    // ---------- Cijfers ----------
    const totaal = v.length;
    const online = v.filter(r => r.online).length;
    const alarmen = v.reduce((n, r) => n + Number(r.open_alarmen || 0), 0);
    const filters = v.filter(r => r.filter_procent !== null && r.filter_procent <= 35).length;
    const open = ml.filter(m => m.status === 'open').length;
    kpi.innerHTML = '';
    for (const [label, waarde, kleur, href] of [
      ['Toestellen', totaal, '', '#/toestellen'],
      ['Online', online, 'goed', '#/toestellen'],
      ['Offline', totaal - online, totaal - online ? 'slecht' : 'goed', '#/toestellen'],
      ['Open alarmen', alarmen, alarmen ? 'matig' : 'goed', '#/toestellen'],
      ['Filters ≤ 35 %', filters, filters ? 'matig' : 'goed', '#/onderhoud'],
      ['Open meldingen', open, open ? 'slecht' : 'goed', '#/meldingen']
    ]) {
      const d = maak('a'); d.href = href; d.style.textDecoration = 'none'; d.style.color = 'inherit';
      d.appendChild(maak('div', label, 'label'));
      d.appendChild(maak('div', String(waarde), 'waarde ' + kleur));
      kpi.appendChild(d);
    }

    // ---------- Actie nodig ----------
    const acties = [];
    for (const m of ml.filter(m => m.status === 'open')) {
      acties.push({ ernst: 'slecht', icoon: '💬', titel: 'Open melding: ' + (CATEGORIE[m.categorie] || m.categorie),
        tekst: (m.profielen?.naam || '?') + ' · ' + (m.woningen?.naam || '') + ' · ' + sindsTekst(m.aangemaakt_op), href: '#/meldingen/' + m.id });
    }
    for (const r of v.filter(r => r.online === false)) {
      acties.push({ ernst: 'slecht', icoon: '⚡', titel: 'Offline: ' + r.kamer + ' (' + (r.woning || '') + ')',
        tekst: (r.klant || '—') + ' · laatst gezien ' + (r.laatst_gezien ? sindsTekst(r.laatst_gezien) : 'onbekend'), href: '#/toestel/' + r.toestel_id });
    }
    for (const r of v.filter(r => Number(r.open_alarmen) > 0 && r.online !== false)) {
      acties.push({ ernst: 'matig', icoon: '⚠', titel: r.open_alarmen + ' open alarm' + (r.open_alarmen > 1 ? 'en' : '') + ': ' + r.kamer + ' (' + (r.woning || '') + ')',
        tekst: r.klant || '—', href: '#/toestel/' + r.toestel_id });
    }
    for (const r of v.filter(r => r.filter_procent !== null && r.filter_procent <= 35)) {
      acties.push({ ernst: r.filter_procent <= 15 ? 'slecht' : 'matig', icoon: '🔧', titel: 'Filter ' + r.filter_procent + ' %: ' + r.kamer + ' (' + (r.woning || '') + ')',
        tekst: (r.klant || '—') + ' · vervangen ' + (r.filter_procent <= 15 ? 'aangeraden' : 'binnenkort'), href: '#/toestel/' + r.toestel_id });
    }

    actieTeller.textContent = acties.length ? acties.length + ' items' : '';
    actieLijst.innerHTML = '';
    if (acties.length === 0) actieLijst.appendChild(maak('p', '✓ Alles in orde. Er is niets dat aandacht vraagt.', 'leeg'));
    for (const a of acties) {
      const r = maak('a', null, 'actie-item'); r.href = a.href;
      r.appendChild(maak('div', a.icoon, 'icoon ' + a.ernst));
      const tekst = maak('div', null, 'tekst');
      tekst.appendChild(maak('strong', a.titel));
      tekst.appendChild(maak('span', a.tekst));
      r.append(tekst, maak('span', '→', 'pijl'));
      actieLijst.appendChild(r);
    }

    // ---------- Laatste meldingen ----------
    meldLijst.innerHTML = '';
    if (ml.length === 0) meldLijst.appendChild(maak('p', 'Nog geen meldingen.', 'leeg'));
    for (const m of ml.slice(0, 6)) {
      const r = maak('a', null, 'actie-item'); r.href = '#/meldingen/' + m.id;
      const tekst = maak('div', null, 'tekst');
      tekst.appendChild(maak('strong', (CATEGORIE[m.categorie] || m.categorie) + ' · ' + (m.profielen?.naam || '?')));
      tekst.appendChild(maak('span', (m.bericht || '(geen beschrijving)').slice(0, 70) + ' · ' + sindsTekst(m.bijgewerkt_op || m.aangemaakt_op)));
      r.append(tekst, statusBadge(m.status));
      meldLijst.appendChild(r);
    }
  }

  await laad();
  let timer = null;
  const ververs = () => { clearTimeout(timer); timer = setTimeout(laad, 800); };
  for (const e of ['status', 'melding', 'alarm']) opruimen.push(bus.on(e, ververs));
  opruimen.push(() => clearTimeout(timer));
  return opruimen;
}
