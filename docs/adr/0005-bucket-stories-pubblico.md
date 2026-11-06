# 0005. Bucket R2 delle stories pubblico in lettura

- **Stato:** accettato
- **Data:** 2026-11-06

## Contesto

I browser devono scaricare foto e video delle stories. La riservatezza dei file non è un obiettivo (le stories sono visibili anche ai guest, ADR-0006); contano semplicità e cache.

## Decisione

Il bucket R2 delle stories attive è pubblico in lettura, servito da un dominio personalizzato, con percorsi impossibili da indovinare decisi da Next. Il link di un file non cambia mai e passa dalla cache di Cloudflare. L'archivio su Hetzner resta privato.

## Alternative scartate

- **Bucket privato con URL firmati in lettura:** link diversi a ogni richiesta del feed, quindi niente cache nel browser e nel service worker; scadenze da gestire per chi lascia l'app aperta.
- **Next che fa da tramite per i file:** riporta i byte sul server, lo stesso problema evitato nel caricamento.

## Conseguenze

- Chi ha il link di un file può vederlo senza login, anche dopo averlo copiato fuori dall'app, finché il file resta su R2.
- In produzione va usato il dominio personalizzato e non l'indirizzo `r2.dev` di prova.
