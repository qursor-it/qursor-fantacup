# Roadmap

Cosa resta da fare, diviso in fasi. **Come** funziona il progetto è in `ai_context/`, **perché** è fatto così è in `docs/adr/`.

## Fasi

| Fase | File | Dipende da |
|---|---|---|
| F1 · Migrazione a Cache Components | [01-cache-components.md](01-cache-components.md) | — |
| F2 · Aggiornamenti in tempo reale | [02-tempo-reale.md](02-tempo-reale.md) | F1 |
| F3 · Stories | [03-stories.md](03-stories.md) | F1, F2 (solo F3-22) |
| F4 · Residui degli audit del 2026-11-03 | [04-audit.md](04-audit.md) | — (F4-05 prima di F2-05) |
| F5 · Decisioni di prodotto e altro | [05-prodotto.md](05-prodotto.md) | — |

Le decisioni che bloccano un task stanno nella stessa fase, come task di tipo "decidere".

## Come è scritto un task

```markdown
### F1-03 · Titolo

- **Stato:** da fare | in corso | fatto
- **Tipo:** fare | decidere | verificare
- **Obiettivo:** una riga.
- **Leggere prima:** ADR, file di ai_context, guide di Next in node_modules.
- **File:** dove si lavora.
- **Fatto quando:** criteri verificabili.
- **Dipende da:** altri task.
```

Un task corrisponde circa a un commit. Un task "decidere" è fatto quando la decisione è scritta: un nuovo ADR in `docs/adr/` se è una scelta architetturale, altrimenti il file di `ai_context/` che descrive quella parte.

## Controlli comuni a ogni task "fare"

Valgono sempre, anche se il task non li ripete (vedi `AGENTS.md`):

1. Prima di scrivere codice Next, leggere la guida relativa in `node_modules/next/dist/docs/`: questa versione di Next differisce da quella che si trova in giro.
2. `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` senza errori.
3. Aggiornare i file di `ai_context/` se cambiano funzionamento, regole o permessi.
4. Cambiare lo stato del task in questo file nello stesso commit.

## Manutenzione

- Quando tutti i task di una fase sono fatti, il file della fase si cancella (resta nella storia di git) e si toglie dalla tabella.
- Le nuove attività si aggiungono alla fase giusta con il primo numero libero.
