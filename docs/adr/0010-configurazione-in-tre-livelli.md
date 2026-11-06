# 0010. Configurazione del torneo in tre livelli

- **Stato:** accettato; il livello 2 non è più "scelto al build" ma all'avvio, vedi ADR-0011
- **Data:** 2026-11-06

## Contesto

Con il secondo torneo (FacolCup) gli organizzatori di ciascun torneo vogliono poter fare piccoli ritocchi da soli, senza un nuovo deploy. Oggi tutta la configurazione del torneo è nel codice (`tournaments/<id>`), scelta al build (ADR-0001), tranne due impostazioni già modificabili dagli admin nella pagina `/admin/impostazioni` (`AppSetting`: registrazioni aperte, torneo concluso) e i punti dei bonus, MVP compreso (`BonusType`).

## Decisione

La configurazione si divide in tre livelli:

1. **Infrastruttura** (id del torneo, dominio, database, chiavi degli storage, job Jenkins, package dell'app negli store): variabili d'ambiente e deploy, gestiti dallo sviluppatore.
2. **Identità** (nome, colori, logo, icone, immagini, nome e aspetto della sezione pallavolo): nel codice, in `tournaments/<id>`, scelta al build. Non cambia durante il torneo e finisce anche nel manifest dell'app.
3. **Regole e contenuti** (regole del fantacalcio, limiti ed emoji delle stories, regolamento in PDF, impostazioni già esistenti): nel database, modificabili dagli organizzatori (gli admin di ciascuna installazione) dalla pagina `/admin/impostazioni`.

Regole:
- **Un solo posto per ogni regola.** Una regola del livello 3 vive solo nel database; la configurazione del torneo nel codice fornisce soltanto i valori iniziali al primo avvio.
- **Le regole che toccano i punteggi** (portieri e giocatori di movimento, moltiplicatore del capitano, finestra MVP, punti MVP) si possono cambiare solo prima che il torneo inizi; dopo vengono bloccate.
- Ogni modifica finisce nell'audit log.

## Alternative scartate

- **Tutto nel codice:** ogni ritocco richiede uno sviluppatore e un deploy.
- **Tutto nel database, identità compresa:** nome, colori e icone finiscono nel manifest e nell'app negli store, che li fissa al momento della generazione con PWABuilder; cambiarli da un form darebbe un'app installata diversa dal sito.
- **Regole di punteggio sempre modificabili:** cambiare la rosa o il moltiplicatore del capitano a torneo iniziato rompe classifiche e storico.

## Conseguenze

- Le regole lette a ogni richiesta vanno messe in cache con un'etichetta e invalidate al salvataggio (dopo F1, con Cache Components).
- Va definito con precisione quando un torneo "è iniziato" ai fini del blocco.
- Valori oggi nel codice (`tournament.rules`, `DEFAULT_MVP_POINTS`) e nel tipo bonus `MVP` vanno unificati in un solo posto.
- Il regolamento non ha più una versione nel codice per torneo: è un PDF caricato dagli organizzatori.
