# EcomVault Ops Cockpit - Install Stack

## V1 demo/local

```bash
npm install
npm run dev
```

Open daarna `http://localhost:5173/`.

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
```

GitHub Variables:

```text
INBOX_SINCE_DAYS=45
PAYABLE_REMINDER_DAYS=5
RECEIVABLE_REMINDER_DAYS=3
AUTO_SEND_CUSTOMER_EMAILS=false
```

Belangrijk: zet `AUTO_SEND_CUSTOMER_EMAILS` pas op `true` nadat klantmailadressen, factuurdata en templates gecontroleerd zijn.

## GitHub toegang

De GitHub OAuth/token moet `workflow` scope hebben, anders kan deze repo geen workflow-bestanden pushen of wijzigen.

## V2 productwaardig

- Auth + database voor multi-tenant klantlogins.
- File storage voor PDF bewijsstukken.
- OCR/AI extractie voor PDF facturen en loonstroken.
- PSD2/bank-provider integratie voor automatische transacties.
- PDF generator voor branded facturen.
- Background jobs/queue voor inbox sync en reminders.
- Audit log per klant voor boekhouder en compliance.
