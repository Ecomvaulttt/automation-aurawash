# EcomVault Pilot Platform Design

## Doel

EcomVault Ops Cockpit wordt een veilig, multi-tenant en plug-and-play finance operations platform. AuraWash is de eerste klantorganisatie en pilot, maar geen hardcoded productbasis. Een nieuwe klant moet via dezelfde onboardingwizard binnen enkele uren eigen branding, vestigingen, gebruikers, e-mail, Slack, regels en exports kunnen activeren.

## Eerste Pilotresultaat

De eerste pilot is geslaagd wanneer een AuraWash-beheerder met verplichte 2FA kan inloggen, alleen toegestane vestigingen ziet, een factuur veilig kan uploaden of ontvangen, de extractie kan controleren, de factuur kan goedkeuren, een reminder kan laten uitvoeren en de volledige auditgeschiedenis kan terugzien.

## Scope

- Supabase Auth, Postgres en private Storage als production foundation.
- Organisaties, vestigingen, gebruikers, rollen en fijnmazige rechten.
- Verplichte TOTP-MFA voor superadmins, eigenaren, managers en boekhouders.
- Afgeslankte medewerkerstoegang voor eigen profiel en loonstroken.
- EcomVault-superadmincenter voor organisaties, vestigingen, gebruikers, uitnodigingen, integraties en supportstatus.
- Plug-and-play onboardingwizard met hervatten, validatie en verbindingschecks.
- Connector registry voor Google/Microsoft inbox, Slack, SMTP en bankbestanden.
- Veilige documentopslag, factuurreview, goedkeuring en auditlog.
- Dashboard met persoonlijke acties, aging, cashforecast, integratiegezondheid en maandafsluiting.
- Lokale demomodus blijft beschikbaar wanneer Supabase niet geconfigureerd is.

## Niet In Deze Pilot

- Directe PSD2-bankkoppeling; CSV/XLS blijft de veilige starter.
- Poetsopdrachten in het medewerkersportaal; rechten en datamodel worden hiervoor wel uitbreidbaar gehouden.
- Volledig boekhoudpakket of automatische betaalopdrachten.
- Stil of onbeperkt impersoneren door support; supporttoegang is tijdelijk, zichtbaar en gelogd.

## Architectuur

De React/Vite-app gebruikt `@supabase/supabase-js` voor sessies, MFA, tenantdata en private documenten. Alle browsertoegang wordt beschermd door Postgres Row Level Security. Gevoelige beheeracties, uitnodigingen, connector-OAuth en automation jobs lopen via server-side API-routes met een service-role key die nooit in de browser terechtkomt.

De bestaande `localStorage`-data blijft alleen beschikbaar als expliciete demomodus. In production mode komt financiële brondata uit Supabase. De UI gebruikt repositories zodat demo- en productiondata dezelfde componenten voeden.

## Tenantmodel

- `organizations`: klantbedrijven zoals AuraWash.
- `locations`: vestigingen binnen een organisatie.
- `profiles`: gebruikersprofielen gekoppeld aan Supabase Auth.
- `memberships`: combinatie van gebruiker, organisatie, optionele vestiging en rol.
- `role_permissions`: centrale rechtenmatrix.
- Elke zakelijke tabel bevat `organization_id`; vestigingsgebonden records bevatten ook `location_id`.
- Een eigenaar kan alle vestigingen van zijn organisatie zien.
- Een manager ziet uitsluitend toegewezen vestigingen.
- Een boekhouder ziet financiële data en exports maar kan geen gebruikers of integraties beheren.
- Een medewerker ziet uitsluitend het eigen profiel en eigen loonstroken.
- Een EcomVault-superadmin ziet organisaties en platformgezondheid; toegang tot klantdata vereist een expliciete, gelogde support-sessie.

## Rollen En Rechten

- `ecomvault_superadmin`: platformbeheer, organisaties, support-sessies en connectorgezondheid.
- `owner`: volledige organisatiecontrole, goedkeuringen, vestigingen, gebruikers en exports.
- `manager`: operationele administratie en medewerkers binnen toegewezen vestigingen.
- `accountant`: financiële read/export/review-toegang zonder account- of connectorbeheer.
- `employee`: eigen profiel en eigen loonstroken.

Rechten worden niet alleen in de UI verborgen, maar ook afgedwongen in RLS en serverroutes.

## Login En MFA

- B2B-uitnodiging via e-mail; publieke signup staat uit.
- E-mail/wachtwoord als pilot-login, uitbreidbaar naar magic link en SSO.
- TOTP-enrollment direct na eerste login voor rollen waarvoor MFA verplicht is.
- Sessies zonder `aal2` krijgen geen toegang tot gevoelige tabellen of beheeracties.
- Gebruikers kunnen eigen actieve sessies bekijken en uitloggen.
- Supabase ondersteunt geen herstelcodes; een tweede TOTP-factor wordt als herstelpad aangeboden.

## Admincenter

Het admincenter bevat organisaties, vestigingen, gebruikers, uitnodigingen, rollen, integraties, automation-runs, opslaggebruik en audit-events. De superadmin kan een nieuwe klantworkspace vanuit een template maken. De eigenaar kan binnen de eigen organisatie vestigingen en accounts beheren.

## Plug-And-Play Onboarding

De wizard bestaat uit tien opgeslagen stappen:

