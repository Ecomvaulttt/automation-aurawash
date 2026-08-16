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
