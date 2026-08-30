# EcomVault Finance OS - stress-testrapport

Datum: 31 augustus 2026

## Toegevoegde productfeatures

1. Excel-import met kolom H als betaalwaarheid voor te betalen facturen.
2. Excel-import met kolom J als betaalwaarheid voor te ontvangen facturen.
3. CSV/XLSX-bankimport met saldo, netto mutatie en datumcontrole.
4. Private documentopslag met tijdelijke signed URLs.
5. Loonstroken per medewerkerprofiel en maand.
6. Handmatig goedkeuren, afkeuren, betaald en niet betaald verwerken.
7. Branded PDF-facturen genereren.
8. ZIP-boekhoudpakket met CSV, JSON, HTML, facturen en loonstrookbewijs.
9. Gmail en Microsoft 365 inbox automatisch uitlezen.
10. Direct e-mail versturen via Gmail of Microsoft 365.
11. Slack-reminders voor te betalen en te ontvangen facturen.
12. Veilige 5/3-dagen reminderregels met dagelijkse deduplicatie.
13. Multi-tenant werkruimtes, vestigingen en rollen.
14. Security wall met 2FA, RBAC en private service-role verwerking.
15. Admin Center voor accounts, vestigingen, koppelingen en livegang.
16. Auditlog voor belangrijke financiele en beheerwijzigingen.
17. AI-helper binnen het dashboard.
18. Light/dark theme en responsive appnavigatie.
19. Dagelijkse Vercel/GitHub automation-trigger.
20. Health endpoint, CI, Dependabot en security headers.

## Bewezen controles

- 40 geautomatiseerde tests verdeeld over 10 testbestanden.
- TypeScript-compile, Node-syntaxcontrole en productiebuild.
- Dependency-audit met nul bekende production vulnerabilities.
- Alle 8 dashboardmodules getest op desktop en 375 px mobiel.
- Geen horizontale pagina-overflow, kapotte afbeeldingen of consolefouten.
- Navigatie reset scrollpositie bij iedere modulewissel.
- Medewerkerprofiel en maandfilter tonen de juiste loonstrookrun.
- AI-paneel opent met invoer en suggesties.
- Theme wisselt stabiel tussen light en dark.
- Standalone HTML bevat geen externe scripts of stylesheets.
- Echte AuraWash-workbookcontrole: 6 sheets, H/J worden direct uit de bron gelezen.

## Security stress

- OAuth-state is ondertekend, kort geldig en bestand tegen manipulatie.
- Provider-tokens zijn AES-256-GCM versleuteld opgeslagen.
- Cron-secret wordt via constante-tijd-hashes vergeleken.
- Alleen officiele HTTPS Slack-webhooks worden toegestaan.
- CR/LF e-mailheaderinjectie wordt verwijderd.
- Onbekende e-mailproviders worden voor netwerkverkeer afgewezen.
- Malformed tenant- en document-UUIDs worden voor databaseverkeer geweigerd.
- Automatische klantmail staat standaard uit.
- Remindertermijnen worden begrensd tot 0-30 dagen.
- Betaalde facturen worden nooit opnieuw geremind.
