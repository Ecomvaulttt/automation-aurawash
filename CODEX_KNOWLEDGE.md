# Codex Knowledge - EcomVault Ops Cockpit

Dit bestand is bedoeld als directe context voor elke nieuwe Codex-agent die aan deze repo werkt.

## Wie Ramzi is

- Ramzi runt EcomVault en werkt aan AuraWash/B&T processen.
- Hij wil snelle, directe uitvoering. Geen lange uitleg als iets gewoon gefixt moet worden.
- Taal: Nederlands als Ramzi Nederlands schrijft.
- Stijl: lean, scherp, praktisch. Geen fluff.
- Als Ramzi zegt `go`, `doe maar`, `fix`, `push`, `gewoon doen`: stoppen met discussieren en uitvoeren.
- Pushback mag alleen vooraf als een keuze echt verkeerd of riskant is. Niet mid-build.

## Projectdoel

Maak en onderhoud een plug-and-play finance operations cockpit voor autodetailers, carwash/detailing shops en servicebedrijven. AuraWash/B&T is de eerste demo-tenant.

- Klant-onboarding met bedrijfsnaam, logo, sector, boekhouder, Slack kanaal en administratie e-mail.
- Veilige bankflow via CSV/XLS upload van de laatste 30 dagen.
- Beschikbaar geld beheren.
- Klikbare KPI's met maand/kwartaal/jaar grafiek.
- Mini-agenda/preset periodekeuze voor overzichtcijfers: vandaag, gister, laatste 7/30/90/365 dagen, deze maand, kwartaal, halfjaar, jaar, totaal en custom start/einddatum.
- Salarissen en medewerkers beheren.
- Loonstroken per medewerkerprofiel en maand uploaden, controleren, goedkeuren of afkeuren.
- Belastingen beheren.
- Te betalen facturen beheren.
- Te ontvangen facturen beheren.
- Documentendossier beheren voor facturen, loonstroken en vaste lasten.
- PDF's uit e-mail of handmatige upload koppelen aan facturen.
- Slack reminders sturen voor interne deadlines.
- Automatische klantmail sturen bij te ontvangen facturen die niet zijn overgeboekt.
- Branded facturen maken vanuit klantprofiel.
- Boekhouderpakket exporteren met kosten, cashflow, activa/passiva indicatie en bewijsstukken.
- Export kunnen maken voor instanties als CSV en JSON.
- E-mail automation kunnen triggeren vanuit de GitHub repo met het e-mailadres van de ontvanger.
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
- E-mail automation via GitHub Actions + `nodemailer`
- Inbox automation via IMAP + `imapflow`
- Slack reminders via `SLACK_WEBHOOK_URL`

## Commands

