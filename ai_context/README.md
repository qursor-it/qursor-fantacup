# AI Context Index

Questa cartella contiene il contesto condiviso del progetto.
Non e un planning operativo: serve a descrivere prodotto, dominio, regole, flussi, baseline tecnica e decisioni ancora aperte.

## Ordine di lettura consigliato

1. `product.md`
2. `domain_rules.md`
3. `roles_permissions.md`
4. `user_flows.md`
5. `db.md`
6. `prisma_model.md`
7. `technical_baseline.md`
   - `multi_tournament.md`
   - `tournament_ui.md`
   - `stories.md`
   - `media_composer.md`
8. `open_questions.md`
9. `open_questions/decisioni_core.md`

## File principali

### `product.md`

Visione del prodotto, obiettivi MVP, perimetro iniziale, assunzioni correnti e glossario del dominio.

### `domain_rules.md`

Regole di dominio consolidate. Qui vivono i vincoli funzionali principali del fantacalcio: rosa, capitano, voto MVP, classifica, admin e visibilita pubblica.

### `roles_permissions.md`

Mappa dei ruoli applicativi e dei relativi permessi: `Guest`, `Registered User`, `Admin`.

### `user_flows.md`

Flussi applicativi principali lato pubblico, utente e admin. E il riferimento piu utile per progettare pagine, API e casi d'uso.

### `db.md`

Baseline del dominio dati ad alto livello. Descrive entita, relazioni, vincoli chiave e significato funzionale dei modelli.

### `prisma_model.md`

Schema Prisma documentale di riferimento. Include il modello atteso con capitano, giocatori presenti in partita, audit log, ruoli utente e stati partita.

### `technical_baseline.md`

Stack corrente, principi architetturali e aree applicative suggerite.

### `multi_tournament.md`

Decisione e funzionamento della gestione di più tornei sullo stesso codice: un'installazione per torneo, configurazione in `tournaments/<id>.ts`, livelli di differenza della UI, app PWABuilder, passi fatti e da fare.

### `tournament_ui.md`

Guida pratica per pagine presenti in un solo torneo, versioni di pagina per torneo e ritocchi grafici, con esempi e comandi di verifica.

### `stories.md`

Decisione sulla sezione stories (foto e video in stile Instagram): chi pubblica, limiti, moderazione admin, ruolo caposquadra e backend in Next.

### `media_composer.md`

Editor di foto e video lato client (pubblicazione solo simulata): architettura, codifica, limiti dei browser, come aggiungere sticker e musica, come sostituire il mock, checklist di test manuale.

### `open_questions.md`

Elenco ridotto dei soli punti ancora aperti dopo la chiusura delle decisioni macro. E il file da consultare prima del planning completo se servono ultime conferme.

## Sottocartelle

### `open_questions/decisioni_core.md`

Questionario esteso con le risposte raccolte sulle 5 decisioni principali che hanno definito il contesto attuale. Va tenuto come traccia delle decisioni prese.

## Regola di manutenzione

Quando aggiungiamo, rimuoviamo o cambiamo in modo sostanziale un file di contesto sotto `ai_context/`, aggiornare anche questo `README.md`.
