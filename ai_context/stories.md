# Stories

Decisione del 2026-11-04. Sezione di stories in stile Instagram: contenuti brevi, foto e video, che scadono.

## Requisiti raccolti

- **Contenuti:** foto e video.
- **Chi pubblica:**
  - **Admin:** foto e video, senza limiti.
  - **Caposquadra:** foto e video, al massimo 10 stories attive (cioè nelle ultime 24 ore). È un ruolo nuovo (vedi sotto).
  - **Utente registrato:** solo foto, solo mentre una finestra di voto MVP è aperta, al massimo una story per partita conclusa (cioè per finestra MVP).
- **Durata dei video:** al massimo 15 secondi; nell'editor si può caricare un video fino a 30 secondi e tagliarlo (decisione del 2026-11-05).
- **Durata:** una story è visibile nel feed per 24 ore dalla pubblicazione, poi scade e sparisce dal feed. Il file non viene eliminato: passa nell'archivio, che a fine torneo gli admin possono rivedere e scaricare (decisione del 2026-11-06, vedi "Archivio").
- **Chi le vede:** tutti, anche i guest senza account (`docs/adr/0006-stories-visibili-ai-guest.md`; prima erano riservate agli utenti loggati). Pubblicare resta riservato ai ruoli indicati sopra.
- **Guest (decisione del 2026-11-06):** possono solo guardare. Non reagiscono e non segnalano (i relativi pulsanti possono invitare a fare login). Nell'elenco delle visualizzazioni l'autore vede le persone registrate per nome e gli ospiti come totale ("+12 ospiti"). Per non contare più volte lo stesso ospite, il browser conserva un identificativo anonimo generato a caso, non collegato a nessun dato personale.
- **Motori di ricerca:** la pagina delle stories non va indicizzata.
- **Visualizzazioni:** si registra chi ha visto ogni story. L'autore vede l'elenco delle persone che l'hanno vista.
- **Reazioni:** gli utenti possono reagire con un insieme fisso di emoji, come su Instagram. L'autore vede chi ha reagito e come.
- **Segnalazioni:** un utente può segnalare una story. Le segnalazioni finiscono in un elenco nell'area admin, dove l'admin decide se eliminarla.
- **Account cancellato o sospeso:** le stories dell'utente vengono eliminate, file compresi, anche dall'archivio.
- **Moderazione:** un admin può eliminare qualsiasi story, anche già pubblicata. L'eliminazione rimuove anche il file dallo storage, archivio compreso, e va registrata nell'audit log.
- **Responsabilità:** va scritto in modo esplicito che l'organizzazione non si assume responsabilità per i contenuti pubblicati dagli utenti. Il testo va mostrato prima della pubblicazione e riportato nel regolamento e nella pagina privacy.

## Ruolo caposquadra

- Ruolo nuovo, assegnato da un admin a un utente registrato e collegato a una squadra reale (`FootballTeam`).
- Non ha permessi admin: in più rispetto a un utente può solo pubblicare stories con foto e video.
- Non va confuso con il capitano della rosa fantasy, che è un giocatore reale scelto dall'utente e non un account.

## Decisione tecnica: tutto in Next.js

Le stories, interfaccia e backend, sono gestite da Next.js come il resto dell'app. Il perché, e le alternative scartate (servizio Quarkus, compressione sul server), sono in `docs/adr/0002-stories-in-next.md`.

