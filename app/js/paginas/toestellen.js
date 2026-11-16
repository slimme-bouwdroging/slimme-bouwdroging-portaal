// =====================================================================
// VERNAST — Toestellen (vlootoverzicht)
// =====================================================================
import { db, maak, bus, getal, sindsTekst, beoordeel, filterOordeel, paginaKop, MODUS_TEKST } from '../lib.js';

let zoekTekst = '';
let alleenProbleem = false;

export async function render(el) {
  const opruimen = [];
  el.appendChild(paginaKop('Toestellen', 'Alle toestellen bij alle klanten. Klik op een rij voor details en bediening.'));

  const kaart = maak('div', null, 'kaart');
  const balk = maak('div', null, 'vloot-balk');
  const zoek = maak('input'); zoek.type = 'search'; zoek.placeholder = 'Zoek op klant, woning, kamer of serienummer'; zoek.value = zoekTekst;
  const vinkLabel = maak('label', null, 'vinkje');
  const vink = maak('input'); vink.type = 'checkbox'; vink.checked = alleenProbleem;
  vinkLabel.append(vink, document.createTextNode(' Alleen problemen'));
  const teller = maak('span', '', 'adres');
  balk.append(zoek, vinkLabel, teller);
  const tabelVak = maak('div', null, 'tabel-wrap');
  kaart.append(balk, tabelVak);
  el.appendChild(kaart);

  let data = [];
  const probleem = (r) => r.online === false || r.open_alarmen > 0 || (r.filter_procent !== null && r.filter_procent <= 35);

  function teken() {
    const z = zoekTekst.trim().toLowerCase();
    const rijen = data.filter(r => {
      if (alleenProbleem && !probleem(r)) return false;
      if (!z) return true;
      return [r.klant, r.woning, r.kamer, r.serienummer].some(x => (x || '').toLowerCase().includes(z));
    });
    teller.textContent = rijen.length + ' van ' + data.length;
    tabelVak.innerHTML = '';
    if (rijen.length === 0) { tabelVak.appendChild(maak('p', 'Geen toestellen gevonden.', 'leeg')); return; }

    const tabel = maak('table');
    tabel.className = 'klik-tabel';
    const kop = maak('tr');
    ['Status', 'Klant', 'Woning', 'Kamer', 'Toestand', 'CO₂', 'Vocht', 'Filter', 'Alarmen'].forEach(x => kop.appendChild(maak('th', x)));
    tabel.appendChild(kop);
    for (const r of rijen) {
      const rij = maak('tr', null, 'klikbaar');
      const st = maak('td');
      st.appendChild(maak('span', r.online ? 'Online' : 'Offline', 'badge ' + (r.online ? 'opgelost' : 'open')));
      if (!r.online && r.laatst_gezien) st.appendChild(maak('div', sindsTekst(r.laatst_gezien), 'voetnoot'));
      rij.appendChild(st);
      rij.appendChild(maak('td', r.klant || '—'));
      rij.appendChild(maak('td', r.woning || '?'));
      const kamer = maak('td', r.kamer || '?');
      if (r.serienummer) kamer.appendChild(maak('div', r.serienummer, 'voetnoot'));
      rij.appendChild(kamer);
      rij.appendChild(maak('td', r.aan === false ? 'Uit' : (MODUS_TEKST[r.modus] || r.modus || '?') + ' · ' + r.stand));
      const co2 = beoordeel('co2', r.co2);
      rij.appendChild(maak('td', r.co2 != null ? getal(r.co2) + ' ppm' : '–', 'num status ' + (co2 ? co2[0] : '')));
      const v = beoordeel('vochtigheid', r.vochtigheid);
      rij.appendChild(maak('td', r.vochtigheid != null ? getal(r.vochtigheid) + ' %' : '–', 'num status ' + (v ? v[0] : '')));
      const f = r.filter_procent != null ? filterOordeel(r.filter_procent) : null;
      rij.appendChild(maak('td', r.filter_procent != null ? r.filter_procent + ' %' : '–', 'num status ' + (f ? f[0] : '')));
      const al = maak('td');
      al.appendChild(Number(r.open_alarmen) > 0 ? maak('span', r.open_alarmen + ' open', 'badge behandeling') : maak('span', '—', 'adres'));
      rij.appendChild(al);
      rij.addEventListener('click', () => { location.hash = '#/toestel/' + r.toestel_id; });
      tabel.appendChild(rij);
    }
    tabelVak.appendChild(tabel);
  }

  async function laad() {
    const { data: d, error } = await db.rpc('vloot_overzicht');
    if (error) { tabelVak.innerHTML = ''; tabelVak.appendChild(maak('p', 'Fout: ' + error.message, 'fout')); return; }
    data = d || [];
    teken();
  }

  zoek.addEventListener('input', () => { zoekTekst = zoek.value; teken(); });
  vink.addEventListener('change', () => { alleenProbleem = vink.checked; teken(); });

  await laad();
  let timer = null;
  const ververs = () => { clearTimeout(timer); timer = setTimeout(laad, 800); };
  opruimen.push(bus.on('status', ververs), bus.on('alarm', ververs), () => clearTimeout(timer));
  return opruimen;
}
