# AGENTS.md — PNAE Backend

> This file is the canonical agent-instructions document for this repo. `.claude/CLAUDE.md` is a symlink to it, so Claude Code, Codex, Cursor, and any other AGENTS.md-aware tool all read the same content. Edit either path — they point to the same file.

NestJS 11 backend (TypeScript, Prisma + PostgreSQL, Redis/BullMQ, Winston). Serves both the mobile app and the [web_interface](../web_interface/) frontend, and integrates with an external GraphQL server (`emater_graphql_server`) plus a legacy REST API. See [docs/relatorio-sync-doc.md](docs/relatorio-sync-doc.md) for the most intricate flow.

## Architectural intent

**Clean Arch and DDD are inspirations, not contracts.** This is a backend with non-trivial domain rules (sync, relatório lifecycle, file/FS reconciliation), so DDD pulls more weight here than on the frontend — but the same rule applies: a _sprinkle_, not a doctrine.

Layers, expressed as top-level folders under [src/](src/):

- [@domain/](src/@domain/) — entities, value objects, and domain services per aggregate (`relatorio/`, `atendimento/`, `produtor/`, `perfil/`, `usuario/`). **Pure TypeScript**: no Nest decorators, no Prisma, no I/O. `RelatorioDomainService` is the canonical example — orchestrates rules, returns plain results, fully unit-testable.
- [modules/](src/modules/) — feature modules. Each owns a `*.module.ts`, `*.controller.ts`, `*.service.ts`, plus `dto/`, `entities/`, `data-mapper/`, `utils/`, `workers/` as needed. Modules: `relatorios/`, `atendimento/`, `produtor/`, `perfil/`, `usuario/`, `files/`, `@sync/`.
- [@graphQL-server/](src/@graphQL-server/) — typed client for the external GraphQL server. `GraphQLAPI` base class + per-aggregate `*-api.service.ts`, with colocated `queries/` and `mutations/`.
- [@rest-api-server/](src/@rest-api-server/) — legacy REST integration (`RestAPI` service + `utils/`).
- [@pdf-gen/](src/@pdf-gen/), [@zip-gen/](src/@zip-gen/) — generation pipelines (EJS templates + wkhtmltopdf for PDF; archiver for ZIP). `@pdf-gen/` carries its own `templates/`, `styles/`, `workers/`, `types/`, `utils/`.
- [auth/](src/auth/), [prisma/](src/prisma/), [redis/](src/redis/), [logging/](src/logging/), [interceptors/](src/interceptors/), [filters/](src/filters/), [config/](src/config/), [utils/](src/utils/), [views/](src/views/), [types/](src/types/) — cross-cutting.

**Hard rules:**

- `@domain/*` imports nothing from `modules/`, `@graphQL-server/`, `@rest-api-server/`, `prisma/`, or Nest. Domain stays pure.
- `modules/* → @domain/*` is the normal direction. Use Prisma + GraphQL/REST clients inside the module's service to feed the domain, not the other way around.
- `data-mapper/` is the only place that converts between Prisma rows / GraphQL payloads / DTOs and domain entities. Don't shape DB rows inside controllers or domain services.
- Controllers stay thin: validate input via DTO, delegate to the service, translate errors. No business logic.

## Code style

### SRP with cohesion limits

Keep related responsibilities **together**. Do NOT over-split into tiny files / tiny helpers / single-call abstractions. A 200-line cohesive service beats six 30-line ones that only make sense read in sequence. Equally avoid the other extreme — long files mixing many unrelated responsibilities. Aim for a small number of cohesive files per concern.

### DRY

- **Domain rules:** centralize in `@domain/<aggregate>/*-domain-service.ts`. If two modules reimplement the same predicate or merge logic, lift it into the domain layer.
- **Functions/utils:** DRY only when worth it. A tiny one-liner used twice — leave inline. **3+ call sites** → extract, prefer the relevant module's `utils/` or top-level [src/utils/](src/utils/).
- **Mapping:** keep Prisma/GraphQL → domain conversion in `data-mapper/`. Don't scatter `humps.camelize` / BigInt coercions across services.

### KISS, with a reliability floor

KISS is the default for new code. **Exception:** if a simple approach scores below 7/10 on reliability/safety, go fancier.

- Simple ≥ 8.5/10 reliability → keep simple.
- Simple at 7–8.5/10 and a slightly fancier version gives bigger reliability gain → take the fancier version.
- Significantly more complex code for **small** gains → keep simple.

The sync flow ([@domain/relatorio/relatorio-domain-service.ts](src/@domain/relatorio/relatorio-domain-service.ts)) is the prototypical case where reliability beats simplicity — see [docs/relatorio-sync-doc.md](docs/relatorio-sync-doc.md).