Struttura:
- **Editor lato client:** il file da caricare è prodotto dal Media Composer, che oggi pubblica solo in modo simulato.
- **Next.js (server action o route):** firma gli URL, salva i dati delle stories con Prisma, applica permessi e limiti sul server (il controllo nel client serve solo all'interfaccia), esegue i job periodici. Usa la sessione esistente, quindi non serve un'autenticazione separata.
- **Database:** lo stesso Postgres del torneo, con modelli Prisma e migration come il resto.
- **Riproduzione:** l'MP4 viene servito dallo storage con richieste per intervalli di byte (range request). HLS non serve per contenuti brevi.
- **Più tornei:** si segue la regola di `multi_tournament.md`, con un'istanza per torneo che ha il suo database e i suoi bucket.

## Storage

Decisioni: `docs/adr/0003-storage-r2-e-archivio-hetzner.md` e `docs/adr/0005-bucket-stories-pubblico.md`.

- **Stories attive: Cloudflare R2.** Una story si carica una volta e si guarda molte volte, e R2 non fa pagare il traffico in uscita. Si pagano solo spazio e operazioni oltre la soglia gratuita (10 GB, 1 milione di scritture e 10 milioni di letture al mese).
- **Archivio: Hetzner Object Storage**, già disponibile (1 TB di spazio e 1 TB di traffico in uscita compresi nel canone). Fa da archivio freddo: lo leggono solo gli admin a fine torneo, quindi la quota di traffico basta.
- Le chiavi degli storage restano solo sul server. Il browser riceve URL firmati solo per caricare.
- **Lettura (decisione del 2026-11-06):** il bucket R2 delle stories attive è pubblico in lettura, servito da un dominio personalizzato, con percorsi dei file impossibili da indovinare (decisi da Next al passo 3). Priorità a semplicità e cache: il link di un file non cambia mai e passa dalla cache di Cloudflare. La riservatezza dei file non è un obiettivo: chi ha il link di un file può vederlo senza login, e comunque le stories sono visibili anche ai guest. Quando il file passa nell'archivio, il link su R2 smette di funzionare. Per la produzione va usato il dominio personalizzato e non l'indirizzo `r2.dev` di prova (da verificare in fase di setup). L'archivio su Hetzner resta privato.

## Flusso di pubblicazione

Decisione: `docs/adr/0004-caricamento-diretto-con-url-firmato.md`.

1. **Pagina di creazione:** accessibile solo a chi in quel momento può pubblicare. È un controllo per l'interfaccia, perché le regole cambiano nel tempo (la finestra MVP può chiudersi mentre l'utente sta modificando). Il controllo che conta è al passo 3.
2. **Editor:** l'utente crea e modifica il contenuto nel Media Composer, che esporta un file già compresso.
3. **Richiesta di pubblicazione:** il browser chiede a Next il permesso, dichiarando tipo, dimensione e durata. Next:
   - controlla ruolo, regole e limiti e rifiuta le dichiarazioni fuori limite;
   - crea la story in stato **in caricamento**, con una **scadenza di caricamento** fissa (vedi sotto). Da questo momento la story conta per i limiti, che sono garantiti dal database (per esempio con un vincolo di unicità su utente e finestra MVP), così due richieste in parallelo non li aggirano;
   - decide lui il percorso del file nel bucket;
   - restituisce l'id della story e un URL firmato di caricamento (PUT), legato a quel percorso e al tipo di file, con scadenza breve.
4. **Caricamento:** il browser carica il file su R2 mostrando un dialog bloccante con l'avanzamento e gli eventuali errori. Se il caricamento fallisce, il browser chiede un nuovo URL **per la stessa story**: stesso percorso, nessuna nuova riga, nessun conteggio doppio. Un nuovo URL si ottiene solo prima della scadenza di caricamento e scade al più tardi a quell'ora.
5. **Conferma:** il browser comunica a Next solo l'id della story. Il percorso lo conosce già Next.
6. **Pubblicazione:** Next controlla su R2 con una richiesta `HEAD` che il file esista, che la dimensione reale sia nei limiti e che il file sia stato scritto prima della scadenza di caricamento, poi porta la story in stato **pubblicata**. La conferma è ripetibile: se arriva due volte, la seconda risponde che la story è già pubblicata.
7. **Esito all'autore:** è la risposta al passo 5.
8. **Notifica agli altri utenti:** Next manda un segnale SSE "c'è una nuova story" e i browser ricaricano la lista delle stories attive (vedi `realtime.md`).

### Scadenza di caricamento

Decisione del 2026-11-06.

- Al passo 3 Next salva sulla story una scadenza di caricamento, per esempio 10 minuti dalla richiesta. Il valore esatto si ricava dalla dimensione massima dei file, con margine per una rete mobile lenta.
- La scadenza non riparte: chiedere un nuovo URL per la stessa story non concede altro tempo.
- Per pubblicare conta quando è arrivato il file, non quando arriva la conferma: la data di scrittura restituita dalla `HEAD` su R2 deve essere precedente alla scadenza. Così un file caricato in ritardo non passa, mentre un utente la cui conferma si è persa può confermare anche qualche minuto dopo.
- Se la finestra MVP si chiude tra il passo 3 e la conferma, la story si pubblica lo stesso: conta il permesso dato al passo 3. Il tempo in più è limitato dalla scadenza di caricamento.

### Cosa protegge l'URL firmato, e cosa no

