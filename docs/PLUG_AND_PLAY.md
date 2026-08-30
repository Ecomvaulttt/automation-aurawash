# Plug-and-play klantinstallatie

Dit is het korte stappenplan voor AuraWash en iedere volgende klant. Deel nooit sleutels, wachtwoorden of 2FA-codes in chat.

## Eenmalig voor EcomVault

1. Deploy deze repo op Vercel.
2. Maak een Supabase-project in een EU-regio en voer `npx supabase db push` uit.
3. Voeg de lege variabelen uit `.env.example` veilig toe aan Vercel.
4. Maak OAuth-apps bij Google, Microsoft en Slack met callback `https://JOUW-DOMEIN/api/integrations/callback`.
5. Voeg bij GitHub alleen `APP_URL` en `CRON_SECRET` toe voor de extra dagelijkse trigger.

## Per nieuwe klant

1. Vul lokaal alleen de `BOOTSTRAP_*`-velden in en run `npm run platform:bootstrap`.
2. Laat de eigenaar de uitnodiging openen, een wachtwoord instellen en 2FA afronden.
3. Vul in `Setup` bedrijfsnaam, sector, logo, administratie- en boekhoudermail in.
4. Voeg vestigingen en accounts toe in `Admin Center`.
5. Koppel Google of Microsoft en Slack via de knoppen in `Admin Center`.
6. Importeer de administratie-Excel; betaalstatus komt uit H voor te betalen en J voor te ontvangen.
7. Upload een CSV/XLSX-bankexport van de laatste 30 dagen.
8. Controleer facturen, PDF's, loonstroken, deadlines en reminderregels.
9. Laat automatische klantmail tijdens de eerste testrun uit staan.
10. Klik in `Admin Center` op `Gecontroleerd live zetten`.

## Klaar voor dagelijks gebruik

- Dagelijks worden gekoppelde inboxen gescand.
- Slack waarschuwt 5 dagen voor te betalen en 3 dagen voor te ontvangen facturen.
- Klantmail kan na controle per organisatie worden aangezet.
- Facturen kunnen als branded PDF met bijlage worden verstuurd.
- De boekhouder krijgt één ZIP met cijfers, CSV/JSON en beschikbare bewijsstukken.
