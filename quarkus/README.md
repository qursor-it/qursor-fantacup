# Servizio stories (Quarkus)

Servizio separato per le stories. Decisioni e requisiti in `../ai_context/stories.md`.
Quarkus 3.40 (LTS), Java 21. Per ora contiene solo l'autenticazione.

## Come sa chi lo chiama

1. Il browser, con l'utente loggato su Next, chiama `GET /api/stories/token` e riceve `{ token, expiresIn }`.
2. Manda il token a Quarkus: `Authorization: Bearer <token>`.
3. Quarkus verifica firma, issuer (`qursor-fantacup`), audience (`stories`) e scadenza (5 minuti).

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

Dev e test usano la coppia di chiavi in `dev-keys/`. Per far parlare Next locale con Quarkus metti in `.env` di Next:
`STORIES_JWT_PRIVATE_KEY` = contenuto di `dev-keys/privateKey.pem` (a capo come `\n`).

## Configurazione di produzione

| Variabile | Dove | Cosa |
|---|---|---|
| `STORIES_JWT_PRIVATE_KEY` | Next | chiave privata RSA in PEM |
| `STORIES_JWT_PUBLIC_KEY_LOCATION` | Quarkus | percorso del file PEM della chiave pubblica |
| `STORIES_CORS_ORIGINS` | Quarkus | origini ammesse, es. `https://fantadc.example.com` (default `http://localhost:3000`) |

Generare una coppia nuova per ogni torneo, mai riusare `dev-keys/`:

```sh
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out privateKey.pem
openssl pkey -in privateKey.pem -pubout -out publicKey.pem
```