1. Bedrijfsprofiel en branding.
2. Vestigingen.
3. Gebruikers en rollen.
4. MFA/security check.
5. Gmail of Microsoft inbox via OAuth.
6. Slack workspace en kanaal.
7. Bank CSV/XLS mapping.
8. Boekhouder en exportvoorkeuren.
9. Reminder-, goedkeurings- en klantmailregels.
10. End-to-end test en activatie.

Iedere connector heeft `not_configured`, `connecting`, `connected`, `attention`, `expired` of `disabled`. De wizard kan worden hervat. Kritieke checks moeten groen zijn voordat een workspace live kan.

## Connectorbeveiliging

- OAuth-tokens worden alleen server-side verwerkt en versleuteld opgeslagen.
- EcomVault ziet status, scopes, laatste sync en foutcode, nooit het ruwe token.
- Elke connector heeft een testactie en een herverbindingsflow.
- Providercredentials worden via hosting/Supabase secrets ingesteld, nooit via chat of broncode.
- Automatische klantmail staat per tenant standaard uit.

## Financiële Datawaarheden

- Te betalen facturen gebruiken uitsluitend het expliciete betaaldveld dat uit Excel-kolom H komt.
- Te ontvangen facturen gebruiken uitsluitend het expliciete betaaldveld dat uit Excel-kolom J komt.
- Vrije statuslabels bepalen nooit of een bedrag openstaat.
- Alle mutaties bewaren actor, tijdstip, vorige waarde, nieuwe waarde en reden in `audit_events`.

## Documenten En Factuurflow

- PDF's komen in een private bucket onder `organization_id/location_id/document_id`.
- Downloads gebruiken korte signed URLs.
- Facturen doorlopen `received`, `extracted`, `review_required`, `approved`, `rejected`, `paid` of `archived`.
- Duplicaten worden gecontroleerd op tenant, relatie, factuurnummer en bedrag.
- Extractievelden bewaren waarde, confidence en handmatige correctie.
- Goedkeuringen bewaren actor, beslissing, commentaar en tijdstip.
- Records worden soft-deleted; financiële historie wordt nooit stil verwijderd.

## Automationflow

De pilot-golden-flow is:

1. Inboxconnector ontvangt een PDF.
2. Een idempotente ingestion job maakt document en factuurrecord.
3. Extractie vult relatie, factuurnummer, bedrag, btw en vervaldatum.
4. Onzekere of dubbele records gaan naar de review inbox.
5. Een bevoegde gebruiker keurt goed of af.
6. Reminderregels maken Slack- en e-mailacties.
7. Iedere stap schrijft een audit- en automation-event.
8. Fouten krijgen retry count, laatste fout en een handmatige herstartknop.

## Dashboard

- `Mijn acties`: persoonlijke, toegewezen taken met eigenaar en deadline.
- `Goedkeuringen`: centrale inbox voor facturen en loonstroken.
- `Aging`: 0-30, 31-60, 61-90 en 90+ dagen.
- `Cashforecast`: 30, 60 en 90 dagen met scenario voor late ontvangsten.
- `Data health`: laatste sync, bankdata-leeftijd, ontbrekende bewijsstukken en verlopen connectoren.
- `Maandafsluiting`: vaste checklist per organisatie/vestiging.
- `Vestigingen`: vergelijking voor eigenaar en superadmin.
- Iedere KPI drillt door naar de onderliggende records.

## Foutafhandeling

- Externe calls hebben timeout, beperkte retries en idempotency keys.
- Providerfouten tonen een veilige foutcode en concrete herstelactie.
- Automationfouten verdwijnen nooit stil; ze komen in het control center.
- De lokale AI-fallback blijft beschikbaar bij Groq-storing of limiet.
- Geen foutmelding toont secrets, tokens of volledige providerresponses.

## Teststrategie

- SQL-tests voor RLS: gebruiker A mag nooit tenant B lezen of muteren.
- Unit-tests voor rollen, betaalstatus, aging, forecast en onboardingstatus.
- API-tests voor uitnodigingen, connectoracties en auditlogging.
- Browser-tests voor login, MFA, role-based navigatie, admincenter en onboarding.
- Mobiel, desktop, light en dark mode blijven onderdeel van visuele QA.
- `npm run build` blijft verplicht en genereert de standalone demoversie.

## Rollout

1. Foundation lokaal en met Supabase-testproject valideren.
2. AuraWash-organisatie, eerste vestiging en testgebruikers seeden.
3. Eén inbox- en Slackconnector activeren.
4. Golden-flow met testfactuur doorlopen.
5. Audit/RLS/security review uitvoeren.
6. Beperkte AuraWash-pilot starten.
7. AuraWash-configuratie als herbruikbaar branchetemplate opslaan.

## Acties Waarvoor De Eigenaar Nodig Is

- Een Supabase-project in een EU-regio aanmaken en EcomVault toegang geven via het providerdashboard.
- Google Cloud of Microsoft Entra OAuth-app registreren met de opgegeven callback-URL.
- Een Slack-app installeren via de onboardingwizard.
- Eerste AuraWash-gebruikers, rollen en vestigingen bevestigen.
- Privacy-, bewaartermijn- en klantmailregels zakelijk goedkeuren.

Secrets worden uitsluitend in provider- of hostingdashboards ingesteld en nooit in chat gedeeld.
