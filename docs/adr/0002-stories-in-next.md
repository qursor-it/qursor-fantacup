# 0002. Stories gestite da Next, senza servizio separato

- **Stato:** accettato
- **Data:** 2026-11-06

## Contesto

Le stories (foto e video brevi che scadono) erano state assegnate il 2026-11-04 a un servizio Quarkus separato, per due motivi: la compressione dei video con ffmpeg consuma molta CPU, e un problema nelle stories non doveva rompere il resto dell'app. Era già stata scritta l'autenticazione tra Next e Quarkus (token firmato da Next e JWKS).

Nel frattempo il Media Composer (`ai_context/media_composer.md`) ha dimostrato che il browser può esportare da solo un MP4 compresso di al massimo 15 secondi e foto ridimensionate senza dati EXIF.

## Decisione

Interfaccia e backend delle stories stanno in Next, come il resto dell'app. Il servizio Quarkus, il token e il JWKS sono stati rimossi. La compressione avviene nel browser; il server firma gli URL, salva i dati, applica permessi e limiti ed esegue i job.

## Alternative scartate

- **Servizio Quarkus dedicato:** senza ffmpeg sul server non resta lavoro pesante da isolare; un secondo servizio (JVM, deploy per torneo, autenticazione tra servizi) costava più di quanto rendeva.
- **Migrare tutto il backend a Quarkus:** valutato il 2026-11-04 e scartato, settimane di lavoro per tornare alle funzioni attuali.
- **Compressione sul server prima di caricare nello storage:** richiede che il file passi dal server due volte e un processo che occupa molta CPU.

## Conseguenze

- Il server non verifica il contenuto dei file: si fida del tipo dichiarato e controlla solo la dimensione reale (ADR-0004).
- La qualità e il peso dei file dipendono dall'editor e dal telefono.
- Se in futuro servisse un lavoro pesante sul server (per esempio convertire video caricati da galleria senza editor), va rivalutato un processo separato.
