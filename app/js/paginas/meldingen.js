// =====================================================================
// MELDINGEN — postvak: links de lijst, rechts het gesprek
// #/meldingen  ·  #/meldingen/:id  ·  #/meldingen/nieuw (klant)
// =====================================================================
import { db, maak, bus, sessie, datum, sindsTekst, statusBadge, aantalBerichten, paginaKop, CATEGORIE } from '../lib.js';
import { gesprekVak } from '../onderdelen/gesprek.js';

let filterStatus = 'actief';   // blijft bewaard tussen pagina's
let filterCategorie = '';

export async function render(el, param) {
  const opruimen = [];
  const beheer = sessie.rol === 'beheerder';
  const nieuw = param === 'nieuw' && !beheer;
  const gekozenId = param && !nieuw ? Number(param) : null;

  const kop = paginaKop('Meldingen', beheer ? 'Alle hulpvragen en storingen van klanten.' : 'Uw hulpvragen en het gesprek met Vernast.');
  if (!beheer) {
    const k = maak('a'); k.href = '#/meldingen/nieuw';
    k.appendChild(maak('button', '+ Nieuwe melding', 'hulpknop'));
    kop.appendChild(k);
  }
  el.appendChild(kop);

  const postvak = maak('div', null, 'postvak' + (gekozenId || nieuw ? ' gesprek-open' : ''));
  const lijstKaart = maak('div', null, 'postvak-lijst');
  const filters = maak('div', null, 'postvak-filters');
  const items = maak('div', null, 'postvak-items');
  lijstKaart.append(filters, items);

  const rechts = maak('div');
  postvak.append(lijstKaart, rechts);
  el.appendChild(postvak);

  // ---------- Filters ----------
  function tekenFilters() {
    filters.innerHTML = '';
    for (const [k, t] of [['actief', 'Lopend'], ['open', 'Open'], ['in behandeling', 'In behandeling'], ['opgelost', 'Opgelost'], ['alle', 'Alle']]) {
      const b = maak('button', t, k === filterStatus ? '' : 'licht');
      b.type = 'button';
      b.addEventListener('click', () => { filterStatus = k; tekenFilters(); laadLijst(); });
      filters.appendChild(b);
    }
    if (beheer) {
      const s = maak('select');
      const leeg = maak('option', 'Alle categorieën'); leeg.value = ''; s.appendChild(leeg);
      for (const [k, v] of Object.entries(CATEGORIE)) { const o = maak('option', v); o.value = k; s.appendChild(o); }
      s.value = filterCategorie;
      s.addEventListener('change', () => { filterCategorie = s.value; laadLijst(); });
      filters.appendChild(s);
    }
  }

  // ---------- Lijst ----------
  async function laadLijst() {
    let q = db.from('meldingen')
      .select('id, categorie, bericht, status, aangemaakt_op, bijgewerkt_op, foto_pad, woningen(naam), profielen(naam), melding_berichten(count)')
      .order('bijgewerkt_op', { ascending: false })
      .limit(100);
    if (filterStatus === 'actief') q = q.neq('status', 'opgelost');
    else if (filterStatus !== 'alle') q = q.eq('status', filterStatus);
    if (filterCategorie) q = q.eq('categorie', filterCategorie);
    const { data, error } = await q;

    items.innerHTML = '';
    if (error) { items.appendChild(maak('p', 'Fout: ' + error.message, 'fout')); return; }
    if (!data || data.length === 0) { items.appendChild(maak('p', 'Geen meldingen in deze lijst.', 'leeg')); return; }
    for (const m of data) {
      const a = maak('a', null, 'postvak-item' + (m.id === gekozenId ? ' actief' : ''));
      a.href = '#/meldingen/' + m.id;
      const r1 = maak('div', null, 'r1');
      r1.appendChild(maak('strong', CATEGORIE[m.categorie] || m.categorie));
      r1.appendChild(statusBadge(m.status));
      const r2 = maak('div', m.bericht || '(geen beschrijving)', 'r2');
      const r3 = maak('div', null, 'r3');
      r3.appendChild(maak('span', beheer ? (m.profielen?.naam || '?') + ' · ' + (m.woningen?.naam || '') : (m.woningen?.naam || '')));
      r3.appendChild(maak('span', sindsTekst(m.bijgewerkt_op || m.aangemaakt_op)));
      r3.appendChild(maak('span', (m.foto_pad ? '📷 ' : '') + '💬 ' + aantalBerichten(m)));
      a.append(r1, r2, r3);
      items.appendChild(a);
    }
  }

  tekenFilters();
  await laadLijst();

  // ---------- Rechts: gesprek, nieuwe melding of uitleg ----------
  if (nieuw) rechts.appendChild(nieuweMelding());
  else if (gekozenId) rechts.appendChild(gesprekVak(gekozenId, opruimen, laadLijst));
  else {
    const leeg = maak('div', null, 'gesprek-vak');
    leeg.appendChild(maak('p', 'Kies links een melding om het gesprek te openen.', 'leeg'));
    rechts.appendChild(leeg);
  }

  // ---------- Realtime: lijst verversen ----------
  let timer = null;
  const ververs = () => { clearTimeout(timer); timer = setTimeout(laadLijst, 500); };
  opruimen.push(bus.on('melding', ververs));
  opruimen.push(bus.on('bericht', ververs));
  opruimen.push(() => clearTimeout(timer));
  return opruimen;
}

