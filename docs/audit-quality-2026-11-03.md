# Audit qualità del codice — 2026-11-03

Terza delle tre verifiche (sicurezza → performance → **qualità**). Codice al commit `a0d4686`. I problemi di sicurezza (`~/security-audit-skill/qursor-fantacup/run-1/REPORT.md`) e di performance (`docs/audit-performance-2026-11-03.md`) non vengono ripetuti qui.

**Cosa fa il repository:** è una web app (PWA) per il fantacalcio di un piccolo torneo amatoriale, la "Danimarca's Cup", con una sezione per il torneo di pallavolo "greenvolley". Gli utenti creano una rosa di 5 giocatori e votano l'MVP di ogni partita; gli admin inseriscono partite, gol, bonus e fasi di punteggio, da cui si calcolano le classifiche. **Carico considerato:** qualche centinaio di utenti, più admin che lavorano insieme durante le partite, un solo server Node.

**Metodo:** quattro analisi delegate a opencode (logica di dominio, server action, UI, codice morto e tooling). I punti principali li ho ricontrollati io sul codice, con grep e sul server in esecuzione. Una segnalazione si è rivelata **falsa** ed è esclusa: la pagina `/admin/bonus-types` non è rotta, perché il `Decimal` arriva al client come stringa. I test esistenti (158) passano tutti.

## Da correggere subito

**1. Modificare una partita cancella il risultato o viene rifiutato** (`app/actions/admin/matches.ts:197-233`, `app/(admin)/admin/partite/[id]/_edit-form.tsx`)
- **Cos'è:** `updateMatch` salva il form di modifica di una partita (squadre, data, stato).
- **Problema:** il form non invia il punteggio, quindi l'action lo considera vuoto. Partita con gol registrati: qualunque modifica, anche solo dell'orario, viene rifiutata con "Il risultato è calcolato dai marcatori…". Partita senza gol con risultato inserito a mano: modificando l'orario, il risultato viene cancellato. Partita conclusa: non si può più cambiare né la data né lo stato.
- **Correzione:** aggiornare `homeScore` e `awayScore` solo quando il form li invia (`parsed.data.homeScore !== undefined`); altrimenti tenere i valori già salvati.
- **Se lo saltiamo:** gli admin perdono risultati o restano bloccati durante il torneo.

**2. Cancellare l'ultimo gol lascia una partita conclusa senza risultato** (`app/actions/admin/goals.ts`, `syncMatchScore`)
- **Cos'è:** aggiungere o togliere un gol ricalcola il risultato della partita.
- **Problema:** se si toglie l'unico gol di una partita conclusa, il risultato diventa nullo ma la partita resta "conclusa". Inoltre la scrittura del gol e l'aggiornamento del risultato non sono in un'unica transazione (un blocco "tutto o niente"): un errore a metà lascia il risultato diverso dalla lista dei gol.
- **Correzione:** fare le due scritture in `db.$transaction`, e con zero gol su una partita conclusa impostare 0-0.
- **Se lo saltiamo:** partite concluse senza risultato, che poi non si possono più modificare (vedi punto 1).

**3. Un doppio clic su "chiudi fase" raddoppia i punti** (`lib/scoring-phases.ts:50-107`, `prisma/schema.prisma:293`)
- **Cos'è:** chiudere una fase salva in modo definitivo i punti di ogni squadra.
- **Problema:** due chiusure contemporanee (doppio clic, o due admin) leggono la stessa ultima fase e creano due fasi con gli stessi punti. La classifica generale somma tutte le fasi, quindi quei punti contano due volte. Il campo `order` non è unico, quindi niente impedisce il doppione.
- **Correzione:** aggiungere `@@unique([order])` su `ScoringPhase` e rileggere l'ultima fase dentro la transazione, oppure usare un lock con `pg_advisory_xact_lock`.
- **Se lo saltiamo:** un clic di troppo rovina la classifica generale, e l'unico rimedio (cancellare la fase) riapre i punti già congelati.

**4. L'MVP vale 3 punti nel codice, ma il regolamento ne promette 5** (`lib/domain/mvp.ts:6`, `app/(public)/regolamento/page.tsx:60,71`, `app/(admin)/admin/partite/[id]/page.tsx:98`)
- **Cos'è:** il punteggio dell'MVP viene dal tipo bonus `MVP`, con 3 come valore di riserva; anche `ai_context/domain_rules.md` dice 3.
- **Problema:** il seed non crea il tipo bonus `MVP`, quindi vale 3. Il regolamento pubblico e la pagina admin dicono invece 5.
- **Correzione:** decidere un valore unico e allineare testi, seed e `domain_rules.md`. Se si tiene 3, basta correggere due testi.
- **Se lo saltiamo:** gli utenti vedono punti diversi da quelli promessi.

