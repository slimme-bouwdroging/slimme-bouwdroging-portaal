// =====================================================================
// BOUWDROGER — detail van één droger (#/bouwdroger/:id)
// Klant en Vernast. Alleen Vernast ziet de knoppen aan/uit.
// =====================================================================
import { db, maak, link, bus, sessie, getal, datum, dag, sindsTekst, tegel } from '../lib.js';
import { TOESTAND, toestandBadge, duurTekst, urenBalk, vermogenGrafiek } from '../onderdelen/droger.js';

const OORZAAK = { UIT: 'Gestopt (geen verbruik)', LAAG: 'Alleen ventilator', 'geen verbinding': 'Geen verbinding', OFFLINE: 'Geen verbinding' };
const CMD_STATUS = { wachtend: 'wacht op stekker', verzonden: 'verstuurd', uitgevoerd: 'uitgevoerd', mislukt: 'mislukt' };

export async function render(el, id) {
  const opruimen = [];
  const beheer = sessie.rol === 'beheerder';
  const drogerId = Number(id);

  el.appendChild(link(beheer ? '#/bouwdrogers' : '#/droging', beheer ? '← Bouwdrogers' : '← Bouwdroging', 'terug'));

  const kopVak = maak('div');
  const tegelVak = maak('div');
  el.append(kopVak, tegelVak);

  // ---------- Bediening (alleen Vernast) ----------
  const bedVak = maak('div', null, 'kaart');
  // ---------- Grafiek ----------
  const grafKaart = maak('div', null, 'kaart');
  grafKaart.appendChild(maak('h3', 'Vermogen laatste 24 uur'));
  const grafBlok = maak('div', null, 'grafiek');
  const grafVak = maak('div', null, 'grafiek-vak');
  grafBlok.appendChild(grafVak);
  grafKaart.appendChild(grafBlok);
  grafKaart.appendChild(maak('p', 'Rood onderaan = de droger droogde niet (gestopt of offline).', 'voetnoot'));
  // ---------- Onderbrekingen ----------
  const ondKaart = maak('div', null, 'kaart');

  if (beheer) el.appendChild(bedVak);
  el.append(grafKaart, ondKaart);

  let r = null;

  async function laadKop() {
    const { data, error } = await db.from('droger_overzicht').select('*').eq('droger_id', drogerId).maybeSingle();
    if (error || !data) { kopVak.innerHTML = ''; kopVak.appendChild(maak('p', 'Deze droger bestaat niet of u hebt er geen toegang toe.', 'fout')); return false; }
    r = data;

    kopVak.innerHTML = '';
    const kop = maak('div', null, 'pagina-kop');
    const links = maak('div');
    links.appendChild(maak('p', r.code + (r.is_test ? ' · testdata' : ''), 'eyebrow'));
    links.appendChild(maak('h1', r.model));
    links.appendChild(maak('p', [r.werf, r.adres, beheer && r.klant ? 'Klant: ' + r.klant : null].filter(Boolean).join(' · '), 'ondertitel'));
    const chips = maak('div', null, 'chips');
    chips.appendChild(toestandBadge(r.toestand));
    kop.append(links, chips);
    kopVak.appendChild(kop);

    const uitleg = TOESTAND[r.toestand]?.uitleg;
    if (r.toestand === 'UIT' || r.toestand === 'OFFLINE') {
      const sinds = r.stil_sinds ? ' · stil sinds ' + duurTekst(Date.now() - new Date(r.stil_sinds).getTime()) : '';
      kopVak.appendChild(maak('div', '⚠ ' + uitleg + sinds, 'alarm kritiek'));
    }

    // Tegels
    tegelVak.innerHTML = '';
    const tegels = maak('div', null, 'tegels');
    const rest = Math.max(0, (r.garantie_uren || 800) - Number(r.draai_uren || 0));
    tegels.appendChild(tegel('Gedroogd', getal(r.draai_uren, 1), 'u', [rest > 0 ? 'goed' : 'matig', rest > 0 ? 'nog ' + getal(rest, 0) + ' u tot ' + r.garantie_uren + ' u' : 'garantiegrens bereikt']));
    tegels.appendChild(tegel('Uren aan', getal(r.aan_uren, 1), 'u', null));
    tegels.appendChild(tegel('Vermogen nu', r.toestand === 'OFFLINE' ? '–' : getal(r.watt), 'W', null));
    tegels.appendChild(tegel('Verbruik', getal(r.kwh, 1), 'kWh', null));
    tegelVak.appendChild(tegels);
    const balk = urenBalk(r.draai_uren, r.garantie_uren);
    balk.style.marginBottom = '20px';
    tegelVak.appendChild(balk);
    tegelVak.appendChild(maak('p',
      'Geplaatst op ' + (r.geplaatst_op ? dag(r.geplaatst_op) : '—') +
      (r.laatst_gezien ? ' · laatste bericht ' + sindsTekst(r.laatst_gezien) : ' · nog geen bericht ontvangen'), 'bijgewerkt'));
    return true;
  }

  async function laadBediening() {
    if (!beheer) return;
    bedVak.innerHTML = '';
    const kop = maak('div', null, 'kaart-kop');
    kop.appendChild(maak('h3', 'Bediening op afstand'));
    kop.appendChild(maak('span', r.stekker_aan === true ? 'Stekker staat AAN' : r.stekker_aan === false ? 'Stekker staat UIT' : 'Stekkerstand onbekend', 'adres'));
    bedVak.appendChild(kop);

    const rij = maak('div', null, 'onderhoud-acties');
    const aan = maak('button', 'Aanzetten', 'bevestig'); aan.type = 'button';
    const uit = maak('button', 'Uitzetten', 'licht'); uit.type = 'button';
    const melding = maak('p', '', 'bed-melding');
    rij.append(aan, uit);
    bedVak.append(rij, melding);
    if (r.is_test) bedVak.appendChild(maak('p', 'Testtoestel zonder echte stekker: een opdracht blijft op "wacht op stekker" staan.', 'voetnoot'));

    async function stuur(actie) {
      aan.disabled = uit.disabled = true;
      const { error } = await db.from('droger_commandos').insert({ droger_id: drogerId, actie });
      aan.disabled = uit.disabled = false;
      if (error) { melding.className = 'bed-melding fout'; melding.textContent = 'Mislukt: ' + error.message; return; }
      melding.className = 'bed-melding ok';
      melding.textContent = 'Opdracht "' + actie + '" verstuurd. De stekker voert hem uit bij het volgende bericht (± 1 minuut).';
      laadCommandos();
    }
    aan.addEventListener('click', () => stuur('aan'));
    uit.addEventListener('click', () => {
      // Eenvoudige bevestiging in de pagina (geen browser-popup)
      if (uit.dataset.zeker !== '1') { uit.dataset.zeker = '1'; uit.textContent = 'Zeker? Klik opnieuw'; setTimeout(() => { uit.dataset.zeker = ''; uit.textContent = 'Uitzetten'; }, 4000); return; }
      uit.dataset.zeker = ''; uit.textContent = 'Uitzetten';
      stuur('uit');
    });

    const logVak = maak('div', null, 'log');
    bedVak.appendChild(logVak);
    async function laadCommandos() {
      const { data } = await db.from('droger_commandos')
        .select('actie, status, aangemaakt_op, uitgevoerd_op, profielen(naam)')
        .eq('droger_id', drogerId).order('aangemaakt_op', { ascending: false }).limit(5);
      logVak.innerHTML = '';
      if (!data || data.length === 0) return;
      logVak.appendChild(maak('div', 'Laatste opdrachten', 'bed-label'));
      const ul = maak('ul');
      for (const c of data) {
        const li = maak('li');
        li.appendChild(maak('span', datum(c.aangemaakt_op), 'num'));
        li.appendChild(maak('strong', c.actie === 'aan' ? 'Aanzetten' : 'Uitzetten'));
        li.appendChild(maak('span', CMD_STATUS[c.status] || c.status, 'badge ' + (c.status === 'uitgevoerd' ? 'opgelost' : c.status === 'mislukt' ? 'open' : 'behandeling')));
        if (c.profielen?.naam) li.appendChild(maak('span', 'door ' + c.profielen.naam));
        ul.appendChild(li);
      }
      logVak.appendChild(ul);
    }
    await laadCommandos();
    opruimen.push(bus.on('droger-commando', laadCommandos));
  }

  async function laadGrafiek() {
    const sinds = new Date(Date.now() - 24 * 3600000).toISOString();
    const { data, error } = await db.from('droger_metingen')
      .select('gemeten_op, watt, toestand')
      .eq('droger_id', drogerId).gte('gemeten_op', sinds)
      .order('gemeten_op', { ascending: true }).limit(3000);
    if (error) { grafVak.innerHTML = ''; grafVak.appendChild(maak('div', 'Fout: ' + error.message, 'grafiek-leeg')); return; }
    vermogenGrafiek(grafVak, data || []);
  }

  async function laadOnderbrekingen() {
    ondKaart.innerHTML = '';
    const kop = maak('div', null, 'kaart-kop');
    kop.appendChild(maak('h3', 'Onderbrekingen'));
    ondKaart.appendChild(kop);
    if (!r.plaatsing_id) { ondKaart.appendChild(maak('p', 'Deze droger staat op geen werf.', 'leeg')); return; }
    const { data } = await db.from('droger_onderbrekingen')
      .select('begin_op, einde_op, oorzaak')
      .eq('plaatsing_id', r.plaatsing_id).order('begin_op', { ascending: false }).limit(50);
    const lijst = data || [];
    const totaalMs = lijst.reduce((n, o) => n + ((o.einde_op ? new Date(o.einde_op) : new Date()) - new Date(o.begin_op)), 0);
    kop.appendChild(maak('span', lijst.length + ' keer · samen ' + duurTekst(totaalMs), 'adres'));
    if (lijst.length === 0) { ondKaart.appendChild(maak('p', 'Geen onderbrekingen sinds de plaatsing.', 'leeg')); return; }

    const wrap = maak('div', null, 'tabel-wrap');
    const tabel = maak('table');
    const th = maak('tr');
    ['Begin', 'Einde', 'Duur', 'Oorzaak'].forEach(x => th.appendChild(maak('th', x)));
    tabel.appendChild(th);
    for (const o of lijst) {
      const tr = maak('tr', null, o.einde_op ? '' : 'open-rij');
      tr.appendChild(maak('td', datum(o.begin_op), 'num'));
      tr.appendChild(maak('td', o.einde_op ? datum(o.einde_op) : 'nog bezig', 'num'));
      tr.appendChild(maak('td', duurTekst((o.einde_op ? new Date(o.einde_op) : new Date()) - new Date(o.begin_op)), 'num'));
      tr.appendChild(maak('td', OORZAAK[o.oorzaak] || o.oorzaak));
      tabel.appendChild(tr);
    }
    wrap.appendChild(tabel);
    ondKaart.appendChild(wrap);
    ondKaart.appendChild(maak('p', 'Een onderbreking begint wanneer de droger stopt met drogen en eindigt wanneer hij terug droogt. Alleen ventilator (ontdooien, hygrostaat) telt ook als onderbreking van het drogen.', 'voetnoot'));
  }

  async function allesLaden() {
    if (!(await laadKop())) return;
    await Promise.all([laadOnderbrekingen(), laadGrafiek()]);
  }

  if (!(await laadKop())) { bedVak.remove(); grafKaart.remove(); ondKaart.remove(); return opruimen; }
  await laadBediening();
  await laadOnderbrekingen();
  requestAnimationFrame(() => laadGrafiek());

  // Realtime + elke minuut verversen (offline-detectie gebeurt op tijd)
  let timer = null;
  const ververs = (p) => {
    if (p && p.droger_id !== undefined && p.droger_id !== drogerId && p.plaatsing_id !== r?.plaatsing_id) return;
    clearTimeout(timer);
    timer = setTimeout(async () => { await allesLaden(); if (beheer) laadBedieningKop(); }, 600);
  };
  function laadBedieningKop() {
    const span = bedVak.querySelector('.kaart-kop .adres');
    if (span) span.textContent = r.stekker_aan === true ? 'Stekker staat AAN' : r.stekker_aan === false ? 'Stekker staat UIT' : 'Stekkerstand onbekend';
  }
  const klok = setInterval(() => ververs(), 60000);
  opruimen.push(bus.on('droger', ververs), () => clearTimeout(timer), () => clearInterval(klok));
  return opruimen;
}
