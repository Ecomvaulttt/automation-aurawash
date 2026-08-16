# AuraWash Administratie Cockpit

Interne administratie-app voor AuraWash/B&T op basis van het Excel-overzicht en loonstrookworkflow.

## Features

- Beschikbaar geld aanpassen en toevoegen.
- Salarissen aanpassen, medewerkers toevoegen en loonstroken uploaden.
- Loonstroken handmatig goedkeuren of afkeuren.
- Belastingen op betaald/niet betaald zetten.
- Te betalen facturen beheren op basis van kolom H `Betaald?`.
- Te ontvangen facturen beheren op basis van kolom J `Beataald`.
- Export naar CSV en JSON voor instanties.
- Lokale wijzigingen blijven bewaard in `localStorage`.

## Starten

```bash
npm install
npm run dev
```

Open daarna `http://localhost:5173/`.

## Build

```bash
npm run build
```

De build maakt ook `aurawash-administratie.html`, een single-file HTML die direct geopend kan worden.

## Belangrijke dataregel

Gebruik voor betaalstatussen altijd de expliciete betaald-kolom:

- `Openstaande facturen`: kolom H `Betaald?`
- `Te ontvangen facturen`: kolom J `Beataald`

Statusvelden zijn alleen context.
