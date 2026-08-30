# Security

## Gevoelige gegevens

Commit nooit `.env`-bestanden, tokens, wachtwoorden, loonstroken, bankexports, factuur-PDF's of gegenereerde automation-output. Productiedata hoort uitsluitend in Supabase met RLS en private Storage.

## Melden

Meld een kwetsbaarheid privé aan EcomVault. Open geen publieke issue met klantgegevens, tokens of een werkende exploit.

## Productieregels

- 2FA is verplicht voor financiële mutaties.
- Service-role keys en OAuth-tokens komen nooit in de browser.
- Klantmail staat standaard uit tot adressen en templates gecontroleerd zijn.
- Verwijderde documenten worden eerst logisch verwijderd en zijn daarna niet meer toegankelijk via de app.
- Roteer iedere sleutel die ooit in chat, logs of een commit zichtbaar is geweest.
