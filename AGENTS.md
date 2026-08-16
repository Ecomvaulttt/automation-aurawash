# Codex Project Notes

- Werk in het Nederlands met korte, directe updates.
- Dit is een interne AuraWash administratie-app met gevoelige loon- en financiele data. Houd de GitHub-repo private tenzij Ramzi expliciet public vraagt.
- Betaalstatus is leidend vanuit de Excel-betaaldkolommen, niet uit de algemene statusvelden:
  - `Openstaande facturen`: kolom H `Betaald?`
  - `Te ontvangen facturen`: kolom J `Beataald`
- Run `npm run build` na wijzigingen. Dit genereert ook `aurawash-administratie.html`.
- UI moet simpel blijven: toevoegen, betaald/niet betaald, goedkeuren/afkeuren, export.
