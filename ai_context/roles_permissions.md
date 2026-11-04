# Roles And Permissions

## Guest

Utente non autenticato.

Puo:

* vedere presentazione del progetto
* consultare regolamento pubblico
* vedere calendario, informazioni sulle partite e classifica fantasy
* vedere il dettaglio pubblico delle squadre fantasy
* registrarsi o accedere

Non puo:

* vedere le stories

* creare squadre fantasy
* votare MVP
* accedere ad area amministrativa

## Registered User

Utente autenticato partecipante al fantacalcio.

Puo:

* creare la propria squadra fantasy se non esiste ancora
* scegliere il nome squadra
* selezionare 1 portiere e 4 giocatori di movimento da 5 squadre reali diverse
* nominare un capitano della rosa
* consultare elenco giocatori, squadre reali, calendario e dettaglio partite
* esprimere un voto MVP per partita nella finestra consentita
* pubblicare una story con sola foto per partita, solo mentre la finestra MVP e aperta (vedi `stories.md`)
* vedere le stories, reagire e segnalarle agli admin
* vedere chi ha visto e chi ha reagito alle proprie stories
* vedere classifica, storico punteggi e dettaglio bonus
* modificare i dati consentiti del proprio profilo

Non puo:

* modificare la rosa dopo la conferma iniziale
* gestire anagrafiche ufficiali del torneo
* assegnare bonus o malus
* modificare dati di altri utenti
* accedere ai log amministrativi

## Caposquadra

Utente registrato a cui un admin assegna il ruolo, collegato a una squadra reale. Dettagli in `stories.md`.

Puo, oltre a quanto puo un utente registrato:

* pubblicare stories con foto e video, al massimo 10 attive nelle ultime 24 ore

Non puo:

* fare nulla di riservato agli admin

## Admin

Utente con responsabilita organizzativa.

Puo:

* gestire squadre reali
* gestire giocatori
* gestire partite e relativi stati
* segnare i giocatori che hanno preso parte a una partita
* definire tipi bonus e malus
* assegnare e correggere bonus per partita
* vedere tutte le squadre fantasy
* modificare manualmente le rose degli utenti
* sospendere o limitare utenti
* vedere il dettaglio di tutti i voti MVP
* correggere o annullare voti MVP
* chiudere o riaprire finestre di voto
* vedere il log amministrativo
* pubblicare stories con foto e video senza limiti
* eliminare qualsiasi story, anche gia pubblicata
* vedere le segnalazioni delle stories
* assegnare e togliere il ruolo caposquadra
* creare altri admin

Nota:

* l'admin iniziale è provisionato da Jenkins tramite la credential dedicata (vedi `technical_baseline.md`), non dai seed applicativi
* operativamente esiste un solo livello di admin, anche se l'admin iniziale ha funzione di bootstrap

## Principio operativo

I dati ufficiali del torneo reale e del punteggio fantasy devono essere amministrati solo dagli admin.
Gli utenti registrati interagiscono con la propria squadra e con il voto MVP, ma non alterano i dati ufficiali della competizione.
