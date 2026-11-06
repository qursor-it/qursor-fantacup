# F5 · Decisioni di prodotto e altro

Punti aperti che non dipendono dalle altre fasi. Provengono dal vecchio `ai_context/open_questions.md` e dal vecchio `TODO.md`.

### F5-01 · Spareggi di classifica

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** regole per ordinare le squadre a pari punti. Oggi: classifica fanta con stessa posizione a pari punti e ordine alfabetico; gironi del torneo per punti, differenza reti, gol fatti, nome.
- **Fatto quando:** criteri e ordine scritti in `domain_rules.md`.
- **Dipende da:** —

### F5-02 · Anti spam e anti abuso

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** limiti concreti su registrazioni e voti ripetuti, eventuale captcha in registrazione, come tradurre "massimo 3 per dispositivo" in una regola realistica.
- **Contesto:** i limiti attuali sono in memoria e si azzerano a ogni riavvio (login 10 tentativi/15 min per email e 30 per IP; registrazione 5/ora per IP; voto MVP, cambio password, cancellazione account 5/ora per utente; `/api/story` e `/api/track` 30/min per IP). Con un solo container per torneo (ADR-0001) non serve uno store condiviso tra istanze, ma resta l'azzeramento al riavvio.
- **Fatto quando:** le regole sono in `domain_rules.md` e, se cambiano, nel codice.
- **Dipende da:** —

### F5-03 · Sessione persistente

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** cosa significa "per sempre se possibile", durata pratica della sessione, rinnovo automatico.
- **Fatto quando:** la scelta è in `technical_baseline.md` o `roles_permissions.md` e applicata in `lib/auth.ts`.
- **Dipende da:** —

### F5-04 · Recupero accesso assistito

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** procedura quando un utente perde accesso alla mail o alle credenziali, e responsabilità degli admin in assenza di reset password self service.
- **Fatto quando:** la procedura è in `user_flows.md`.
- **Dipende da:** —

### F5-05 · Migliorare l'interfaccia di voto

- **Stato:** da fare
- **Tipo:** decidere
- **Obiettivo:** dal vecchio `TODO.md`: definire cosa migliorare nella pagina `/vota/[id]`.
- **Fatto quando:** i miglioramenti sono descritti come task "fare" in questa fase.
- **Dipende da:** —
