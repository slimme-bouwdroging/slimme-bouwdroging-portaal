// =====================================================================
// VERNAST — Klanten: lijst, klant toevoegen, woning toevoegen/koppelen
// =====================================================================
import { db, maak, sessie, paginaKop, dag } from '../lib.js';
import { FUNCTIE_KLANT_AANMAKEN } from '../config.js';

export async function render(el) {
  el.appendChild(paginaKop('Klanten', 'Klik op een klant voor woningen, toestellen en meldingen.'));

  const kolommen = maak('div', null, 'twee-kolommen');
  const lijstKaart = maak('div', null, 'kaart');
  const lijstKop = maak('div', null, 'kaart-kop');
  lijstKop.appendChild(maak('h2', 'Alle klanten'));
  const zoek = maak('input'); zoek.type = 'search'; zoek.placeholder = 'Zoek op naam of e-mail';
  zoek.style.maxWidth = '260px'; zoek.style.margin = '0';
  lijstKop.appendChild(zoek);
  const lijst = maak('div', null, 'tabel-wrap');
  lijstKaart.append(lijstKop, lijst);

  const rechts = maak('div');
  kolommen.append(lijstKaart, rechts);
  el.appendChild(kolommen);

  let klanten = [];

  async function laad() {
    const { data, error } = await db.from('profielen')
      .select('id, naam, email, aangemaakt_op, woningen(id, toestellen(count))')
      .eq('rol', 'klant').order('naam');
    if (error) { lijst.innerHTML = ''; lijst.appendChild(maak('p', 'Fout: ' + error.message, 'fout')); return; }
    klanten = data || [];
    teken();
    vulKeuze();
  }

  function teken() {
    const z = zoek.value.trim().toLowerCase();
    const rijen = klanten.filter(k => !z || (k.naam || '').toLowerCase().includes(z) || (k.email || '').toLowerCase().includes(z));
    lijst.innerHTML = '';
    if (rijen.length === 0) { lijst.appendChild(maak('p', 'Geen klanten gevonden.', 'leeg')); return; }
    const tabel = maak('table');
    tabel.className = 'klik-tabel';
    const kop = maak('tr');
    ['Naam', 'E-mail', 'Woningen', 'Toestellen', 'Klant sinds'].forEach(x => kop.appendChild(maak('th', x)));
    tabel.appendChild(kop);
    for (const k of rijen) {
      const rij = maak('tr', null, 'klikbaar');
      const woningen = k.woningen || [];
      const toestellen = woningen.reduce((n, w) => n + (Array.isArray(w.toestellen) ? (w.toestellen[0]?.count || 0) : (w.toestellen?.count || 0)), 0);
      rij.appendChild(maak('td', k.naam || '(geen naam)'));
      rij.appendChild(maak('td', k.email || ''));
      rij.appendChild(maak('td', String(woningen.length), 'num'));
      rij.appendChild(maak('td', String(toestellen), 'num'));
      rij.appendChild(maak('td', k.aangemaakt_op ? dag(k.aangemaakt_op) : ''));
      rij.addEventListener('click', () => { location.hash = '#/klant/' + k.id; });
      tabel.appendChild(rij);
    }
    lijst.appendChild(tabel);
  }
  zoek.addEventListener('input', teken);

  // ---------- Klant toevoegen ----------
  const nk = maak('div', null, 'kaart');
  nk.appendChild(maak('h3', 'Klant toevoegen'));
  const nkNaam = invoer(nk, 'Naam', 'text');
  const nkEmail = invoer(nk, 'E-mail', 'email');
  nk.appendChild(maak('label', 'Tijdelijk wachtwoord (min. 8 tekens)'));
  const rijWw = maak('div', null, 'rij');
  const nkWw = maak('input'); nkWw.type = 'text'; nkWw.autocomplete = 'off';
  const gen = maak('button', 'Genereer', 'licht'); gen.type = 'button';
  rijWw.append(nkWw, gen);
  const nkKnop = maak('button', 'Klant aanmaken'); nkKnop.style.marginTop = '14px';
  const nkSt = maak('p');
  nk.append(rijWw, nkKnop, nkSt);

  gen.addEventListener('click', () => {
    const tekens = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const r = new Uint32Array(12); crypto.getRandomValues(r);
    nkWw.value = Array.from(r, n => tekens[n % tekens.length]).join('');
  });

  nkKnop.addEventListener('click', async () => {
    const naam = nkNaam.value.trim(), email = nkEmail.value.trim(), ww = nkWw.value;
    if (!naam || !email || ww.length < 8) { nkSt.textContent = 'Vul naam, e-mail en een wachtwoord van minstens 8 tekens in.'; nkSt.className = 'fout'; return; }
    nkKnop.disabled = true; nkSt.textContent = 'Bezig...'; nkSt.className = '';
    const { error } = await db.functions.invoke(FUNCTIE_KLANT_AANMAKEN, { body: { naam, email, wachtwoord: ww } });
    if (error) {
      let melding = error.message;
      try { const b = await error.context.json(); if (b && b.fout) melding = b.fout; } catch (e) { /* geen details */ }
      nkSt.textContent = 'Mislukt: ' + melding; nkSt.className = 'fout';
    } else {
      nkSt.textContent = 'Klant aangemaakt: ' + email + '. Geef de klant het tijdelijke wachtwoord door.'; nkSt.className = 'ok';
      nkNaam.value = ''; nkEmail.value = '';
      await laad();
    }
    nkKnop.disabled = false;
  });

  // ---------- Woning toevoegen ----------
  const nw = maak('div', null, 'kaart');
  nw.appendChild(maak('h3', 'Woning toevoegen'));
  const nwNaam = invoer(nw, 'Naam', 'text', 'Woning 004');
  const nwAdres = invoer(nw, 'Adres', 'text');
  nw.appendChild(maak('label', 'Klant'));
  const nwKlant = maak('select');
  nw.appendChild(nwKlant);
  const nwKnop = maak('button', 'Woning aanmaken');
  const nwSt = maak('p');
  nw.append(nwKnop, nwSt);

  function vulKeuze() {
    const huidig = nwKlant.value;
    nwKlant.innerHTML = '';
    const leeg = maak('option', '— geen klant —'); leeg.value = ''; nwKlant.appendChild(leeg);
    for (const k of klanten) { const o = maak('option', (k.naam || '?') + ' (' + (k.email || '') + ')'); o.value = k.id; nwKlant.appendChild(o); }
    nwKlant.value = huidig;
  }

  nwKnop.addEventListener('click', async () => {
    const naam = nwNaam.value.trim();
    if (!naam) { nwSt.textContent = 'Vul een naam in.'; nwSt.className = 'fout'; return; }
    nwKnop.disabled = true;
    const { error } = await db.from('woningen').insert({ naam, adres: nwAdres.value.trim() || null, klant_id: nwKlant.value || null });
    if (error) { nwSt.textContent = 'Mislukt: ' + error.message; nwSt.className = 'fout'; }
    else { nwSt.textContent = 'Woning aangemaakt: ' + naam; nwSt.className = 'ok'; nwNaam.value = ''; nwAdres.value = ''; await laad(); await laadLos(); }
    nwKnop.disabled = false;
  });

  // ---------- Woningen zonder klant ----------
  const los = maak('div', null, 'kaart');
  los.appendChild(maak('h3', 'Woningen zonder klant'));
  const losLijst = maak('div');
  los.appendChild(losLijst);

  async function laadLos() {
    const { data } = await db.from('woningen').select('id, naam, adres').is('klant_id', null).order('naam');
    losLijst.innerHTML = '';
    if (!data || data.length === 0) { losLijst.appendChild(maak('p', 'Alle woningen zijn aan een klant gekoppeld.', 'adres')); return; }
    for (const w of data) {
      const r = maak('div', null, 'klantkeuze');
      r.style.padding = '10px 0'; r.style.borderBottom = '1px solid var(--lijn-zacht)';
      r.appendChild(maak('strong', w.naam));
      if (w.adres) r.appendChild(maak('span', w.adres, 'adres'));
      const s = maak('select');
      const leeg = maak('option', 'Koppelen aan…'); leeg.value = ''; s.appendChild(leeg);
      for (const k of klanten) { const o = maak('option', k.naam || k.email); o.value = k.id; s.appendChild(o); }
      const st = maak('span');
      s.addEventListener('change', async () => {
        if (!s.value) return;
        const { error } = await db.from('woningen').update({ klant_id: s.value }).eq('id', w.id);
        if (error) { st.textContent = 'Mislukt: ' + error.message; st.className = 'fout'; return; }
        await laad(); await laadLos();
      });
      r.append(s, st);
      losLijst.appendChild(r);
    }
  }

  rechts.append(nk, nw, los);
  await laad();
  await laadLos();
  return [];
}

function invoer(houder, label, type, placeholder) {
  houder.appendChild(maak('label', label));
  const i = maak('input'); i.type = type;
  if (placeholder) i.placeholder = placeholder;
  houder.appendChild(i);
  return i;
}
