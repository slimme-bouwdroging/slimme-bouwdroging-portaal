// =====================================================================
// BOUWDROGERS — overzicht
// Vernast: tabel met alle drogers op alle werven (#/bouwdrogers)
// Klant:   kaarten met de drogers op zijn eigen werven (#/droging)
// =====================================================================
import { db, maak, link, bus, sessie, getal, sindsTekst, dag, paginaKop } from '../lib.js';
import { TOESTAND, actieNodig, toestandBadge, duurTekst, urenBalk } from '../onderdelen/droger.js';

let zoekTekst = '';
let alleenProbleem = false;

export async function render(el) {
  const opruimen = [];
  const beheer = sessie.rol === 'beheerder';

  el.appendChild(beheer
    ? paginaKop('Bouwdrogers', 'Alle drogers op alle werven. Rood = actie nodig. Klik op een rij voor details.', 'Vernast-app')
    : paginaKop('Bouwdroging', 'Zo werken de bouwdrogers op uw werf.', 'Vernast-app'));

  const kpi = maak('div', null, 'kpi');
  const vak = maak('div');
  if (beheer) el.appendChild(kpi);
  el.appendChild(vak);

  let data = [];

  async function laad() {
    const { data: d, error } = await db.from('droger_overzicht').select('*');
    if (error) { vak.innerHTML = ''; vak.appendChild(maak('p', 'Fout: ' + error.message, 'fout')); return; }
    data = (d || []).filter(r => r.plaatsing_id)   // alleen drogers die op een werf staan
      .sort((a, b) => (actieNodig(b) - actieNodig(a)) || (a.werf || '').localeCompare(b.werf || '') || a.code.localeCompare(b.code));
    if (beheer) { tekenKpi(); tekenTabel(); } else tekenKaarten();
  }

  // ---------- Vernast: cijfers ----------
  function tekenKpi() {
    kpi.innerHTML = '';
    const drogen = data.filter(r => r.toestand === 'DRAAIT').length;
    const actie = data.filter(actieNodig).length;
    const werven = new Set(data.map(r => r.woning_id)).size;
    for (const [label, waarde, kleur] of [
      ['Drogers geplaatst', data.length, ''],
      ['Drogen nu', drogen, 'goed'],
      ['Actie nodig', actie, actie ? 'slecht' : 'goed'],
      ['Werven', werven, '']
    ]) {
      const d = maak('div');
      d.appendChild(maak('div', label, 'label'));
      d.appendChild(maak('div', String(waarde), 'waarde ' + kleur));
      kpi.appendChild(d);
    }
  }

  // ---------- Vernast: tabel ----------
  const kaart = maak('div', null, 'kaart');
  const balk = maak('div', null, 'vloot-balk');
  const zoek = maak('input'); zoek.type = 'search'; zoek.placeholder = 'Zoek op werf, klant of droger'; zoek.value = zoekTekst;
  const vinkLabel = maak('label', null, 'vinkje');
  const vink = maak('input'); vink.type = 'checkbox'; vink.checked = alleenProbleem;
  vinkLabel.append(vink, document.createTextNode(' Alleen actie nodig'));
  const teller = maak('span', '', 'adres');
  balk.append(zoek, vinkLabel, teller);
  const tabelVak = maak('div', null, 'tabel-wrap');
  kaart.append(balk, tabelVak);

  function tekenTabel() {
    if (!kaart.isConnected) { vak.innerHTML = ''; vak.appendChild(kaart); }
    const z = zoekTekst.trim().toLowerCase();
    const rijen = data.filter(r => {
      if (alleenProbleem && !actieNodig(r)) return false;
      if (!z) return true;
      return [r.werf, r.klant, r.code, r.model, r.adres].some(x => (x || '').toLowerCase().includes(z));
    });
    teller.textContent = rijen.length + ' van ' + data.length;
    tabelVak.innerHTML = '';
    if (rijen.length === 0) { tabelVak.appendChild(maak('p', data.length ? 'Geen drogers gevonden.' : 'Nog geen drogers geplaatst.', 'leeg')); return; }

    const tabel = maak('table', null, 'klik-tabel droger-tabel');
    const kop = maak('tr');
    ['Werf', 'Droger', 'Toestand', 'Uren drogen', 'Geplaatst'].forEach((x, i) => kop.appendChild(maak('th', x, i === 4 ? 'smal-weg' : '')));
    tabel.appendChild(kop);
    for (const r of rijen) {
      const rij = maak('tr', null, 'klikbaar' + (actieNodig(r) ? ' open-rij' : ''));
      const werf = maak('td', r.werf || '?');
      werf.appendChild(maak('div', 'Klant: ' + (r.klant || '—'), 'voetnoot'));
      rij.appendChild(werf);
      const droger = maak('td');
      droger.appendChild(maak('span', r.code, 'num'));
      droger.appendChild(maak('div', r.model + (r.is_test ? ' · testdata' : ''), 'voetnoot'));
      rij.appendChild(droger);
      const st = maak('td');
      st.appendChild(toestandBadge(r.toestand));
      st.appendChild(maak('div', toestandDetail(r), 'voetnoot'));
      rij.appendChild(st);
      const uren = maak('td');
      uren.appendChild(urenBalk(r.draai_uren, r.garantie_uren));
      rij.appendChild(uren);
      rij.appendChild(maak('td', r.geplaatst_op ? dag(r.geplaatst_op) : '—', 'num smal-weg'));
      rij.addEventListener('click', () => { location.hash = '#/bouwdroger/' + r.droger_id; });
      tabel.appendChild(rij);
    }
    tabelVak.appendChild(tabel);
  }

  // ---------- Klant: kaarten ----------
  function tekenKaarten() {
    vak.innerHTML = '';
    if (data.length === 0) {
      const k = maak('div', null, 'kaart');
      k.appendChild(maak('h3', 'Geen bouwdroger op uw werf'));
      k.appendChild(maak('p', 'Zodra Vernast een bouwdroger bij u plaatst, ziet u hier hoe hij werkt.', 'adres'));
      vak.appendChild(k);
      return;
    }
    const perWerf = {};
    for (const r of data) (perWerf[r.werf] = perWerf[r.werf] || []).push(r);
    for (const [werf, drogers] of Object.entries(perWerf)) {
      const kop = maak('div', null, 'woning-kop');
      kop.appendChild(maak('h2', werf));
      kop.appendChild(maak('span', drogers[0].adres || '', 'adres'));
      vak.appendChild(kop);
      const raster = maak('div', null, 'kaart-raster');
      for (const r of drogers) {
        const a = link('#/bouwdroger/' + r.droger_id, null, 'kamerkaart');
        const k = maak('div', null, 'kop');
        const titel = maak('div');
        titel.appendChild(maak('h3', 'Bouwdroger ' + r.code));
        titel.appendChild(maak('div', r.model, 'sub'));
        const chips = maak('div', null, 'chips');
        chips.appendChild(toestandBadge(r.toestand));
        k.append(titel, chips);
        a.appendChild(k);
        a.appendChild(maak('div', 'Gedroogd voor de garantie', 'sub'));
        a.appendChild(urenBalk(r.draai_uren, r.garantie_uren));
        const voet = maak('div', null, 'voet');
        voet.appendChild(maak('span', r.geplaatst_op ? 'Geplaatst ' + dag(r.geplaatst_op) : ''));
        voet.appendChild(maak('span', 'Details →'));
        a.appendChild(voet);
        raster.appendChild(a);
      }
      vak.appendChild(raster);
    }
  }

  zoek.addEventListener('input', () => { zoekTekst = zoek.value; tekenTabel(); });
  vink.addEventListener('change', () => { alleenProbleem = vink.checked; tekenTabel(); });

  await laad();

  // Realtime: toestand verandert -> opnieuw laden. Elke minuut ook (offline na 5 min).
  let timer = null;
  const ververs = () => { clearTimeout(timer); timer = setTimeout(laad, 800); };
  const klok = setInterval(laad, 60000);
  opruimen.push(bus.on('droger', ververs), () => clearTimeout(timer), () => clearInterval(klok));
  return opruimen;
}

function toestandDetail(r) {
  if (r.toestand === 'OFFLINE') return r.laatst_gezien ? 'laatst gezien ' + sindsTekst(r.laatst_gezien) : 'nog nooit gezien';
  const delen = [];
  if (r.watt !== null && r.watt !== undefined) delen.push(getal(r.watt) + ' W');
  if (r.stil_sinds && r.toestand !== 'DRAAIT') delen.push('stil sinds ' + duurTekst(Date.now() - new Date(r.stil_sinds).getTime()));
  return delen.join(' · ') || (TOESTAND[r.toestand]?.uitleg || '');
}
