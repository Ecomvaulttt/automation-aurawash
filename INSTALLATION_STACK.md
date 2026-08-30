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

## Live platform

Benodigd per klant:

- Google Workspace of Microsoft 365 OAuth-app.
- Slack OAuth-app met incoming webhook.
- CSV/XLSX bankexport van de laatste 30 dagen.
- Logo, bedrijfsnaam, contactpersoon en boekhouder e-mail.

Hosting secrets:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_URL
TOKEN_ENCRYPTION_KEY
CRON_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET
SLACK_CLIENT_ID
SLACK_CLIENT_SECRET
```

Optionele GitHub-trigger secrets:

```text
APP_URL
CRON_SECRET
```

Belangrijk: automatische klantmail staat per organisatie standaard uit. Zet dit pas in de app aan nadat adressen, factuurdata en template gecontroleerd zijn.

## GitHub toegang

De GitHub OAuth/token moet `workflow` scope hebben, anders kan deze repo geen workflow-bestanden pushen of wijzigen.

## Platform foundation

Aanwezig in de repo:

- Supabase Auth met TOTP-2FA.
- Multi-tenant Postgres-schema en RLS per organisatie en vestiging.
- Private Storage bucket voor bewijsstukken.
- Rollen voor platformbeheer, eigenaar, manager, boekhouder en medewerker.
- Admin API voor uitnodigen, rollen/status wijzigen en toegang intrekken.
- Auditlog voor beheer- en financiële statusacties.
- OAuth-flow voor Google Workspace, Microsoft 365 en Slack.
- Versleutelde tokenopslag buiten de browser.
- Herhaalbaar bootstrap-commando en gecontroleerde livegang per nieuwe klant.
- Dagelijkse provider-sync via Vercel Cron en beveiligde GitHub-trigger.
- PDF-facturen en ZIP-boekhouderpakket met bewijsstukken.

Benodigde platformvariabelen staan als lege namen in `.env.example`. Plaats waarden alleen in `.env.local` en bij de hostingprovider.

Volg voor AuraWash of een volgende klant `docs/PLUG_AND_PLAY.md`.

## Later uitbreiden

- OCR/AI extractie voor PDF facturen en loonstroken.
- PSD2-bankkoppeling voor automatische transactiematching.
- Queue/worker voor grotere aantallen mailboxen.
- Medewerkerportaal voor poetsopdrachten.
