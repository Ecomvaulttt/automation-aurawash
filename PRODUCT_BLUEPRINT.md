# EcomVault Ops Cockpit - Product Blueprint

## Positionering

EcomVault Ops Cockpit is een plug-and-play finance operations systeem voor autodetailers, carwash/detailing shops en servicebedrijven.

Belofte: binnen 2-3 uur staat er een werkend systeem dat inbox, facturen, loonstroken, vaste lasten, Slack reminders, klantmail en boekhouder-export samenbrengt.

## Ideale klant

- Autodetailing bedrijf, carwash, garage servicebedrijf of vergelijkbare operationele shop.
- Heeft maandelijks terugkerende facturen, loonstroken, vaste lasten en klantfacturen.
- Werkt nu met losse Excel, mailbox, PDF's en boekhoudermappen.
- Wil snel overzicht zonder meteen bankkoppelingen of zwaar boekhoudpakket te migreren.

## Core workflow

1. Klant vult bedrijfsprofiel in: naam, logo, sector, contactpersoon, boekhouder, administratie e-mail.
2. Klant koppelt Google Workspace of Microsoft 365 via OAuth.
3. Klant kiest Slack kanaal voor reminders.
4. Klant uploadt CSV/XLSX bankbestand van de laatste 30 dagen.
5. Systeem haalt facturen, loonstroken en vaste lasten uit e-mail.
6. Systeem toont per document: PDF, relatie, factuurnummer, bedrag, vervaldatum, betaald JA/NEE, prioriteit, status en opmerkingen.
7. Loonstroken staan per medewerkerprofiel met maandselectie onder het profiel.
8. Overzichtcijfers hebben een mini-agenda: vandaag, gister, laatste 7/30/90/365 dagen, deze maand, kwartaal, halfjaar, jaar, totaal en handmatige start/einddatum.
9. Systeem stuurt Slack reminders:
   - 5 dagen voor deadlines van te betalen facturen en vaste lasten.
   - 3 dagen voor deadlines van te ontvangen facturen.
10. Systeem stuurt klantmail wanneer een te ontvangen factuur nog niet is overgeboekt en klantmail automation aan staat.
11. Klant exporteert met 1 klik een boekhouderpakket.

## Productregels

- Geen bankcredentials opslaan in V1. Gebruik bank CSV/XLS upload als veilige starter.
- Klantmail staat standaard uit tot e-mailadressen en templates gecontroleerd zijn.
- PDF's en automation-output worden niet gecommit naar Git.
- Betaalstatus komt uit expliciete betaaldvelden, niet uit vrije statuslabels.
- Elk belangrijk bedrag moet doorklikbaar zijn naar onderliggende facturen/documenten.

## Installatievragen

- Wat is de bedrijfsnaam, sector en contactpersoon?
- Welk logo en welke accentkleur moet op facturen/export?
- Welke inbox moet gescand worden?
- Welke woorden herkennen facturen/loonstroken/vaste lasten in de inbox?
- Welk Slack kanaal ontvangt administratie alerts?
- Welk e-mailadres gebruikt de boekhouder?
- Hoe vaak uploadt de klant bank CSV/XLS?
- Moet klantmail automatisch aan, of eerst alleen als concept/export?
- Welke standaard services/prijzen gebruikt het bedrijf per voertuigtype?

## Dashboardregels

- Eerste scherm moet werkbaar zijn, geen marketing homepage.
- KPI's: beschikbaar geld, salarissen, belasting open, facturen open, te ontvangen, vaste lasten.
- KPI's zijn klikbaar en tonen maand/kwartaal/jaar context.
- Datumselectie moet boven KPI's staan en direct duidelijk maken welke periode de cijfers tonen.
- Loonstroken worden altijd bekeken vanuit medewerkerprofiel -> maand -> document.
- Boekhouderexport bevat kosten, cashflow, activa/passiva indicatie en bewijsstukken.
- Documentendossier is de bron voor PDF-bewijs.

## Later uitbreiden

- Bank PSD2 koppeling via externe provider als betaalde add-on.
- OCR/AI extractie voor PDF-bedragen en vervaldata.
- Klantportal met login.
- Servicecatalogus voor prijzen per voertuigtype.
- Automatische transactiematching tussen bankimport en facturen.
