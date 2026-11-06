# F3 · Stories

Funzionamento e requisiti: `ai_context/stories.md`, `ai_context/media_composer.md`. Decisioni: ADR-0002 … ADR-0006 e ADR-0009 in `docs/adr/`.

Obiettivo della fase: stories reali al posto della pubblicazione simulata del Media Composer, con visualizzazioni, reazioni, segnalazioni, moderazione, scadenza e archivio.

## Decisioni da prendere

### F3-01 · Dimensione massima dei file e scadenza di caricamento

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** limiti da applicare nell'editor e sul server.
- **Fatto quando:** in `stories.md` sono scritti la dimensione massima per foto e video (proposta del Media Composer: 10 MB foto, 30 MB video) e la durata della scadenza di caricamento (proposta: 10 minuti), ricavata dalla dimensione massima con margine per una rete mobile lenta.
- **Dipende da:** —

### F3-02 · Video dalla galleria oltre 30 secondi

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** oggi vengono rifiutati; l'alternativa è aprirli e far scegliere 15 secondi dentro una finestra di 30.
- **Fatto quando:** la scelta è scritta in `media_composer.md`.
- **Dipende da:** —

### F3-03 · Cancellazione delle proprie stories

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** stabilire se l'autore può cancellare le sue stories (servirebbe anche per i doppioni dovuti a una conferma persa) e se la cancellazione libera il posto nei limiti.
- **Fatto quando:** la regola è in `stories.md` e in `roles_permissions.md`.
- **Dipende da:** —

### F3-04 · Emoji delle reazioni

- **Stato:** da fare
- **Tipo:** decidere
- **Fatto quando:** l'elenco fisso è in `stories.md`.
- **Dipende da:** —

### F3-05 · Condivisione fuori dall'app

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** cosa si condivide (una story, le stories di una persona, la sezione), chi può condividere, cosa mostra l'anteprima su WhatsApp (story o logo del torneo), cosa vede chi apre il link dopo la scadenza.
- **Fatto quando:** le risposte sono in `stories.md`.
- **Dipende da:** —

### F3-06 · Archivio: download, durata, moderazione

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** come gli admin scaricano (URL firmati uno per uno o uno zip preparato dal server), quando si cancella definitivamente l'archivio, come evitare che una story eliminata dalla moderazione mentre il job la copia "risorga" su Hetzner.
- **Fatto quando:** le risposte sono in `stories.md`.
- **Dipende da:** —

### F3-07 · Testi: dichiarazione, regolamento, privacy

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** il testo mostrato prima della pubblicazione e le modifiche a regolamento e privacy.
- **Fatto quando:** i testi sono approvati e dicono che: l'organizzazione non risponde dei contenuti pubblicati dagli utenti; le stories sono visibili a chiunque, anche senza account; vengono conservate nell'archivio e possono essere riusate dall'organizzazione; per gli ospiti si salva un identificativo anonimo nel browser (verificare con chi cura la privacy se serve un consenso). Testi applicati in `app/(public)/regolamento`, `app/(public)/privacy` e nel Media Composer.
- **Dipende da:** —

### F3-08 · Musica del Media Composer

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** sostituire i 3 brani sintetici di `lib/media/music.ts` con brani la cui licenza permetta l'uso (attribuzione, usi consentiti), e decidere cosa fare dei video dalla galleria che contengono già musica protetta.
- **Fatto quando:** la scelta è in `media_composer.md` e i brani sono nel progetto con le loro licenze.
- **Dipende da:** —

### F3-09 · Storage per lo sviluppo locale

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** MinIO nel `docker-compose` o un bucket R2 di test.
- **Fatto quando:** la scelta è in `stories.md` e nel README.
- **Dipende da:** —

## Fondamenta

### F3-10 · Ruolo caposquadra

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** nuovo ruolo assegnato da un admin, collegato a una `FootballTeam`, che in più rispetto a un utente può solo pubblicare stories con foto e video.
- **Leggere prima:** `stories.md` (Ruolo caposquadra), `roles_permissions.md`.
- **File:** `prisma/schema.prisma` (+ migration), `app/actions/admin/users.ts`, pagine admin utenti, `lib/session.ts` se serve esporre la squadra.
- **Fatto quando:** un admin può assegnare e togliere il ruolo scegliendo la squadra; il ruolo non dà permessi admin; `roles_permissions.md` è aggiornato; non c'è confusione con il capitano della rosa fantasy.
- **Dipende da:** —