```bash
npm install
npm run dev
npm run build
npm run automation:sync
npm run automation:reminders
npm run automation:run
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
- `scripts/send-email.mjs`: verstuurt workflow e-mail via SMTP-secrets.
- `scripts/sync-inbox.mjs`: haalt factuur/loonstrook PDF's uit inbox en schrijft documentdata.
- `scripts/run-reminders.mjs`: stuurt Slack reminders en optionele klantmail.
- `automation/README.md`: setup voor inbox, Slack en klantmail automation.
- `automation/config.example.json`: voorbeeldregels voor automation.
- `PRODUCT_BLUEPRINT.md`: productstrategie, onboarding en installatieregels.
- `DESIGN.md`: EcomVault designregels.
- `.github/workflows/send-email.yml`: handmatig te triggeren GitHub Actions e-mail automation.
- `.github/workflows/inbox-automation.yml`: dagelijkse inbox/reminder automation.
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
- Medewerkers toevoegen, bewerken, uit dienst zetten en verwijderen.
- Medewerker verwijderen moet ook gekoppelde loonstroken van die medewerker opruimen.
- `Uit dienst` medewerkers blijven zichtbaar in medewerkerbeheer, maar tellen niet mee in actieve salarisrun, loonstrook-upload dropdown of actieve medewerker-totalen.
- Loonstroken uploaden.
- Loonstroken moeten per profiel zichtbaar zijn met maandchips eronder.
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
- E-mail template maken in de app.
- E-mail versturen via GitHub Actions workflow met ontvanger, onderwerp en bericht.
- Reset naar Excel-startdata.
- Automation tab openen.
- Gmail/IMAP zoekregel aanpassen.
- Slack kanaal/reminderdagen aanpassen.
- Document uploaden voor factuur, vaste last of loonstrook.
- Bij factuur op `Bekijk` klikken om gekoppelde data/PDF te zien.
- Documentdata handmatig corrigeren.

## E-mail automation

Geen SMTP-wachtwoorden in de code zetten. Gebruik alleen GitHub Secrets:

```text
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
```

Workflow:

```text
Actions > Send automation email > Run workflow
```

Inputs:

- `recipient_email`: zijn e-mailadres
- `subject`: onderwerp
- `body`: bericht
- `reply_to`: optioneel

De app heeft daarnaast een `E-mail` tab met mailto-fallback.

## Inbox, Slack en klantmail automation

Doel:

- Alle loonstroken, facturen en vaste lasten automatisch uit e-mail ophalen.
- PDF-bijlagen lokaal opslaan onder `automation/documents/YYYY-MM/`.
- Extractie-data opslaan in `automation/inbox-documents.json`.
- Per document tonen: relatie, factuurnummer, bedrag, vervaldatum, status, betaald JA/NEE, opslagpad en extractietekst.
- Te betalen facturen en vaste lasten: Slack melding 5 dagen voor deadline als `paid = NEE`.
- Te ontvangen facturen: Slack melding 3 dagen voor deadline als `paid = NEE`.
- Te ontvangen facturen: automatische klantmail alleen als `AUTO_SEND_CUSTOMER_EMAILS=true`.

GitHub Secrets:

```text
IMAP_HOST
IMAP_PORT
IMAP_USER
IMAP_PASS
IMAP_MAILBOX
SLACK_WEBHOOK_URL
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
EMAIL_REPLY_TO
```

GitHub Variables:

```text
INBOX_SINCE_DAYS=45
PAYABLE_REMINDER_DAYS=5
RECEIVABLE_REMINDER_DAYS=3
AUTO_SEND_CUSTOMER_EMAILS=false
```

Belangrijk:

- Zet `AUTO_SEND_CUSTOMER_EMAILS` standaard op `false` bij eerste installatie.
- Eerst klantmailadressen/templates controleren, daarna pas op `true`.
- `automation/inbox-documents.json`, `automation/reminder-log.json` en `automation/documents/*` zijn gevoelige output en worden niet gecommit.

## UI-richting

EcomVault brand richting:

- Ink Black `#0B0B0C` + Warm White `#F5F2ED` als basis.
- Royal Blue `#2D5BFF` als enige actiekleur.
- Champagne `#E8D9B8` als premium detailkleur.
- Lettergevoel: Inter / Inter Tight, headings strak met `-0.02em`.
- Geen marketing landing page. Eerste scherm moet de werktool zijn.
- Dashboard moet compact, duidelijk, senior en operationeel blijven.

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
- E-mail tab opent.
- GitHub workflow YAML blijft geldig.
- Handmatige `JA/NEE` wijziging past totals aan.

## Dingen die niet fout mogen gaan

- Geen publieke GitHub repo maken zonder expliciete toestemming.
- Geen tokens, secrets of lokale auth-data committen.
- Geen `node_modules` of `dist` committen.
- Niet vertrouwen op `Status` voor betaalberekeningen als er een betaaldkolom is.
- Niet vergeten `aurawash-administratie.html` opnieuw te genereren met `npm run build`.
- Geen SMTP secrets of e-mail wachtwoorden committen.
- Geen lange uitleg geven als Ramzi vraagt om een simpele fix.

## Aanbevolen werkwijze voor volgende Codex

1. Lees `AGENTS.md`, `.ai/lessons.md` en dit bestand.
2. Run `npm install` als dependencies ontbreken.
3. Run `npm run build` om baseline te checken.
4. Maak de gevraagde wijziging.
5. Test met Playwright op desktop en mobiel.
6. Commit met korte duidelijke commit message.
7. Push naar `origin/main`, tenzij Ramzi om een branch vraagt.
