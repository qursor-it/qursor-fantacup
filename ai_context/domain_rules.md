# Domain Rules

## Regole confermate

### Utenti e squadre fantasy

* un utente puo avere una sola squadra fantasy
* una squadra fantasy appartiene a un solo utente
* il coach e stato rimosso dal dominio
* ogni squadra fantasy deve avere un capitano

### Rose fantasy

* una squadra fantasy contiene esattamente 5 giocatori
* la composizione e fissa: 1 portiere e 4 giocatori di movimento
* i 5 giocatori della rosa devono appartenere a 5 squadre reali diverse
* un giocatore puo comparire in piu squadre fantasy
* la rosa fantasy e bloccata per l'utente dopo la creazione iniziale, **salvo durante una finestra di modifica ("mercato") aperta dall'admin**
* durante la finestra l'utente puo sostituire fino a un numero massimo di giocatori configurato dall'admin (budget cumulativo rispetto alla rosa di partenza); il cambio di capitano e sempre consentito e non consuma cambi; il nome squadra resta non modificabile
* gli admin possono intervenire manualmente sulle rose
* il capitano deve appartenere alla rosa della squadra fantasy
* il capitano raddoppia il punteggio del proprio giocatore

### Giocatori e ruoli

* i ruoli validi sono solo `GK` e `PLAYER`
* il ruolo di un giocatore e fisso
* ogni giocatore appartiene a una sola squadra reale

### Nome della squadra fantasy

* il nome della squadra fantasy non deve essere unico
* il nome non e modificabile dopo la creazione utente
* alcune parole devono essere filtrate o censurate

### Partite

* ogni partita coinvolge esattamente due squadre reali
* una partita ha una squadra di casa e una squadra ospite
* una partita deve avere stati espliciti: bozza, programmata, conclusa, pubblicata
* quando un admin imposta una partita come conclusa, si apre la finestra di voto MVP
* il voto MVP resta aperto per 2 ore dalla chiusura della partita
* gli admin possono chiudere o riaprire la finestra di voto (**non ancora implementato**: oggi l'unica leva e riportare la partita a "programmata" e riconcluderla, che riapre una nuova finestra di 2 ore)
* transizioni di stato ammesse: bozza ↔ programmata, programmata/live → conclusa, conclusa → programmata
* per concludere una partita servono entrambe le squadre e un risultato (anche 0-0)
* se la partita ha marcatori registrati, il risultato e calcolato dai gol e non si modifica a mano; i marcatori devono appartenere a una delle due squadre della partita
* una partita conclusa che ricade in una fase di punteggio gia chiusa non puo essere riportata indietro (verrebbe contata due volte); si correggono direttamente gol e bonus
* una partita conclusa o con gol/voti/bonus non si elimina; le partite del tabellone si gestiscono solo dalla pagina eliminazione diretta

### Giocatori presenti in partita

* solo i giocatori segnati come presenti nella partita possono essere votati come MVP; i voti per un giocatore poi rimosso dai presenti non contano
* nel torneo il set atteso e di 10 giocatori totali per partita
* la gestione dei giocatori presenti e una responsabilita admin

### Voto MVP

* un utente puo votare una sola volta per partita
* il voto non e modificabile dall'utente
* se un utente cancella l'account i suoi voti restano (anonimizzati, `userId = null`), cosi gli MVP gia assegnati non cambiano
* i voti dei singoli utenti sono privati
* durante la finestra di voto si puo mostrare un favorito provvisorio
* dopo la chiusura si mostra l'MVP finale della partita
* se due o piu giocatori sono pari a fine finestra, l'MVP resta non assegnato finche un admin non lo sceglie manualmente
* il voto MVP ha sia funzione di engagement sia impatto sul punteggio fantasy

### Punteggio e classifica

* il punteggio fantasy deriva da bonus e malus assegnati dagli admin
* il giocatore MVP ufficiale riceve i punti configurati nel BonusType con codice `MVP` (default 3)
* il punteggio di una squadra e la somma dei punteggi dei 5 giocatori della rosa
* il raddoppio del capitano si applica al punteggio del singolo giocatore capitano
* la classifica principale e cumulata totale
* a parita di punti le squadre hanno la stessa posizione (1, 1, 3); l'ordine di visualizzazione tra pari e alfabetico
* il punteggio fanta e articolato in **fasi** (es. gironi, eliminazione, semifinali, finali): alla chiusura di una fase i punti fatti da ogni squadra fino a quel momento (con la rosa di allora) vengono **congelati** in uno snapshot e non cambiano piu, anche se in seguito cambiano le rose o si correggono bonus passati
* la classifica generale = somma delle fasi congelate + fase in corso; esistono anche viste per singola fase
* le fasi le chiude l'admin: spuntando "salva storico" all'apertura del mercato, oppure con un pulsante dedicato "Chiudi fase ora"
* una fase non si puo chiudere finche c'e una partita (nell'intervallo della fase) con MVP non definitivo (voto ancora aperto o pareggio senza scelta admin): altrimenti il bonus MVP andrebbe perso
* il BonusType con codice `MVP` non puo essere rinominato ne eliminato
* non esiste il concetto di giornata
* deve esistere uno storico punteggi per partita
* il dettaglio dei bonus assegnati deve essere consultabile
* **una squadra fanta accumula punti solo dalle partite concluse a partire dalla propria `createdAt`** (`FantasyTeam.createdAt`): le partite e le fasi concluse prima dell'iscrizione non vengono conteggiate (contribuiscono 0); il confine e incluso (`concludedAt >= createdAt` conta). Lo storico mostra queste partite con una nota "Precedente all'iscrizione — non conteggiata" e totale 0. In fase di registrazione e di creazione squadra viene mostrato un avviso se il torneo e gia in corso.

