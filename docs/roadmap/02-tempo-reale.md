# F2 · Aggiornamenti in tempo reale

Decisione: `docs/adr/0007-tempo-reale-con-sse.md`. Funzionamento: `ai_context/realtime.md`.

Obiettivo della fase: i gol arrivano praticamente in diretta a 100–200 persone collegate, con una sola query al database per ogni evento.

### F2-01 · Configurazione nginx di fantadc

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** sapere cosa c'è davanti a Next e prepararlo per SSE.
- **Leggere prima:** `ai_context/realtime.md` (sezione Nginx); repository `qursor-it/qursor-infrastructure` (`nginx/*.conf`, `Jenkinsfile*`).
- **File:** configurazione sul server (da trovare) → `nginx/qursor-prod.conf` e `nginx/qursor-dev.conf` in `qursor-infrastructure`.
- **Fatto quando:**
  - la configurazione di fantadc (dev e prod) è nella repository infrastructure e viene distribuita da Jenkins come gli altri siti;
  - c'è `proxy_buffering off`;
  - la route SSE ha un timeout compatibile con il heartbeat (o lungo, come `board.qursor.dev/collab`);
  - è valutato e, se possibile, attivato `http2` sul dominio del torneo.
- **Dipende da:** —

### F2-02 · Decidere eventi, pagine e limiti

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** chiudere i punti aperti di `ai_context/realtime.md`.
- **Fatto quando:** in `realtime.md` sono scritti: l'elenco degli eventi (almeno "live cambiata" e "nuova story") con il loro formato; su quali pagine il browser si collega (solo homepage o tutta l'app); se e come limitare le connessioni per IP o per utente.
- **Dipende da:** —

### F2-03 · Dati live in cache ed endpoint

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** un unico punto da cui leggere lo stato live.
- **File:** `lib/data/public/` (nuovo loader `getLiveMatches()`), `app/api/live/route.ts`, `app/page.tsx`.
- **Fatto quando:** `getLiveMatches()` è in cache con l'etichetta delle partite; `GET /api/live` restituisce le partite in corso con punteggio; la homepage usa lo stesso loader.
- **Dipende da:** F1-03, F1-05

### F2-04 · Canale SSE

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** una route che tiene aperte le connessioni e gira gli eventi a tutte.
- **Leggere prima:** guida delle route handler e dello streaming in `node_modules/next/dist/docs/`.
- **File:** `lib/realtime/` (elenco delle connessioni nel processo, funzione per pubblicare un evento), `app/api/events/route.ts` (nome da confermare).
- **Fatto quando:**
  - la route risponde con `text/event-stream` e non viene mai messa in cache;
  - un evento pubblicato arriva a tutte le connessioni aperte;
  - heartbeat ogni 20–30 secondi;
  - una connessione chiusa dal browser viene tolta dall'elenco (nessuna crescita della memoria);
  - verificato che la compressione delle risposte di Next non trattenga gli eventi;
  - eventuale limite di connessioni deciso in F2-02.
- **Dipende da:** F2-02

### F2-05 · Azioni admin che pubblicano l'evento live

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** dopo un gol, cache pronta prima del segnale.
- **File:** `app/actions/admin/goals.ts`, `matches.ts`, `match-players.ts` (dove cambia la live), `revalidate-public.ts`.
- **Fatto quando:** aggiungere o togliere un gol, cambiare stato o punteggio di una partita esegue nell'ordine: salvataggio, invalidazione della cache, ricalcolo di `getLiveMatches()`, evento "live cambiata". Verificato che con molte richieste contemporanee dopo l'evento il database riceve una sola lettura.
- **Dipende da:** F2-03, F2-04, F4-05 (consigliato)

### F2-06 · Card live nel browser

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** il punteggio si aggiorna senza ricaricare la pagina.
- **File:** `components/live-match-card.tsx` (diventa componente client o ne contiene uno), `components/live-match-clock.tsx` (resta com'è), un hook condiviso per la connessione SSE.
- **Fatto quando:** alla ricezione di "live cambiata" la card chiama `/api/live` e mostra il nuovo punteggio; al ritorno in primo piano dell'app (`visibilitychange`) e a ogni riconnessione ricarica lo stato; una sola connessione SSE per scheda anche con più componenti in ascolto.
- **Dipende da:** F2-03, F2-04

### F2-07 · Prova di carico

- **Stato:** da fare
- **Tipo:** verificare
- **Obiettivo:** confermare che 200 persone collegate non sono un problema.
- **File:** script in `.perf-audit/` (locale); risultati in `docs/perf/2026-11-tempo-reale.md`.
- **Fatto quando:** con 200 connessioni SSE aperte e un evento "live cambiata" si misurano tempo di consegna dell'evento, tempo di risposta di `/api/live` e numero di query; ripetuto in DEV passando da nginx.
- **Dipende da:** F2-01, F2-05, F2-06
