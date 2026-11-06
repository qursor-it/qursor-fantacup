# 0003. R2 per le stories attive, Hetzner come archivio

- **Stato:** accettato
- **Data:** 2026-11-06

## Contesto

Una story si carica una volta e si guarda molte volte, anche da 100–200 persone insieme. Dopo 24 ore sparisce dal feed, ma a fine torneo gli admin vogliono rivederle, selezionarle e scaricarle. È già disponibile un Hetzner Object Storage (1 TB di spazio e 1 TB di traffico in uscita compresi nel canone). Il server di Next non è su Hetzner.

## Decisione

- Stories attive su **Cloudflare R2**, che non fa pagare il traffico in uscita; si pagano solo spazio e operazioni oltre la soglia gratuita.
- Stories scadute spostate una volta al giorno in un bucket privato su **Hetzner Object Storage**, letto solo dagli admin a fine torneo.
- Le chiavi degli storage restano solo sul server.

## Alternative scartate

- **Solo Hetzner:** la quota di traffico in uscita si consumerebbe proprio quando tutti guardano le stories.
- **Solo R2, file tenuti fino a fine torneo:** possibile e più semplice; scartato perché l'archivio ha un posto proprio, già pagato, e R2 resta limitato alle stories attive.
- **Cancellare i file dopo 24 ore:** era il requisito iniziale; cambiato perché si vogliono rivedere le stories a fine torneo.
- **Hetzner Storage Box:** non è compatibile con S3, quindi niente URL firmati.

## Conseguenze

- Serve un job giornaliero che sposta i file passando dal server di Next (ADR-0009).
- Ogni file può trovarsi in due posti: le eliminazioni (moderazione, account) devono cercarlo in entrambi.
- Chi pubblica deve sapere che le stories vengono conservate: va scritto nella dichiarazione mostrata prima della pubblicazione e nella pagina privacy.
