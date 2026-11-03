# Più tornei sullo stesso codice

Decisione del 2026-11-03. Il progetto dovrà gestire almeno due tornei, anche in contemporanea.

## Requisiti raccolti

- **Comunità separate:** gli utenti di un torneo non usano l'altro, quindi non serve un account unico.
- **Stesso gioco:** fantacalcio molto simile.
- **Regole:** differenze solo di configurazione (valori), non meccaniche diverse.
- **Tempi:** i tornei possono svolgersi in contemporanea.
- **App negli store:** ognuno ha la sua app, diversa dalle altre. Le app sono PWA impacchettate con PWABuilder e non esistono progetti nativi da mantenere.
- **Interfaccia:** può differire tra tornei. Quali sezioni cambieranno non è ancora noto.

## Decisione: un codice, un'installazione per torneo

Un solo repository e una sola build. Ogni torneo ha il suo deploy, con database, variabili d'ambiente, dominio, job Jenkins e app negli store propri.

Alternative scartate:
- **Multi-tenant** (modello `Tournament` con `tournamentId` su tutte le tabelle):
  - sarebbe servito solo con un account unico tra tornei, che non è richiesto;
  - è il cambiamento più costoso;
  - c'è il rischio che dati di un torneo compaiano nell'altro.
- **Motore in un pacchetto condiviso e due app Next.js:** due app da mantenere. Ha senso solo se le interfacce diventano prodotti diversi.
- **Copia del repository:** le copie divergono e ogni correzione va fatta due volte.

## Come funziona

### Configurazione per torneo

- Il torneo si sceglie al momento della build con `NEXT_PUBLIC_TOURNAMENT`; se manca vale `dcup`. Si sceglie al build, non all'avvio, perché nome, colori e manifest finiscono anche nel codice del browser. Ogni torneo ha quindi la sua immagine Docker, costruita dallo stesso commit.
- `tournaments/index.ts`:
  - contiene il tipo `TournamentConfig`, che ogni torneo deve rispettare per intero, e l'elenco dei tornei;
  - espone `tournament`;
  - con un id sconosciuto genera un errore.
- `tournaments/<id>.ts` contiene:
  - **`site`:** nome, nome breve, descrizione, colori del tema, logo, icona, edizione, scritta su più righe per lo splash, scorciatoie della PWA;
  - **`appStore`:** nome dell'app e link ad App Store e Google Play;
  - **`rules`:** portieri, giocatori di movimento (la rosa ne è la somma), moltiplicatore del capitano, finestra di voto MVP in minuti, punti MVP di default.
- `lib/site.ts` espone `siteConfig` e `appStoreConfig`, ricavati dalla configurazione. Nelle pagine non vanno scritti a mano nome, logo o regole del torneo.
- Bonus e malus sono già nel database (`BonusType`), quindi ogni torneo ha i suoi senza bisogno di configurazione.

### Differenze di interfaccia: tre livelli

Per ogni differenza si sceglie il livello più basso che basta:

| Differenza | Come si gestisce |
|---|---|
| Stessa pagina, piccole differenze (testi, colori, una sezione in più o in meno) | Valori e flag nella configurazione del torneo |
| Stessa pagina, aspetto diverso | Un componente per torneo. La pagina condivisa importa `@tournament/<Componente>` e la build collega l'import alla cartella del torneo (`turbopack.resolveAlias`) |
| Sezione presente in un solo torneo (es. green volley) | Le pagine restano nel codice. `proxy.ts` risponde 404 se la sezione non è attiva, e il menu si costruisce dalla configurazione |

Si parte con tutto in comune e si separa solo quando una differenza reale lo richiede. Il secondo livello (alias `@tournament`) non è ancora costruito: va aggiunto con la prima pagina che deve essere diversa. Se quasi tutte le pagine divergessero, conviene rivalutare l'opzione del motore condiviso.

### App negli store (PWABuilder)

Per ogni torneo:
1. Deploy sul suo dominio, che fornisce il suo manifest e le sue icone.
2. Generazione con PWABuilder partendo da quel dominio, con un package proprio (es. `it.<organizzazione>.<torneo>`).
3. `.well-known/assetlinks.json` con il package e la fingerprint della chiave di quel torneo.

La chiave di firma Android generata da PWABuilder va conservata: senza, l'app non si può più aggiornare sullo stesso package.

## Stato e prossimi passi

1. **Fatto (`35d5803`):** configurazione per torneo, con identità e regole spostate in `tournaments/dcup.ts`. Il comportamento del DCup è invariato.
2. **Da fare:** colori del marchio (3–4) in variabili CSS lette dalla configurazione. Gli altri colori scritti a mano restano.
3. **Da fare:** struttura degli asset per torneo:
   - loghi, icone e `assetlinks.json` in `tournaments/<id>/public`, copiati in `public/` durante la build Docker;
   - flag delle sezioni (green volley) in `proxy.ts` e nel menu.
4. **Da fare:** Docker Compose e Jenkins parametrici per torneo:
   - nomi dei container, porte e volumi con un prefisso per torneo (oggi sono fissi: `fantadc-prod`, `fantadc-postgres-prod`);
   - un job Jenkins per torneo, con `TOURNAMENT` e credenziali proprie (file env, admin, chiavi VAPID).
5. **Da fare:** il secondo torneo, con configurazione, asset, dominio, job e app PWABuilder.

## Ancora specifico del DCup

- **Regolamento:** il testo della pagina è scritto a mano. Probabilmente sarà la prima pagina con una versione per torneo.
- **Green volley:** è sempre attivo finché non c'è il flag del passo 3.
- **Colori:** sono scritti a mano nelle pagine finché non si fa il passo 2.