// =====================================================================
// Nieuwe melding (klant): woning, categorie, foto, beschrijving
// =====================================================================
function nieuweMelding() {
  const vak = maak('div', null, 'gesprek-vak');
  const kop = maak('div', null, 'paneel-kop');
  kop.appendChild(maak('h2', 'Nieuwe melding'));
  const terug = maak('a', '← Alle meldingen', 'terug'); terug.href = '#/meldingen'; terug.style.marginBottom = '0';
  kop.appendChild(terug);
  vak.appendChild(kop);
  vak.appendChild(maak('p', 'Beschrijf het probleem. Vernast krijgt uw melding meteen te zien.', 'adres'));

  const formulier = maak('div');
  formulier.style.marginTop = '18px';
  vak.appendChild(formulier);

  const woningLabel = maak('label', 'Woning');
  const woning = maak('select');
  const catLabel = maak('label', 'Waarover gaat het?');
  const cat = maak('select');
  for (const [k, v] of Object.entries(CATEGORIE)) { const o = maak('option', v); o.value = k; cat.appendChild(o); }
  cat.value = 'geen_werking';
  const tekstLabel = maak('label', 'Beschrijving');
  const tekst = maak('textarea'); tekst.maxLength = 500; tekst.placeholder = 'Wat merkt u? Sinds wanneer?';

  const fotoLabel = maak('label', null, 'bestand');
  fotoLabel.appendChild(document.createTextNode('📷 Foto toevoegen (optioneel)'));
  const fotoInput = maak('input'); fotoInput.type = 'file'; fotoInput.accept = 'image/*';
  fotoLabel.appendChild(fotoInput);
  const voorbeeld = maak('div', null, 'voorbeeld verborgen');
  voorbeeld.style.marginTop = '12px';

  const knop = maak('button', 'Melding versturen', 'hulpknop');
  knop.style.marginTop = '18px';
  const status = maak('p');

  formulier.append(woningLabel, woning, catLabel, cat, tekstLabel, tekst, fotoLabel, voorbeeld, maak('div'), knop, status);

  // Woningen van de klant
  db.from('woningen').select('id, naam').order('naam').then(({ data }) => {
    for (const w of (data || [])) { const o = maak('option', w.naam); o.value = w.id; woning.appendChild(o); }
    if (!data || data.length === 0) { status.textContent = 'Er is nog geen woning aan uw account gekoppeld.'; status.className = 'fout'; knop.disabled = true; }
    if (data && data.length === 1) { woningLabel.classList.add('verborgen'); woning.classList.add('verborgen'); }
  });

  let fotoBlob = null;
  fotoInput.addEventListener('change', async () => {
    const f = fotoInput.files[0];
    if (!f) return;
    status.textContent = 'Foto voorbereiden...'; status.className = '';
    try { fotoBlob = await verklein(f); }
    catch (e) { fotoBlob = null; status.textContent = 'Deze foto kan niet gelezen worden. Kies een JPG- of PNG-foto.'; status.className = 'fout'; return; }
    status.textContent = '';
    voorbeeld.innerHTML = '';
    const img = maak('img'); img.src = URL.createObjectURL(fotoBlob); img.alt = 'Voorbeeld van de foto';
    const weg = maak('button', 'Verwijderen', 'licht'); weg.type = 'button';
    weg.addEventListener('click', () => { fotoBlob = null; fotoInput.value = ''; voorbeeld.classList.add('verborgen'); });
    voorbeeld.append(img, maak('span', Math.round(fotoBlob.size / 1024) + ' kB', 'adres'), weg);
    voorbeeld.classList.remove('verborgen');
  });

  knop.addEventListener('click', async () => {
    if (!woning.value) return;
    knop.disabled = true;
    status.textContent = 'Bezig met versturen...'; status.className = '';

    let fotoPad = null;
    if (fotoBlob) {
      fotoPad = sessie.id + '/' + Date.now() + '.jpg';
      const { error: upFout } = await db.storage.from('melding-fotos').upload(fotoPad, fotoBlob, { contentType: 'image/jpeg', upsert: false });
      if (upFout) { status.textContent = 'Foto uploaden mislukt: ' + upFout.message; status.className = 'fout'; knop.disabled = false; return; }
    }

    const { data, error } = await db.from('meldingen').insert({
      woning_id: Number(woning.value),
      categorie: cat.value,
      bericht: tekst.value.trim() || null,
      foto_pad: fotoPad
    }).select('id').single();
    if (error) { status.textContent = 'Versturen mislukt: ' + error.message; status.className = 'fout'; knop.disabled = false; return; }
    location.hash = '#/meldingen/' + data.id;
  });

  return vak;
}

// Foto verkleinen tot max. 1600 px (sneller uploaden, kleiner dan 5 MB)
async function verklein(bestand) {
  const bmp = await createImageBitmap(bestand);
  const max = 1600;
  const schaal = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * schaal); c.height = Math.round(bmp.height * schaal);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((ok, nok) => c.toBlob(b => b ? ok(b) : nok(new Error('leeg')), 'image/jpeg', 0.85));
}
