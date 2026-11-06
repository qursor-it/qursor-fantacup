# Product Context

## Progetto

Fantadc e il gestore di un fantacalcio legato a un torneo di paese.
Gli utenti registrati possono creare una sola squadra fantasy scegliendo i giocatori che partecipano al torneo reale.

## Obiettivo MVP

L'MVP deve permettere di:

1. registrare utenti con accesso email-only
2. creare una sola squadra fantasy per utente
3. comporre una rosa fissa da 5 giocatori: 1 portiere e 4 giocatori di movimento
4. imporre che i 5 giocatori provengano da 5 squadre reali diverse
5. scegliere un capitano che raddoppia il proprio punteggio
6. consultare squadre, giocatori, partite e classifica
7. votare l'MVP di una partita in una finestra di 2 ore dopo la chiusura
8. permettere agli admin di gestire partite, partecipanti al match, bonus e malus
9. calcolare il punteggio fantasy sulla base di bonus, malus, capitano e premio MVP

## Perche esiste

Il prodotto serve a gestire in modo semplice e centralizzato un fantacalcio locale, evitando fogli sparsi, regole poco chiare e conteggi manuali.

## Utenti principali

### Partecipante

Utente registrato che crea una sola squadra fantasy, vota gli MVP e segue la classifica.

### Admin organizzatore

Persona che gestisce dati del torneo, partite, bonus, votazioni e supervisione operativa.

## Perimetro iniziale

Incluso nell'avvio del progetto:

* una sola competizione
* squadre fantasy create dagli utenti
* rosa fantasy statica dopo la creazione utente
* capitano della squadra fantasy
* lista giocatori del torneo reale
* calendario partite e dettaglio partita
* indicazione dei giocatori che hanno preso parte alla partita
* voto MVP per partita
* notifiche push opzionali per apertura voto MVP
* bonus e malus assegnati dagli admin
* classifica cumulata e storico punteggi per partita
* area admin con CRUD semplici ma sicuri

## Non obiettivi per il primo step

Fuori scope per ora:

* multi stagione
* asta o mercato trasferimenti
* modifiche storicizzate automatiche della rosa
* pagamenti
* ruoli complessi oltre user e admin
* reset password self service

## Assunzioni correnti

* ogni utente ha una sola squadra fantasy
* la rosa utente e composta da esattamente 5 giocatori
* la rosa utente ha esattamente 1 portiere e 4 giocatori di movimento
* i 5 giocatori devono appartenere a 5 squadre reali diverse
* lo stesso giocatore reale puo comparire in piu squadre fantasy
* la rosa e bloccata dopo la creazione lato utente
* il nome squadra non deve essere unico, ma puo essere filtrato per parole non ammesse
* il coach non fa piu parte del dominio
* il capitano raddoppia il punteggio del proprio giocatore
* il voto MVP incide anche sul punteggio fantasy: l'MVP ufficiale riceve 5 punti
* i contenuti non admin del torneo sono pubblici

## Macro aree applicative

* area pubblica: presentazione torneo, calendario, partite, classifica, squadre fantasy pubbliche
* area utente: registrazione, mia squadra, voto MVP, dettagli punteggi
* area admin: anagrafiche, partite, partecipanti alla partita, bonus, utenti, log, supervisione

## Glossario minimo

* `FootballTeam`: squadra reale del torneo
* `FantasyTeam`: squadra fantasy creata da un utente
* `Captain`: giocatore della rosa fantasy che raddoppia il proprio punteggio
* `MatchPlayer`: giocatore segnato come presente in una partita e quindi votabile come MVP
* `Vote`: voto MVP espresso da un utente su una partita
* `BonusType`: tipo di bonus o malus configurabile
* `PlayerMatchBonus`: assegnazione concreta di un bonus o malus a un giocatore in una partita
