# EcomVault Ops Cockpit

Plug-and-play administratie cockpit voor autodetailers, carwash/detailing shops en servicebedrijven.
AuraWash/B&T is de eerste demo-tenant.

## Features

- Klant-onboarding met bedrijfsnaam, logo, boekhouder, Slack en inbox.
- EcomVault design system: Ink Black, Warm White, Royal Blue en Champagne.
- Beschikbaar geld aanpassen en toevoegen.
- Veilige bankflow via periodieke CSV/XLSX upload in plaats van bankcredentials opslaan.
- Klikbare KPI's met maand/kwartaal/jaar analyse.
- Mini-agenda met presets: vandaag, gister, laatste 7/30/90/365 dagen, deze maand, kwartaal, halfjaar, jaar en totaal.
- Salarissen aanpassen, medewerkers toevoegen/verwijderen en loonstroken uploaden.
- Loonstroken per medewerkerprofiel met maandselectie.
- Medewerkers uit dienst zetten zonder ze direct uit de historie te verwijderen.
- Loonstroken handmatig goedkeuren of afkeuren.
- Belastingen op betaald/niet betaald zetten.
- Te betalen facturen beheren op basis van kolom H `Betaald?`.
- Te ontvangen facturen beheren op basis van kolom J `Beataald`.
- Export naar CSV en JSON voor instanties.
- E-mail automation via gekoppelde Google/Microsoft-inbox, GitHub Actions of mailto-fallback.
- Inbox automation voor facturen, loonstroken en vaste lasten via IMAP.
- Documentendossier met PDF/data-preview per factuur.
- Slack reminders voor deadlines.
- Automatische klantmail voor te ontvangen facturen wanneer betaling nog niet binnen is.
- Branded PDF-facturen die automatisch in het dossier en bij te ontvangen komen.
- Boekhouderpakket als ZIP met CSV, JSON, HTML en beschikbare PDF-bewijsstukken.
- Ingebouwde EcomVault AI-helper met actuele administratiecontext en lokale fallback.
- Automatisch controlecentrum voor achterstallige posten, ontbrekende vervaldatums, bewijsstukken, loondossiers en dubbele factuurnummers.
- Cash-stresstest met de verwachte eindpositie nadat alle open ontvangsten zijn meegenomen.
- Liquiditeitsprognose voor 30 dagen met ouderdom van open posten.
- Veilige login met Supabase Auth en verplichte TOTP-2FA voor financiele toegang.
- Multi-tenant organisatie- en vestigingsafscherming met Postgres RLS.
- Rollen voor EcomVault beheer, eigenaar, manager, boekhouder en medewerker.
- Admin Center voor accounts, rollen, vestigingen, beveiliging en connectorstatus.
- Begeleide plug-and-play startcheck die alleen echte gereedheid meetelt.
- Veilige OAuth-basis voor Google Workspace, Microsoft 365 en Slack.
- Versleutelde provider-tokens; service keys en tokens komen nooit in de browser.
- Auditlog voor uitnodigingen, rollen, vestigingen, betaalstatus, documenten, e-mail en koppelingen.
- Financiële productiegegevens blijven uitsluitend in Supabase; alleen UI-voorkeuren staan lokaal.
- Dagelijkse OAuth-inboxsync, Slack-reminders en optionele klantmail via Vercel Cron of GitHub Actions.

## Starten

```bash
npm install
npm run dev
```

Open daarna `http://localhost:5173/`.

Wanneer die poort bezet is:

```bash
npm run dev -- --port 5174
```

## Build

```bash
npm run build
```

De build maakt ook `aurawash-administratie.html`, een single-file HTML die direct geopend kan worden.

## AI-helper

