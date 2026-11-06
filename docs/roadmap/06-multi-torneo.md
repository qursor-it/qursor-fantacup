# F6 · Multi-torneo

Decisione: `docs/adr/0001-installazione-per-torneo.md`. Funzionamento: `ai_context/multi_tournament.md`, `ai_context/tournament_ui.md`.

Obiettivo della fase: portare in produzione il secondo torneo, che parte a breve, sullo stesso codice. Il primo passo è fatto: identità e regole del DCup sono in `tournaments/dcup.ts`, scelto al build con `NEXT_PUBLIC_TOURNAMENT`.

Stories e aggiornamenti in tempo reale valgono per tutti i tornei: non servono flag per spegnerli. Le loro regole numeriche (limiti, durate, dimensioni dei file) stanno nella configurazione del torneo come le altre regole, con gli stessi valori per tutti finché non serve altro (vedi F3-11).

### F6-01 · Raccogliere i dati del secondo torneo

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** sapere cosa cambia rispetto al DCup prima di toccare il codice.
- **Fatto quando:** sono scritti in `multi_tournament.md` (sezione "Secondo torneo: FacolCup"): id del torneo, nome, dominio, date, regole (portieri, giocatori di movimento, capitano, finestra MVP, punti MVP), sezioni attive (green volley sì o no), pagine con una versione propria (almeno il regolamento), colori, logo e icone, dati per l'app negli store.
- **Dipende da:** —

### F6-02 · Struttura per torneo

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** passo 3 di `multi_tournament.md`.
- **Leggere prima:** `multi_tournament.md`, `tournament_ui.md`.
- **File:** `tournaments/index.ts`, `tournaments/dcup.ts` → `tournaments/dcup/config.ts`, `tournaments/dcup/public/`, `Dockerfile`, `app/layout.tsx`.
- **Fatto quando:** `TournamentConfig` ha `id` e `features`; la configurazione del DCup è in `tournaments/dcup/config.ts`; loghi, icone e `.well-known/assetlinks.json` stanno in `tournaments/<id>/public` e vengono copiati in `public/` nella build Docker; l'`<html>` ha `data-tournament`; il DCup si comporta esattamente come prima.
- **Dipende da:** —

### F6-03 · Sezione pallavolo configurabile per torneo

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** la sezione pallavolo esiste in entrambi i tornei con identità diversa: GreenVolley nel DCup, FacolVolley nella FacolCup. Oggi nome, colore (`#3DD907`, `.gv-theme`), logo e URL sono scritti per il DCup in circa 40 file; i modelli dati (`Volley*`) sono già generici.
- **File:** `tournaments/<id>/config.ts` (blocco della sezione volley: attiva sì/no, nome, colori, logo), `app/(public)/greenvolley/**`, `app/(admin)/admin/greenvolley/**`, `components/gv-theme-wrapper.tsx`, `app/globals.css`, menu, `proxy.ts`.
- **Fatto quando:** nome, colori e logo della sezione arrivano dalla configurazione; gli URL seguono la scelta di F6-10; con la sezione spenta le pagine rispondono 404 e spariscono dai menu; il DCup appare identico a prima.
- **Dipende da:** F6-02, F6-10

### F6-04 · Colori del marchio dalla configurazione

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** passo 2 di `multi_tournament.md`: 3–4 colori del marchio in variabili CSS lette dalla configurazione.
- **File:** `app/globals.css`, `app/layout.tsx`, pagine con colori del marchio scritti a mano.
- **Fatto quando:** cambiando i colori nella configurazione cambiano marchio, pulsanti principali, manifest e splash; gli altri colori scritti a mano possono restare.
- **Dipende da:** F6-02

### F6-05 · Docker Compose per torneo

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** passo 4 di `multi_tournament.md`, parte Compose.
- **File:** `docker-compose.yml`, `docker-compose.prod.yml`, `.env.docker.example`.
- **Fatto quando:** nomi dei container, porte, reti e volumi hanno un prefisso per torneo (oggi sono fissi: `fantadc-prod`, `fantadc-postgres-prod`, porta 4567, volume esterno `dcup-prod_pgdata_prod`); due tornei possono girare sullo stesso server; il DCup in produzione continua a usare il suo volume senza perdita di dati (procedura di passaggio scritta e provata in DEV).
- **Dipende da:** —

### F6-06 · Un job Jenkins per torneo

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** passo 4 di `multi_tournament.md`, parte Jenkins.
- **File:** `Jenkinsfile`, `Jenkinsfile_prod`, configurazione dei job su Jenkins.
- **Fatto quando:** ogni torneo ha il suo job con `NEXT_PUBLIC_TOURNAMENT` e credenziali proprie (file env, admin, chiavi VAPID; poi quelle degli storage di F3-12); il job del DCup produce la stessa immagine di prima.
- **Dipende da:** F6-05

### F6-07 · Nginx per il dominio del secondo torneo

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** il dominio del nuovo torneo servito come quello del DCup, già pronto per SSE.
- **File:** `nginx/qursor-prod.conf` e `nginx/qursor-dev.conf` nella repository `qursor-it/qursor-infrastructure`.
- **Fatto quando:** il blocco del nuovo dominio è nella repository infrastructure, con certificato, `proxy_buffering off` e le stesse impostazioni decise per fantadc in F2-01.
- **Dipende da:** F6-01, F2-01

### F6-08 · Regolamento per torneo

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** il testo del regolamento oggi è scritto a mano per il DCup; probabilmente è la prima pagina con una versione per torneo.
- **Leggere prima:** `tournament_ui.md` (Stessa pagina, versione diversa).
- **File:** `app/(public)/regolamento/`, `tournaments/<id>/pages/`.
- **Fatto quando:** ogni torneo ha il suo regolamento; i valori (punti, capitano, finestra MVP) sono letti dalla configurazione dove possibile.
- **Dipende da:** F6-02, F6-01

### F6-10 · URL della sezione pallavolo

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** oggi gli URL sono `/greenvolley/*`. Per la FacolCup un indirizzo con "greenvolley" sarebbe strano.
- **Opzioni:** URL generici uguali per tutti (per esempio `/volley/*`, con redirect da `/greenvolley/*` per non rompere i link già condivisi del DCup); oppure URL presi dalla configurazione del torneo (`/greenvolley/*` per il DCup, `/facolvolley/*` per la FacolCup).
- **Fatto quando:** la scelta è scritta in `multi_tournament.md` (o in un ADR, se cambia la struttura delle rotte).
- **Dipende da:** —

### F6-09 · Secondo torneo in produzione

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** passo 5 di `multi_tournament.md`.
- **Fatto quando:** configurazione e asset in `tournaments/<id>/`; database, dominio, job Jenkins e deploy propri; admin iniziale creato; app generata con PWABuilder e `assetlinks.json` aggiornato; chiave di firma Android conservata; `multi_tournament.md` aggiornato.
- **Dipende da:** F6-02 … F6-08