### F3-11 · Modelli dati delle stories

- **Stato:** da fare
- **Tipo:** fare
- **Leggere prima:** `stories.md` (Stati nel database, Flusso, Job), ADR-0004.
- **File:** `prisma/schema.prisma`, nuova migration, `ai_context/prisma_model.md`, `ai_context/db.md`.
- **Fatto quando:** esistono i modelli per: story (autore, tipo, stato in caricamento/pubblicata, scadenza di caricamento, percorso del file, posizione del file R2/in spostamento/Hetzner, data di caricamento e di pubblicazione, finestra MVP o partita collegata); visualizzazioni (utente oppure identificativo anonimo dell'ospite, una sola per persona); reazioni (solo utenti, emoji dall'elenco fisso); segnalazioni; data dell'ultima esecuzione di ogni job. I limiti sono garantiti dal database (vincoli di unicità, per esempio utente + finestra MVP).
- **Dipende da:** F3-10

### F3-12 · Bucket e configurazione

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** storage pronti per DEV e produzione, per ogni torneo.
- **File:** `.env.example`, `.env.docker.example`, `docker-compose*.yml`, `Jenkinsfile*` (credenziali), `README.md`.
- **Fatto quando:** bucket R2 pubblico in lettura con dominio personalizzato (non `r2.dev`) e CORS che permette il PUT dal dominio del torneo; bucket Hetzner privato; chiavi solo nelle variabili del server; storage di sviluppo come deciso in F3-09; tutto descritto nel README.
- **Dipende da:** F3-09

### F3-13 · Libreria di accesso agli storage

- **Stato:** da fare
- **Tipo:** fare
- **File:** `lib/storage/` (nuovo).
- **Fatto quando:** funzioni testate per: URL firmato PUT legato a percorso e tipo con scadenza; `HEAD` con dimensione e data di scrittura; copia in streaming da R2 a Hetzner senza caricare il file in memoria; cancellazione su entrambi; URL firmato in lettura per l'archivio. Percorsi dei file impossibili da indovinare.
- **Dipende da:** F3-12

## Pubblicazione

### F3-14 · Richiesta di pubblicazione

- **Stato:** da fare
- **Tipo:** fare
- **Leggere prima:** `stories.md` (Flusso, passo 3; Scadenza di caricamento), ADR-0004.
- **File:** server action o route in `app/actions/user/` o `app/api/stories/`.
- **Fatto quando:** controlla ruolo, regole (finestra MVP aperta per gli utenti registrati, solo foto per loro) e limiti; sistema le stories "in caricamento" scadute dello stesso utente; crea la story in caricamento con scadenza in una transazione; restituisce id e URL firmato; un nuovo URL per la stessa story solo prima della scadenza. Test per limiti e richieste in parallelo.
- **Dipende da:** F3-01, F3-11, F3-13

### F3-15 · Conferma

- **Stato:** da fare
- **Tipo:** fare
- **Fatto quando:** riceve solo l'id; `HEAD` su R2; pubblica se il file esiste, la dimensione è nei limiti e la data di scrittura è precedente alla scadenza, anche se la finestra MVP nel frattempo si è chiusa; ripetibile senza effetti doppi; test per conferma doppia, file in ritardo, file assente.
- **Dipende da:** F3-14

### F3-16 · Media Composer collegato al flusso reale

- **Stato:** da fare
- **Tipo:** fare
- **Leggere prima:** `media_composer.md` (Sostituire il mock).
- **File:** `lib/media/upload.ts` (`MediaUploadService`), `components/media-composer/`, `app/(user)/media/crea/`.
- **Fatto quando:** caricamento con `PUT` e avanzamento in un dialog bloccante che mostra gli errori; in caso di errore si riprova sulla stessa story senza perdere il lavoro fatto; la pagina è accessibile solo a chi può pubblicare in quel momento; il video è offerto solo ad admin e capisquadra (e rifiutato comunque dal server agli altri); limiti di F3-01 controllati anche nell'editor; rimossi `app/api/media/mock-upload` e `lib/media/mock-upload.ts`.
- **Dipende da:** F3-15, F3-07 (testo da mostrare)

## Visualizzazione

### F3-17 · Feed e visualizzatore

- **Stato:** da fare
- **Tipo:** fare
- **File:** API del feed, componenti della barra stories e del visualizzatore a schermo intero, homepage.
- **Fatto quando:** il feed restituisce solo le stories pubblicate nelle ultime 24 ore (filtro sul server), visibile anche ai guest; video riprodotti con richieste per intervalli di byte; la pagina delle stories ha `noindex`.
- **Dipende da:** F3-15