### No hidden reusable types

A type/interface stays inside a controller/service file **only** if it is used by that file alone. If imported elsewhere, move it next to the domain/feature it describes (e.g. `@domain/<aggregate>/types/`, `modules/<feature>/dto/`, `modules/<feature>/types/`).

### Comments

Default to none. Only add a comment when _why_ is non-obvious (hidden constraint, subtle invariant, workaround for a specific bug or older client). Never narrate _what_ the code does. The `PlainTextExceptionFilter` and the static `CLIENT_TOKEN` bypass in [auth/auth.middleware.ts](src/auth/auth.middleware.ts) are the kind of cases that justify a one-line comment.

## Request lifecycle

- Bootstrap in [main.ts](src/main.ts): JSON/urlencoded body limits at 5mb, cookie parser, CORS with credentials, `BigIntInterceptor` (Prisma `BigInt` → string), `PlainTextExceptionFilter` (error normalization for older mobile clients), shutdown hooks.
- Two middlewares wired on `*` in [app.module.ts](src/app.module.ts): `AuthMiddleware` (JWT verify, with mobile static-token bypass via `CLIENT_TOKEN`) then `UserContextMiddleware` (hydrates `req.user`).
- Two global interceptors via `APP_INTERCEPTOR`: `WinstonLoggerService` (structured logs) and `UserHydrationInterceptor` (resolves the `Usuario` domain entity from the token claims).
- Auth bypass list lives in [auth/auth.middleware.ts](src/auth/auth.middleware.ts) (currently `/relatorios/pdf`, `/relatorios/zip`, `/cmc`, `/login`, plus CORS preflight). Treat that list as load-bearing — adding a new public endpoint means updating it explicitly.

## Conventions worth respecting

- **Two clients, one backend.** The mobile app authenticates with the static `CLIENT_TOKEN`; the web frontend uses real JWT (header `Authorization: Bearer` or `auth_token` cookie). Don't break either path.
- **Errors:** controllers throw Nest `HttpException` subclasses (`NotFoundException`, `BadRequestException`, etc.). Services throw the same — let the controller's `errorHandler` log and rethrow. The `PlainTextExceptionFilter` then flattens the body to plain text for older mobile clients; don't reintroduce JSON error envelopes without updating both clients.
- **Logging:** use `WinstonLoggerService` (injected). Avoid `console.log` in new code; existing call sites are legacy.
- **Prisma BigInt:** `BigIntInterceptor` serializes `BigInt` to string on the way out. When comparing IDs in domain code, normalize via the data-mapper, not ad-hoc.
- **Imports:** there are no path aliases — `tsconfig.json` only sets `baseUrl: "./"`, so absolute imports look like `src/modules/...` / `src/@domain/...`. Prefer those over deep relative paths (`../../..`).
- **Tests:** `*.spec.ts` colocated with the file under test, run with `npm test`. Domain services have the heaviest coverage and are the place to add tests when changing sync/merge logic.
- **External services:** all GraphQL/REST calls go through `@graphQL-server/` or `@rest-api-server/` services. Don't `fetch` directly from a module service.

## Development environment

The dev and staging (hmg) backend runs inside a Docker container with `npm run start:dev` (Nest watch mode) — file changes hot-reload, no manual build required. Redis runs as a sibling service in the same compose network for BullMQ.

- **Never run `npm run build`** (or any variant). This command is reserved for production releases only and is triggered manually by the user.
- **Never run `npm run start`/`start:prod`** locally — the container already runs the dev process.
- **Never run `git add`** (or any equivalent staging command). Staging is always a manual user action.
- **Never run Prisma migrations** (`prisma migrate dev`, `prisma migrate deploy`, `prisma db push`) without explicit user instruction. Schema changes are reviewed manually before being applied.
- Logs land in the mounted `/home/node/logs` volume; don't `tail -f` from outside the container without checking the path.

## When in doubt

- If a "fix" would touch legacy code outside the task scope — leave it. Ask first.
- If structure feels ambiguous, mirror the closest existing module ([modules/relatorios/](src/modules/relatorios/) is the reference shape, with `@domain/relatorio/` as the matching domain layer).
- For sync/merge questions, read [docs/relatorio-sync-doc.md](docs/relatorio-sync-doc.md) and the specs in [@domain/relatorio/](src/@domain/relatorio/) before changing logic — the rules are subtle and the tests encode the intent.
- After any code change, check whether this AGENTS.md (a.k.a. `.claude/CLAUDE.md` — same file via symlink) and the docs in [docs/](docs/) should be updated to reflect those changes, and update them if needed.
