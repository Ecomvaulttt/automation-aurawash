# AuraWash Administratie Cockpit

Interne administratie-app voor AuraWash/B&T op basis van het Excel-overzicht en loonstrookworkflow.

## Features

- Beschikbaar geld aanpassen en toevoegen.
- Salarissen aanpassen, medewerkers toevoegen/verwijderen en loonstroken uploaden.
- Medewerkers uit dienst zetten zonder ze direct uit de historie te verwijderen.
- Loonstroken handmatig goedkeuren of afkeuren.
- Belastingen op betaald/niet betaald zetten.
- Te betalen facturen beheren op basis van kolom H `Betaald?`.
- Te ontvangen facturen beheren op basis van kolom J `Beataald`.
- Export naar CSV en JSON voor instanties.
- E-mail automation via GitHub Actions of directe mailto-template.
- Inbox automation voor facturen, loonstroken en vaste lasten via IMAP.
- Documentendossier met PDF/data-preview per factuur.
- Slack reminders voor deadlines.
- Automatische klantmail voor te ontvangen facturen wanneer betaling nog niet binnen is.
- Lokale wijzigingen blijven bewaard in `localStorage`.

## Starten

```bash
npm install
npm run dev
```

Open daarna `http://localhost:5173/`.

## Build

```bash
npm run build
```

De build maakt ook `aurawash-administratie.html`, een single-file HTML die direct geopend kan worden.

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
```

GitHub Variables:

```text
INBOX_SINCE_DAYS=45
PAYABLE_REMINDER_DAYS=5
RECEIVABLE_REMINDER_DAYS=3
AUTO_SEND_CUSTOMER_EMAILS=false
```

Zet `AUTO_SEND_CUSTOMER_EMAILS` pas op `true` wanneer klantmailadressen en templates gecontroleerd zijn.

## Belangrijke dataregel

Gebruik voor betaalstatussen altijd de expliciete betaald-kolom:

- `Openstaande facturen`: kolom H `Betaald?`
- `Te ontvangen facturen`: kolom J `Beataald`

Statusvelden zijn alleen context.

## Codex context

Nieuwe Codex-agent? Lees eerst `CODEX_KNOWLEDGE.md` en `AGENTS.md`.
