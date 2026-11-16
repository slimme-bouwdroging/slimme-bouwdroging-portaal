// =====================================================================
// VERNAST — Klantdetail: woningen, toestellen, meldingen
// =====================================================================
import { db, maak, link, dag, sindsTekst, statusBadge, CATEGORIE } from '../lib.js';
import { kamerkaart, laadKaartData } from '../onderdelen/kamerkaart.js';

export async function render(el, id) {
  el.appendChild(link('#/klanten', '← Klanten', 'terug'));

  const { data: k, error } = await db.from('profielen')
    .select('id, naam, email, rol, aangemaakt_op').eq('id', id).single();
  if (error || !k) { el.appendChild(maak('p', 'Klant niet gevonden.', 'fout')); return []; }

  const kop = maak('div', null, 'pagina-kop');
  const links = maak('div');
  links.appendChild(maak('p', 'Klant', 'eyebrow'));
  links.appendChild(maak('h1', k.naam || '(geen naam)'));
  links.appendChild(maak('p', (k.email || '') + (k.aangemaakt_op ? ' · klant sinds ' + dag(k.aangemaakt_op) : ''), 'ondertitel'));
  kop.appendChild(links);
  el.appendChild(kop);

  const woningenVak = maak('div');
  el.appendChild(woningenVak);

  async function laadWoningen() {
    const { data: woningen } = await db.from('woningen')
      .select('id, naam, adres, toestellen(id, naam, serienummer, toestel_status(*))')
      .eq('klant_id', k.id).order('naam');
    woningenVak.innerHTML = '';
    if (!woningen || woningen.length === 0) {
      woningenVak.appendChild(maak('p', 'Deze klant heeft nog geen woning. Voeg er een toe via de pagina Klanten.', 'adres'));
      return;
    }
    const alle = woningen.flatMap(w => w.toestellen || []);
    const { metingen, alarmen } = await laadKaartData(alle);

    for (const w of woningen) {
      const wk = maak('div', null, 'woning-kop');
      wk.appendChild(maak('h2', w.naam));
      const rechts = maak('div', null, 'klantkeuze');
      if (w.adres) rechts.appendChild(maak('span', w.adres, 'adres'));
      const ontkoppel = maak('button', 'Ontkoppelen', 'licht');
      ontkoppel.style.padding = '5px 12px'; ontkoppel.style.fontSize = '12px';
      let bevestig = false;
      ontkoppel.addEventListener('click', async () => {
        if (!bevestig) { bevestig = true; ontkoppel.textContent = 'Zeker? Klik opnieuw'; ontkoppel.classList.add('bevestig'); setTimeout(() => { bevestig = false; ontkoppel.textContent = 'Ontkoppelen'; ontkoppel.classList.remove('bevestig'); }, 5000); return; }
        await db.from('woningen').update({ klant_id: null }).eq('id', w.id);
        laadWoningen();
      });
      rechts.appendChild(ontkoppel);
      wk.appendChild(rechts);
      woningenVak.appendChild(wk);

      const raster = maak('div', null, 'kaart-raster');
      for (const t of (w.toestellen || []).sort((a, b) => a.naam.localeCompare(b.naam))) {
        raster.appendChild(kamerkaart(t, metingen[t.id], alarmen[t.id], '#/toestel/' + t.id, t.serienummer));
      }
      raster.appendChild(toestelToevoegen(w, laadWoningen));
      woningenVak.appendChild(raster);
    }
  }
  await laadWoningen();

  // ---------- Meldingen van deze klant ----------
  const mk = maak('div', null, 'kaart');
  mk.style.marginTop = '32px';
  mk.appendChild(maak('h2', 'Meldingen'));
  const mLijst = maak('div', null, 'actielijst');
  mk.appendChild(mLijst);
  el.appendChild(mk);
  const { data: meldingen } = await db.from('meldingen')
    .select('id, categorie, bericht, status, bijgewerkt_op, aangemaakt_op, woningen(naam)')
    .eq('klant_id', k.id).order('bijgewerkt_op', { ascending: false }).limit(20);
  if (!meldingen || meldingen.length === 0) mLijst.appendChild(maak('p', 'Geen meldingen.', 'leeg'));
  for (const m of (meldingen || [])) {
    const r = maak('a', null, 'actie-item'); r.href = '#/meldingen/' + m.id;
    const tekst = maak('div', null, 'tekst');
    tekst.appendChild(maak('strong', (CATEGORIE[m.categorie] || m.categorie) + ' · ' + (m.woningen?.naam || '')));
    tekst.appendChild(maak('span', (m.bericht || '(geen beschrijving)').slice(0, 80) + ' · ' + sindsTekst(m.bijgewerkt_op || m.aangemaakt_op)));
    r.append(tekst, statusBadge(m.status));
    mLijst.appendChild(r);
  }
  return [];
}

// Kaart "+ Toestel toevoegen" binnen een woning
function toestelToevoegen(w, naAfloop) {
  const houder = maak('div', null, 'nieuw-toestel');
  const open = maak('button', '+ Toestel toevoegen'); open.type = 'button';
  houder.appendChild(open);
  const kaart = maak('div', null, 'kaart');
  kaart.style.margin = '0';
  kaart.style.borderStyle = 'dashed';
  open.addEventListener('click', () => { houder.replaceWith(kaart); kaart.querySelector('input').focus(); });
  kaart.appendChild(maak('h3', 'Toestel toevoegen'));
  kaart.appendChild(maak('label', 'Kamer'));
  const kamer = maak('input'); kamer.placeholder = 'Slaapkamer';
  kaart.appendChild(kamer);
  kaart.appendChild(maak('label', 'Serienummer'));
  const serie = maak('input'); serie.placeholder = 'FAO-2026-0005';
  kaart.appendChild(serie);
  const knop = maak('button', 'Toestel registreren');
  const st = maak('p');
  kaart.append(knop, st);

  knop.addEventListener('click', async () => {
    const naam = kamer.value.trim();
    if (!naam) { st.textContent = 'Vul een kamer in.'; st.className = 'fout'; return; }
    knop.disabled = true; st.textContent = 'Bezig...'; st.className = '';
    const vandaag = new Date().toISOString().slice(0, 10);
    const { data: t, error } = await db.from('toestellen')
      .insert({ woning_id: w.id, naam, serienummer: serie.value.trim() || null, geinstalleerd_op: vandaag })
      .select('id').single();
    if (error) { st.textContent = 'Mislukt: ' + error.message; st.className = 'fout'; knop.disabled = false; return; }
    await db.from('toestel_status').insert({ toestel_id: t.id });
    await db.from('onderhoud').insert({ toestel_id: t.id, soort: 'installatie', omschrijving: 'Toestel geregistreerd door Vernast' });
    naAfloop();
  });
  return houder;
}