De chat werkt direct met lokale antwoorden over cash, facturen, loonstroken, deadlines en exports. Voor vrije AI-vragen gebruikt het systeem de gratis Groq-tier met `openai/gpt-oss-20b`, gekozen uit [awesome-free-llm-apis](https://github.com/mnfst/awesome-free-llm-apis):

```bash
cp .env.example .env.local
```

Vul daarna alleen server-side in:

```text
GROQ_API_KEY=...
GROQ_MODEL=openai/gpt-oss-20b
```

Maak de gratis sleutel aan via [GroqCloud](https://console.groq.com/keys). Zet voor gebruik met echte salaris- en factuurdata eerst **Zero Data Retention** aan in Groq Data Controls. De browser ontvangt de API-key nooit en alleen een begrensde administratiesamenvatting wordt verstuurd.

De route `api/ai-helper.mjs` is geschikt voor een serverless deployment; zet dezelfde environment variables ook bij de hostingprovider. Wanneer de gratis limiet is bereikt of Groq niet beschikbaar is, gebruikt de app automatisch de lokale kennislaag. De single-file HTML blijft altijd lokaal werken.

## E-mail automation

De repo bevat een handmatige GitHub Actions workflow:

```text
.github/workflows/send-email.yml
```

Voeg deze repository secrets toe in GitHub:

```text
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
```

Daarna kun je via `Actions > Send automation email > Run workflow` een ontvanger, onderwerp en bericht invullen.

De app bevat ook een `E-mail` tab met een mailtemplate en directe `mailto` knop.

## Veilige platformmodus

Zonder Supabase-variabelen start de app expliciet als `Demo`. Met beide publieke Supabase-variabelen actief verschijnt eerst de login- en 2FA-beveiligingswand.

De volledige activering voor een nieuwe klant staat in `docs/PLUG_AND_PLAY.md`.
De bewezen featurelijst en stresstestresultaten staan in `docs/STRESS_TEST_REPORT.md`.

Nieuwe organisatie aanmaken nadat Supabase is ingericht:

```bash
npm run platform:bootstrap
```

Dit maakt de organisatie, hoofdvestiging, eigenaar, standaardregels en connectorrecords aan. De eigenaar ontvangt een uitnodiging en rondt zelf het wachtwoord en 2FA af.

## Plug-and-play setup

Start bij de `Setup` tab:

1. Vul bedrijfsnaam, sector, contactpersoon, logo en brandkleur in.
2. Voeg administratie- en boekhouder e-mail toe.
3. Kies Slack kanaal.
4. Importeer de administratie-Excel en een CSV/XLSX-bankbestand van de laatste 30 dagen.
5. Koppel Google Workspace of Microsoft 365 en Slack via OAuth.
6. Controleer dossier/reminders en gebruik daarna `Gecontroleerd live zetten`.

## Wat moet geinstalleerd/gekoppeld worden

Zie ook `INSTALLATION_STACK.md`.

Minimaal voor een werkende demo:

```bash
npm install
npm run dev
```

Voor echte automation:

- Google Workspace of Microsoft 365 OAuth-app voor inbox en uitgaande e-mail.
- Slack OAuth-app voor het administratiekanaal.
- Vercel Cron of de beveiligde GitHub-trigger voor dagelijkse automation.
- Periodieke CSV/XLSX-bankexport van de klant, of later een bank-provider integratie.

De multi-tenant database, private documentopslag, login, 2FA, rollen, connectorbeveiliging en automation-runner staan klaar. Voor productie moeten alleen de provideraccounts en hostingvariabelen uit het activatieplan door de eigenaar worden ingesteld.

Latere productuitbreidingen:

- OCR/AI extractie voor PDFs.
- Automatische bankkoppeling via een PSD2-provider.
- Het eigen poetsopdrachten-controlesysteem voor medewerkers.

## Inbox, Slack en klantmail automation

De app bevat een `Automation` tab voor:

- Facturen/loonstroken/vaste lasten uit de inbox registreren.
- PDF/document uploaden en direct per factuur openen.
- Factuurdata controleren: relatie, factuurnummer, bedrag, vervaldatum, status en betaald JA/NEE.
- Reminderregels beheren.

Scripts:

```bash
npm run automation:sync
npm run automation:reminders
npm run automation:run
```

GitHub workflow:

```text
.github/workflows/inbox-automation.yml
```

Benodigde GitHub Secrets:

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
VITE_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

GitHub Variables:

```text
INBOX_SINCE_DAYS=45
PAYABLE_REMINDER_DAYS=5
RECEIVABLE_REMINDER_DAYS=3
AUTO_SEND_CUSTOMER_EMAILS=false
ORGANIZATION_ID=
LOCATION_ID=
```

Zet `AUTO_SEND_CUSTOMER_EMAILS` pas op `true` wanneer klantmailadressen en templates gecontroleerd zijn.

## Belangrijke dataregel

Gebruik voor betaalstatussen altijd de expliciete betaald-kolom:

- `Openstaande facturen`: kolom H `Betaald?`
- `Te ontvangen facturen`: kolom J `Beataald`

Statusvelden zijn alleen context.

## Codex context

Nieuwe Codex-agent? Lees eerst `CODEX_KNOWLEDGE.md` en `AGENTS.md`.
