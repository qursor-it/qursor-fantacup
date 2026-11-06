# 0011. Torneo scelto all'avvio, con un'immagine unica

- **Stato:** accettato
- **Data:** 2026-11-06
- **Modifica:** ADR-0001, nella parte "il torneo si sceglie al build"; ADR-0010, dove dice che l'identità è "scelta al build". Resta valido tutto il resto: un'installazione per torneo, con container, database e dominio propri.

## Contesto

Con ADR-0001 il torneo si sceglie al momento della build (`NEXT_PUBLIC_TOURNAMENT`), perché nome, colori e manifest finiscono anche nel codice del browser. Ne segue un'immagine Docker e un job di build per torneo: ogni correzione va costruita una volta per torneo. Si prevedono due o tre tornei, tutti sullo stesso server; la priorità è che un problema in un torneo non tocchi gli altri.

Le alternative pesate il 2026-11-06 erano tre: A (situazione attuale), B (un'immagine, torneo scelto all'avvio), C (multi-tenant con un solo database).

## Decisione

- **Una sola immagine Docker** per tutti i tornei. Il torneo si sceglie **all'avvio** del container con la variabile d'ambiente `TOURNAMENT`.
- Manifest, colori, metadati e asset del torneo sono prodotti dal server in base al torneo scelto, non fissati nella build. I componenti del browser ricevono la configurazione dal server invece di importarla.
- Nessuna variabile specifica del torneo viene letta durante la build (oggi anche `NEXTAUTH_URL` e `NEXT_PUBLIC_APP_URL` sono argomenti di build).
- **Installazione per torneo invariata:** ogni torneo ha il suo container, database, volumi, dominio e app negli store.
- Ogni torneo indica la **versione dell'immagine** che usa, così gli aggiornamenti si fanno un torneo alla volta e si può tornare indietro solo dove serve.

## Alternative scartate

- **A, torneo scelto al build:** una build e un job per torneo a ogni correzione; per provare un altro torneo in locale serve un'altra build.
- **C, multi-tenant:** un solo deploy per tutti, ma un solo database: un problema o un errore di filtro tocca tutti i tornei, cioè il rischio che si vuole evitare. Costo alto (ogni query filtrata per torneo, cache separata per torneo). Da riconsiderare solo se i tornei diventassero molti.

## Conseguenze

- Una correzione è una build; i container dei tornei si aggiornano separatamente.
- Va cambiato il modo in cui il codice legge la configurazione del torneo: manifest (`app/manifest.ts`), colori come variabili CSS nel layout, asset serviti per torneo, 8 componenti client che oggi importano la configurazione.
- Il comportamento del DCup deve restare identico; va verificato anche nell'app negli store, che legge manifest e icone dal dominio.
