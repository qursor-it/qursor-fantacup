# F1 · Migrazione a Cache Components

Decisione: `docs/adr/0008-cache-components-prima-del-tempo-reale.md`.

Obiettivo della fase: passare dal modello di cache precedente (`unstable_cache`, `export const dynamic` / `revalidate`) al modello Cache Components di Next 16 (`cacheComponents: true`, `use cache`, `cacheLife`, `cacheTag`), senza cambiare il comportamento visibile e misurando prima e dopo.

Guide di riferimento (in `node_modules/next/dist/docs/01-app/`):
- `02-guides/migrating-to-cache-components.md`
- `01-getting-started/08-caching.md`
- `03-api-reference/01-directives/use-cache.md`, `04-functions/cacheLife.md`, `04-functions/cacheTag.md`, `04-functions/updateTag.md`

### F1-01 · Misurare lo stato attuale

- **Stato:** da fare
- **Tipo:** verificare
- **Obiettivo:** avere numeri di partenza da confrontare dopo la migrazione.
- **Chi:** un agente in locale sul PC di sviluppo (servono Docker per il Postgres di audit, la build di produzione e Chrome per le misure da mobile). Vale anche per F1-07.
- **Leggere prima:** `docs/audit-performance-2026-11-03.md` (sezione Metodo).
- **File:** `.perf-audit/` (locale, non versionato: `measure.mjs`, `load.mjs`, `seed-load.ts`); risultati in `docs/perf/2026-11-cache-components-prima.md`.
- **Fatto quando:**
  - tempi lato server e numero di query per `/`, `/classifica-fanta`, `/squadre-fanta`, `/mvp`, `/dashboard`, `/squadra` (ospite e loggato), con lo stesso DB di audit;
  - tempi percepiti da mobile (Chrome DevTools, profilo rete mobile, emulazione telefono): comparsa del primo contenuto e dell'elemento principale per le stesse pagine;
  - risultati scritti nel file indicato.
- **Dipende da:** —

### F1-02 · Inventario delle modifiche

- **Stato:** da fare
- **Tipo:** verificare
- **Obiettivo:** sapere esattamente cosa toccare prima di iniziare.
- **File:** elenco aggiunto in fondo a questo file.
- **Fatto quando:** esiste l'elenco di:
  - i file con `export const dynamic` o `export const revalidate` (39 al 2026-11-06);
  - le pagine e i layout che leggono sessione, cookie, header o `searchParams` (almeno 9);
  - le funzioni che dipendono dall'ora attuale (`getMatchClockNow()` in `lib/domain/match.ts` e simili) o da valori casuali;
  - le route GET (`app/api/**`) e il loro comportamento atteso, perché con Cache Components seguono lo stesso modello delle pagine;
  - gli usi di `unstable_cache` (`lib/data/public/cache.ts` e chi lo chiama).
- **Dipende da:** —

### F1-03 · Attivare Cache Components e migrare lo strato di cache dei dati

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** `cachePublicData` basato su `use cache` invece di `unstable_cache`, con le stesse etichette.
- **File:** `next.config.ts`, `lib/data/public/cache.ts` e i loader in `lib/data/public/*.ts`, `app/actions/admin/revalidate-public.ts`.
- **Fatto quando:**
  - `cacheComponents: true` è attivo;
  - i loader pubblici usano `use cache` con `cacheTag` (stesse etichette di `PUBLIC_CACHE_TAGS`) e `cacheLife` (equivalenti a `PUBLIC_CACHE_TTL_SECONDS`: live 60 s, stable 300 s);
  - le invalidazioni con `updateTag` nelle azioni admin continuano a funzionare (verificato a mano: modifica in admin → pagina pubblica aggiornata);
  - verificato se `revivePublicDates` serve ancora con il nuovo modello, e tolto se non serve.
- **Dipende da:** F1-02

### F1-04 · Pagine pubbliche

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** togliere `dynamic` e `revalidate` dalle pagine pubbliche e sistemare gli errori che la build segnala.
- **File:** `app/(public)/**`, `app/(bare)/**`.
- **Fatto quando:** nessuna pagina pubblica esporta `dynamic` o `revalidate`; la build passa; le pagine mostrano gli stessi dati di prima; le parti che dipendono da utente o ora sono in `<Suspense>`.
- **Dipende da:** F1-03

### F1-05 · Homepage, pagine utente e admin

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** pagine che leggono la sessione con la parte fissa mandata subito e i dati dell'utente in `<Suspense>`.
- **File:** `app/page.tsx`, `app/(user)/**`, `app/(admin)/**`, `app/profilo/**`, layout relativi.
- **Fatto quando:**
  - nessun `force-dynamic` rimasto;
  - la homepage legge partite live, prossime partite, gironi e marcatori da loader in cache, e solo i dati dell'utente (voti MVP in sospeso, popup recensione) a ogni richiesta (risolve anche il punto 8 dell'audit performance);
  - `getMatchClockNow()` e le altre operazioni sull'ora sono gestite come indica la guida (per esempio `connection()`), senza mettere in cache l'ora;
  - la protezione delle pagine admin (`requireAdmin`) funziona come prima.
- **Dipende da:** F1-03

### F1-06 · Route API

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** le route GET si comportano come prima (nessuna risposta messa in cache per errore).
- **File:** `app/api/**` (`track`, `story/[teamId]`, `auth`, `media/mock-upload`).
- **Fatto quando:** ogni route è verificata a mano dopo la build di produzione; l'immagine story per squadra e `/api/track` restituiscono dati aggiornati.
- **Dipende da:** F1-03

### F1-07 · Rimisurare e documentare

- **Stato:** da fare
- **Tipo:** verificare
- **Obiettivo:** sapere cosa è migliorato e lasciare il progetto documentato.
- **File:** `docs/perf/2026-11-cache-components-dopo.md`, `ai_context/technical_baseline.md`.
- **Fatto quando:** stesse misure di F1-01 ripetute e confrontate; `technical_baseline.md` descrive il nuovo modello di cache; un admin ha provato le modifiche più comuni (gol, stato partita, bonus) e le pagine pubbliche si aggiornano.
- **Dipende da:** F1-04, F1-05, F1-06
