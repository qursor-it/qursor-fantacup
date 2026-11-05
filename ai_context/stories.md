# Stories

Decisione del 2026-11-04. Sezione di stories in stile Instagram: contenuti brevi, foto e video, che scadono.

## Requisiti raccolti

- **Contenuti:** foto e video.
- **Chi pubblica:**
  - **Admin:** foto e video, senza limiti.
  - **Caposquadra:** foto e video, al massimo 10 stories attive (cioè nelle ultime 24 ore). È un ruolo nuovo (vedi sotto).
  - **Utente registrato:** solo foto, solo mentre una finestra di voto MVP è aperta, al massimo una story per partita conclusa (cioè per finestra MVP).
- **Durata:** una story è visibile per 24 ore dalla pubblicazione, poi scade e il file viene eliminato dallo storage.
- **Chi le vede:** solo gli utenti che hanno fatto login. I guest non vedono le stories.
- **Visualizzazioni:** si registra chi ha visto ogni story. L'autore vede l'elenco delle persone che l'hanno vista.
- **Reazioni:** gli utenti possono reagire con un insieme fisso di emoji, come su Instagram. L'autore vede chi ha reagito e come.
- **Segnalazioni:** un utente può segnalare una story. Le segnalazioni finiscono in un elenco nell'area admin, dove l'admin decide se eliminarla.
- **Account cancellato o sospeso:** le stories dell'utente vengono eliminate, file compresi.
- **Moderazione:** un admin può eliminare qualsiasi story, anche già pubblicata. L'eliminazione rimuove anche il file dallo storage e va registrata nell'audit log.
- **Responsabilità:** va scritto in modo esplicito che l'organizzazione non si assume responsabilità per i contenuti pubblicati dagli utenti. Il testo va mostrato prima della pubblicazione e riportato nel regolamento e nella pagina privacy.

## Ruolo caposquadra

- Ruolo nuovo, assegnato da un admin a un utente registrato e collegato a una squadra reale (`FootballTeam`).
- Non ha permessi admin: in più rispetto a un utente può solo pubblicare stories con foto e video.
- Non va confuso con il capitano della rosa fantasy, che è un giocatore reale scelto dall'utente e non un account.

## Decisione tecnica: servizio Quarkus dedicato

Le stories sono un servizio Quarkus separato. Next.js resta per tutto il resto e ospita anche l'interfaccia delle stories.

Motivi:
- il responsabile del progetto è più rapido su Quarkus;
- la compressione dei video (ffmpeg) consuma molta CPU e va comunque tenuta fuori dal server web;
- migrare l'intero backend a Quarkus è stato valutato e scartato: costerebbe settimane per tornare alle funzioni attuali, mentre l'organizzazione del codice si migliora restando in TypeScript.

Struttura prevista:
- **Editor lato client:** il file da caricare e prodotto dal Media Composer (`media_composer.md`), che oggi pubblica solo in modo simulato.
- **Storage a oggetti** (MinIO nel `docker-compose`, o S3/R2). Il browser carica il file direttamente tramite URL firmato: il file non passa da Next.
- **Servizio Quarkus:** firma gli URL, salva i dati delle stories, applica i permessi e i limiti, gestisce la coda di elaborazione con ffmpeg (compressione, anteprima), la scadenza e le eliminazioni.
- **Database:** stesso Postgres del torneo, ma in uno schema separato (`stories`) con migration Flyway, per non scontrarsi con Prisma.
- **Riproduzione:** MP4 servito con richieste per intervalli di byte (range request). HLS non serve per contenuti brevi.
- **Auth (fatta):** `GET /api/stories/token` di Next restituisce all'utente loggato un JWT RS256 valido 5 minuti (`iss` `qursor-fantacup`, `aud` `stories`, `sub` id utente, `upn` email, `groups` ruolo). Il browser lo manda a Quarkus come `Authorization: Bearer`; Quarkus lo verifica (smallrye-jwt) con la chiave pubblica che scarica dal JWKS di Next (`GET /api/stories/jwks`, URL in `STORIES_JWKS_URL`) e sa chi chiama. L'unico segreto è `STORIES_JWT_PRIVATE_KEY` in Next; Quarkus non ha chiavi da configurare. Quando esisterà il ruolo caposquadra andrà aggiunta al token la sua squadra. Istruzioni in `quarkus/README.md`.
- **Più tornei:** il servizio segue la regola di `multi_tournament.md`, un'istanza per torneo con il suo database e il suo storage.

Prima di scegliere va verificato che il server di produzione abbia RAM e CPU sufficienti per JVM e ffmpeg.

## Punti ancora aperti

- durata massima di un video e dimensione massima dei file
- quali emoji sono disponibili come reazioni
- testo esatto della dichiarazione di non responsabilità
