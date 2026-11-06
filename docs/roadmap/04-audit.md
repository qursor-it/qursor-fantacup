# F4 · Residui degli audit del 2026-11-03

Fonti: `docs/audit-quality-2026-11-03.md`, `docs/audit-performance-2026-11-03.md`. Il 2026-11-03 molti punti sono già stati corretti (commit `fix(admin)`, `fix(scoring)`, `fix(volley)`, `fix(security)`, `perf:`, `chore:`, `ci:` di quel giorno). Qui restano quelli probabilmente ancora aperti: il primo task li verifica.

### F4-01 · Verificare cosa resta aperto

- **Stato:** da fare
- **Tipo:** verificare
- **Obiettivo:** confrontare ogni punto dei due audit con il codice attuale.
- **Fatto quando:** in fondo a ciascun audit c'è una sezione "Stato al …" con i punti corretti e quelli aperti, e i task qui sotto sono confermati, tolti o aggiunti.
- **Dipende da:** —

### F4-02 · Punti dell'MVP: 3 o 5

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** valore unico. Il regolamento pubblico dice 5; `ai_context/domain_rules.md` dice "default 3" del `BonusType` `MVP`; l'audit segnalava che il seed non crea quel tipo bonus.
- **Fatto quando:** il valore è deciso e allineato in regolamento, pagina admin, seed e `domain_rules.md`.
- **Dipende da:** —

### F4-03 · Paginazione delle liste grandi

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** pagine leggere anche con 500 squadre (audit performance, punto 6).
- **File:** `/classifica-fanta` (441 KB), `/squadre-fanta` (366 KB), `/giocatori` (205 KB), `/admin/utenti` (180 KB), `/admin/squadre-fantasy` (159 KB).
- **Fatto quando:** paginazione o "prime N più ricerca", con l'utente che trova sempre la propria squadra; HTML rimisurato.
- **Dipende da:** F1 (consigliato)

### F4-04 · Font e CSS

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** audit performance, punto 10.
- **Fatto quando:** il tema PrimeReact non scarica più `InterVariable.woff2` (345 KB) in aggiunta all'Inter di `next/font`; Tallica in woff2 con preload; peso del CSS globale verificato.
- **Dipende da:** —

### F4-05 · Invalidazione selettiva

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** audit performance, punto 11: oggi ogni scrittura admin del torneo cancella lo snapshot della classifica e invalida 11 path e 8 etichette.
- **File:** `app/actions/admin/revalidate-public.ts` e chi lo chiama.
- **Fatto quando:** ogni azione invalida solo ciò che cambia (un gol non deve svuotare dati che non dipendono dai gol). Importante prima di F2-05, perché con il tempo reale ogni gol diventa un evento per tutti.
- **Dipende da:** F1-03

### F4-06 · Scritture admin e transazioni

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** audit performance punto 12 e audit qualità (coppie di scritture non in transazione).
- **Fatto quando:** `addAllMatchPlayers` senza decine di upsert in sequenza; `initBracket` in una transazione; il lock della modifica rosa tenuto per meno query; creazione partita con giocatori, chiusura fase con apertura mercato, modifica con riga di audit log ciascuna in una transazione (verificare quali sono già sistemate).
- **Dipende da:** F4-01

### F4-07 · Duplicati rimasti

- **Stato:** da fare
- **Tipo:** fare
- **Obiettivo:** audit qualità: una sola implementazione per tipo.
- **Fatto quando:** verificato e, dove serve, unificato: validatori di id, hook `matchMedia`, componenti bandiera/logo squadra, varianti del pulsante indietro (la sincronizzazione dei giocatori di una partita è già unificata).
- **Dipende da:** F4-01

### F4-08 · Modello dati in ai_context

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** `ai_context/prisma_model.md` duplica `prisma/schema.prisma` e tende a restare indietro.
- **Fatto quando:** deciso se rigenerarlo a ogni modifica dello schema o scrivere che fa fede `prisma/schema.prisma` e tenere in `ai_context/` solo le regole; `AGENTS.md` aggiornato di conseguenza.
- **Dipende da:** —
