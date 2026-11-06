# 0006. Stories visibili anche ai guest

- **Stato:** accettato
- **Data:** 2026-11-06

## Contesto

All'inizio le stories erano riservate agli utenti loggati. Si vuole però poter condividere fuori dall'app un link alla pagina con le stories, e chi lo apre spesso non ha un account.

## Decisione

- Tutti vedono le stories attive, anche i guest. Pubblicare resta riservato ad admin, capisquadra e utenti registrati con le loro regole.
- I guest possono solo guardare: niente reazioni né segnalazioni.
- Nelle visualizzazioni l'autore vede gli utenti per nome e gli ospiti come totale ("+12 ospiti"), contati con un identificativo anonimo salvato nel browser.
- La pagina delle stories non va indicizzata dai motori di ricerca.

## Alternative scartate

- **Solo utenti loggati, con il link che porta al login:** la condivisione diventerebbe solo un invito a registrarsi.
- **Guest che reagiscono o segnalano:** reazioni e segnalazioni ripetute o false senza modo di fermarle.

## Conseguenze

- Una story è di fatto pubblica: la dichiarazione mostrata prima della pubblicazione e la pagina privacy lo devono dire.
- Un contenuto offensivo visto da un guest non può essere segnalato da lui.
- L'identificativo anonimo è un dato salvato sul dispositivo: va valutato se richiede consenso o una menzione nella privacy.
