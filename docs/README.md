# Documentazione del progetto: come è organizzata e come tenerla aggiornata

Questa guida vale per chiunque lavori sul repository, persone e agenti (Claude, Codex). Le regole essenziali sono ripetute in `AGENTS.md`.

## Dove sta cosa

| Dove | Risponde a | Esempio |
|---|---|---|
| `ai_context/` | **Come funziona oggi**: prodotto, regole di dominio, ruoli, flussi, architettura | "Una story resta nel feed 24 ore, poi passa nell'archivio" |
| `docs/adr/` | **Perché** è fatto così: contesto, decisione, alternative scartate, conseguenze | "Abbiamo scelto R2 perché non fa pagare il traffico in uscita; Hetzner da solo consumerebbe la quota" |
| `docs/roadmap/` | **Cosa resta da fare**, comprese le decisioni ancora da prendere | "F3-14 · Richiesta di pubblicazione" |
| `docs/audit-*.md`, `docs/perf/` | **Fotografie** di un momento: audit, misure prima e dopo un intervento | "Homepage a 17 ms il 2026-11-03" |
| `TODO.md` | Indice della roadmap | — |

Regola generale: **ogni informazione sta in un solo posto**. `ai_context/` non ripete le motivazioni (rimanda all'ADR), la roadmap non descrive il funzionamento (rimanda ad `ai_context/`), un ADR non elenca i passi di implementazione (stanno nella roadmap).

## Come usarla

### Prima di iniziare un lavoro

1. Leggi `ai_context/README.md` e i file di contesto della parte che tocchi.
2. Cerca il task in `docs/roadmap/`: obiettivo, file, criteri "fatto quando" e dipendenze. Se le dipendenze non sono fatte, parti da quelle.
3. Leggi gli ADR citati dal task o dal file di contesto. Se il lavoro va contro un ADR, fermati: serve una nuova decisione, non un'eccezione silenziosa.
4. Se il task è di tipo "decidere", il risultato è un testo (ADR o file di contesto), non codice.

### Mentre lavori

- Se scopri un lavoro non previsto, aggiungilo come nuovo task alla fase giusta invece di allargare quello in corso.
- Se scopri una decisione da prendere, aggiungila come task "decidere" e chiedi a chi decide; non inventare regole di dominio.

### Quando finisci

Nello stesso commit del codice:

1. Cambia lo **stato** del task in `docs/roadmap/` (`da fare` → `fatto`).
2. Aggiorna **`ai_context/`** se è cambiato il funzionamento, una regola, un permesso o il modello dati.
3. Scrivi un **ADR** se hai preso una decisione architetturale (vedi sotto).
4. Esegui i controlli comuni del README della roadmap (`tsc`, lint, test, build).

## Quando scrivere un ADR

Scrivi un ADR quando la scelta:
- è difficile o costosa da cambiare dopo (storage, protocolli, struttura dei dati, servizi);
- aveva alternative sensate che qualcuno potrebbe riproporre;
- cambia un requisito o una decisione precedente.

Non serve un ADR per dettagli di implementazione reversibili (nome di una funzione, organizzazione di un componente) o per regole di prodotto senza impatto architetturale: queste vanno direttamente in `ai_context/`.

Come:
1. Copia il modello da `docs/adr/README.md` in `docs/adr/NNNN-titolo-breve.md` con il primo numero libero.
2. Aggiungi la riga nell'elenco di `docs/adr/README.md`.
3. Nel file di `ai_context/` interessato, descrivi il funzionamento e metti un rimando all'ADR.

### Cambiare una decisione

Un ADR accettato **non si riscrive**: è la traccia di cosa si sapeva allora.
1. Scrivi un nuovo ADR che spiega cosa è cambiato e perché.
2. Nel vecchio cambia solo lo stato: `superato da ADR-NNNN`. Aggiorna l'elenco.
3. Aggiorna `ai_context/` con il nuovo funzionamento.

Si possono correggere in un ADR solo refusi o link rotti.

## Come mantenere la roadmap

- **Nuovo task:** nella fase giusta, con il primo numero libero (`F3-28`), nel formato del README della roadmap. I numeri non si riusano.
- **Stati:** `da fare`, `in corso`, `fatto`. Chi inizia un task lo mette `in corso` se il lavoro dura più di un commit.
- **Task non più necessario:** si toglie, scrivendo nel messaggio di commit perché.
- **Fase completata:** quando tutti i task sono `fatto`, il file della fase si cancella e si toglie dalle tabelle di `docs/roadmap/README.md` e `TODO.md`. La storia resta in git.
- **Nuova fase:** nuovo file `NN-nome.md` e nuova riga nelle stesse due tabelle.

## Come mantenere ai_context

- Descrive il presente, non la storia: quando qualcosa cambia, si riscrive la parte vecchia invece di aggiungere "aggiornamento del…".
- Le date di decisione stanno negli ADR, non nel testo di contesto.
- Se aggiungi, togli o rinomini un file, aggiorna `ai_context/README.md` (ordine di lettura e descrizioni).
- I punti aperti non stanno in `ai_context/`: sono task "decidere" nella roadmap.

## Audit e misure

- Un audit o una misura è una fotografia datata: non si aggiorna dopo, salvo una sezione finale "Stato al AAAA-MM-GG" con cosa è stato corretto.
- I problemi trovati diventano task nella roadmap.
- Le misure prima e dopo un intervento vanno in `docs/perf/` con data e nome dell'intervento, con lo stesso metodo così da poterle confrontare.
- Quando un audit non ha più punti aperti e nessun task lo cita, si può cancellare.

## Cosa non fare

- Piani, handoff o liste di cose da fare sparsi nella radice del repository o in cartelle nuove: vanno nella roadmap.
- Motivazioni ripetute in più file.
- Riscrivere un ADR accettato per adattarlo a una decisione nuova.
- Lasciare un task `fatto` nel codice ma `da fare` nella roadmap, o il contrario.