- Non si può fare in modo che solo l'app usi l'URL: tutto ciò che fa l'app lo può fare anche l'utente dal suo dispositivo. Cifrarlo non serve.
- Un URL firmato vale finché non scade e si può riusare, quindi non è davvero monouso.
- La protezione è limitare cosa permette e a chi lo si dà: solo a utenti autorizzati al passo 3, per un unico percorso deciso da Next, legato al tipo di file, con scadenza breve, più il controllo della dimensione reale alla conferma. Il caso peggiore è un utente autorizzato che riscrive il proprio file finché l'URL non scade.
- R2 non supporta il caricamento POST con policy (quello che su S3 permette di imporre una dimensione massima). Il limite di dimensione si verifica alla conferma.
- L'header del tipo di file è una dichiarazione del client: R2 non verifica che i byte siano davvero un'immagine o un video. Per un torneo locale è un rischio accettato.

## Visibilità e scadenza

- Il filtro delle 24 ore è sul backend: l'API restituisce solo le stories attive. Le stories scadute non arrivano mai al browser.
- Una story scaduta non viene cancellata: il file passa nell'archivio.

## Stati nel database

- **Stato della story:** in caricamento (URL emesso, file forse non ancora caricato) oppure pubblicata. "Scaduta" non è uno stato: si ricava dalla data di pubblicazione.
- **Posizione del file:** su R2, in spostamento, su Hetzner. Serve perché un job interrotto sappia cosa resta da spostare.

## Job periodici

Li esegue il backend Next, sulla stessa macchina, con un timer interno al processo Next (`docs/adr/0009-job-con-timer-interno.md`):
- il timer non conta 24 ore dall'avvio, che con deploy frequenti non scatterebbero mai: controlla ogni tanto la data dell'ultima esecuzione salvata nel database e fa partire il job se è passato abbastanza tempo;
- c'è un solo container per torneo (ogni torneo ha la sua installazione), quindi non servono lucchetti contro due esecuzioni in parallelo. I job restano comunque rilanciabili senza danni. Copiare file è lavoro di rete e quasi niente CPU, e con i volumi di un torneo locale (qualche GB al giorno al massimo) non serve un servizio separato. Si separa solo se le misure mostrano che il job rallenta l'app.

- **Stories in caricamento scadute, gestite subito da Next:** quando Next conta i limiti al passo 3, o quando l'autore riprova la conferma, le stories "in caricamento" di quell'utente con la scadenza superata vengono sistemate al momento con le regole qui sotto. Così un posto nei limiti non resta bloccato fino al job giornaliero.
- **Pulizia nel job giornaliero:** le stories ancora "in caricamento" con la scadenza di caricamento superata vengono controllate su R2:
  - file presente e scritto prima della scadenza: la story viene pubblicata (mancava solo la conferma);
  - file assente o scritto dopo la scadenza: si cancella il file, se c'è, e si elimina la riga, così il posto nei limiti torna libero.
  Le 24 ore di visibilità partono dalla data di caricamento del file. Una story recuperata dal job giornaliero può quindi essere già scaduta: in quel caso non compare nel feed ma passa direttamente nell'archivio, così il contenuto non va perso.
  Se la conferma si perde e l'autore non riprova o lo fa più tardi, la story può comparire in ritardo o finire direttamente nell'archivio. Per un utente registrato non può nascere un doppione (il limite lo blocca); per un caposquadra sì, se ricarica tutto da capo.
- **Archiviazione (una volta al giorno):** sposta su Hetzner i file delle stories scadute. Un file può restare su R2 fino a 48 ore. Regole:
  - ordine delle operazioni: copia su Hetzner, verifica che la copia esista e abbia la stessa dimensione, aggiorna la posizione nel database, cancella da R2. Così non si perde mai un file e il database non punta mai a un file che non esiste;
  - il job si può rilanciare senza fare danni: ricopiare lo stesso file sullo stesso percorso non cambia nulla;
  - i file passano in streaming da R2 a Hetzner, senza caricarli interi in memoria, pochi alla volta e in orari tranquilli (non durante le partite).
- **Rete di sicurezza:** una regola di scadenza automatica sul bucket R2 per i file rimasti orfani (da verificare su R2 prima di contarci).

## Archivio

- A fine torneo solo gli admin rivedono le stories archiviate, le selezionano e le scaricano.
- Le eliminazioni (moderazione, account cancellato o sospeso) devono togliere il file ovunque si trovi, su R2 o su Hetzner.

## Punti ancora aperti

Le decisioni ancora da prendere sono task di tipo "decidere" in `docs/roadmap/03-stories.md` (F3-01 … F3-09).
