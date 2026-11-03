# Audit performance — 2026-11-03

Seconda delle tre verifiche (sicurezza → **performance** → qualità del codice). Codice al commit `a0d4686`.

## Metodo

- **Dati:** DB Postgres usa e getta (`fantadc-audit-pg`, porta 5440) con seed di sviluppo più un carico realistico (`.perf-audit/seed-load.ts`, locale, non versionato): 501 utenti, 500 squadre fanta, 24 squadre reali, 144 giocatori, 40 partite (29 concluse), 6.000 voti MVP, 350 presenze. Nessuna fase chiusa, quindi la classifica corrente si calcola su tutte le partite (caso peggiore).
- **Server:** build di produzione (`next start`, un solo processo Node) con `PERF_LOG=1`. `pg_stat_statements` attivo per contare le query per richiesta.
- **Misure:** 10 richieste sequenziali per pagina (cache calda) come ospite, utente e admin; carico con 20 client concorrenti per 8 s; costo del cache miss forzato con `?fase=` sempre diverso.
- **Analisi statica** delegata a opencode (`.perf-audit/static-db.md`, `.perf-audit/frontend.md`), con i punti chiave ricontrollati sul codice e sul server in esecuzione.
- **Limiti:** macchina di sviluppo Windows, DB locale con latenza minima e un solo processo. I numeri assoluti in produzione saranno diversi; contano i rapporti tra pagine e il numero di query.

## Risultati misurati

### Pagine pubbliche (ospite, cache calda)

| Pagina | p50 | HTML | Query DB/richiesta |
|---|---:|---:|---:|
| `/` | 17 ms | 65 KB | 15 |
| `/classifica-fanta` | 17 ms | **441 KB** | 2 |
| `/squadre-fanta` | 19 ms | **366 KB** | 2 |
| `/squadre-fanta/1` | 30 ms | 58 KB | 15 |
| `/giocatori` | 12 ms | 205 KB | 2 |
| `/mvp` | 22 ms | 77 KB | 10 (non in cache) |
| `/partite`, `/gironi`, `/greenvolley` | 8–16 ms | 43–58 KB | 2 |

Le "2 query" fisse su ogni pagina, comprese le 404, sono la lettura di `AppSetting.tournamentConcluded`, fatta due volte: in `proxy.ts` e nel layout.

### Pagine utente e admin (cache calda)

| Pagina | p50 | Query DB/richiesta |
|---|---:|---:|
| `/` (utente loggato) | 24 ms | 25 |
| `/dashboard` | **79 ms** | **47** |
| `/squadra` | **52 ms** | **47** |
| `/vota/1` | 18 ms | 23 |
| `/admin` | 36 ms | 47 |
| `/admin/partite/1` | 24 ms | 27 |
| `/admin/utenti` | 18 ms | 9 (180 KB HTML) |

### Sotto carico (20 client concorrenti, un processo)

| Pagina | req/s | p50 | p95 |
|---|---:|---:|---:|
| `/`, `/classifica-fanta`, `/squadre-fanta` (cache) | 87–97 | ~200 ms | ~310 ms |
| `/classifica-fanta` con cache miss forzato | 58 | 333 ms | 532 ms |
| `/mvp` | 60 | 317 ms | 451 ms |
| `/admin` | 30 | 694 ms | 927 ms |
| `/squadra` | 29 | 717 ms | 1.282 ms |
| `/dashboard` | **22** | **978 ms** | **1.143 ms** |

Tempi medi sotto carico dai log `[perf]`: `computeCumulativeRankings` **389 ms** (421 chiamate), `computeFantasyTeamPoints` 217 ms, `computeStandings` 185 ms, lettura dello snapshot classifica 123 ms.

Il tempo passato nel DB è piccolo: circa 10 ms su `/dashboard`. Il collo di bottiglia è la **CPU del processo Node**: calcoli di punteggio ripetuti a ogni richiesta e rendering di HTML molto grandi.

## Problemi, in ordine di priorità

### Alta priorità

1. **`/dashboard`, `/squadra` e `/admin` ricalcolano l'intera classifica fanta a ogni richiesta.** Saltano lo snapshot (`getFantasyRankingSnapshotOrCompute`) e chiamano `computeCumulativeRankings` e il breakdown per fasi; `/dashboard` lo fa due volte (`app/(user)/dashboard/page.tsx:52-56`). Sono le pagine più visitate dagli utenti loggati e sotto carico scendono a circa 1 s.
   *Correzione:* usare lo snapshot e i loader in cache già esistenti; per la propria squadra calcolare solo i dati di quella squadra.
2. **Immagine del campo da 2,9 MB.** `public/images/football-field.webp` (940×1671) è caricata come `<img>` diretto con `fetchPriority="high"` su `/squadra`, `/squadra/crea`, `/squadra/modifica` e `/squadre-fanta/[id]`. Su mobile pesa sul tempo di comparsa dell'elemento principale della pagina e sul traffico dati.
   *Correzione:* ricomprimerla a circa 100–150 KB oppure usare `next/image`.
