# AuraWash Automation

Deze map is voor automatische inbox-verwerking, PDF-opslag en reminders.

## Wat draait automatisch

- `npm run automation:sync`: haalt e-mails met PDF-bijlagen op via IMAP en schrijft documenten naar `automation/inbox-documents.json`.
- `npm run automation:reminders`: controleert open documenten en stuurt Slack/e-mail reminders.
- `npm run automation:run`: doet beide achter elkaar.

## Reminderregels

- Te betalen facturen: Slack melding 5 dagen voor deadline wanneer `paid = NEE`.
- Vaste lasten: dezelfde interne Slack-regel als te betalen facturen.
- Te ontvangen facturen: Slack melding 3 dagen voor deadline wanneer `paid = NEE`.
- Te ontvangen facturen: klantmail wordt automatisch gestuurd wanneer `AUTO_SEND_CUSTOMER_EMAILS=true` en er een klantmail bekend is.
- Dedupe staat in `automation/reminder-log.json`, zodat dezelfde melding niet dagelijks dubbel gaat.

## Lokale env vars

```bash
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=info@bedrijf.nl
IMAP_PASS=app-password
IMAP_MAILBOX=INBOX
INBOX_SINCE_DAYS=45

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=info@bedrijf.nl
SMTP_PASS=app-password
SMTP_FROM=info@bedrijf.nl
EMAIL_REPLY_TO=info@bedrijf.nl

PAYABLE_REMINDER_DAYS=5
RECEIVABLE_REMINDER_DAYS=3
AUTO_SEND_CUSTOMER_EMAILS=true

VITE_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ORGANIZATION_ID
LOCATION_ID
```

## GitHub Secrets

Zet dezelfde waarden in GitHub bij `Settings > Secrets and variables > Actions`.

Belangrijk: wachtwoorden, IMAP app passwords, SMTP secrets en Slack webhook URL nooit committen.

## Output

- PDF's komen lokaal in `automation/documents/YYYY-MM/`.
- Extractie-data komt in `automation/inbox-documents.json`.
- Wanneer de Supabase-variabelen aanwezig zijn, worden nieuwe documenten ook naar private Storage en de tenantdatabase geschreven.
- Deze bestanden zijn bewust genegeerd door Git, omdat ze gevoelige financiële/loondata kunnen bevatten.
