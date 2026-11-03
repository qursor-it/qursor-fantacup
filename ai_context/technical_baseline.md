# Technical Baseline

## Stack corrente del repository

* Next.js `16.2.1`
* React `19.2.4`
* TypeScript `5`
* Tailwind CSS `4`
* PWA nativa via App Router (`manifest.ts`, metadata, service worker custom, offline fallback)
* Prisma ORM come target dichiarato nei documenti di dominio
* PostgreSQL come database target

## Stato attuale

Il repository e stato inizializzato con uno starter minimale.
La parte applicativa vera non e ancora partita.
Il modello Prisma e gia definito in forma documentale, ma non e ancora collegato a una implementazione completa.

## Decisioni tecniche gia emerse dal contesto

* autenticazione email-only
* ruoli applicativi iniziali: `user` e `admin`
* area pubblica disponibile senza login per tutti i contenuti non admin
* area admin basata su CRUD semplici ma sicuri
* auditing delle modifiche amministrative
* rate limit richiesto su operazioni sensibili
* captcha semplice valutabile in registrazione se il costo di integrazione resta basso
* distribuzione mobile primaria come PWA installabile, con packaging store derivato dalla web app

## Principi architetturali iniziali

* usare il database come fonte di verita per i vincoli critici
* mantenere la logica di dominio lato server
* evitare dipendenze da stato client per regole importanti
* costruire prima le basi del dominio e poi le viste UI
* privilegiare semplicita e leggibilita rispetto a generalizzazioni premature
* esplicitare bene gli stati di partita e i ricalcoli di punteggio
* mantenere la PWA sicura: niente caching offline di HTML privato o risposte autenticate

## Aree applicative suggerite

### Public

* home
* accesso e registrazione
* regolamento
* calendario e partite
* classifica fantasy
* squadre fantasy pubbliche

### User App

* dashboard utente
* creazione squadra fantasy
* mia squadra fantasy
* voto MVP
* storico punteggi

### Admin App

* gestione squadre reali
* gestione giocatori
* gestione partite e stati
* gestione partecipanti alla partita
* gestione bonus e malus
* supervisione utenti e squadre fantasy
* audit log

## Convenzioni utili da mantenere

* documentare prima il dominio e poi il planning
* centralizzare le decisioni aperte in un file unico
* separare chiaramente dati ufficiali del torneo da interazioni utente
* far derivare API, pagine e permessi dai ruoli e dai flussi gia documentati
* trattare il documento Prisma in `ai_context/prisma_model.md` come baseline da tradurre poi nel vero schema

## Nota importante su Next.js

Nel repository e presente una regola esplicita: prima di implementare codice Next.js bisogna leggere la documentazione rilevante dentro `node_modules/next/dist/docs/`, perche questa versione ha breaking changes rispetto a convenzioni precedenti.
Al momento quei file non sono presenti nel workspace, quindi quando inizieremo l'implementazione sara necessario installare o verificare le dipendenze e consultare la documentazione locale corretta.

## Baseline PWA/store

* la web app deve essere installabile su Android e iOS con icone, manifest e modalità standalone
* il service worker deve coprire asset statici e fallback offline pubblico senza memorizzare pagine private
* la pubblicazione su store richiede passaggi esterni al repo:
  * Android: packaging TWA/WebAPK o wrapper nativo con firma e Play Console
  * iOS: wrapper nativo (es. Capacitor/PWABuilder) con build Xcode e App Store Connect
* le credenziali store, i bundle identifier, le chiavi di firma e gli asset marketing non devono stare nel repository

## Rate limiting e proxy

Il rate limit usa l'IP del client ricavato da `x-forwarded-for` partendo da destra, perche i valori a sinistra possono essere iniettati dal client. La variabile d'ambiente `TRUSTED_PROXY_HOPS` (intero, default `1`) indica quanti reverse proxy fidati stanno davanti al container e deve corrispondere al deployment reale: con un solo proxy in front si lascia `1`, con due si imposta `2`, mentre `0` prende comunque il valore piu a destra dell'header.

