# Media Composer

Editor di foto e video che gira interamente nel browser. Produce il file da pubblicare; la pubblicazione, per ora, e solo simulata.

## Scopo e perimetro

* Editor lato client: ritaglio, rotazione, filtri (foto), testo, sticker, trim e musica (video).
* Pubblicazione **mock**: nessuna persistenza, nessun database, nessun file lascia il dispositivo (all'endpoint mock arrivano solo i metadati).
* Indipendente dall'immagine story della squadra (`app/api/story/[teamId]`) e dal futuro servizio Quarkus descritto in `stories.md`.
* Il file esportato e quello che in futuro verra caricato con URL firmato. Il punto di sostituzione e `MediaUploadService` (vedi "Sostituire il mock").
* Permessi: in `stories.md` gli utenti registrati pubblicano solo foto. Il composer permette il video a tutti perche la pubblicazione e simulata; il servizio reale deve far rispettare i ruoli.

## Architettura

Logica pura e motore in `lib/media/`:

* `types.ts`: modello (`MediaComposition`, overlay, `ExportedMedia`).
* `geometry.ts`: ritaglio, dimensioni di output, pan, rotazione.
* `composition.ts`: creazione, normalizzazione, validazione file, trim, cronologia annulla/ripristina.
* `render.ts`: renderer unico (`renderComposition`), filtri sui pixel, overlay.
* `stickers.ts`: catalogo sticker.
* `music.ts`: catalogo brani, calcolo dell'inizio e della copertura, estratto audio.
* `export.ts`: esportazione foto e video, analisi del video di partenza.
* `upload.ts`: `MediaUploadService` e implementazione mock.
* `mock-upload.ts`: validazione del payload e latenza dell'endpoint mock.

Interfaccia: componenti UI in `components/media-composer/`, pagina `/media/crea`, punto di accesso nel menu squadra.

## Modello dati

`MediaComposition` e serializzabile. Coordinate normalizzate: `x`/`y` degli overlay sono frazioni dell'output, `size` e frazione della larghezza dell'output (altezza del font per il testo, larghezza per lo sticker). File, stream e object URL restano fuori dal modello, nei componenti.

## Renderer unico

`renderComposition` disegna ritaglio, rotazione, specchio, regolazioni e overlay. Anteprima ed export usano la stessa funzione e cambia solo la dimensione del canvas: quello che si vede e quello che si esporta. Per questo non c'e Konva (nessuna dipendenza in piu).

## Codifica

**Foto**: canvas, WebP qualita 0.82; JPEG se il browser non sa codificare WebP (Safari). Lato lungo massimo 2048, mai ingrandita. L'EXIF sparisce perche si ricodifica; l'orientamento e applicato da `createImageBitmap` con `imageOrientation: "from-image"`.

**Video**: Mediabunny + WebCodecs, MP4 H.264 + AAC.

* Lato lungo massimo 1920, dimensioni pari, massimo 30 fps.
* Video circa 3 Mbps, scalati sul numero di pixel; audio AAC 128 kbps; keyframe ogni 2 s.
* Encoder AAC WASM (`@mediabunny/aac-encoder`) caricato solo se il browser non codifica AAC in modo nativo.
* Sorgente decodificata a dimensione ridotta.
* Il file prodotto viene riletto e verificato (codec, dimensioni, durata ±0.5 s, presenza audio) prima di essere dichiarato valido.

## Musica

* Catalogo di brani generati nel browser con `OfflineAudioContext`: nessun asset con licenza.
* La musica **sostituisce** l'audio originale.
* L'inizio e limitato in modo che il brano copra la clip. Se il brano e piu corto della clip, la coda resta in silenzio: niente loop.

## Dipendenze aggiunte

* `mediabunny` 1.65.2 (MPL-2.0).
* `@mediabunny/aac-encoder` 1.65.2 (MPL-2.0): incapsula l'encoder AAC di FFmpeg in WASM. Il componente FFmpeg e LGPL: tenerne conto in caso di redistribuzione.

Scelte rispetto a ffmpeg.wasm: molto piu piccolo, usa WebCodecs (anche hardware), decodifica in streaming.

## Formati supportati

* Ingresso foto: JPEG, PNG, WebP, GIF (primo fotogramma), AVIF; HEIC/HEIF solo dove il browser li decodifica (Safari).
* Ingresso video: MP4, MOV, WebM, con codec che il browser sa decodificare.
* Uscita: foto WebP o JPEG; video MP4 H.264/AAC.

## Limiti dei browser

* Video: serve WebCodecs. Chrome/Edge 94+; Safari 16.4+ per la codifica video. Decodificare l'audio originale richiede `AudioDecoder`: Safari 26+.
* Firefox non codifica AAC: si usa l'encoder WASM.
* `MediaRecorder` (registrazione da camera): Safari produce mp4, Chrome mp4 o webm.
* HEIC solo su Safari.
* I filtri sono implementati in JS sui pixel perche `ctx.filter` manca su Safari.
* Nessun fallback silenzioso: se qualcosa non e supportato si mostra un errore esplicito.

## Aggiungere sticker

Mettere il file in `public/stickers/` (gli SVG devono avere `width` e `height` espliciti) e aggiungere una riga in `STICKERS` in `lib/media/stickers.ts`.

## Aggiungere musica

Mettere il file in `public/music/` e aggiungere in `MUSIC_CATALOG` (`lib/media/music.ts`) `{ id, title, artist, durationSeconds, load: () => loadAudioFile("/music/brano.mp3") }`. Solo brani con licenza.

## Sostituire il mock

Implementare `MediaUploadService` (`lib/media/upload.ts`): per esempio chiedere a Quarkus un URL firmato e fare un `PUT` del file con `XMLHttpRequest` per avere il progresso reale. Il servizio si passa con la prop `uploadService` di `MediaComposer`. Poi si puo rimuovere `app/api/media/mock-upload` e `lib/media/mock-upload.ts`.

## Endpoint mock

`POST /api/media/mock-upload`, JSON con soli metadati: `filename`, `mimeType` (`image/webp`, `image/jpeg`, `video/mp4`), `type` (coerente col MIME), `size` (intero fino a 500 MB), `width`/`height` (1..4096), `durationSeconds` (obbligatorio per i video, fino a 61), `simulate` opzionale (solo `"error"`).

* Richiede utente autenticato (401), limite 20 richieste al minuto per utente (429 con `Retry-After`).
* Payload non valido o JSON rotto: 400 `{ error: "invalid_payload" }`.
* Attesa simulata di 900 ms. Con `simulate: "error"`: 503 `{ error: "mock_failure" }`.
* Successo: 200 con `{ id: "mock-<uuid>", status: "mocked", filename, mimeType, size, createdAt }` e `Cache-Control: no-store`.
* Non salva nulla, non usa il database, non legge file.

## Test

**Vitest** (`lib/media/*.test.ts`): geometria, normalizzazione e cronologia, calcoli della musica, filtri sui pixel, servizio di upload (con `fetch` finto), validazione e route dell'endpoint mock.

**Serve un browser vero**: codifica e decodifica (WebCodecs, `OfflineAudioContext`, canvas), camera, permessi, riproduzione.

### Verifica automatica dell'export in Chrome

La pipeline di export e stata verificata con uno script in Chrome headless (non committato). Procedura riproducibile:

1. Creare una pagina di prova che importa `lib/media/export.ts` e la espone su `window`; impacchettarla con esbuild.
2. Avviare Chrome con `playwright-core` e `executablePath` verso Chrome installato; servire la pagina.
3. Sorgente sintetica generata nel test: video con colori noti per verificare rotazione, specchio, ritaglio e pixel dello sticker; audio con tono a 440 Hz.
4. Controlli: musica contro audio originale (frequenza dominante dell'audio esportato), ingresso WebM prodotto da `MediaRecorder`, annullamento a meta export (abort), foto in WebP.
5. Rileggere il file esportato (Mediabunny / decodifica) e confrontare dimensioni, durata, codec e pixel.

### Checklist manuale

| # | Caso | Risultato atteso |
|---|------|------------------|
| 1 | Foto + scritta | La scritta in anteprima coincide con il file scaricato (posizione, dimensione, colore) |
| 2 | Foto da galleria + sticker | Lo sticker compare nella posizione scelta; HEIC accettato su Safari |
| 3 | Video camera posteriore | Registrazione, anteprima e export corretti, orientamento giusto |
| 4 | Video camera frontale | Specchio attivo per default; il file esportato corrisponde all'anteprima |
| 5 | Video importato + trim | Il file dura quanto l'intervallo scelto (1-60 s) |
| 6 | Scritta su video | La scritta e visibile per tutta la clip e nella posizione dell'anteprima |
| 7 | Sticker su video | Come sopra |
| 8 | Brano e punto iniziale | Cambiando l'inizio si sente il punto scelto; l'inizio non supera fine brano meno durata clip |
| 9 | Export video con musica | Nel file c'e solo la musica, niente audio originale |
| 10 | Scaricare e riprodurre il file | Il file si apre nel lettore del sistema con audio e video corretti |
| 11 | Simulare pubblicazione | Progresso, poi conferma con id `mock-...` e la dicitura che nessun file e stato salvato; offline compare l'errore e si puo riprovare |
| 12 | Annullare un'operazione | "Annulla" durante l'export o la pubblicazione simulata interrompe l'operazione e torna indietro senza errori; annulla/ripristina nell'editor tornano allo stato precedente |
| 13 | Permessi negati | Camera/microfono negati: messaggio chiaro e alternativa dalla galleria |
| 14 | Audio originale presente senza musica | Un video con audio e senza brano mantiene l'audio originale nel file |

Dispositivi da provare: Safari su iPhone, Chrome su Android, PWA installata, Chrome desktop con emulazione dispositivo di DevTools (l'user agent desktop e bloccato da `MobileOnlyGate`).
