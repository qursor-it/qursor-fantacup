# Aggiornamenti in tempo reale

Decisione del 2026-11-06. Meccanismo unico per mandare aggiornamenti dal server alle persone collegate: punteggi delle partite in diretta (soprattutto i gol) e nuove stories. Prima di questa decisione l'app non aveva nulla di simile: la homepage ricalcola i dati solo al caricamento e l'orologio della `LiveMatchCard` avanza nel browser, ma il punteggio non si aggiorna senza ricaricare la pagina.

## Requisiti

- **Direzione:** solo dal server al browser.
- **Ritardo:** i gol devono arrivare praticamente in diretta. Per le stories qualche secondo di ritardo va bene.
- **Carico:** nel momento di picco 100–200 persone collegate insieme, guest compresi.
- **Istanze:** un solo container Next per torneo (ogni torneo ha la sua installazione, vedi `multi_tournament.md`).

## Decisione: SSE, con segnale più richiesta

- **Canale:** Server-Sent Events. Una route di Next tiene aperta una connessione per ogni persona collegata. WebSocket è stato scartato perché la seconda direzione non serve; il polling perché per avere i gol quasi in diretta dovrebbe chiedere ogni 1–2 secondi.
- **Distribuzione:** con un solo container per torneo, il processo Next gira l'evento a tutte le connessioni che tiene aperte. Non servono sistemi intermedi.
- **Contenuto dell'evento:** solo un segnale di cosa è cambiato (per esempio "la live è cambiata", "c'è una nuova story"). Il browser poi chiede i dati aggiornati con una richiesta normale. Così un evento perso non lascia dati sbagliati: alla richiesta successiva arriva lo stato attuale.
- **Heartbeat:** il server manda un messaggio "sono vivo" con intervallo inferiore a 60 secondi, il timeout di default di nginx. Tiene aperta la connessione anche quando non succede niente (per esempio durante l'intervallo) e permette al browser di accorgersi se la connessione è caduta.

## Cache e picco di richieste

Decisione del 2026-11-06: prima di costruire questa parte si migra la cache al modello Cache Components di Next 16 (`use cache`, vedi `TODO.md`), così `getLiveMatches()` nasce già nel modello nuovo. Qui sotto `cachePublicData` indica lo strato di cache dei dati pubblici, qualunque sia la sua implementazione.

200 connessioni ferme pesano poco su Node. Il momento delicato è subito dopo un evento: tutti i browser chiedono i dati nello stesso istante.

- I dati live passano da un'unica funzione in cache (`getLiveMatches()` con `cachePublicData` in `lib/data/public/cache.ts`), con l'etichetta delle partite che le azioni admin già svuotano con `updateTag`.
- La usano sia la homepage sia un endpoint leggero (per esempio `GET /api/live`) che il browser chiama quando riceve il segnale.
- **Ordine dopo un gol:** l'azione admin salva il gol, svuota la cache (succede già), ricalcola subito una volta i dati live così la cache torna piena, e **solo dopo** manda il segnale SSE. Le richieste dei browser trovano la cache pronta: una sola query al database invece di una per persona.
- **Homepage:** resta dinamica perché dipende dall'utente (sessione, voti MVP in sospeso), ma legge partite live, prossime partite, gironi e marcatori dalle funzioni in cache. Solo i dati dell'utente restano calcolati a ogni richiesta. `force-dynamic` in sé non è il problema; lo sono le query fatte da zero a ogni visita.
- Alternativa scartata: tenere lo stato live nella memoria del processo Next. Funzionerebbe con un solo container, ma la cache esistente è lo stesso meccanismo usato dal resto dell'app.

## Browser e PWA

- La card live diventa un componente client che ascolta SSE e, al segnale, chiama `/api/live` e aggiorna il punteggio.
- Quando la PWA va in background la connessione cade. Quando l'app torna in primo piano, o la connessione si riapre dopo un buco di rete, il browser ricarica comunque lo stato attuale (punteggio, lista stories). Gli eventi persi nel frattempo non contano.

## Nginx

Le configurazioni nginx dei siti Qursor sono nella repository `qursor-it/qursor-infrastructure` (`nginx/qursor-prod.conf`, `nginx/qursor-dev.conf`), distribuite da Jenkins. Al 2026-11-06:

- **fantadc non c'è** in quella repository: la sua configurazione va trovata sul server e, possibilmente, portata lì come gli altri siti;
- gli altri siti usano `proxy_buffering off`, necessario perché gli eventi non restino fermi nel proxy: va verificato che valga anche per fantadc;
- nessun `proxy_read_timeout` sui siti normali (default 60 secondi): da qui il heartbeat. In alternativa si alza il timeout solo sulla route SSE, come già fatto per `board.qursor.dev/collab`;
- in prod i server ascoltano con `listen 443 ssl` senza `http2`: con HTTP/1.1 un browser apre al massimo circa 6 connessioni per dominio, e ogni scheda aperta dell'app ne occupa una con SSE. Valutare `http2` per il dominio del torneo.

## Punti ancora aperti

- verificare che la compressione delle risposte di Next non trattenga gli eventi del flusso SSE
- quali eventi esistono oltre a "live cambiata" e "nuova story", e su quali pagine il browser si collega (solo homepage o tutta l'app)
- limite di connessioni per IP o per utente, per evitare abusi