**5. I "migliori marcatori" di una squadra contano gli autogol** (`lib/data/public/teams.ts:101-107`)
- **Cos'è:** la pagina della squadra mostra i 5 migliori marcatori.
- **Problema:** la query non esclude gli autogol e non controlla che la partita sia conclusa. Un giocatore con un solo autogol compare tra i marcatori della sua squadra, ma non nella classifica marcatori. Un gol inserito su una partita non ancora giocata (`goals.ts` non controlla lo stato) conta nei totali del giocatore.
- **Correzione:** aggiungere `isOwnGoal: false` e `match: { status: "CONCLUDED" }` nella query, e rifiutare i gol su partite non avviate.
- **Se lo saltiamo:** numeri diversi tra pagine che dovrebbero coincidere.

**6. Volley: si possono rompere risultati e tabellone già giocati** (`app/actions/admin/volley.ts:104,247,306-383,401,485`)
- **Cos'è:** le action admin della pallavolo.
- **Problema:** a differenza del calcio, si può cancellare una partita conclusa, un girone con partite giocate o un turno del tabellone, e tutto sparisce in cascata senza avviso. Si possono anche aggiungere o modificare set su una partita conclusa: da 1-0 diventa 1-1, la partita resta "conclusa" senza vincitore e la classifica cambia.
- **Correzione:** copiare i controlli del calcio, cioè rifiutare le cancellazioni se ci sono partite giocate e rifiutare le modifiche ai set quando la partita è conclusa.
- **Se lo saltiamo:** classifica e tabellone volley si possono rompere per errore.

**7. Dopo una correzione, lo storico di una fase chiusa non torna con il totale** (`lib/scoring.ts:327-352` contro `lib/scoring.ts:409-567`, `app/api/story/[teamId]/route.tsx:115-145`)
- **Cos'è:** il totale di una fase chiusa è congelato, mentre lo storico partita per partita viene ricalcolato ogni volta.
- **Problema:** se un admin corregge un bonus in una fase chiusa (le regole lo permettono), la scheda mostra punti per partita che sommano a 12 mentre il totale resta 10. Anche l'immagine "story" dopo il mercato mostra righe che non sommano al TOTALE, perché elenca solo la rosa attuale.
- **Correzione:** per le fasi chiuse mostrare solo il numero congelato; nella story aggiungere una riga "altri / pre-mercato" con la differenza.
- **Se lo saltiamo:** gli utenti vedono numeri che non tornano e lo segnalano.

## Da correggere

**8. Mancano test proprio dove un errore costa di più** (`lib/standings.ts`, `lib/scoring-phases.ts`, `lib/fantasy-ranking-snapshot.ts`)
- **Cos'è:** classifica dei gironi con spareggi, chiusura delle fasi, regola che decide quando ricalcolare lo snapshot della classifica.
- **Problema:** nessuno dei tre ha un test. Un cambio agli spareggi o alla regola di freschezza dello snapshot passerebbe inosservato. In più la regola di chiusura fase è mescolata alle letture dal DB, quindi oggi non si può testare.
- **Correzione:** un test per `computeStandings` con un pari merito a tre squadre, uno per `hasMvpWindowClosedSince` e, separando la regola dalla query, uno per il controllo di chiusura fase.
- **Se lo saltiamo:** i bug dei punti 3 e 7 si ripresentano senza che nessuno se ne accorga.

**9. Circa 950 righe di codice morto** (verificato con grep su tutto il repository)
- **Cos'è:** 8 file UI mai importati: `app/(public)/partite/_matches.tsx`, `app/(public)/mvp/_mvp-views.tsx`, `app/(public)/squadre/_accordion.tsx`, `app/(admin)/admin/partite/[id]/_assign-bonus-form.tsx`, `_score-form.tsx`, `app/(user)/squadra/_roster-table.tsx`, `_score-table.tsx`, `components/stat-card.tsx`. Più alcune funzioni esportate e mai usate: `computeRankings`, `computeAllGroupsStandings`, `renameScoringPhase`, `createAdmin`, e `computeMvpWinnerId`, che sopravvive solo nei test e applica regole diverse da `resolveMvp`.
- **Problema:** chi corregge la pagina partite può modificare il file morto e non vedere cambiare nulla, perché quella vera è `_partite-client.tsx`.
- **Correzione:** cancellarli insieme ai relativi test.
- **Se lo saltiamo:** confusione e tempo perso a ogni modifica.

