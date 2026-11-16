// =====================================================================
// ACCOUNT — gegevens en wachtwoord wijzigen
// =====================================================================
import { db, maak, sessie, bus, paginaKop } from '../lib.js';

export async function render(el) {
  el.appendChild(paginaKop('Account', 'Uw gegevens en wachtwoord.'));

  const kaart = maak('div', null, 'kaart');
  kaart.style.maxWidth = '520px';
  const info = maak('div', null, 'info-raster');
  for (const [label, waarde] of [['Naam', sessie.naam], ['E-mail', sessie.email], ['Rol', sessie.rol === 'beheerder' ? 'Beheerder (Vernast)' : 'Klant']]) {
    const d = maak('div');
    d.appendChild(maak('div', label, 'label'));
    d.appendChild(maak('div', waarde, 'waarde'));
    info.appendChild(d);
  }
  kaart.appendChild(info);

  kaart.appendChild(Object.assign(maak('h3', 'Wachtwoord wijzigen'), { style: 'margin-top:28px' }));
  const veld = (id, label, auto) => {
    const l = maak('label', label); l.htmlFor = id;
    const i = maak('input'); i.id = id; i.type = 'password'; i.autocomplete = auto;
    kaart.append(l, i);
    return i;
  };
  const huidig = veld('wwHuidig', 'Huidig wachtwoord', 'current-password');
  const nieuw = veld('wwNieuw', 'Nieuw wachtwoord (minstens 8 tekens)', 'new-password');
  const herhaal = veld('wwHerhaal', 'Herhaal nieuw wachtwoord', 'new-password');
  const knop = maak('button', 'Wachtwoord wijzigen');
  const st = maak('p');
  kaart.append(knop, st);
  el.appendChild(kaart);

  const fout = (t) => { st.textContent = t; st.className = 'fout'; };

  knop.addEventListener('click', async () => {
    if (!huidig.value) return fout('Vul uw huidige wachtwoord in.');
    if (nieuw.value.length < 8) return fout('Het nieuwe wachtwoord moet minstens 8 tekens hebben.');
    if (nieuw.value !== herhaal.value) return fout('De twee nieuwe wachtwoorden zijn niet gelijk.');
    if (nieuw.value === huidig.value) return fout('Het nieuwe wachtwoord moet verschillen van het huidige.');

    knop.disabled = true;
    st.textContent = 'Bezig...'; st.className = '';

    // Eerst controleren of het huidige wachtwoord klopt
    const { error: e1 } = await db.auth.signInWithPassword({ email: sessie.email, password: huidig.value });
    if (e1) { knop.disabled = false; return fout('Het huidige wachtwoord klopt niet.'); }

    const { error: e2 } = await db.auth.updateUser({ password: nieuw.value, data: { tijdelijk_wachtwoord: false } });
    knop.disabled = false;
    if (e2) return fout('Niet gelukt: ' + e2.message);

    st.textContent = 'Uw wachtwoord is gewijzigd ✓'; st.className = 'ok';
    huidig.value = ''; nieuw.value = ''; herhaal.value = '';
    bus.emit('wachtwoord-gewijzigd');
  });

  return [];
}