3. **La sessione viene riletta dal DB 3-4 volte per richiesta.** Il callback `jwt` (`lib/auth.ts`) gira in `proxy`, nel layout root, nei layout di area e nella pagina, e ogni volta legge `User`.
   *Correzione:* `React.cache()` attorno a `getCurrentUser`/`auth()`, ed eliminare il `requireAdmin` duplicato nei due layout admin.
4. **`AppSetting` letto 2 volte su ogni pagina** (`proxy.ts`, `app/layout.tsx`), introdotto con il flag "torneo concluso".
   *Correzione:* mettere il valore in cache con un tag e invalidarlo nell'action delle impostazioni.

### Media priorità

5. **Pagina MVP non in cache.** `getPublicMvpData` e `getMvpMatchDetail` (`lib/data/public/mvp.ts:46,201`) leggono tutte le partite concluse e tutti i voti a ogni richiesta (10–16 query, 60 req/s).
   *Correzione:* `cachePublicData` con tag, invalidato al voto e all'override MVP.
6. **HTML enormi con 500 squadre.** `/classifica-fanta` (441 KB), `/squadre-fanta` (366 KB), `/giocatori` (205 KB), `/admin/utenti` (180 KB) e `/admin/squadre-fantasy` (159 KB) mostrano tutto in un'unica pagina. Il rendering limita il server a circa 90 req/s anche con la cache calda, e su mobile pesa sul download.
   *Correzione:* paginazione o "top N più ricerca".
7. **`/squadre-fanta/[id]` calcola due volte `getTeamPhaseBreakdown`** (`lib/data/public/fantasy-rankings.ts:113` e `page.tsx:30`): 15 query.
8. **La home fa 15 query (25 da loggato)** con letture dirette invece dei loader in cache, più la query del popup recensione e quella dei voti MVP in sospeso su ogni pagina da loggato.
9. **La navigazione chiama `/api/auth/session` dal client** (`components/public-nav-client.tsx:66`, `squadre-fanta/_rankings.tsx:16`) anche quando il server conosce già l'utente. È una richiesta in più per ogni pagina, che rilegge anche `User` nel callback `jwt`.
10. **Font e CSS globali.**
    - Il tema PrimeReact dichiara un `InterVariable.woff2` da 345 KB, scaricato in più rispetto all'Inter di `next/font` (48 KB) sulle pagine con campi PrimeReact.
    - Tallica è servito in TTF (circa 125 KB) senza preload.
    - Il CSS globale pesa 37,6 KB gzip su ogni pagina.
    *Correzione:* sovrascrivere `--font-family`, convertire Tallica in woff2 e precaricarlo.
11. **Invalidazione troppo ampia.** Ogni scrittura admin del torneo cancella lo snapshot della classifica e invalida 11 path e 8 tag (`app/actions/admin/revalidate-public.ts:38-52`), anche quando cambiano solo dati descrittivi.
12. **Scritture admin poco efficienti.** `addAllMatchPlayers` fa circa 26 upsert in transazione (`match-players.ts:63`); `initBracket` fa scritture in sequenza fuori da una transazione (`knockout.ts:41`). La transazione della modifica rosa tiene il lock `FOR UPDATE` durante 7 query.

### Bassa priorità

- **Indici:** mancano `AdminAuditLog.createdAt` e `User.name`. Con questi volumi l'effetto è trascurabile.
- **`SiteVisit`:** un upsert per ogni visita pubblica (`/api/track`).
- **Asset nel repository:** in `public/` ci sono 25 MB di SVG dei bonus non usati (i serviti sono i `.webp`). Non pesano sugli utenti, ma sul repository e sull'immagine Docker.
- **14 `setState` dentro `useEffect`** (segnalati dal lint): splash, suggerimento MVP e 6 effetti `matchMedia`, che causano un render in più al caricamento.
- **Cache su disco senza limite** tramite `?fase` o id arbitrari: già nel report di sicurezza (P3).

### Verificato, non è un problema

- **`updateTag`** in `revalidate-public.ts` invalida correttamente anche le voci di `unstable_cache`: usa lo stesso meccanismo di `revalidateTag`, con scadenza immediata.
- **Bundle JS:** circa 195 KB gzip condivisi da tutte le pagine (react-dom, runtime Next, PrimeReact core). `DataTable`, `Calendar` e `Dropdown` restano solo nell'area admin.
- **Query SQL:** tutte veloci (millesimi di secondo) con i volumi realistici; non serve intervenire sugli indici principali.

## Ordine di intervento consigliato

1. **Correzioni rapide, ad alto impatto:**
   - punto 2, l'immagine del campo;
   - punti 3 e 4, sessione e `AppSetting` in cache;
   - punto 5, MVP in cache;
   - punto 7, breakdown calcolato una volta sola.
2. **`/dashboard` e `/squadra` sullo snapshot** (punto 1): è il guadagno maggiore sotto carico. Va accompagnato da test sul calcolo dei punteggi.
3. **Paginazione** delle liste grandi (punto 6) e **font** (punto 10).
4. **Invalidazione selettiva e scritture admin** (punti 11 e 12).

Per ogni intervento, rimisurare con gli stessi script (`.perf-audit/measure.mjs`, `.perf-audit/load.mjs`) sul DB di audit.
