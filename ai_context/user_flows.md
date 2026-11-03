# User Flows

## 1. Accesso pubblico e onboarding

Obiettivo: permettere a chiunque di seguire il torneo e, se vuole, registrarsi al fantacalcio.

Flusso base:

1. l'utente arriva nell'area pubblica
2. puo vedere calendario, partite, classifica fantasy e squadre fantasy pubbliche
3. si registra oppure accede
4. il sistema verifica se ha gia una squadra fantasy
5. se non esiste, viene guidato alla creazione della squadra
6. se esiste, entra nella dashboard personale

## 2. Creazione squadra fantasy

Obiettivo: configurare la squadra iniziale dell'utente.

Flusso base:

1. l'utente inserisce il nome della squadra fantasy
2. vede una singola schermata con layout a campo e slot liberi
3. seleziona 1 portiere
4. seleziona 4 giocatori di movimento
5. il sistema verifica in tempo reale che i 5 giocatori vengano da 5 squadre reali diverse
6. l'utente sceglie un capitano tra i 5 giocatori selezionati
7. conferma la squadra completa
8. il sistema salva la squadra e impedisce la creazione di una seconda squadra per lo stesso utente
9. dopo la conferma, la rosa utente resta bloccata

## 3. Consultazione torneo

Obiettivo: permettere all'utente di capire stato del torneo e del fantacalcio.

Viste principali:

* elenco squadre reali
* elenco giocatori
* dettaglio giocatore
* calendario partite
* dettaglio partita
* classifica fantasy cumulata
* dettaglio squadra fantasy
* dettaglio punteggio per partita

## 4. Voto MVP

Obiettivo: raccogliere un voto utente per ogni partita conclusa.

Flusso base:

1. un admin imposta la partita come conclusa
2. si apre una finestra di voto di 2 ore
3. se ha attivato le notifiche push, l'utente riceve una push con link diretto a `/vota/{id}`
4. l'utente apre la partita e vede i giocatori segnati come presenti
5. l'interfaccia mostra un elenco semplice dei 10 giocatori della partita
6. l'utente seleziona un solo giocatore come MVP
7. il sistema registra il voto e blocca ulteriori modifiche lato utente
8. dopo il voto, l'utente vede conferma e favorito provvisorio
9. alla chiusura della finestra, il sistema mostra l'MVP finale della partita se c'e un vincitore unico
10. se c'e pari voti, un admin sceglie manualmente l'MVP ufficiale

## 5. Gestione admin del torneo

Obiettivo: mantenere i dati ufficiali del sistema.

Flussi base:

1. creare e aggiornare squadre reali
2. creare e aggiornare giocatori
3. creare e aggiornare partite
4. gestire gli stati partita: bozza, programmata, conclusa, pubblicata
5. segnare i giocatori che hanno preso parte alla partita
6. creare tipi bonus e malus
7. assegnare o correggere bonus ai giocatori per partita
8. vedere e correggere voti MVP quando necessario
9. vedere tutte le squadre fantasy e intervenire manualmente sulle rose
10. sospendere utenti e gestire altri admin
11. consultare il log delle modifiche amministrative
12. segnare il torneo come concluso da `/admin/impostazioni` (`AppSetting.tournamentConcluded`): finché è attivo, ospiti e utenti non admin vengono rimandati a `/torneo-concluso` (il controllo è in `proxy.ts`), mentre `/login` e `/admin` restano raggiungibili e gli admin vedono il sito normalmente

## 6. Calcolo risultati fantasy

Obiettivo: mostrare punteggi e classifiche coerenti con i dati ufficiali.

Flusso logico:

1. gli admin definiscono i giocatori presenti in partita
2. gli admin assegnano bonus e malus per partita ai giocatori
3. il sistema determina l'MVP della partita
4. il giocatore MVP ufficiale riceve 5 punti
5. il sistema calcola il punteggio di ciascun giocatore
6. se il giocatore e capitano, il suo punteggio viene raddoppiato
7. il sistema somma i punteggi dei 5 giocatori della squadra fantasy
8. aggiorna la classifica cumulata totale
9. conserva il dettaglio storico per partita

## 7. Punti ancora aperti

Restano da definire nel dettaglio:

* regole di spareggio in classifica
* meccanismo tecnico anti spam su registrazione e voto
