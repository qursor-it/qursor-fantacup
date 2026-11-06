# 0009. Job periodici con timer interno a Next

- **Stato:** accettato
- **Data:** 2026-11-06

## Contesto

Le stories richiedono due lavori periodici: sistemare le stories rimaste "in caricamento" e spostare ogni giorno su Hetzner i file delle stories scadute. Next non ha un meccanismo incorporato per eseguire lavori a orari fissi. C'è un solo container per torneo (ADR-0001) e i deploy possono essere frequenti.

## Decisione

- I job girano nel processo Next, sulla stessa macchina, avviati da un timer interno.
- Il timer non conta 24 ore dall'avvio: controlla ogni tanto la data dell'ultima esecuzione salvata nel database e lancia il job quando è passato abbastanza tempo.
- I job sono rilanciabili senza danni. Lo spostamento segue l'ordine: copia su Hetzner, verifica della copia, aggiornamento del database, cancellazione da R2. I file passano in streaming, pochi alla volta, fuori dagli orari delle partite.
- Non servono lucchetti contro esecuzioni parallele, perché c'è un solo processo per torneo.

## Alternative scartate

- **Route protetta chiamata da fuori** (crontab, container, Jenkins): un pezzo in più da configurare per ogni torneo.
- **Servizio separato per i job:** copiare file è lavoro di rete, non di CPU; con qualche GB al giorno al massimo non serve.
- **Timer "ogni 24 ore dall'avvio":** con deploy più frequenti di 24 ore non scatterebbe mai.

## Conseguenze

- Se le misure mostrassero che il job rallenta l'app, va spostato in un processo separato.
- Con più container per torneo servirebbe un lucchetto (per esempio nel database).
