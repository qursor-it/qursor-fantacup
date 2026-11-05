# Handoff – Media Composer

Stato al 2026-11-05, branch `develop`. Commit: `87247c9` (feature), `49338c7` (limiti durata video).
Documentazione completa: `ai_context/media_composer.md`. Requisiti stories: `ai_context/stories.md`.

## Fatto

- Editor foto e video nel browser: pagina `/media/crea`, voce "Crea foto o video" nel menu squadra, componente riusabile `components/media-composer/media-composer.tsx` (`onCancel`, `onComplete`, `uploadService`).
- Motore in `lib/media/`: renderer unico per anteprima ed export, export foto WebP/JPEG ≤ 2048 px, video MP4 H.264/AAC ≤ 1920 px 30 fps (Mediabunny + WebCodecs), musica generata nel browser.
- Pubblicazione simulata: `POST /api/media/mock-upload`, solo metadati, nessun salvataggio.
- Limiti: foto in ingresso ≤ 30 MB, video in ingresso ≤ 500 MB e ≤ 30 s (oltre viene rifiutato), video esportato ≤ 15 s. Costanti in `lib/media/composition.ts`.
- Verifiche: `tsc`, lint, build, 73 test Vitest in `lib/media`; percorso completo provato in Chrome con emulazione Pixel 7 e fotocamera finta.

## Da verificare a mano

Checklist completa in `ai_context/media_composer.md` ("Checklist manuale"). Mai provati:

- [ ] Safari su iPhone e Chrome su Android reali, PWA installata
- [ ] Permessi camera/microfono negati (messaggio e alternativa galleria)
- [ ] Cambio fotocamera frontale/posteriore e specchio del video frontale
- [ ] Gesti a due dita (pizzico, rotazione) su touch reale
- [ ] Video della galleria oltre 30 s rifiutato con il messaggio giusto
- [ ] HEIC da galleria su Safari

## Decisioni aperte

- [ ] Galleria oltre 30 s: oggi viene rifiutato. Alternativa: aprirlo e far scegliere i 15 s dentro una finestra di 30 s.
- [ ] Dimensione massima del file esportato per il servizio reale (proposta: 10 MB foto, 30 MB video), da controllare sia nel client sia in Quarkus. Aperto anche in `stories.md`.
- [ ] Ruoli: oggi chiunque può creare video; da `stories.md` l'utente registrato pubblica solo foto. Da far rispettare in Quarkus ed eventualmente nella pagina.
- [ ] Testo della dichiarazione di non responsabilità da mostrare prima della pubblicazione.
- [ ] Brani musicali reali con licenza (oggi 3 brani sintetici in `lib/media/music.ts`).

## Prossimi passi

1. Upload reale: implementare `MediaUploadService` (`lib/media/upload.ts`) con URL firmato da Quarkus + `PUT` con progresso, passarlo via prop `uploadService`; poi rimuovere `app/api/media/mock-upload` e `lib/media/mock-upload.ts`.
2. Eventuale spostamento dell'export video in un Web Worker, se su telefoni lenti blocca l'interfaccia.

## Note

- `lib/stories-token.test.ts` fallisce senza `quarkus/dev-keys/privateKey.pem` (file gitignored): non dipende dal composer.
- Su desktop l'area utente è bloccata da `MobileOnlyGate`: per provare usare l'emulazione dispositivo di DevTools.
- Dipendenze aggiunte: `mediabunny` e `@mediabunny/aac-encoder` 1.65.2 (MPL-2.0; l'encoder AAC contiene FFmpeg LGPL).
