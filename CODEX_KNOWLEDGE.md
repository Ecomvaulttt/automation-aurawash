# Codex Knowledge - AuraWash Administratie

Dit bestand is bedoeld als directe context voor elke nieuwe Codex-agent die aan deze repo werkt.

## Wie Ramzi is

- Ramzi runt EcomVault en werkt aan AuraWash/B&T processen.
- Hij wil snelle, directe uitvoering. Geen lange uitleg als iets gewoon gefixt moet worden.
- Taal: Nederlands als Ramzi Nederlands schrijft.
- Stijl: lean, scherp, praktisch. Geen fluff.
- Als Ramzi zegt `go`, `doe maar`, `fix`, `push`, `gewoon doen`: stoppen met discussieren en uitvoeren.
- Pushback mag alleen vooraf als een keuze echt verkeerd of riskant is. Niet mid-build.

## Projectdoel

Maak en onderhoud een simpele interne administratie-cockpit voor AuraWash/B&T:

- Beschikbaar geld beheren.
- Salarissen en medewerkers beheren.
- Loonstroken uploaden, controleren, goedkeuren of afkeuren.
- Belastingen beheren.
- Te betalen facturen beheren.
- Te ontvangen facturen beheren.
- Export kunnen maken voor instanties als CSV en JSON.
- Alles moet simpel genoeg zijn voor dagelijks gebruik zonder technische kennis.

## Tech stack

- Vite
- React
- TypeScript
- Tailwind CSS v4
- shadcn-style lokale componenten in `src/components/ui`
- Lucide icons
- Data start in `src/data.ts`
- Lokale gebruikerswijzigingen blijven bewaard in `localStorage`

## Commands

```bash
npm install
npm run dev
npm run build
```

`npm run build` doet drie dingen:

1. TypeScript check
2. Vite build
3. Maakt `aurawash-administratie.html` als single-file HTML via `scripts/make-single-html.mjs`

Gebruik `aurawash-administratie.html` als direct te openen bestand.

## GitHub

Repo:

```text
https://github.com/Ecomvaulttt/automation-aurawash
```

Repo moet private blijven, omdat er loon- en financiele gegevens in staan.

## Belangrijkste bestanden

- `src/App.tsx`: hoofdapp, UI, state, acties, export.
- `src/data.ts`: startdata uit Excel en voorbeeldloonstrook.
- `src/lib/export.ts`: CSV/JSON download helpers.
- `src/components/ui/*`: lokale shadcn-style primitives.
- `scripts/make-single-html.mjs`: maakt single-file HTML.
- `AGENTS.md`: korte projectregels voor Codex.
- `.ai/lessons.md`: projectlessons die toegepast moeten worden.

## Absolute datawaarheden

Betaalstatus nooit raden uit een algemene `Status` kolom als er een expliciete betaald-kolom is.

Gebruik altijd:

- `Openstaande facturen`: Excel kolom H `Betaald?`
- `Te ontvangen facturen`: Excel kolom J `Beataald`

Statusvelden zoals `Open`, `Betaald`, `in behandeling`, `loopt` zijn alleen context of UI-labels.

Voor berekeningen telt:

- Te betalen facturen open = kolom H `NEE`
- Te ontvangen facturen open = kolom J `NEE`
- Kolomwaarde `JA` betekent betaald
- Kolomwaarde `JA (termijn)` betekent niet direct open, maar wel apart tonen als termijn/context

## Huidige brondata

Gebaseerd op:

- `B&T _ AuraWash Overzicht Mei 2026.xlsx`
- `115 Murabe-A.--P07.pdf`

Voorbeeldloonstrook bevat o.a.:

- Medewerker: Anas Murabe
- Loonnummer: `115wn0005`
- Periode: `07 = Juli 2026`
- Functie: `Autopoetser`
- Bruto: `2598.27`
- Netto: `2296.45`

## Handmatige acties die moeten blijven werken

De app moet minimaal dit ondersteunen:

- Beschikbaar geld aanpassen, verwijderen, toevoegen.
- Salarissen aanpassen.
- Medewerkers toevoegen.
- Loonstroken uploaden.
- Loonstroken status: `Controle`, `Goedgekeurd`, `Afgekeurd`, `Ontbreekt`.
- Belastingen op `JA` of `NEE` zetten.
- Belastingpost toevoegen.
- Te betalen factuur toevoegen.
- Te betalen factuur status wijzigen.
- Te betalen factuur betaald/niet betaald zetten.
- Te ontvangen factuur toevoegen.
- Te ontvangen factuur status wijzigen.
- Te ontvangen factuur betaald/niet betaald zetten.
- Vaste lasten openstaand bedrag en status aanpassen.
- Alles exporteren naar CSV/JSON.
- Reset naar Excel-startdata.

## UI-richting

AuraWash brand richting:

- Zwart/wit basis.
- Lichtgrijs dashboard canvas.
- AuraWash accent blauw: `#A7C7E7`.
- Lettergevoel: Inter + Archivo Black vibe.
- Geen marketing landing page. Eerste scherm moet de werktool zijn.
- Dashboard moet compact, duidelijk en operationeel blijven.

Gebruik bekende UI patronen:

- Buttons met icons.
- Selects voor status.
- `JA/NEE` als duidelijke kleine knoppen.
- Inputs voor bedragen en namen.
- Tabellen met horizontale scroll op mobiel.
- Badges voor status.

## Skills / workflows die hier relevant zijn

Gebruik deze aanpak bij werk aan dit project:

- `browser-qa`: altijd na UI-wijzigingen met Playwright testen.
- Frontend taste/design regels: geen generieke AI-purple UI, geen marketinghero, geen onnodige cards-in-cards.
- Spreadsheet/PDF workflow: bij twijfel originele Excel/PDF opnieuw inspecteren met Python libraries.
- Git workflow: na werk `npm run build`, commit, push.

Praktische QA minimaal:

- Build groen.
- Directe `aurawash-administratie.html` opent via `file://`.
- Desktop 1280px check.
- Mobile 375px check.
- Geen console errors.
- Geen failed requests.
- Geen horizontale page overflow.
- Uploadflow werkt.
- JSON export downloadt.
- Handmatige `JA/NEE` wijziging past totals aan.

## Dingen die niet fout mogen gaan

- Geen publieke GitHub repo maken zonder expliciete toestemming.
- Geen tokens, secrets of lokale auth-data committen.
- Geen `node_modules` of `dist` committen.
- Niet vertrouwen op `Status` voor betaalberekeningen als er een betaaldkolom is.
- Niet vergeten `aurawash-administratie.html` opnieuw te genereren met `npm run build`.
- Geen lange uitleg geven als Ramzi vraagt om een simpele fix.

## Aanbevolen werkwijze voor volgende Codex

1. Lees `AGENTS.md`, `.ai/lessons.md` en dit bestand.
2. Run `npm install` als dependencies ontbreken.
3. Run `npm run build` om baseline te checken.
4. Maak de gevraagde wijziging.
5. Test met Playwright op desktop en mobiel.
6. Commit met korte duidelijke commit message.
7. Push naar `origin/main`, tenzij Ramzi om een branch vraagt.
