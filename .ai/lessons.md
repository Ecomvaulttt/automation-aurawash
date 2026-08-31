# Project Lessons -- Automation Aurawash
Read at session start, after global lessons. These override/extend global. Add at DEBRIEF.
(empty -- entries get added as we work)

## [2026-08-16] Betaalstatuskolom is leidend
- Context: AuraWash administratie-dashboard op basis van Excel-overzicht.
- Mistake: Te ontvangen facturen werden deels berekend op basis van de tekst in `Status`, terwijl de Excel in kolom J expliciet `Betaald JA/NEE` bevat.
- Root cause: De data werd handmatig genormaliseerd zonder de originele kolompositie als bronwaarheid te bewaren.
- Rule: Bij factuur- en betalingsdata altijd eerst de expliciete betaald-kolom per sheet gebruiken: `Openstaande facturen` kolom H, `Te ontvangen facturen` kolom J. Statusvelden alleen tonen als context, niet gebruiken als betaald-berekening.
- Scope: project
- Tags: #excel #facturen #betalingen

## [2026-08-30] Bewaar alleen serialiseerbare connectorstatus
- Context: Het Admin Center bewaarde demo-connectoren tussen browserrefreshes.
- Mistake: Complete connectorobjecten met Lucide-componenten werden naar localStorage geschreven, waardoor de UI na herladen crashte.
- Root cause: Presentatiecomponenten en persistente status zaten in hetzelfde object.
- Rule: Persist connectoren en andere UI-configuratie alleen als vlakke data-id/status; voeg iconen en componenten na het laden opnieuw toe vanuit de vaste catalogus.
- Scope: project
- Tags: #frontend #persistence #qa

## [2026-08-31] Producttours moeten zichtbare targets kiezen
- Context: De dashboardtour moest dezelfde AI-actie en grote setupkaart op desktop en mobiel uitlichten.
- Mistake: De eerste plaatsing kon een groot target overlappen en koos op mobiel eerst de verborgen desktopknop.
- Root cause: De tour ging uit van één selectorresultaat en alleen verticale plaatsingsruimte.
- Rule: Kies bij dubbele responsive controls altijd het target met een niet-nul rechthoek en test tourplaatsing op overlap; wijk op desktop zijwaarts uit als boven/onder niet past.
- Scope: project
- Tags: #frontend #product-tour #responsive #qa

## [2026-08-31] OTP gebruikt één semantische invoer
- Context: De verplichte 2FA-pagina gebruikte zes losse gecontroleerde cijfervelden met automatische focus.
- Mistake: De velden zagen er goed uit maar verloren in een echte browser invoer tijdens focuswissels.
- Root cause: Presentatie en invoerstate waren verdeeld over zes afhankelijke controls.
- Rule: Gebruik voor OTP één echte input met `one-time-code` en render de zes vakken alleen visueel; test typen en plakken in een echte browser.
- Scope: project
- Tags: #auth #2fa #frontend #qa
