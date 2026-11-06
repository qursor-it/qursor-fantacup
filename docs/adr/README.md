# Decisioni architetturali (ADR)

Qui si registra **perché** il progetto è fatto così: il contesto, la scelta, le alternative scartate e le conseguenze. **Come** funziona oggi è descritto in `ai_context/`, che rimanda agli ADR invece di ripeterne le motivazioni.

## Regole

- Un file per decisione, numerato: `NNNN-titolo-breve.md`.
- Un ADR accettato non si riscrive. Se la decisione cambia, si scrive un nuovo ADR e in quello vecchio si cambia solo lo stato in "superato da ADR-NNNN".
- Le decisioni ancora da prendere sono task di tipo "decidere" in `docs/roadmap/`; il loro risultato è un nuovo ADR.

## Elenco

| # | Decisione | Stato |
|---|---|---|
| [0001](0001-installazione-per-torneo.md) | Un'installazione per torneo | accettato |
| [0002](0002-stories-in-next.md) | Stories gestite da Next, senza servizio separato | accettato |
| [0003](0003-storage-r2-e-archivio-hetzner.md) | R2 per le stories attive, Hetzner come archivio | accettato |
| [0004](0004-caricamento-diretto-con-url-firmato.md) | Caricamento diretto con URL firmato e story "in caricamento" | accettato |
| [0005](0005-bucket-stories-pubblico.md) | Bucket R2 delle stories pubblico in lettura | accettato |
| [0006](0006-stories-visibili-ai-guest.md) | Stories visibili anche ai guest | accettato |
| [0007](0007-tempo-reale-con-sse.md) | Aggiornamenti in tempo reale con SSE | accettato |
| [0008](0008-cache-components-prima-del-tempo-reale.md) | Migrazione a Cache Components prima del tempo reale | accettato |
| [0009](0009-job-con-timer-interno.md) | Job periodici con timer interno a Next | accettato |
| [0010](0010-configurazione-in-tre-livelli.md) | Configurazione del torneo in tre livelli | accettato |

## Modello

```markdown
# NNNN. Titolo

- **Stato:** proposto | accettato | superato da ADR-NNNN
- **Data:** AAAA-MM-GG

## Contesto

Il problema e i vincoli, in poche righe.

## Decisione

Cosa si è scelto.

## Alternative scartate

- **Alternativa:** perché no.

## Conseguenze

Cosa diventa più facile, cosa più difficile, cosa resta da fare.
```