### Fasi del torneo

* il torneo si articola in due fasi: **fase a gironi** e **fase ad eliminazione diretta**
* le due fasi coesistono — le partite senza `groupId` e `knockoutRoundId` sono amichevoli o fuori fase
* una partita ha al massimo un `groupId` **oppure** un `knockoutRoundId`, mai entrambi

#### Fase a gironi

* ci sono 4 gironi (A, B, C, D), ciascuno con 4 squadre (16 totali)
* ogni girone ha la propria classifica calcolata con `computeGroupStandings(groupId)`
* le prime 2 classificate di ogni girone passano alla fase ad eliminazione diretta
* la qualificazione (`GroupTeam.qualified`) è gestita manualmente dall'admin
* una squadra appartiene a un solo girone alla volta

#### Fase ad eliminazione diretta

* bracket fisso a 8 squadre: 4 quarti di finale → 2 semifinali → finale + finale 3°/4° posto
* accoppiamenti QF predeterminati dalla posizione nel girone:
  * QF1: 1°A vs 2°B, QF2: 1°C vs 2°D, QF3: 2°A vs 1°B, QF4: 2°C vs 1°D
* i match placeholder vengono creati con `homeSeed`/`awaySeed` (es. "1A", "V QF1") e `homeTeamId = null`
* l'admin assegna le squadre reali ai match TBD usando `assignKnockoutTeams`
* l'avanzamento nel bracket è manuale — l'admin assegna le squadre alle fasi successive
* il vincitore si deduce dal risultato (`homeScore` vs `awayScore`), non da un campo dedicato

#### Punteggio fantasy e fasi

* il punteggio fantasy è cumulativo su tutte le fasi — non si resetta tra gironi e knockout; le **fasi di punteggio** (snapshot storici, vedi sezione "Punteggio e classifica") sono un meccanismo trasversale gestito dall'admin, indipendente dalla suddivisione gironi/knockout delle partite
* `computeStandings()` globale rimane invariata per la classifica generale

### Admin e audit

* gli admin possono creare, modificare ed eliminare squadre reali, giocatori e partite
* gli admin possono definire bonus e malus
* gli admin possono correggere dati anche dopo la pubblicazione
* le azioni admin che modificano dati devono essere tracciate in un log
* gli admin possono vedere tutte le squadre fantasy, modificarne la rosa, sospendere utenti, vedere e correggere voti
* gli admin possono aprire una finestra di modifica rosa (periodo + numero massimo di cambi) valida per tutte le squadre, e chiuderla in anticipo
* esiste un admin di default
* gli admin possono creare altri admin
* un admin non puo sospendere un altro admin, ne declassare se stesso o l'ultimo admin; un admin non puo eliminare il proprio account dal profilo
* cancellare un utente non cancella fasi congelate, finestre mercato e audit log da lui creati (riferimento messo a null)
* operativamente esiste un solo livello di admin

### Accesso e visibilita

* il prodotto e pubblico per la parte non admin
* calendario, informazioni sulle partite, classifica fantasy e dettaglio squadre fantasy sono pubblici
* autenticazione e richiesta per creare la squadra fantasy e votare
* il login e email-only
* le classifiche e le pagine pubbliche non espongono mai l'email degli utenti (se manca il nome si mostra "Utente")

## Vincoli funzionali da rispettare in applicazione

* i vincoli critici devono essere protetti anche a livello database quando possibile
* le validazioni di rosa devono impedire:
  * piu o meno di 5 giocatori
  * assenza del portiere
  * piu portieri
  * duplicazione della stessa squadra reale nella stessa rosa
  * capitano fuori rosa
* il frontend non deve essere l'unico punto di enforcement delle regole
* il calcolo del punteggio deve dipendere dai dati ufficiali registrati nel sistema

## Regole implicite utili per il progetto

* esiste una sola competizione attiva nel perimetro iniziale
* il sistema e pensato per uso comunitario locale, quindi la chiarezza operativa conta piu della complessita
* il modello dati corrente privilegia semplicita e auditabilita rispetto a casistiche avanzate
* l'area admin parte con CRUD semplici ma sicuri

## Decisioni ancora aperte

Le aree rimaste aperte sono poche e puntuali:

* regole custom di spareggio in classifica
* meccanismo concreto anti spam su registrazione e voto
* durata tecnica della sessione persistente
* forma finale del recupero accesso assistito da admin
