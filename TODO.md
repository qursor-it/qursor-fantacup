- Gestire gironi e brackets.
- Migliorare ui votazione
- 

## Roadmap stories e tempo reale (decisa il 2026-11-06)

Ordine: prima la migrazione della cache, poi il tempo reale (che usa la cache), poi le stories (che usano entrambi). Dettagli in `ai_context/realtime.md` e `ai_context/stories.md`.

### 1. Migrazione a Cache Components (Next 16)

- [ ] Misurare prima, per avere un confronto: tempi delle pagine principali anche su rete mobile, con gli script in `.perf-audit/`.
- [ ] Leggere `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md` e `01-getting-started/08-caching.md`.
- [ ] Attivare `cacheComponents: true` in `next.config.ts`.
- [ ] Sostituire `unstable_cache` in `lib/data/public/cache.ts` con `use cache`, `cacheLife` e `cacheTag`, mantenendo le etichette attuali (`PUBLIC_CACHE_TAGS`) e le invalidazioni con `updateTag`.
- [ ] Togliere `export const dynamic` / `export const revalidate` dalle pagine (39 file).
- [ ] Racchiudere in `<Suspense>` le parti che leggono sessione, cookie o dati non in cache (almeno 9 pagine, homepage compresa).
- [ ] Gestire le operazioni che dipendono dall'ora attuale (`getMatchClockNow()` e simili).
- [ ] `npx tsc --noEmit`, `npm run build`, test; rimisurare e confrontare.
- [ ] Aggiornare `ai_context/technical_baseline.md` e `docs/performance-prisma-caching-plan.md`.

### 2. Aggiornamenti in tempo reale (SSE)

- [ ] Trovare sul server la configurazione nginx di fantadc e portarla in `qursor-it/qursor-infrastructure`.
- [ ] Nginx per fantadc: `proxy_buffering off`, valutare `http2`, timeout compatibile con il heartbeat (o timeout lungo solo sulla route SSE).
- [ ] `getLiveMatches()` in cache con l'etichetta delle partite, usata da homepage ed endpoint `GET /api/live`.
- [ ] Route SSE in Next: elenco delle connessioni nel processo, invio degli eventi a tutte, heartbeat sotto i 60 secondi.
- [ ] Azioni admin che cambiano la live (gol, stato partita): svuotano la cache, la ricalcolano una volta, poi mandano il segnale SSE.
- [ ] Homepage: dati pubblici dalle funzioni in cache, solo i dati dell'utente calcolati a ogni richiesta.
- [ ] `LiveMatchCard` come componente client: al segnale chiama `/api/live`; ricarica lo stato anche al rientro dell'app in primo piano e alla riconnessione.
- [ ] Verificare che la compressione di Next non trattenga gli eventi SSE.
- [ ] Decidere: quali eventi esistono, su quali pagine ci si collega, limite di connessioni per IP o utente.

### 3. Stories

Fondamenta
- [ ] Ruolo caposquadra: assegnato da un admin, collegato a una `FootballTeam`.
- [ ] Modelli Prisma: story (stato in caricamento/pubblicata, scadenza di caricamento, percorso del file, posizione del file R2/in spostamento/Hetzner, data di pubblicazione), visualizzazioni (utente o ospite anonimo), reazioni, segnalazioni, data dell'ultima esecuzione dei job. Limiti garantiti dal database (vincoli di unicità).
- [ ] Storage: bucket R2 pubblico in lettura con dominio personalizzato e CORS per il caricamento; bucket Hetzner privato per l'archivio; chiavi solo sul server; storage per lo sviluppo locale.

Pubblicazione
- [ ] Richiesta di pubblicazione (passo 3): controlli di ruolo, regole e limiti, creazione della story "in caricamento" con scadenza, URL firmato PUT legato a percorso e tipo; nuovo URL per la stessa story solo prima della scadenza.
- [ ] Conferma (passi 5-6): `HEAD` su R2, dimensione reale nei limiti, file scritto prima della scadenza; conferma ripetibile.
- [ ] Stories "in caricamento" scadute sistemate da Next al momento (al passo 3 e alla conferma).
- [ ] Media Composer: sostituire il mock di `MediaUploadService` con il flusso reale e il dialog bloccante con avanzamento ed errori; video consentito solo ad admin e capisquadra, controllato sul server.

Visualizzazione
- [ ] API del feed con solo le stories attive (filtro delle 24 ore sul backend), visibile anche ai guest; pagina non indicizzata.
- [ ] Segnale SSE "nuova story" e ricarica della lista.
- [ ] Visualizzazioni: utenti per nome, ospiti come totale ("+12 ospiti") con identificativo anonimo nel browser.
- [ ] Reazioni e segnalazioni solo per utenti loggati; elenco delle segnalazioni nell'area admin.

Moderazione e ciclo di vita
- [ ] Eliminazione admin con audit log, file tolto da R2 o da Hetzner; stessa cosa per account sospeso o cancellato.
- [ ] Timer interno a Next che controlla la data dell'ultima esecuzione e lancia i job.
- [ ] Job giornaliero: pulizia delle stories "in caricamento" rimaste e archiviazione su Hetzner (copia in streaming, verifica, aggiornamento del database, cancellazione da R2).
- [ ] Regola di scadenza automatica su R2 come rete di sicurezza (verificare).
- [ ] Archivio per gli admin a fine torneo: vedere, selezionare, scaricare.

Testi e decisioni ancora aperte
- [ ] Dichiarazione di non responsabilità (visibilità a chiunque, conservazione nell'archivio, riuso), regolamento, pagina privacy (compreso l'identificativo anonimo degli ospiti).
- [ ] Chiudere i punti aperti elencati in fondo a `ai_context/stories.md` (dimensione massima dei file, emoji, cancellazione da parte dell'autore, condivisione, download dall'archivio, durata dell'archivio, moderazione durante lo spostamento, licenze della musica).
