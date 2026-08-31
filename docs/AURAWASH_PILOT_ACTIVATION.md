# AuraWash pilot activeren

Dit zijn de enige stappen die de eigenaar van de accounts zelf moet uitvoeren. Deel geen sleutels, wachtwoorden of 2FA-codes in chat.

## 1. Supabase aanmaken

1. Maak een Supabase-project in een EU-regio.
2. Zet e-mailauthenticatie en TOTP-MFA aan.
3. Zet bij `Authentication > Providers` ook Google aan met een eigen Google OAuth client.
4. Gebruik bij Google als callback `https://JOUW_PROJECT_REF.supabase.co/auth/v1/callback`.
5. Voeg de uiteindelijke app-URL toe als `Site URL` en bij `Auth redirect URLs`.
6. Bewaar de Google client secret, project-URL, publishable key en service-role key alleen bij Supabase, in `.env.local` of bij de hostingprovider.

Gebruik deze namen:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_URL
TOKEN_ENCRYPTION_KEY
CRON_SECRET
```

`TOKEN_ENCRYPTION_KEY` moet een willekeurige waarde van minimaal 32 tekens zijn.

## 2. Database installeren

```bash
npx supabase login
npx supabase link --project-ref JOUW_PROJECT_REF
npx supabase db push
```

Voor lokale RLS-tests is Docker Desktop nodig:

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

## 3. Eerste klant aanmaken

Vul in `.env.local` ook:

```text
BOOTSTRAP_OWNER_EMAIL
BOOTSTRAP_OWNER_NAME
BOOTSTRAP_COMPANY_NAME
BOOTSTRAP_COMPANY_SLUG
BOOTSTRAP_LOCATION_NAME
```

Voer daarna uit:

```bash
npm run platform:bootstrap
```

De eigenaar ontvangt een uitnodiging. Inloggen kan daarna met Google of e-mail/wachtwoord. Na de eerste login moet de eigenaar direct de QR-code voor 2FA scannen; zonder AAL2 opent de administratie niet.

## 4. E-mail en Slack koppelen

Maak OAuth-apps bij Google, Microsoft en Slack. Gebruik bij alle drie deze callback:

```text
https://JOUW-DOMEIN.nl/api/integrations/callback
```

Plaats daarna alleen bij de hostingprovider:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET
SLACK_CLIENT_ID
SLACK_CLIENT_SECRET
```

De klant klikt vervolgens zelf in `Admin Center > Koppelingen` op `Verbinden`. EcomVault ziet alleen status en fouten, nooit het ruwe token.

## 5. Dagelijkse platformautomation activeren

Vercel roept dagelijks `/api/automation/run` aan. De gekoppelde Google/Microsoft-inbox levert facturen en loonstroken; Slack ontvangt de reminders. De optionele GitHub-workflow kan dezelfde beveiligde route aanroepen met:

```text
APP_URL
CRON_SECRET
```

Test eerst `Platform automation` handmatig in GitHub Actions. Controleer PDF's, bedragen, factuurnummers, deadlines en klantadressen. Zet automatische klantmail pas daarna in de app aan.

## 6. Bank en boekhouder

1. Upload in `Setup` een CSV/XLSX-bankexport van de laatste 30 dagen.
2. Controleer de herkenning en het beschikbare bedrag.
3. Nodig de boekhouder uit met rol `Boekhouder`.
4. Test CSV, JSON, branded PDF en het complete ZIP-boekhouderpakket.

## 7. Pilot livezetten

Controleer in het Admin Center dat deze onderdelen groen zijn:

1. Minimaal een vestiging.
2. Actieve eigenaar met 2FA.
3. E-mailverbinding.
4. Slack-verbinding.
5. Bankbestand gecontroleerd.
6. Boekhouder toegevoegd.
7. Reminderregels op 5 dagen te betalen en 3 dagen te ontvangen.
8. Automatische klantmail nog uit tijdens de eerste testrun.

Klik daarna op `Gecontroleerd live zetten`. De server controleert dezelfde onderdelen en legt de livegang vast in de auditlog.
