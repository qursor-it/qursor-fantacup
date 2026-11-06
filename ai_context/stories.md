# Stories

Decisione del 2026-11-04. Sezione di stories in stile Instagram: contenuti brevi, foto e video, che scadono.

## Requisiti raccolti

- **Contenuti:** foto e video.
- **Chi pubblica:**
  - **Admin:** foto e video, senza limiti.
  - **Caposquadra:** foto e video, al massimo 10 stories attive (cioè nelle ultime 24 ore). È un ruolo nuovo (vedi sotto).
  - **Utente registrato:** solo foto, solo mentre una finestra di voto MVP è aperta, al massimo una story per partita conclusa (cioè per finestra MVP).
- **Durata dei video:** al massimo 15 secondi; nell'editor si può caricare un video fino a 30 secondi e tagliarlo (decisione del 2026-11-05).
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

## Decisione tecnica: tutto in Next.js

Le stories, interfaccia e backend, sono gestite da Next.js come il resto dell'app. Decisione aggiornata il 2026-11-06: il servizio Quarkus separato previsto in precedenza è stato rimosso, insieme al token firmato e al JWKS che servivano solo a lui.

Motivi:
- la compressione dei video non serve sul server: il Media Composer (`media_composer.md`) esporta già nel browser un MP4 compresso di al massimo 15 secondi;
- un secondo servizio (JVM, deploy, autenticazione tra servizi) costava più di quanto rendeva.

Struttura prevista:
- **Editor lato client:** il file da caricare è prodotto dal Media Composer, che oggi pubblica solo in modo simulato.
- **Storage a oggetti** (MinIO nel `docker-compose`, oppure S3 o R2). Next genera un URL firmato e il browser carica il file direttamente nello storage, senza passare da Next.
- **Next.js (server action o route):** firma gli URL, salva i dati delle stories con Prisma, applica permessi e limiti (anche sul server, non solo nel client), e gestisce scadenza ed eliminazioni. Usa la sessione esistente, quindi non serve un'autenticazione separata.
- **Database:** lo stesso Postgres del torneo, con modelli Prisma e migration come il resto.
- **Riproduzione:** l'MP4 viene servito dallo storage con richieste per intervalli di byte (range request). HLS non serve per contenuti brevi.
- **Più tornei:** si segue la regola di `multi_tournament.md`, con un'istanza per torneo che ha il suo database e il suo storage.

## Punti ancora aperti

- dimensione massima dei file
- quali emoji sono disponibili come reazioni
- testo esatto della dichiarazione di non responsabilità
