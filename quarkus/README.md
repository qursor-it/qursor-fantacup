# Servizio stories (Quarkus)

Servizio separato per le stories. Decisioni e requisiti in `../ai_context/stories.md`.
Quarkus 3.40 (LTS), Java 21. Per ora contiene solo l'autenticazione.

## Come sa chi lo chiama

1. Il browser, con l'utente loggato su Next, chiama `GET /api/stories/token` e riceve `{ token, expiresIn }`.
2. Manda il token a Quarkus: `Authorization: Bearer <token>`.
3. Quarkus verifica firma, issuer (`qursor-fantacup`), audience (`stories`) e scadenza (5 minuti).
   La chiave pubblica la scarica da Next (`GET /api/stories/jwks`) e la tiene in cache: Quarkus non ha nessuna chiave da configurare.

Nelle risorse:

```java
@Inject JsonWebToken jwt;
jwt.getSubject();  // id utente (stringa)
jwt.getName();     // email
jwt.getGroups();   // ruolo: USER o ADMIN
```

Usa `@Authenticated` o `@RolesAllowed("ADMIN")` per proteggere gli endpoint. Esempio: `MeResource` (`GET /me`).

## Sviluppo

```sh
./mvnw quarkus:dev   # porta 8080
./mvnw test
```

In dev Quarkus legge il JWKS da `http://localhost:3000/api/stories/jwks`: avvia Next con
`STORIES_JWT_PRIVATE_KEY` = contenuto di `dev-keys/privateKey.pem` (a capo come `\n`) nel `.env`.
I test usano direttamente `dev-keys/` e non hanno bisogno di Next.

## Configurazione di produzione

| Variabile | Dove | Cosa |
|---|---|---|
| `STORIES_JWT_PRIVATE_KEY` | Next | chiave privata RSA in PEM (l'unico segreto) |
| `STORIES_JWKS_URL` | Quarkus | URL del JWKS di Next, es. `http://app:3000/api/stories/jwks` sulla rete interna Docker |
| `STORIES_CORS_ORIGINS` | Quarkus | origini ammesse, es. `https://fantadc.example.com` (default `http://localhost:3000`) |

Generare una chiave nuova per ogni torneo, mai riusare `dev-keys/`. Serve solo la privata: la pubblica la ricava Next.

```sh
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out privateKey.pem
```

Per cambiare chiave basta aggiornare `STORIES_JWT_PRIVATE_KEY` e riavviare Next: il `kid` cambia e Quarkus riscarica il JWKS.
I token già emessi con la vecchia chiave smettono di valere (durano comunque 5 minuti) e il browser ne chiede uno nuovo.
