# F7 · Configuratore per gli organizzatori

Decisione: `docs/adr/0010-configurazione-in-tre-livelli.md`.

Obiettivo della fase: gli organizzatori di ciascun torneo modificano da soli, dalla pagina `/admin/impostazioni`, le regole e i contenuti del livello 3. Identità (nome, colori, logo, immagini) e infrastruttura restano fuori dal configuratore. La fase non blocca la partenza della FacolCup, tranne il regolamento in PDF (F6-08).

### F7-01 · Quando un torneo "è iniziato"

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** la condizione dopo cui le regole che toccano i punteggi non si possono più cambiare.
- **Opzioni:** prima partita conclusa; prima squadra fanta creata; data di inizio impostata dagli organizzatori; blocco manuale.
- **Fatto quando:** la condizione è in `domain_rules.md`.
- **Dipende da:** —

### F7-02 · Regole nel database

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** un solo posto per ogni regola del livello 3.
- **File:** `prisma/schema.prisma` (estensione di `AppSetting` o tabella dedicata), `lib/app-settings.ts`, `tournaments/index.ts`, `lib/domain/mvp.ts`, chi legge `tournament.rules`.
- **Fatto quando:** portieri, giocatori di movimento, moltiplicatore del capitano, finestra MVP e punti MVP si leggono dal database; al primo avvio i valori vengono presi da `tournaments/<id>`; i punti MVP hanno un solo posto (tipo bonus `MVP` o impostazione, non entrambi); lettura in cache con etichetta, invalidata al salvataggio; comportamento del DCup invariato.
- **Dipende da:** F1-03

### F7-03 · Pagina impostazioni: regole del fantacalcio

- **Stato:** da fare
- **Tipo:** fare
- **File:** `app/(admin)/admin/impostazioni/`, azioni admin.
- **Fatto quando:** gli organizzatori modificano le regole con validazione; dopo l'inizio del torneo (F7-01) i campi sono bloccati e il server rifiuta le modifiche; ogni modifica va nell'audit log.
- **Dipende da:** F7-01, F7-02

### F7-04 · Pagina impostazioni: stories

- **Stato:** da fare
- **Tipo:** fare
- **Fatto quando:** gli organizzatori modificano limiti (stories attive per caposquadra, durata, dimensioni massime dei file) ed emoji delle reazioni; i valori iniziali sono quelli decisi in F3-01 e F3-04; le regole che non si possono cambiare a stories già pubblicate sono indicate.
- **Dipende da:** F7-02, F3-11

### F7-05 · Documentare il configuratore

- **Stato:** da fare
- **Tipo:** fare
- **Fatto quando:** `ai_context/` descrive quali impostazioni esistono, chi le cambia e quando sono bloccate; `multi_tournament.md` spiega i tre livelli per chi aggiunge un torneo.
- **Dipende da:** F7-03, F7-04
