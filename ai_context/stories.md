# Stories

Decisione del 2026-11-04. Sezione di stories in stile Instagram: contenuti brevi, foto e video, che scadono.

## Requisiti raccolti

- **Contenuti:** foto e video.
- **Chi pubblica:**
  - **Admin:** foto e video, senza limiti.
  - **Caposquadra:** foto e video. È un ruolo nuovo (vedi sotto).
  - **Utente registrato:** solo foto, solo mentre una finestra di voto MVP è aperta, al massimo una story per partita conclusa (cioè per finestra MVP).
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
- **Storage a oggetti** (MinIO nel `docker-compose`, o S3/R2). Il browser carica il file direttamente tramite URL firmato: il file non passa da Next.
- **Servizio Quarkus:** firma gli URL, salva i dati delle stories, applica i permessi e i limiti, gestisce la coda di elaborazione con ffmpeg (compressione, anteprima), la scadenza e le eliminazioni.
- **Database:** stesso Postgres del torneo, ma in uno schema separato (`stories`) con migration Flyway, per non scontrarsi con Prisma.
- **Riproduzione:** MP4 servito con richieste per intervalli di byte (range request). HLS non serve per contenuti brevi.
- **Auth:** Next emette un token breve per l'utente loggato (id, ruolo, squadra del caposquadra) e Quarkus lo verifica. Da progettare con attenzione: è il punto più delicato.
- **Più tornei:** il servizio segue la regola di `multi_tournament.md`, un'istanza per torneo con il suo database e il suo storage.

Prima di scegliere va verificato che il server di produzione abbia RAM e CPU sufficienti per JVM e ffmpeg.

## Punti ancora aperti

- durata di visibilità di una story (proposta: 24 ore)
- durata massima di un video e dimensione massima dei file
- chi può vedere le stories: anche i guest o solo gli utenti registrati
- se gli utenti possono segnalare una story agli admin
- se una story ha visualizzazioni, risposte o reazioni
- se un caposquadra ha limiti di quantità
- cosa succede alle stories quando un utente cancella l'account o viene sospeso (proposta: vengono eliminate)
- testo esatto della dichiarazione di non responsabilità
