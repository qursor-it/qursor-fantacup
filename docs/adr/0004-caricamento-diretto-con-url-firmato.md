# 0004. Caricamento diretto con URL firmato e story "in caricamento"

- **Stato:** accettato
- **Data:** 2026-11-06

## Contesto

Il file prodotto dal Media Composer deve arrivare su R2 senza passare da Next. I limiti (una story per finestra MVP per l'utente registrato, 10 attive per il caposquadra) non devono essere aggirabili con richieste in parallelo, e una conferma persa per un buco di rete non deve lasciare file orfani o contare due volte.

## Decisione

- Il browser chiede il permesso a Next. Next controlla ruolo, regole e limiti, **crea subito la story in stato "in caricamento"** (che conta per i limiti, garantiti dal database), decide il percorso del file e restituisce un URL firmato PUT legato a quel percorso e al tipo di file.
- Ogni story ha una **scadenza di caricamento** fissa (per esempio 10 minuti) che non riparte. Un nuovo URL per la stessa story si ottiene solo prima della scadenza.
- Alla conferma Next fa una `HEAD` su R2: il file deve esistere, avere una dimensione nei limiti ed essere stato scritto prima della scadenza. La conferma è ripetibile.
- Se la finestra MVP si chiude tra la richiesta e la conferma, la story si pubblica: conta il permesso dato all'inizio.
- Le stories "in caricamento" scadute si sistemano quando l'utente fa una nuova richiesta o riprova la conferma, e in ogni caso nel job giornaliero.

## Alternative scartate

- **File che passa dal server:** banda e memoria del server per ogni caricamento, senza vantaggi di sicurezza reali.
- **Story creata solo alla conferma:** due richieste in parallelo aggirano i limiti; una conferma persa lascia un file senza riga.
- **URL "solo per l'app" o cifrato:** impossibile, tutto ciò che fa l'app lo può fare l'utente dal suo dispositivo.
- **Rifiutare la conferma se la finestra MVP si è chiusa:** penalizza chi era in regola quando ha premuto "pubblica".

## Conseguenze

- Il limite di dimensione si verifica solo alla conferma: R2 non supporta il caricamento POST con policy che lo imporrebbe prima.
- Il tipo di file è una dichiarazione del client; un utente autorizzato può al massimo riscrivere il proprio file finché l'URL non scade. Rischio accettato.
- Una story recuperata in ritardo dal job può risultare già scaduta e andare direttamente nell'archivio.
