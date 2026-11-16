// =====================================================================
// Gesprek bij één melding: foto, tijdlijn, berichten, status (Vernast)
// =====================================================================
import { db, maak, bus, sessie, datum, statusBadge, CATEGORIE } from '../lib.js';

export function gesprekVak(meldingId, opruimen, bijWijziging) {
  const vak = maak('div', null, 'gesprek-vak');
  const kop = maak('div', null, 'paneel-kop');
  const titel = maak('h2', 'Melding');
  const terug = maak('a', '← Alle meldingen', 'terug');
  terug.href = '#/meldingen';
  terug.style.marginBottom = '0';
  kop.append(titel, terug);
  const meta = maak('div', null, 'gesprek-meta');
  const statusRij = maak('div', null, 'gesprek-status');
  const tl = maak('div', null, 'tijdlijn');
  const invoer = maak('div', null, 'gesprek-invoer');
  const tekst = maak('textarea');
  tekst.maxLength = 2000; tekst.placeholder = 'Typ een bericht...';
  const stuurKnop = maak('button', 'Versturen'); stuurKnop.type = 'button';
  invoer.append(tekst, stuurKnop);
  const fout = maak('p', null, 'fout');
  vak.append(kop, meta, statusRij, tl, invoer, fout);

  async function herlaad() {
    const { data: m, error } = await db.from('meldingen')
      .select('id, categorie, bericht, status, aangemaakt_op, foto_pad, klant_id, woningen(naam, adres), profielen(naam)')
      .eq('id', meldingId).single();
    if (error || !m) { tl.innerHTML = ''; tl.appendChild(maak('p', 'Melding niet gevonden.', 'leeg')); invoer.classList.add('verborgen'); return; }

    titel.textContent = CATEGORIE[m.categorie] || 'Melding';
    meta.innerHTML = '';
    meta.appendChild(statusBadge(m.status));
    meta.appendChild(maak('span', (m.woningen?.naam || '') + (m.woningen?.adres ? ' – ' + m.woningen.adres : '')));
    if (sessie.rol === 'beheerder') meta.appendChild(maak('span', '· ' + (m.profielen?.naam || 'klant')));

    statusRij.innerHTML = '';
    if (sessie.rol === 'beheerder') {
      for (const [waarde, tekstK] of [['open', 'Open'], ['in behandeling', 'In behandeling'], ['opgelost', 'Opgelost']]) {
        const b = maak('button', tekstK, waarde === m.status ? '' : 'licht');
        b.type = 'button';
        b.disabled = waarde === m.status;
        b.addEventListener('click', async () => {
          const { error: e } = await db.from('meldingen').update({ status: waarde }).eq('id', m.id);
          if (e) fout.textContent = 'Status wijzigen mislukt: ' + e.message;
          await herlaad();
          if (bijWijziging) bijWijziging();
        });
        statusRij.appendChild(b);
      }
    }

    const { data: berichten } = await db.from('melding_berichten')
      .select('id, afzender, soort, tekst, aangemaakt_op, profielen(naam)')
      .eq('melding_id', meldingId)
      .order('aangemaakt_op');

    tl.innerHTML = '';
    if (m.foto_pad) {
      const { data: url } = await db.storage.from('melding-fotos').createSignedUrl(m.foto_pad, 3600);
      if (url?.signedUrl) {
        const img = maak('img', null, 'gesprek-foto');
        img.src = url.signedUrl; img.alt = 'Foto bij de melding';
        img.addEventListener('click', () => window.open(url.signedUrl, '_blank'));
        img.addEventListener('load', () => { tl.scrollTop = tl.scrollHeight; });
        tl.appendChild(img);
      }
    }

    const eerste = maak('div', null, 'bubbel' + (m.klant_id === sessie.id ? ' eigen' : ''));
    eerste.appendChild(maak('small', (m.klant_id === sessie.id ? 'U' : (m.profielen?.naam || 'Klant')) + ' · ' + datum(m.aangemaakt_op)));
    eerste.appendChild(document.createTextNode(m.bericht || '(geen beschrijving)'));
    tl.appendChild(eerste);

    for (const b of (berichten || [])) {
      if (b.soort === 'status') {
        tl.appendChild(maak('div', 'Status: ' + b.tekst + ' · ' + datum(b.aangemaakt_op), 'systeem'));
        continue;
      }
      const eigen = b.afzender === sessie.id;
      const bub = maak('div', null, 'bubbel' + (eigen ? ' eigen' : ''));
      bub.appendChild(maak('small', (eigen ? 'U' : (b.profielen?.naam || 'Vernast')) + ' · ' + datum(b.aangemaakt_op)));
      bub.appendChild(document.createTextNode(b.tekst));
      tl.appendChild(bub);
    }
    tl.scrollTop = tl.scrollHeight;
  }

  async function stuur() {
    const t = tekst.value.trim();
    if (!t) return;
    stuurKnop.disabled = true;
    const { error } = await db.from('melding_berichten').insert({ melding_id: meldingId, tekst: t });
    stuurKnop.disabled = false;
    if (error) { fout.textContent = 'Versturen mislukt: ' + error.message; return; }
    fout.textContent = '';
    tekst.value = '';
    await herlaad();
    if (bijWijziging) bijWijziging();
  }
  stuurKnop.addEventListener('click', stuur);
  tekst.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); stuur(); } });

  opruimen.push(bus.on('bericht', (b) => { if (b.melding_id === meldingId && b.afzender !== sessie.id) herlaad(); }));
  opruimen.push(bus.on('melding', (p) => { if (p.new && p.new.id === meldingId && p.eventType === 'UPDATE') herlaad(); }));

  herlaad();
  return vak;
}
