// =====================================================================
// App: inloggen, menu, pagina's wisselen (router) en realtime
// =====================================================================
import { db, sessie, $, maak, bus, toast, CATEGORIE } from './lib.js';

import * as home from './paginas/home.js';
import * as kamer from './paginas/kamer.js';
import * as meldingen from './paginas/meldingen.js';
import * as account from './paginas/account.js';
import * as dashboard from './paginas/dashboard.js';
import * as toestellen from './paginas/toestellen.js';
import * as klanten from './paginas/klanten.js';
import * as klant from './paginas/klant.js';
import * as onderhoud from './paginas/onderhoud.js';
import * as bouwdrogers from './paginas/bouwdrogers.js';
import * as bouwdroger from './paginas/bouwdroger.js';

// ---------- Iconen (eenvoudige lijntekeningen) ----------
const ICOON = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  toestellen: '<rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="12" cy="12" r="4"/><path d="M12 8v1M12 15v1"/>',
  meldingen: '<path d="M4 5h16v11H8l-4 4z"/>',
  klanten: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.7 2.6 2.4 3 5.2"/>',
  onderhoud: '<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L3 18l3 3 6.2-6.2a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  droger: '<rect x="5" y="3" width="14" height="16" rx="2.5"/><path d="M8 7h8M8 10h8"/><path d="M12 13.5c-1.3 1.6-2 2.6-2 3.4a2 2 0 0 0 4 0c0-.8-.7-1.8-2-3.4z"/><path d="M7 19v2M17 19v2"/>',
  account: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>'
};
const svg = (naam) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICOON[naam]}</svg>`;

// ---------- Menu en routes per rol ----------
const MENU = {
  klant: [
    { pad: 'home', tekst: 'Home', icoon: 'home', ook: ['kamer'] },
    { pad: 'droging', tekst: 'Bouwdroging', icoon: 'droger', ook: ['bouwdroger'] },
    { pad: 'meldingen', tekst: 'Meldingen', icoon: 'meldingen' },
    { pad: 'account', tekst: 'Account', icoon: 'account' }
  ],
  beheerder: [
    { pad: 'dashboard', tekst: 'Dashboard', icoon: 'dashboard' },
    { pad: 'toestellen', tekst: 'Toestellen', icoon: 'toestellen', ook: ['toestel'] },
    { pad: 'bouwdrogers', tekst: 'Bouwdrogers', icoon: 'droger', ook: ['bouwdroger'] },
    { pad: 'meldingen', tekst: 'Meldingen', icoon: 'meldingen', teller: true },
    { pad: 'klanten', tekst: 'Klanten', icoon: 'klanten', ook: ['klant'] },
    { pad: 'onderhoud', tekst: 'Onderhoud', icoon: 'onderhoud', gsm: false },
    { pad: 'account', tekst: 'Account', icoon: 'account' }
  ]
};

const ROUTES = {
  klant: { home, kamer, droging: bouwdrogers, bouwdroger, meldingen, account },
  beheerder: { dashboard, toestellen, toestel: kamer, meldingen, klanten, klant, onderhoud, bouwdrogers, bouwdroger, account }
};

let opruimen = [];
let routeTeller = 0;
let kanaal = null;
let boostTimer = null;

// ---------- Inloggen / uitloggen ----------
async function inloggen() {
  $('loginFout').textContent = '';
  $('loginKnop').disabled = true;
  const { error } = await db.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('wachtwoord').value
  });
  $('loginKnop').disabled = false;
  if (error) { $('loginFout').textContent = 'Inloggen mislukt: ' + error.message; return; }
  $('wachtwoord').value = '';
  await startApp();
}

async function uitloggen() {
  ruimOp();
  bus.leeg();
  if (kanaal) { await db.removeChannel(kanaal); kanaal = null; }
  if (boostTimer) { clearInterval(boostTimer); boostTimer = null; }
  await db.auth.signOut();
  Object.assign(sessie, { id: null, email: '', naam: '', rol: null });
  $('shell').classList.add('verborgen');
  $('loginBlok').classList.remove('verborgen');
  history.replaceState(null, '', location.pathname);
}

// ---------- Opstarten na inloggen ----------
async function startApp() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) { $('loginBlok').classList.remove('verborgen'); return; }

  const { data: profiel } = await db.from('profielen').select('naam, rol').eq('id', user.id).single();
  Object.assign(sessie, {
    id: user.id,
    email: user.email || '',
    naam: profiel?.naam || user.email,
    rol: profiel?.rol === 'beheerder' ? 'beheerder' : 'klant'
  });

  $('wieNaam').textContent = sessie.naam;
  $('wieRol').textContent = sessie.rol;
  $('tijdelijkBanner').classList.toggle('verborgen', !(user.user_metadata && user.user_metadata.tijdelijk_wachtwoord === true));
  bus.on('wachtwoord-gewijzigd', () => $('tijdelijkBanner').classList.add('verborgen'));

  bouwMenu();
  startRealtime();

  // Verlopen boosts afronden (een echt toestel doet dit zelf; nu de simulator)
  db.rpc('boost_afronden');
  if (!boostTimer) boostTimer = setInterval(() => db.rpc('boost_afronden'), 60000);

  $('loginBlok').classList.add('verborgen');
  $('shell').classList.remove('verborgen');

  const start = sessie.rol === 'beheerder' ? '#/dashboard' : '#/home';
  if (!location.hash || location.hash === '#/' ) location.hash = start;
  else toonRoute();
  verversTeller();
}

// ---------- Menu ----------
function bouwMenu() {
  const items = MENU[sessie.rol];
  for (const houder of [$('nav'), $('tabbalk')]) {
    houder.innerHTML = '';
    for (const it of items) {
      if (houder.id === 'tabbalk' && it.gsm === false) continue;   // te weinig plaats op gsm
      const a = maak('a');
      a.href = '#/' + it.pad;
      a.dataset.pad = it.pad;
      a.dataset.ook = (it.ook || []).join(',');
      a.innerHTML = `<span class="ico">${svg(it.icoon)}</span>`;
      a.appendChild(maak('span', it.tekst));
      if (it.teller) { const t = maak('span', '', 'teller verborgen'); t.dataset.teller = '1'; a.appendChild(t); }
      houder.appendChild(a);
    }
  }
}

function markeerMenu(hoofd) {
  for (const a of document.querySelectorAll('#nav a, #tabbalk a')) {
    const ook = a.dataset.ook ? a.dataset.ook.split(',') : [];
    a.classList.toggle('actief', a.dataset.pad === hoofd || ook.includes(hoofd));
  }
}

async function verversTeller() {
  if (sessie.rol !== 'beheerder') return;
  const { count } = await db.from('meldingen').select('id', { count: 'exact', head: true }).eq('status', 'open');
  for (const t of document.querySelectorAll('[data-teller]')) {
    t.textContent = count || '';
    t.classList.toggle('verborgen', !count);
  }
}

// ---------- Router ----------
function ruimOp() {
  for (const fn of opruimen) { try { fn(); } catch (e) { /* negeren */ } }
  opruimen = [];
}

async function toonRoute() {
  if (!sessie.rol) return;
  const delen = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  let hoofd = delen[0];
  const param = delen[1] ? decodeURIComponent(delen[1]) : null;

  const routes = ROUTES[sessie.rol];
  if (!routes[hoofd]) {
    location.hash = sessie.rol === 'beheerder' ? '#/dashboard' : '#/home';
    return;
  }

  ruimOp();
  const mijnRoute = ++routeTeller;
  markeerMenu(hoofd);

  const el = $('pagina');
  el.innerHTML = '';
  el.appendChild(maak('div', 'Laden...', 'laden'));
  window.scrollTo(0, 0);

  const houder = maak('div');
  try {
    const terug = await routes[hoofd].render(houder, param);
    if (mijnRoute !== routeTeller) { if (Array.isArray(terug)) terug.forEach(f => f()); return; }
    if (Array.isArray(terug)) opruimen.push(...terug);
    el.innerHTML = '';
    el.appendChild(houder);
  } catch (e) {
    console.error(e);
    if (mijnRoute !== routeTeller) return;
    el.innerHTML = '';
    el.appendChild(maak('p', 'Er ging iets mis bij het laden van deze pagina: ' + e.message, 'fout'));
  }
}

// ---------- Realtime: alles via de bus doorgeven ----------
function startRealtime() {
  if (kanaal) return;
  kanaal = db.channel('app')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'toestel_status' }, (p) => bus.emit('status', p.new))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meldingen' }, (p) => bus.emit('melding', p))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'melding_berichten' }, (p) => bus.emit('bericht', p.new))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'alarmen' }, (p) => bus.emit('alarm', p))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'droger_status' }, (p) => bus.emit('droger', p.new))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'droger_onderbrekingen' }, (p) => { bus.emit('droger', p.new); if (p.eventType === 'INSERT') bus.emit('droger-stil', p.new); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'droger_commandos' }, (p) => bus.emit('droger-commando', p.new))
    .subscribe();

  // Meldingen rechtsonder, op elke pagina
  bus.on('melding', (p) => {
    verversTeller();
    if (sessie.rol === 'beheerder' && p.eventType === 'INSERT') {
      toast('🔔 Nieuwe melding: ' + (CATEGORIE[p.new.categorie] || 'hulpvraag'), 'slecht', '#/meldingen/' + p.new.id);
    }
  });
  // Bouwdroger valt stil -> melding voor Vernast
  bus.on('droger-stil', async (o) => {
    if (sessie.rol !== 'beheerder') return;
    const { data } = await db.from('droger_plaatsingen').select('droger_id, bouwdrogers(code), woningen(naam)').eq('id', o.plaatsing_id).maybeSingle();
    const naam = data ? (data.bouwdrogers?.code || 'Bouwdroger') + ' op ' + (data.woningen?.naam || 'werf') : 'Een bouwdroger';
    toast('⚠ ' + naam + ' droogt niet meer', 'slecht', data ? '#/bouwdroger/' + data.droger_id : '#/bouwdrogers');
  });
  bus.on('bericht', (b) => {
    if (b.afzender === sessie.id || b.soort !== 'bericht') return;
    if (location.hash === '#/meldingen/' + b.melding_id) return;
    toast(sessie.rol === 'beheerder' ? '💬 Nieuw bericht van een klant' : '💬 Nieuw antwoord van Vernast', null, '#/meldingen/' + b.melding_id);
  });
}

// ---------- Knoppen ----------
$('loginKnop').addEventListener('click', inloggen);
$('wachtwoord').addEventListener('keydown', (e) => { if (e.key === 'Enter') inloggen(); });
$('uitlogKnop').addEventListener('click', uitloggen);
$('uitlogKnopMobiel').addEventListener('click', uitloggen);
window.addEventListener('hashchange', toonRoute);

// Al ingelogd? Dan meteen de app tonen.
db.auth.getSession().then(({ data }) => {
  if (data.session) startApp();
  else $('loginBlok').classList.remove('verborgen');
});
