// =====================================================================
// KLANT — Home: per woning een kaart per kamer
// =====================================================================
import { db, maak, link, sessie, bus, paginaKop } from '../lib.js';
import { kamerkaart, laadKaartData } from '../onderdelen/kamerkaart.js';

export async function render(el) {
  const opruimen = [];
  el.appendChild(paginaKop('Hallo ' + sessie.naam.split(' ')[0] + '.', 'Zo staat het met de lucht in uw woning.', 'Vernast-app'));

  const { data: woningen, error } = await db.from('woningen')
    .select('id, naam, adres, toestellen(id, naam, serienummer, toestel_status(*))')
    .order('naam');
  if (error) { el.appendChild(maak('p', 'Fout: ' + error.message, 'fout')); return opruimen; }
  if (!woningen || woningen.length === 0) {
    const k = maak('div', null, 'kaart');
    k.appendChild(maak('h3', 'Nog geen woning gekoppeld'));
    k.appendChild(maak('p', 'Vernast koppelt uw woning en toestellen aan uw account na de installatie.', 'adres'));
    el.appendChild(k);
    return opruimen;
  }

  const alleToestellen = woningen.flatMap(w => w.toestellen || []);
  const { metingen, alarmen } = await laadKaartData(alleToestellen);

  for (const w of woningen) {
    const kop = maak('div', null, 'woning-kop');
    kop.appendChild(maak('h2', w.naam));
    kop.appendChild(maak('span', w.adres || '', 'adres'));
    el.appendChild(kop);

    const raster = maak('div', null, 'kaart-raster');
    const toestellen = (w.toestellen || []).sort((a, b) => a.naam.localeCompare(b.naam));
    if (toestellen.length === 0) raster.appendChild(maak('p', 'Nog geen toestellen geïnstalleerd.', 'adres'));
    for (const t of toestellen) {
      raster.appendChild(kamerkaart(t, metingen[t.id], alarmen[t.id], '#/kamer/' + t.id));
    }
    el.appendChild(raster);
  }

  // Snelle hulp
  const hulp = maak('div', null, 'kaart');
  hulp.style.marginTop = '32px';
  const r = maak('div', null, 'kaart-kop');
  r.style.marginBottom = '0';
  const tekst = maak('div');
  tekst.appendChild(maak('h3', 'Hulp nodig?'));
  tekst.appendChild(maak('p', 'Meld een storing of stel een vraag aan Vernast. U kunt een foto toevoegen.', 'adres'));
  const knop = link('#/meldingen/nieuw', null);
  knop.appendChild(maak('button', 'Hulp vragen', 'hulpknop'));
  r.append(tekst, knop);
  hulp.appendChild(r);
  el.appendChild(hulp);

  // Status verandert (bv. Vernast zet toestel uit) -> pagina verversen
  let timer = null;
  opruimen.push(bus.on('status', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (location.hash === '#/home') window.dispatchEvent(new HashChangeEvent('hashchange')); }, 600);
  }));
  opruimen.push(() => clearTimeout(timer));
  return opruimen;
}
