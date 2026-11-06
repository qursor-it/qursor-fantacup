# 0007. Aggiornamenti in tempo reale con SSE

- **Stato:** accettato
- **Data:** 2026-11-06

## Contesto

I gol devono arrivare praticamente in diretta e le nuove stories con poco ritardo, a 100–200 persone collegate insieme, guest compresi. I dati vanno solo dal server al browser. C'è un solo container Next per torneo (ADR-0001) dietro nginx. Prima di questa decisione l'app non aveva aggiornamenti in diretta e il live scoring era fuori scope.

## Decisione

- **Server-Sent Events:** una route di Next tiene aperta una connessione per persona e il processo gira gli eventi a tutte.
- **Segnale più richiesta:** l'evento dice solo cosa è cambiato; il browser chiede poi i dati con una richiesta normale.
- **Cache ricalcolata prima del segnale:** dopo un gol l'azione admin svuota la cache dei dati live, la ricalcola una volta e solo dopo manda il segnale, così le richieste di tutti i browser fanno una sola query al database.
- **Heartbeat** sotto i 60 secondi (timeout di default di nginx).
- **Recupero:** al ritorno in primo piano della PWA e a ogni riconnessione il browser ricarica lo stato attuale.

Dettagli in `ai_context/realtime.md`.

## Alternative scartate

- **Polling:** per avere i gol quasi in diretta servirebbe una richiesta ogni 1–2 secondi per persona.
- **WebSocket:** la seconda direzione non serve, e richiede più configurazione su nginx.
- **Servizio esterno di tempo reale:** un fornitore in più, inutile con un solo processo per torneo.
- **Evento con i dati completi:** un evento perso lascerebbe dati sbagliati fino al successivo.
- **Stato live nella memoria del processo:** funzionerebbe, ma la cache esistente è lo stesso meccanismo usato dal resto dell'app.

## Conseguenze

- Con più container per torneo servirebbe un sistema per distribuire gli eventi tra i processi.
- Nginx deve avere `proxy_buffering off` e un timeout compatibile; con HTTP/1.1 ogni scheda aperta occupa una delle circa 6 connessioni per dominio del browser.
- `ai_context/product.md` non elenca più il live scoring tra le cose fuori scope.
