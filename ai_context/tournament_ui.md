# Pagine e design specifici per torneo

Guida pratica per far differire l'interfaccia tra tornei. Il contesto e la decisione architetturale stanno in `multi_tournament.md`.

> **Stato:** `tournament.id`, `tournament.features` e la cartella `tournaments/<id>/` vengono introdotti con il passo 3 di `multi_tournament.md`. Finché non ci sono, gli esempi sotto descrivono lo schema da seguire, non codice già esistente. Il caso 2 va verificato con una build reale alla prima pagina che lo usa.

## Regola generale

Si parte con tutto in comune e si separa solo quando una differenza reale lo richiede. Per ogni differenza si sceglie il caso più semplice che basta:

| Cosa cambia | Caso |
|---|---|
| Un colore, un testo, un valore | Configurazione del torneo, oppure caso 3 |
| La pagina esiste solo in un torneo | Caso 1 |
| La struttura o il contenuto di una pagina (o di un suo pezzo) | Caso 2 |
| Solo qualche ritocco grafico | Caso 3 |

Nelle pagine non vanno mai scritti a mano nome, logo, colori del marchio o regole del torneo. Vanno letti da `siteConfig`, `appStoreConfig` o `tournament`.

## Struttura delle cartelle

```
tournaments/
  index.ts              tipo TournamentConfig, elenco dei tornei, `tournament` attivo
  dcup/
    config.ts           identità, regole, features
    pages/              versioni specifiche di pagine o componenti (caso 2)
    public/             logo, icone, .well-known/assetlinks.json
  <altro>/
    ...
app/                    pagine condivise, come oggi
```

Il torneo attivo si sceglie al momento della build con `NEXT_PUBLIC_TOURNAMENT`.

## Caso 1: pagina presente in un solo torneo

La pagina si crea in `app/` come tutte le altre e si accende con un flag in `features` nella configurazione.

```ts
// tournaments/<altro>/config.ts
features: { greenvolley: false, premi: true },
```

```tsx
// app/(public)/premi/page.tsx
import { notFound } from "next/navigation";
import { tournament } from "@/tournaments";

export default function PremiPage() {
  if (!tournament.features.premi) notFound();
  return <div>…</div>;
}
```

- **Menu:** la voce compare solo se il flag è attivo. Le voci dei menu (`components/public-nav-client.tsx`, `components/public-bottom-nav.tsx`, `app/(admin)/admin/_top-bar.tsx`, `_bottom-nav.tsx`) vanno filtrate con `tournament.features`.
- **Sezioni con molte pagine:** per una sezione intera, come `/greenvolley/*`, il controllo si mette una volta sola in `proxy.ts` invece che in ogni pagina. Un percorso disattivato risponde 404.
- **Aggiunta del flag:** ogni nuovo flag va aggiunto al tipo `TournamentConfig`, così TypeScript obbliga ogni torneo a dichiararlo.

## Caso 2: stessa pagina, versione diversa per torneo

La pagina in `app/` resta l'unico punto d'ingresso e sceglie il componente del torneo attivo. Chi non ha una versione propria usa quella comune.

```tsx
// app/(public)/regolamento/page.tsx
import { tournament } from "@/tournaments";
import RegolamentoComune from "./_comune";
import RegolamentoDcup from "@/tournaments/dcup/pages/regolamento";

const perTorneo: Partial<Record<string, React.ComponentType>> = {
  dcup: RegolamentoDcup,
};

export default function Page() {
  const Regolamento = perTorneo[tournament.id] ?? RegolamentoComune;
  return <Regolamento />;
}
```

- **Dove stanno le versioni:** in `tournaments/<id>/pages/`, con lo stesso nome della pagina o del componente.
- **Pezzi di pagina:** lo stesso schema vale per un singolo componente, per esempio solo l'intestazione della home.
- **Peso nel browser:** la pagina viene generata sul server, quindi il browser carica solo i componenti del torneo attivo. Le altre versioni restano nel codice ma non pesano sull'app.
- **Controlli condivisi:** dati, controlli di accesso (`requireAdmin`, `getCurrentUser`) e metadata restano nella pagina in `app/`. Le versioni per torneo ricevono i dati come props, così la logica non si duplica.
- **Quando fermarsi:** se una pagina diventa diversa in quasi tutto per due tornei, è il segnale per riparlarne (vedi le alternative in `multi_tournament.md`).

Perché non un alias di build (`@tournament/...` con `turbopack.resolveAlias`): fa lo stesso lavoro, ma TypeScript vedrebbe un solo torneo alla volta e servirebbe configurazione di build in più. La scelta dentro la pagina controlla i tipi di tutti i tornei a ogni `tsc`.

## Caso 3: solo ritocchi grafici

- **Colori del marchio:** sono variabili CSS valorizzate dalla configurazione del torneo (passo 2 di `multi_tournament.md`). Nei componenti si usano le variabili (`var(--primary)`…), non colori esadecimali.
- **Altri ritocchi:** l'`<html>` riceve `data-tournament="<id>"`. Il CSS o Tailwind possono cambiare l'aspetto solo per un torneo senza duplicare il componente:

```tsx
<h1 className="text-4xl [[data-tournament=altro]_&]:text-5xl">…</h1>
```

```css
[data-tournament="altro"] .hero { background-image: url("/images/hero.webp"); }
```

- **Immagini e asset:** stanno in `tournaments/<id>/public/` e vengono copiati in `public/` durante la build. Per questo si usano gli stessi percorsi (es. `/images/hero.webp`) e ogni torneo fornisce il suo file.

## Verifica

Prima di committare una differenza per torneo:
1. `npx tsc --noEmit`, che controlla anche che ogni torneo abbia tutti i campi e i flag della configurazione.
2. `npm run build` con il torneo di default.
3. `NEXT_PUBLIC_TOURNAMENT=<altro> npm run build` per ogni altro torneo toccato.
4. Apri la pagina in locale con entrambi i tornei e controlla che la versione giusta compaia, e che le sezioni disattivate rispondano 404.
