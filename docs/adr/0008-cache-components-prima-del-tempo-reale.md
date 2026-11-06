# 0008. Migrazione a Cache Components prima del tempo reale

- **Stato:** accettato
- **Data:** 2026-11-06

## Contesto

Il progetto è su Next 16 ma usa ancora il modello di cache precedente: `unstable_cache` in `lib/data/public/cache.ts` e `export const dynamic` / `revalidate` in 39 file. Il tempo reale (ADR-0007) richiede una nuova funzione in cache per i dati live, e la homepage oggi interroga il database direttamente a ogni richiesta. L'audit del 2026-11-03 misura già tempi del server bassi (homepage 17 ms, pagine pubbliche 8–30 ms).

## Decisione

Prima di costruire il tempo reale si migra al modello Cache Components (`cacheComponents: true`, `use cache`, `cacheLife`, `cacheTag`), così le funzioni nuove nascono già nel modello definitivo.

## Alternative scartate

- **Prima il tempo reale, migrazione dopo:** `getLiveMatches()` e la homepage andrebbero scritte due volte.
- **Non migrare:** resta un modello che Next 16 considera superato, e si perde la parte fissa delle pagine mandata subito al browser.

## Conseguenze

- Guadagno atteso soprattutto sulla velocità percepita da mobile (parte fissa della pagina mandata subito); poco sui tempi del server, già bassi.
- Va toccata ogni pagina con `dynamic` o `revalidate`; letture di sessione e dati non in cache vanno racchiuse in `<Suspense>`; le operazioni che dipendono dall'ora (`getMatchClockNow()`) vanno gestite esplicitamente.
- Non risolve i problemi più grossi dell'audit (pagine con molte query, HTML molto pesanti).
- Va misurato prima e dopo con gli script di `.perf-audit/`.
