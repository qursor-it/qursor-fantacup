# Più tornei sullo stesso codice

Decisione del 2026-11-03. Il progetto dovrà gestire almeno due tornei, anche in contemporanea.

## Requisiti raccolti

- **Comunità separate:** gli utenti di un torneo non usano l'altro, quindi non serve un account unico.
- **Stesso gioco:** fantacalcio molto simile.
- **Regole:** differenze solo di configurazione (valori), non meccaniche diverse.
- **Tempi:** i tornei possono svolgersi in contemporanea.
- **App negli store:** ognuno ha la sua app, diversa dalle altre. Le app sono PWA impacchettate con PWABuilder e non esistono progetti nativi da mantenere.
- **Interfaccia:** può differire tra tornei. Quali sezioni cambieranno non è ancora noto.

## Decisione: un codice, un'installazione per torneo

Un solo repository e una sola build. Ogni torneo ha il suo deploy, con database, variabili d'ambiente, dominio, job Jenkins e app negli store propri.

Il perché e le alternative scartate (multi-tenant, motore condiviso con due app, copia del repository) sono in `docs/adr/0001-installazione-per-torneo.md`.

## Come funziona

### Configurazione per torneo

- Il torneo si sceglie al momento della build con `NEXT_PUBLIC_TOURNAMENT`; se manca vale `dcup`. Si sceglie al build, non all'avvio, perché nome, colori e manifest finiscono anche nel codice del browser. Ogni torneo ha quindi la sua immagine Docker, costruita dallo stesso commit.
- `tournaments/index.ts`:
  - contiene il tipo `TournamentConfig`, che ogni torneo deve rispettare per intero, e l'elenco dei tornei;
  - espone `tournament`;
  - con un id sconosciuto genera un errore.
- `tournaments/<id>.ts` contiene:
  - **`site`:** nome, nome breve, descrizione, colori del tema, logo, icona, edizione, scritta su più righe per lo splash, scorciatoie della PWA;
  - **`appStore`:** nome dell'app e link ad App Store e Google Play;
  - **`rules`:** portieri, giocatori di movimento (la rosa ne è la somma), moltiplicatore del capitano, finestra di voto MVP in minuti, punti MVP di default.
- `lib/site.ts` espone `siteConfig` e `appStoreConfig`, ricavati dalla configurazione. Nelle pagine non vanno scritti a mano nome, logo o regole del torneo.
- Bonus e malus sono già nel database (`BonusType`), quindi ogni torneo ha i suoi senza bisogno di configurazione.

### Differenze di interfaccia

Come fare pagine esclusive, versioni di pagina per torneo e ritocchi grafici è spiegato in `tournament_ui.md`. In sintesi:
- **Pagina presente in un solo torneo:** un flag in `features`, controllato con `notFound()` nella pagina oppure in `proxy.ts` per un'intera sezione.
- **Stessa pagina, versione diversa:** la pagina in `app/` sceglie il componente di `tournaments/<id>/pages/`, oppure quello comune.
- **Solo ritocchi grafici:** variabili CSS dalla configurazione e `data-tournament` sull'`<html>`.

Si parte con tutto in comune e si separa solo quando una differenza reale lo richiede. Se quasi tutte le pagine divergessero, conviene rivalutare l'opzione del motore condiviso.

### Aggiungere un nuovo torneo

1. Crea `tournaments/<id>/config.ts` con identità, regole e `features`, e aggiungilo all'elenco in `tournaments/index.ts`.
2. Metti logo, icone e immagini in `tournaments/<id>/public/`, con gli stessi nomi di file del DCup dove si sostituiscono.
3. Aggiungi le eventuali versioni di pagina in `tournaments/<id>/pages/` (vedi `tournament_ui.md`).
4. Prepara il deploy con `NEXT_PUBLIC_TOURNAMENT=<id>`, che comprende:
   - un database proprio;
   - le credenziali Jenkins proprie (file env, admin, chiavi VAPID per le notifiche push);
   - un dominio proprio.
5. Dopo il primo deploy, genera l'app con PWABuilder dal dominio del torneo e aggiorna `tournaments/<id>/public/.well-known/assetlinks.json` con il package e la fingerprint della nuova chiave.
6. Crea in admin i bonus e i malus (`BonusType`) del torneo.
7. Controlla i comandi di verifica in `tournament_ui.md`, eseguendo la build per ogni torneo.

### App negli store (PWABuilder)

Per ogni torneo:
1. Deploy sul suo dominio, che fornisce il suo manifest e le sue icone.
2. Generazione con PWABuilder partendo da quel dominio, con un package proprio (es. `it.<organizzazione>.<torneo>`).
3. `.well-known/assetlinks.json` con il package e la fingerprint della chiave di quel torneo.

La chiave di firma Android generata da PWABuilder va conservata: senza, l'app non si può più aggiornare sullo stesso package.

## Stato e prossimi passi

Le attività ancora da fare sono task della fase F6 in `docs/roadmap/06-multi-torneo.md`.

1. **Fatto (`35d5803`):** configurazione per torneo, con identità e regole spostate in `tournaments/dcup.ts`. Il comportamento del DCup è invariato.
2. **Da fare:** colori del marchio dalla configurazione (F6-04), struttura per torneo e sezioni attivabili (F6-02, F6-03), Docker Compose e Jenkins per torneo (F6-05, F6-06), nginx (F6-07), regolamento per torneo (F6-08), secondo torneo in produzione (F6-09).

Stories e aggiornamenti in tempo reale valgono per tutti i tornei.

La configurazione è divisa in tre livelli (`docs/adr/0010-configurazione-in-tre-livelli.md`): infrastruttura nelle variabili d'ambiente; identità (nome, colori, logo, immagini, sezione pallavolo) in `tournaments/<id>`; regole e contenuti (regole del fantacalcio, limiti delle stories, regolamento in PDF) nel database, modificabili dagli organizzatori da `/admin/impostazioni` (fase F7). Finché F7 non è fatta, le regole restano in `tournaments/<id>`.

## Secondo torneo: FacolCup

Dati raccolti finora (F6-01 in `docs/roadmap/06-multi-torneo.md`):

- **Nome:** FacolCup. Id proposto: `facolcup`.
- **Pallavolo:** ha la sua sezione di pallavolo, **FacolVolley**, equivalente a GreenVolley del DCup. La sezione volley quindi non è solo da accendere o spegnere: nome, colori e logo cambiano per torneo.

- **URL della sezione pallavolo:** configurabili per torneo (`/greenvolley/*` per il DCup, per esempio `/facolvolley/*` per la FacolCup), vedi F6-10.
- **Regolamento:** PDF caricato dagli organizzatori e salvato su un volume Docker persistente; la pagina mostra un pulsante che lo apre. Sostituisce anche la pagina HTML del DCup (F6-08, F6-11).

Ancora da raccogliere: dominio, date, regole del fantacalcio (se diverse dal DCup), colori, logo e icone, differenze nel regolamento, dati dell'app negli store, regole della pallavolo se diverse.

## Ancora specifico del DCup

- **Regolamento:** il testo della pagina è scritto a mano. Diventerà un PDF caricato dagli organizzatori (F6-08, F6-11).
- **Green volley:** nome, colore (`#3DD907`, classe `.gv-theme`), logo e URL (`/greenvolley/*`, `/admin/greenvolley/*`) sono scritti per il DCup in una quarantina di file. I modelli dati (`Volley*`) sono già generici. Da rendere configurabili in F6-03.
- **Colori:** sono scritti a mano nelle pagine finché non si fa F6-04.
