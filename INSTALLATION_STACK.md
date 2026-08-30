# EcomVault Ops Cockpit - Install Stack

## V1 demo/local

```bash
npm install
npm run dev
```

Open daarna `http://localhost:5173/`.

Optioneel voor volledige EcomVault AI-antwoorden:

```text
GROQ_API_KEY
GROQ_MODEL=openai/gpt-oss-20b
```

Maak een gratis GroqCloud-key aan en activeer Zero Data Retention voordat echte salaris- of factuurgegevens worden gebruikt. Zet de waarden alleen server-side in `.env.local` of bij de hostingprovider. Zonder key of bij een providerstoring blijft de ingebouwde lokale administratie-assistent beschikbaar.

## V1 live automation

Benodigd per klant:

- Administratie inbox met IMAP toegang.
- SMTP account voor uitgaande klantmails.
- Slack Incoming Webhook voor het administratiekanaal.
- CSV/XLS bankexport van de laatste 30 dagen.
- Logo, bedrijfsnaam, contactpersoon en boekhouder e-mail.

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

Belangrijk: zet `AUTO_SEND_CUSTOMER_EMAILS` pas op `true` nadat klantmailadressen, factuurdata en templates gecontroleerd zijn.

## GitHub toegang

De GitHub OAuth/token moet `workflow` scope hebben, anders kan deze repo geen workflow-bestanden pushen of wijzigen.

## Platform foundation

Aanwezig in de repo:

- Supabase Auth met TOTP-2FA.
- Multi-tenant Postgres-schema en RLS per organisatie en vestiging.
- Private Storage bucket voor bewijsstukken.
- Rollen voor platformbeheer, eigenaar, manager, boekhouder en medewerker.
- Admin API voor uitnodigen, rollen/status wijzigen en toegang intrekken.
- Auditlog voor beheeracties.
- OAuth-flow voor Google Workspace, Microsoft 365 en Slack.
- Versleutelde tokenopslag buiten de browser.
- Herhaalbaar bootstrap-commando per nieuwe klant.

Benodigde platformvariabelen staan als lege namen in `.env.example`. Plaats waarden alleen in `.env.local` en bij de hostingprovider.

Volg voor AuraWash of een volgende klant `docs/AURAWASH_PILOT_ACTIVATION.md`.

## Later uitbreiden

- OCR/AI extractie voor PDF facturen en loonstroken.
- PSD2-bankkoppeling voor automatische transactiematching.
- Queue/worker voor grotere aantallen mailboxen.
- Medewerkerportaal voor poetsopdrachten.
