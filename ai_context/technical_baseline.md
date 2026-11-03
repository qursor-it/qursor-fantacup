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

## Account admin

L'admin non viene più creato dai seed applicativi: viene sincronizzato da `npm run db:seed-admin` (`prisma/seed-admin.ts`), eseguito da Jenkins a ogni deploy.

* DEV: credential Jenkins `fantadc-admin-dev`, env `ADMIN_EMAIL` / `ADMIN_PASSWORD`
* PROD: credential Jenkins `fantadc-admin-prod`, env `ADMIN_EMAIL` / `ADMIN_PASSWORD`

Jenkins è la fonte di verità della sola password provisionata. Il campo `User.provisionedPasswordHash` contiene l'hash dell'ultima `ADMIN_PASSWORD` applicata dal deploy; un valore non-null marca l'unico account gestito da Jenkins. Lo script:

* al primo deploy **adotta** l'utente con `ADMIN_EMAIL` se esiste (ruolo `ADMIN`, `passwordHash` e `provisionedPasswordHash` allineati alla credential): `passwordChangedAt` viene aggiornato solo se la password effettiva cambia, così le sessioni sopravvivono quando la password era già la stessa;
* se l'account gestito non esiste ancora, lo **crea** (`name: "Admin"`);
* a ogni deploy garantisce il ruolo `ADMIN` e ruota la password solo quando la credential Jenkins è cambiata (`bcrypt.compare` contro `provisionedPasswordHash`, non contro `passwordHash`); una password cambiata dall'admin via UI viene quindi **preservata**;
* se `ADMIN_EMAIL` cambia, **rinomina** lo stesso account gestito (storia preservata); se l'email è già di un altro utente lo script esce con un errore invece di unire gli account;
* se più di un utente ha `provisionedPasswordHash` non-null esce con un errore che elenca gli id, da sistemare manualmente.

Quando la password viene ruotata o adottata con valore diverso, `passwordChangedAt` viene aggiornato e il callback JWT in `lib/auth.ts` invalida le sessioni emesse prima di quella data.

## Rate limiting e proxy

Il rate limit usa l'IP del client ricavato da `x-forwarded-for` partendo da destra, perche i valori a sinistra possono essere iniettati dal client. La variabile d'ambiente `TRUSTED_PROXY_HOPS` (intero, default `1`) indica quanti reverse proxy fidati stanno davanti al container e deve corrispondere al deployment reale: con un solo proxy in front si lascia `1`, con due si imposta `2`, mentre `0` prende comunque il valore piu a destra dell'header.


## Più tornei (un'installazione per torneo)

Lo stesso codice serve tornei diversi, ognuno con il suo deploy, database, dominio e app PWABuilder. Il torneo si sceglie al build con `NEXT_PUBLIC_TOURNAMENT` (default `dcup`); la configurazione sta in `tournaments/<id>.ts` (tipo `TournamentConfig` in `tournaments/index.ts`): identità (nome, logo, icona, edizione, link store) e regole (portieri, giocatori di movimento, moltiplicatore capitano, finestra MVP, punti MVP di default). `lib/site.ts` espone `siteConfig`/`appStoreConfig` derivati da lì. Il testo del regolamento è ancora specifico del DCup.
