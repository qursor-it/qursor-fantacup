# Open Questions

Le 5 decisioni principali sono state chiuse in `ai_context/open_questions/decisioni_core.md` e propagate nei file di contesto.

Questo file non raccoglie piu le decisioni macro iniziali: ora elenca solo i punti ancora davvero aperti prima del planning completo.

## Decisioni gia consolidate

* rosa fissa da 5 giocatori: 1 portiere e 4 giocatori di movimento
* i 5 giocatori della rosa devono appartenere a 5 squadre reali diverse
* la rosa utente e bloccata dopo la creazione
* il coach e stato rimosso dal dominio
* esiste un capitano che raddoppia il punteggio del proprio giocatore
* voto MVP aperto per 2 ore dopo che l'admin conclude la partita
* il giocatore MVP ufficiale riceve 5 punti fantasy
* in caso di pari voti MVP, un admin sceglie manualmente il vincitore
* i voti singoli sono privati, ma si puo mostrare un favorito provvisorio
* il punteggio e cumulato totale, con storico per partita e senza giornate
* l'area pubblica mostra calendario, partite, classifica e squadre fantasy
* l'area admin copre anagrafiche, partite, bonus, voti, utenti, log e altri admin
* autenticazione email-only con ruoli `user` e `admin`

## Punti ancora aperti

### 0. Stories

Decisione presa in `stories.md`; i dettagli ancora aperti (limiti dei file video, emoji delle reazioni, testo di non responsabilita) sono elencati li.

### 1. Spareggi di classifica

Da definire:

* regole custom per ordinare squadre a pari punti (oggi: stessa posizione a pari punti, ordine alfabetico; nei gironi del torneo: punti, differenza reti, gol fatti, nome)
* eventuale ordine dei criteri di spareggio

### 2. Anti spam e anti abuso

Da definire:

* limite concreto su registrazioni ripetute
* limite concreto su votazioni ripetute
* se introdurre captcha semplice in registrazione
* come tradurre l'idea di "massimo 3 per device" in una regola tecnica realistica

Stato attuale (in memoria, per singola istanza: si azzera al riavvio e non e condiviso tra istanze):

* login: 10 tentativi / 15 min per email, 30 / 15 min per IP
* registrazione: 5 / ora per IP
* voto MVP, cambio password, cancellazione account: 5 / ora per utente
* `/api/story` e `/api/track`: 30 / min per IP

Da valutare se passare a uno store condiviso (Postgres/Redis) in caso di deploy multi-istanza.

### 3. Sessione persistente

Da definire:

* cosa significa esattamente "per sempre se possibile"
* durata pratica della sessione
* eventuale strategia di rinnovo automatico

### 4. Recupero accesso assistito

Da definire:

* procedura operativa quando un utente perde accesso alla mail o alle credenziali
* responsabilita admin in assenza di reset password self service
