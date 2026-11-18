# Fresh Air One – klantenportaal (Vernast-app)

Webapp in HTML/CSS/JavaScript met Supabase als backend. Draait op GitHub Pages.

## Mappen

```
app/
├── index.html              ← het "omhulsel": inlogscherm, menu, plek voor de pagina
├── css/app.css             ← alle opmaak (kleuren bovenaan in :root)
└── js/
    ├── config.js           ← INSTELLINGEN: Supabase-adres, publieke sleutel, naam Edge Function
    ├── lib.js              ← gedeelde hulpjes (databank, teksten, kleurgrenzen, toast, ...)
    ├── app.js              ← inloggen, menu, pagina's wisselen, realtime
    ├── onderdelen/         ← bouwstenen die op meerdere pagina's terugkomen
    │   ├── bediening.js    ← aan/uit, modus, stand, boost
    │   ├── grafiek.js      ← grafiek per meetwaarde (24 u / 7 d / 30 d)
    │   ├── onderhoud.js    ← filter + onderhoudshistoriek
    │   ├── gesprek.js      ← gesprek bij een melding
    │   ├── kamerkaart.js   ← compacte kaart per kamer
    │   └── droger.js       ← bouwdrogers: toestanden, urenbalk, vermogensgrafiek
    └── paginas/            ← één bestand per pagina
        ├── home.js         ← klant: overzicht kamers
        ├── kamer.js        ← klant + Vernast: detail van één kamer/toestel
        ├── meldingen.js    ← klant + Vernast: postvak met gesprekken
        ├── account.js      ← wachtwoord wijzigen
        ├── dashboard.js    ← Vernast: cijfers + "Actie nodig"
        ├── toestellen.js   ← Vernast: vlootoverzicht
        ├── klanten.js      ← Vernast: klanten + woningen toevoegen
        ├── klant.js        ← Vernast: detail van één klant (+ toestel registreren)
        ├── onderhoud.js    ← Vernast: filters en planning
        ├── bouwdrogers.js  ← bouwdrogers: Vernast tabel (#/bouwdrogers), klant kaarten (#/droging)
        └── bouwdroger.js   ← bouwdroger detail: uren, grafiek, onderbrekingen, aan/uit (Vernast)
```

## Pagina's (adres na `#`)

| Klant | Vernast |
|---|---|
| `#/home` | `#/dashboard` |
| `#/kamer/<id>` | `#/toestellen`, `#/toestel/<id>` |
| `#/meldingen`, `#/meldingen/<id>`, `#/meldingen/nieuw` | `#/meldingen`, `#/meldingen/<id>` |
| `#/account` | `#/klanten`, `#/klant/<id>`, `#/onderhoud`, `#/account` |
| `#/droging`, `#/bouwdroger/<id>` | `#/bouwdrogers`, `#/bouwdroger/<id>` |

## Samenwerken

- Werk elk aan **je eigen bestand** (bv. één persoon `paginas/dashboard.js`, een ander `onderdelen/grafiek.js`). Zo overschrijven jullie elkaars werk niet.
- Een nieuwe pagina toevoegen: maak `js/paginas/naam.js` met een functie `export async function render(el, param)`, en voeg ze toe in `MENU` en `ROUTES` bovenaan `js/app.js`.
- **Nooit** de secret/service_role-sleutel van Supabase in deze bestanden zetten. Alleen de publieke sleutel in `config.js`.
- Beveiliging zit in de databank (Row Level Security), niet in deze code.
