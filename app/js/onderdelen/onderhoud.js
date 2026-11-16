// =====================================================================
// Filter & onderhoud van één toestel
// =====================================================================
import { db, maak, bus, sessie, filterOordeel, ONDERHOUD_TEKST } from '../lib.js';

export function onderhoudBlok(t, st, woningId, opruimen) {
  const blok = maak('div', null, 'onderhoud');
  const kop = maak('div', null, 'onderhoud-kop');
  kop.appendChild(maak('h4', 'Filter'));
  blok.appendChild(kop);

  const meter = maak('div', null, 'meter');
  const balk = maak('div');
  meter.appendChild(balk);
  const filterRegel = maak('p', null, 'regel');
  const onderhoudRegel = maak('p', null, 'regel');
  const melding = maak('p', null, 'bed-melding');
  const acties = maak('div', null, 'onderhoud-acties');
  const histTitel = maak('h4', 'Onderhoudshistoriek');
  histTitel.style.marginTop = '22px';
  const histLijst = maak('div', null, 'log');
  blok.append(meter, filterRegel, onderhoudRegel, acties);

  let pct = st.filter_procent;
  let online = st.online;

  // Filter vervangen: twee keer klikken (geen pop-up)
  const filterKnop = maak('button', 'Filter vervangen ✓', 'licht');
  let bevestigTimer = null;

  function tekenFilter() {
    const o = filterOordeel(pct);
    balk.className = o[0];
    balk.style.width = Math.max(2, pct) + '%';
    filterRegel.innerHTML = '';
    filterRegel.appendChild(document.createTextNode('Filter: '));
    filterRegel.appendChild(maak('strong', pct + ' %'));
    filterRegel.appendChild(document.createTextNode(' · ' + o[1]));
    filterKnop.disabled = !online;
  }

  filterKnop.addEventListener('click', async () => {
    if (!filterKnop.classList.contains('bevestig')) {
      filterKnop.classList.add('bevestig');
      filterKnop.textContent = 'Klik opnieuw om te bevestigen';
      bevestigTimer = setTimeout(() => { filterKnop.classList.remove('bevestig'); filterKnop.textContent = 'Filter vervangen ✓'; }, 5000);
      return;
    }
    clearTimeout(bevestigTimer);
    filterKnop.classList.remove('bevestig');
    filterKnop.textContent = 'Filter vervangen ✓';
    filterKnop.disabled = true;
    melding.textContent = 'Bezig...'; melding.className = 'bed-melding';
    const { data, error } = await db.from('commandos')
      .insert({ toestel_id: t.id, actie: 'filter_reset' })
      .select('status, foutmelding').single();
    if (error) { melding.textContent = 'Niet gelukt: ' + error.message; melding.className = 'bed-melding fout'; }
    else if (data.status === 'mislukt') { melding.textContent = 'Niet uitgevoerd: ' + (data.foutmelding || ''); melding.className = 'bed-melding fout'; }
    else { melding.textContent = 'Filterteller staat terug op 100 % ✓'; melding.className = 'bed-melding ok'; }
    const { data: nieuw } = await db.from('toestel_status').select('*').eq('toestel_id', t.id).single();
    if (nieuw) { pct = nieuw.filter_procent; online = nieuw.online; bus.emit('status', nieuw); }
    tekenFilter();
    await laadHistoriek();
  });
  acties.appendChild(filterKnop);

  // Klant: onderhoudsafspraak aanvragen (komt als melding binnen bij Vernast)
  if (sessie.rol === 'klant') {
    const afspraak = maak('button', 'Onderhoudsafspraak aanvragen', 'licht');
    afspraak.addEventListener('click', async () => {
      afspraak.disabled = true;
      const { data, error } = await db.from('meldingen').insert({
        woning_id: woningId,
        categorie: 'onderhoud',
        bericht: 'Onderhoudsafspraak aangevraagd voor ' + t.naam + (t.serienummer ? ' (' + t.serienummer + ')' : '')
      }).select('id').single();
      if (error) { melding.textContent = 'Niet gelukt: ' + error.message; melding.className = 'bed-melding fout'; afspraak.disabled = false; return; }
      melding.innerHTML = '';
      melding.className = 'bed-melding ok';
      melding.appendChild(document.createTextNode('Aanvraag verstuurd. Vernast neemt contact op. '));
      const a = maak('a', 'Bekijk de melding →'); a.href = '#/meldingen/' + data.id; a.style.color = 'inherit';
      melding.appendChild(a);
    });
    acties.appendChild(afspraak);
  }
  blok.appendChild(melding);

  // Beheerder: onderhoud of interventie registreren
  if (sessie.rol === 'beheerder') {
    const form = maak('div', null, 'onderhoud-form');
    const soort = maak('select');
    for (const [k, v] of [['onderhoud', 'Onderhoud'], ['interventie', 'Interventie']]) { const o = maak('option', v); o.value = k; soort.appendChild(o); }
    const omschr = maak('input'); omschr.placeholder = 'Omschrijving (bv. ventilator gereinigd)';
    const knop = maak('button', 'Registreren');
    knop.addEventListener('click', async () => {
      if (!omschr.value.trim()) { melding.textContent = 'Vul een omschrijving in.'; melding.className = 'bed-melding fout'; return; }
      knop.disabled = true;
      const { error } = await db.from('onderhoud').insert({ toestel_id: t.id, soort: soort.value, omschrijving: omschr.value.trim(), door: sessie.id });
      if (error) { melding.textContent = 'Niet gelukt: ' + error.message; melding.className = 'bed-melding fout'; }
      else { melding.textContent = 'Geregistreerd ✓'; melding.className = 'bed-melding ok'; omschr.value = ''; await laadHistoriek(); }
      knop.disabled = false;
    });
    form.append(soort, omschr, knop);
    blok.appendChild(form);
  }

  blok.append(histTitel, histLijst);

  async function laadHistoriek() {
    const { data } = await db.from('onderhoud')
      .select('soort, omschrijving, uitgevoerd_op')
      .eq('toestel_id', t.id)
      .order('uitgevoerd_op', { ascending: false });
    const lijst = data || [];

    // Volgend onderhoud: 1 jaar na laatste installatie of onderhoud
    const basis = lijst.find(o => o.soort === 'onderhoud' || o.soort === 'installatie');
    onderhoudRegel.innerHTML = '';
    onderhoudRegel.className = 'regel';
    if (basis) {
      const volgend = new Date(basis.uitgevoerd_op);
      volgend.setFullYear(volgend.getFullYear() + 1);
      const dagen = Math.round((volgend - Date.now()) / 86400000);
      onderhoudRegel.appendChild(document.createTextNode('Volgend onderhoud: '));
      onderhoudRegel.appendChild(maak('strong', volgend.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })));
      onderhoudRegel.appendChild(document.createTextNode(dagen < 0 ? ' · te laat' : ' · over ' + dagen + ' dagen'));
      if (dagen <= 30) onderhoudRegel.classList.add('matig');
    }

    histLijst.innerHTML = '';
    if (lijst.length === 0) { histLijst.appendChild(maak('p', 'Nog geen onderhoud geregistreerd.', 'adres')); return; }
    const ul = maak('ul');
    for (const o of lijst) {
      const li = maak('li');
      li.appendChild(maak('span', new Date(o.uitgevoerd_op).toLocaleDateString('nl-BE')));
      li.appendChild(maak('strong', ONDERHOUD_TEKST[o.soort] || o.soort));
      if (o.omschrijving) li.appendChild(maak('span', o.omschrijving));
      ul.appendChild(li);
    }
    histLijst.appendChild(ul);
  }

  opruimen.push(bus.on('status', (nieuw) => {
    if (nieuw.toestel_id !== t.id) return;
    if (nieuw.filter_procent !== undefined && nieuw.filter_procent !== pct) { pct = nieuw.filter_procent; laadHistoriek(); }
    if (nieuw.online !== undefined) online = nieuw.online;
    tekenFilter();
  }));

  tekenFilter();
  laadHistoriek();
  return blok;
}