**10. Le action volley accettano dati non validi** (`app/actions/admin/volley.ts`, righe con `as string` e `Number()`)
- **Cos'è:** il resto delle action admin usa zod (una libreria che controlla i dati in ingresso); quelle volley no.
- **Problema:** un numero vuoto o testuale diventa `NaN` o 0 e finisce nel DB o in un errore Prisma grezzo. Inoltre `addVolleySet` prima conta i set e poi ne crea uno: con due salvataggi contemporanei si superano i 5 set o si duplica il numero del set.
- **Correzione:** schemi zod come in `matches.ts`, e un vincolo unico `(matchId, setNumber)` sui set.
- **Se lo saltiamo:** dati sporchi nella pallavolo.

**11. Scritture in più passaggi senza transazione** (`app/actions/admin/matches.ts` `createMatch`, `app/actions/admin/roster-edit-window.ts:52-58`, varie action con `logAdminAction`)
- **Cos'è:** creare una partita più i suoi giocatori; chiudere una fase più aprire il mercato; modifica più riga nel log admin.
- **Problema:** se il secondo passaggio fallisce, il primo resta: per esempio una partita senza giocatori, o una fase chiusa senza mercato aperto. Inoltre il log admin a volte viene scritto prima e a volte dopo la modifica.
- **Correzione:** `db.$transaction` per ogni coppia, con il log dentro la stessa transazione.
- **Se lo saltiamo:** dati a metà, da correggere a mano.

**12. La stessa logica copiata più volte, e le copie già divergono** (`app/actions/admin/matches.ts`, `knockout.ts`, `match-players.ts`)
- **Cos'è:** "allinea i giocatori della partita alle squadre" esiste in 3 copie che si comportano già in modo diverso. Lo stesso vale per 7 validatori di id (`isValidId`, `parsePositiveId`, `isPositiveId`…), 6 hook `matchMedia`, 8 componenti bandiera/logo squadra e 4 varianti del pulsante indietro.
- **Problema:** correggere un bug in una copia lascia il bug nelle altre.
- **Correzione:** tenerne una per tipo, per esempio una sola funzione `syncMatchPlayers` in `lib/` e un solo `parseId` in `lib/`, e sostituire le altre. Il codice totale diminuisce.
- **Se lo saltiamo:** comportamenti diversi per la stessa azione.

**13. La pipeline pubblica senza controllare niente** (`Jenkinsfile`, `Jenkinsfile_prod`)
- **Cos'è:** il deploy su DEV e produzione.
- **Problema:** non lancia né lint, né `tsc`, né i test. Oggi ci sono 19 errori ESLint che nessuno blocca, e un test rotto andrebbe in produzione.
- **Correzione:** uno step con `npm ci && npx tsc --noEmit && npm test && npm run lint` prima del build Docker, dopo aver sistemato i 19 errori di lint (punto 17).
- **Se lo saltiamo:** gli errori si scoprono in produzione.

**14. Immagine Docker e deploy DEV fragili** (`Dockerfile`, `Jenkinsfile:65`)
- **Cos'è:** come si costruisce e si aggiorna l'app.
- **Problema:** `npm install` invece di `npm ci`, quindi le versioni possono cambiare tra un build e l'altro. Le dipendenze di sviluppo finiscono nell'immagine, e il processo gira come root. Il DEV usa `prisma db push --accept-data-loss`, che può cancellare dati sul volume persistente.
- **Correzione:** `npm ci`, aggiungere `npm prune --omit=dev` dopo il build e `USER node`; in DEV `prisma migrate deploy` come in produzione.
- **Se lo saltiamo:** build non ripetibili e dati DEV persi a un cambio di schema.

**15. `ai_context/` non corrisponde più al codice** (`ai_context/prisma_model.md` contro `prisma/schema.prisma`)
- **Cos'è:** `AGENTS.md` dice di usare `ai_context/` come riferimento per il modello dati.
- **Problema:** a `prisma_model.md` mancano 6 o più modelli dello schema attuale (per esempio volley, snapshot, mercato). Chi lo usa come riferimento progetta su dati sbagliati.
- **Correzione:** rigenerarlo dallo schema attuale, oppure scrivere che lo schema Prisma fa fede e tenere in `ai_context` solo le regole.
- **Se lo saltiamo:** chi lavora sul progetto parte da informazioni vecchie.