### F3-18 · Visualizzazioni

- **Stato:** da fare
- **Tipo:** fare
- **Fatto quando:** ogni apertura registra una visualizzazione per utente o per identificativo anonimo dell'ospite (salvato nel browser come deciso in F3-07); l'autore vede gli utenti per nome e gli ospiti come totale ("+12 ospiti").
- **Dipende da:** F3-17, F3-07

### F3-19 · Reazioni

- **Stato:** da fare
- **Tipo:** fare
- **Fatto quando:** gli utenti loggati reagiscono con le emoji di F3-04; i guest vedono un invito a fare login; l'autore vede chi ha reagito e come.
- **Dipende da:** F3-17, F3-04

### F3-20 · Segnalazioni e area admin

- **Stato:** da fare
- **Tipo:** fare
- **Fatto quando:** gli utenti loggati segnalano una story; nell'area admin c'è l'elenco delle segnalazioni da cui l'admin apre la story ed eventualmente la elimina (F3-21).
- **Dipende da:** F3-17

## Moderazione e ciclo di vita

### F3-21 · Eliminazioni

- **Stato:** da fare
- **Tipo:** fare
- **File:** azioni admin delle stories, `app/actions/account.ts`, `app/actions/admin/users.ts`, `lib/audit.ts`.
- **Fatto quando:** un admin elimina qualsiasi story, con file tolto da R2 o da Hetzner e riga nell'audit log; account sospeso o cancellato elimina tutte le sue stories, file compresi, archivio compreso; eventuale cancellazione da parte dell'autore come deciso in F3-03.
- **Dipende da:** F3-13, F3-03

### F3-22 · Evento "nuova story"

- **Stato:** da fare
- **Tipo:** fare
- **Fatto quando:** la pubblicazione manda l'evento SSE "nuova story" e i browser ricaricano la lista; al ritorno in primo piano la lista si ricarica comunque.
- **Dipende da:** F3-15, F2-04

### F3-23 · Timer e job

- **Stato:** da fare
- **Tipo:** fare
- **Leggere prima:** ADR-0009, `stories.md` (Job periodici).
- **File:** `lib/jobs/` (nuovo), punto di avvio nel server Next (da verificare nella guida di Next).
- **Fatto quando:** un timer interno controlla la data dell'ultima esecuzione nel database; il job giornaliero sistema le stories "in caricamento" scadute (pubblica se il file è arrivato in tempo, altrimenti elimina riga e file) e sposta su Hetzner i file delle stories scadute nell'ordine copia → verifica → aggiornamento del database → cancellazione da R2, in streaming e pochi alla volta, fuori dagli orari delle partite; rilanciabile senza danni; test della logica senza storage reali.
- **Dipende da:** F3-13, F3-15, F3-06

### F3-24 · Rete di sicurezza su R2

- **Stato:** da fare
- **Tipo:** verificare
- **Fatto quando:** verificato se R2 permette una regola di scadenza automatica per i file rimasti orfani; se sì, configurata e descritta in `stories.md`.
- **Dipende da:** F3-12

### F3-25 · Archivio per gli admin

- **Stato:** da fare
- **Tipo:** fare
- **Fatto quando:** nell'area admin si vedono le stories archiviate, si selezionano e si scaricano come deciso in F3-06.
- **Dipende da:** F3-23, F3-06

## Prima del rilascio

### F3-26 · Verifiche manuali del Media Composer

- **Stato:** da fare
- **Tipo:** verificare
- **Leggere prima:** `media_composer.md` (Checklist manuale).
- **Fatto quando:** provati e annotati: Safari su iPhone e Chrome su Android reali con la PWA installata; permessi di fotocamera e microfono negati (messaggio e alternativa galleria); cambio fotocamera frontale/posteriore e specchio del video frontale; gesti a due dita su touch reale; video della galleria oltre 30 secondi; HEIC dalla galleria su Safari; tutto anche dentro l'app degli store.
- **Dipende da:** F3-16

### F3-27 · Export video in un Web Worker

- **Stato:** da fare
- **Tipo:** fare (solo se serve)
- **Obiettivo:** spostare l'export video in un Web Worker se su telefoni lenti blocca l'interfaccia.
- **Fatto quando:** deciso in base a F3-26; se necessario, l'interfaccia resta reattiva durante l'export.
- **Dipende da:** F3-26
