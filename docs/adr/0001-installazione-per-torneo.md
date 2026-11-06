# 0001. Un'installazione per torneo

- **Stato:** accettato; la scelta del torneo al build è superata da ADR-0011
- **Data:** 2026-11-03

## Contesto

Il progetto deve gestire almeno due tornei, anche in contemporanea. Le comunità sono separate (nessun account unico), il gioco è lo stesso con regole che cambiano solo nei valori, ogni torneo ha la sua app negli store e l'interfaccia può differire in parti non ancora note.

## Decisione

Un solo repository e una sola build. Ogni torneo ha il suo deploy, con database, variabili d'ambiente, dominio, job Jenkins e app negli store propri. Il torneo si sceglie al build con `NEXT_PUBLIC_TOURNAMENT`. Funzionamento in `ai_context/multi_tournament.md`.

## Alternative scartate

- **Multi-tenant** (modello `Tournament` e `tournamentId` su tutte le tabelle): servirebbe solo con un account unico tra tornei, che non è richiesto; è il cambiamento più costoso; c'è il rischio che dati di un torneo compaiano nell'altro.
- **Motore in un pacchetto condiviso e due app Next.js:** due app da mantenere. Ha senso solo se le interfacce diventano prodotti diversi.
- **Copia del repository:** le copie divergono e ogni correzione va fatta due volte.

## Conseguenze

- Un solo container Next per torneo: le soluzioni che contano su un unico processo (eventi SSE in memoria, job senza lucchetti) sono possibili. Vedi ADR-0007 e ADR-0009.
- Ogni servizio aggiunto (storage, job, chiavi) va configurato per ogni torneo.
- Se quasi tutte le pagine divergessero tra tornei, va rivalutata l'opzione del motore condiviso.