**16. Peso inutile nel repository** (`public/`, `.claude/`, `.codex/`, `package.json`)
- **Cos'è:** file e dipendenze che non servono all'app.
- **Problema:**
  - 28,9 MB di asset mai referenziati: 23 SVG dei bonus (quelli usati sono `.webp`), `inspo_*.png` e altri;
  - 8 file `__pycache__` versionati nelle cartelle delle skill;
  - `@auth/prisma-adapter`, mai importato;
  - `@types/bcryptjs`, inutile perché `bcryptjs` v3 ha già i suoi tipi.
  Tutto questo finisce nel clone e nell'immagine Docker.
- **Correzione:** cancellare gli asset non usati, aggiungere `__pycache__` a `.gitignore`, `npm uninstall` delle due dipendenze.
- **Se lo saltiamo:** repository e immagine più pesanti senza motivo.

**17. Due errori di lint che sono veri bug** (`app/(admin)/admin/bonus-types/_table.tsx:117`, `app/(user)/vota/[id]/page.tsx:117,138`)
- **Cos'è:** dei 19 errori ESLint, la maggior parte è solo stile; questi due no.
- **Problema:** passando da una riga all'altra della tabella bonus, il form mostra per un attimo i valori della riga precedente. In `/vota/[id]` alcuni componenti sono definiti dentro il render, quindi vengono ricreati a ogni aggiornamento e perdono il loro stato.
- **Correzione:** per la tabella, una `key` sul form legata all'id della riga, al posto del `setState` nell'effect; per `/vota`, spostare i componenti fuori dalla funzione.
- **Se lo saltiamo:** piccoli difetti visibili, e il lint resta sempre rosso.

**18. Il menu ricarica la sessione dal client e per un attimo mostra "non loggato"** (`components/public-nav-client.tsx:66`, `app/(public)/squadre-fanta/_rankings.tsx:16`)
- **Cos'è:** il menu chiede `/api/auth/session` dopo il caricamento della pagina.
- **Problema:** il server sa già chi è l'utente, ma il menu parte come ospite e poi cambia: un flash visibile, più una richiesta e una lettura dal DB in più.
- **Correzione:** passare l'utente dal layout server al componente come prop.
- **Se lo saltiamo:** un difetto visibile a ogni caricamento.

## Miglioramenti

**19. Pulsanti senza nome accessibile e regola PrimeReact ignorata** (74 `<button>` grezzi in 42 file)
- **Cos'è:** `AGENTS.md` chiede `Button` di PrimeReact.
- **Problema:** 6 pulsanti con sola icona non hanno un nome, quindi uno screen reader dice solo "pulsante". Il resto è incoerenza di stile.
- **Correzione:** `aria-label` sui 6 pulsanti con icona. Gli altri si convertono quando si tocca quel file, senza una passata apposita.
- **Se lo saltiamo:** accessibilità ridotta per pochi utenti.

**20. Date MVP in UTC e arrotondamenti diversi** (`components/mvp-vote-banner.tsx:45`, pagine squadra contro classifiche)
- **Cos'è:** il banner raggruppa le votazioni per giorno; le pagine squadra mostrano i totali.
- **Problema:** il giorno è calcolato in UTC, quindi una partita finita alle 00:30 italiane viene messa nel giorno prima. Le pagine squadra arrotondano i punti a interi, mentre le classifiche mostrano i decimali.
- **Correzione:** `timeZone: "Europe/Rome"`, e un solo formatter dei punti.
- **Se lo saltiamo:** piccole incoerenze visive.

Ho lasciato fuori circa 10 segnalazioni minori: date formattate a mano in 33 punti, `"use client"` superflui, header di pagina duplicati, piccoli `Promise.all` mancanti e altri dettagli.

**Verdetto:** l'impianto è sano (permessi, test di dominio, struttura dei dati), ma prima di nuove funzioni vanno sistemati i punti **1, 2, 3 e 6**, che toccano risultati e classifiche durante il torneo, e va aggiunto il controllo in pipeline (13).

**Codice da eliminare:** circa -1.100 righe e -2 dipendenze, più 28,9 MB di asset.

**Non controllato:** non ho letto riga per riga tutte le pagine admin e pubbliche (le liste complete sono in `.quality-audit/q*.md`), né la logica degli script `scripts/` e dei seed. Non ho eseguito le action contro il DB; i bug 1, 2 e 5 sono confermati leggendo il codice, gli altri vengono dall'analisi di opencode ricontrollata sui file citati.
