// =====================================================================
// Bediening van één toestel: aan/uit, modus, stand, boost
// Toont altijd wat het toestel BEVESTIGT, niet wat gevraagd werd.
// =====================================================================
import { db, maak, bus, datum, ACTIE_TEKST } from '../lib.js';

export function bedieningBlok(t, st, opruimen, bijStatus) {
  const blok = maak('div', null, 'bediening');
  const inhoud = maak('div');
  const melding = maak('p', null, 'bed-melding');
  const log = maak('details', null, 'log');
  const logLijst = maak('div');
  log.appendChild(maak('summary', 'Laatste acties'));
  log.appendChild(logLijst);
  log.addEventListener('toggle', () => { if (log.open) laadLog(); });
  blok.append(inhoud, melding, log);

  let huidig = st;
  let bezig = false;

  async function stuur(actie, waarde) {
    if (bezig) return;
    bezig = true; teken(huidig);
    melding.textContent = 'Bezig met versturen...'; melding.className = 'bed-melding';

    const { data, error } = await db.from('commandos')
      .insert({ toestel_id: t.id, actie, waarde: waarde ?? null })
      .select('status, foutmelding')
      .single();

    if (error) {
      melding.textContent = 'Niet gelukt: ' + error.message; melding.className = 'bed-melding fout';
    } else if (data.status === 'mislukt') {
      melding.textContent = 'Niet uitgevoerd: ' + (data.foutmelding || 'onbekende fout'); melding.className = 'bed-melding fout';
    } else if (data.status === 'wachtend') {
      melding.textContent = 'Verstuurd — wacht op bevestiging van het toestel...'; melding.className = 'bed-melding';
    } else {
      melding.textContent = 'Uitgevoerd ✓ (' + ACTIE_TEKST[actie](waarde) + ')'; melding.className = 'bed-melding ok';
    }

    const { data: nieuw } = await db.from('toestel_status').select('*').eq('toestel_id', t.id).single();
    bezig = false;
    teken(nieuw || huidig);
    if (nieuw && bijStatus) bijStatus(nieuw);
    if (log.open) laadLog();
  }

  function segment(opties, actief, bijKlik, extraKlasse) {
    const seg = maak('div', null, 'seg' + (extraKlasse ? ' ' + extraKlasse : ''));
    for (const [waarde, tekst] of opties) {
      const b = maak('button', tekst, waarde === actief ? 'actief' : '');
      b.type = 'button';
      b.disabled = bezig || !huidig.online;
      b.addEventListener('click', () => { if (waarde !== actief) bijKlik(waarde); });
      seg.appendChild(b);
    }
    return seg;
  }

  function rij(label, ...delen) {
    const r = maak('div', null, 'bed-rij');
    r.appendChild(maak('span', label, 'bed-label'));
    for (const d of delen) r.appendChild(d);
    return r;
  }

  function teken(s) {
    huidig = s;
    inhoud.innerHTML = '';
    if (!s.online) inhoud.appendChild(maak('p', 'Toestel is offline — bediening niet mogelijk tot het weer verbinding heeft.', 'bed-offline'));

    inhoud.appendChild(rij('Toestel', segment([['aan', 'Aan'], ['uit', 'Uit']], s.aan ? 'aan' : 'uit', (w) => stuur(w))));

    if (s.aan) {
      inhoud.appendChild(rij('Modus', segment(
        [['automatisch', 'Automatisch'], ['handmatig', 'Handmatig'], ['sleep', 'Sleep Air'], ['afwezig', 'Afwezig']],
        s.modus, (w) => stuur('modus', w))));

      const standRij = rij('Stand', segment([1, 2, 3, 4, 5].map(n => [n, String(n)]), s.stand, (n) => stuur('stand', String(n)), 'stand'));
      if (s.modus === 'automatisch') standRij.appendChild(maak('span', 'Automatisch geregeld — kies een stand om over te nemen', 'adres'));
      inhoud.appendChild(standRij);

      if (s.modus === 'boost' && s.boost_tot) {
        const tot = new Date(s.boost_tot).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
        const stop = maak('button', 'Boost stoppen', 'licht');
        stop.disabled = bezig || !s.online;
        stop.addEventListener('click', () => stuur('modus', s.voor_boost_modus && s.voor_boost_modus !== 'boost' ? s.voor_boost_modus : 'automatisch'));
        inhoud.appendChild(rij('Boost', maak('span', 'Actief op maximum tot ' + tot, 'bed-info'), stop));
      } else {
        const duur = maak('select');
        for (const m of [15, 30, 60]) { const o = maak('option', m + ' min'); o.value = m; duur.appendChild(o); }
        duur.value = '30';
        duur.disabled = bezig || !s.online;
        const start = maak('button', 'Boost starten', 'licht');
        start.disabled = bezig || !s.online;
        start.addEventListener('click', () => stuur('boost', duur.value));
        inhoud.appendChild(rij('Boost', duur, start));
      }
    }
  }

  async function laadLog() {
    const { data } = await db.from('commandos')
      .select('actie, waarde, status, foutmelding, aangemaakt_op, profielen(naam)')
      .eq('toestel_id', t.id)
      .order('aangemaakt_op', { ascending: false })
      .limit(8);
    logLijst.innerHTML = '';
    if (!data || data.length === 0) { logLijst.appendChild(maak('p', 'Nog geen acties.', 'adres')); return; }
    const ul = maak('ul');
    for (const c of data) {
      const li = maak('li');
      li.appendChild(maak('span', c.status === 'uitgevoerd' ? 'OK' : c.status, 'badge ' + (c.status === 'uitgevoerd' ? 'opgelost' : c.status === 'mislukt' ? 'open' : 'behandeling')));
      li.appendChild(maak('span', datum(c.aangemaakt_op)));
      li.appendChild(maak('strong', (ACTIE_TEKST[c.actie] || (() => c.actie))(c.waarde)));
      li.appendChild(maak('span', 'door ' + (c.profielen?.naam || 'Vernast')));
      if (c.foutmelding) li.appendChild(maak('span', c.foutmelding, 'fout'));
      ul.appendChild(li);
    }
    logLijst.appendChild(ul);
  }

  // Realtime: als het toestel (of Vernast in een ander venster) iets wijzigt
  opruimen.push(bus.on('status', (nieuw) => {
    if (nieuw.toestel_id !== t.id || bezig) return;
    teken({ ...huidig, ...nieuw });
  }));

  teken(st);
  return blok;
}
