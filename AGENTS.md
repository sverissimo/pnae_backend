# AGENTS.md — PNAE Backend

> This file is the canonical agent-instructions document for this repo. `.claude/CLAUDE.md` is a symlink to it, so Claude Code, Codex, Cursor, and any other AGENTS.md-aware tool all read the same content. Edit either path — they point to the same file.

NestJS 11 backend (TypeScript, Prisma + PostgreSQL, Redis/BullMQ, Winston). Serves both the mobile app and the [web_interface](../web_interface/) frontend, and integrates with an external GraphQL server (`emater_graphql_server`) plus a legacy REST API. See [docs/relatorio-sync-doc.md](docs/relatorio-sync-doc.md) for the most intricate flow.

Read ../AGENTS.md first.

> Hard rules (full text in `../AGENTS.md`): no build, no container changes, no database access, no state-changing Git, no sensitive/env values in non-ignored or tracked files.

Dual-storage field details: [docs/app-overview.md](docs/app-overview.md#dual-storage-fields); historical background: [temas-atendimento-and-numero-visita.md](docs/plans/archive/temas-atendimento-and-numero-visita.md).

## Architectural intent

**Clean Arch and DDD are inspirations, not contracts.** This is a backend with non-trivial domain rules (sync, relatório lifecycle, file/FS reconciliation), so DDD pulls more weight here than on the frontend — but the same rule applies: a _sprinkle_, not a doctrine.

**Read [docs/app-overview.md](docs/app-overview.md) before any structural, cross-module, or environment change.** It holds the layer/folder map (`@domain/`, `modules/`, `@graphQL-server/`, `@rest-api-server/`, `@pdf-gen/`, `@zip-gen/`, cross-cutting) and the environment topology. The load-bearing *rules* derived from that layout are below.

## Architecture Rules

**Hard rules:**

- `@domain/*` imports nothing from `modules/`, `@graphQL-server/`, `@rest-api-server/`, `prisma/`, or Nest. Domain stays pure.
- `modules/* → @domain/*` is the normal direction. Use Prisma + GraphQL/REST clients inside the module's service to feed the domain, not the other way around.
- `data-mapper/` is the only place that converts between Prisma rows / GraphQL payloads / DTOs and domain entities. Don't shape DB rows inside controllers or domain services.
- Controllers stay thin: validate input via DTO, delegate to the service, translate errors. No business logic.

## Code style

- **Cohesion:** A 200-line cohesive service beats six 30-line ones that only make sense read in sequence.
- **Domain rules:** centralize in `@domain/<aggregate>/*-domain-service.ts`. If two modules reimplement the same predicate or merge logic, lift it into the domain layer.
- **Functions/utils:** prefer the relevant module's `utils/` or top-level [src/utils/](src/utils/).
- **Mapping:** keep Prisma/GraphQL → domain conversion in `data-mapper/`. Don't scatter `humps.camelize` / BigInt coercions across services.
- **KISS:** The sync flow ([@domain/relatorio/relatorio-domain-service.ts](src/@domain/relatorio/relatorio-domain-service.ts)) is the prototypical case where reliability beats simplicity. The reliability-budget rubric + reasoning lives in [docs/decisions.md](docs/decisions.md#kiss-with-a-reliability-floor).
- **Reusable types:** Placement examples: `@domain/<aggregate>/types/`, `modules/<feature>/dto/`, `modules/<feature>/types/`.
- **Comments:** Full guidance: [docs/decisions.md](docs/decisions.md#comments).

## Request lifecycle

- Bootstrap in [main.ts](src/main.ts): JSON/urlencoded body limits at 5mb, cookie parser, CORS with credentials, `BigIntInterceptor` (Prisma `BigInt` → string), `PlainTextExceptionFilter` (error normalization for older mobile clients), shutdown hooks.
- Two middlewares wired on `*` in [app.module.ts](src/app.module.ts): `AuthMiddleware` (JWT verify, with mobile static-token bypass via `CLIENT_TOKEN` and a dashboard-only reporting token) then `UserContextMiddleware` (hydrates `req.user`).
- Two global interceptors via `APP_INTERCEPTOR`: `WinstonLoggerService` (structured logs) and `UserHydrationInterceptor` (resolves the `Usuario` domain entity from the token claims).
- Auth bypass list lives in [auth/auth.middleware.ts](src/auth/auth.middleware.ts) (currently `/relatorios/pdf`, `/relatorios/zip`, `/cmc`, `/login`, plus CORS preflight). Treat that list as load-bearing — adding a new public endpoint means updating it explicitly.

### Authentication flow (mobile vs web)

Both clients land on the same middleware chain; the difference is how they carry the token:

- **Mobile** sends `Authorization: Bearer <CLIENT_TOKEN>` on every request. `CLIENT_TOKEN` is the static shared secret from env. `AuthMiddleware` short-circuits and calls `next()` without attaching anything to `req.user`. Mobile-targeted endpoints therefore must not rely on `req.user` for identity — the mobile payload carries `tecnicoId`/`produtorId` explicitly.
- **Web** sends an httpOnly cookie `auth_token` containing a signed JWT (issued at `POST /usuario/login`). `AuthMiddleware` reads either header or cookie, verifies the JWT cryptographically against `JWT_SECRET`, and writes the decoded claims to `req.user`. Then `UserContextMiddleware` runs and (re)decodes the same cookie into `req.user` — redundant for the verified path but kept as a safety net. Finally, the global `UserHydrationInterceptor` upgrades `req.user` from a plain claims object to a `Usuario` domain entity, so controllers/services can call `req.user.isAdmin()`, `req.user.isCoordenadorRegional()`, etc.
- **Reporting** (the Gestão Estratégica portal, server-to-server) sends `Authorization: Bearer <REPORTING_BEARER_TOKEN>`. `AuthMiddleware` accepts it only from the header on `GET /relatorios/dashboard`, after the `CLIENT_TOKEN` check so a colliding value keeps mobile behavior. It sets only `req.reportingAccess` and never a synthetic `req.user`; the dashboard resolves the marker to the admin view. A missing or empty variable disables it. Details: [docs/web-only-endpoints.md](docs/web-only-endpoints.md#dashboard).
- **Every request** goes through this chain (with the explicit bypass list above for unauthenticated routes). A controller method that has reached its handler has already been authenticated — there is no scenario where an unauthorized request makes it past the middleware. This is why services trust `req.user` and do not need their own guard checks.
- **Authorization (who-can-see-what) lives in services and on the `Usuario` domain entity**, not middleware. It is split into two checks, both expressed as `Usuario` methods (see [@domain/usuario/usuario.entity.ts](src/@domain/usuario/usuario.entity.ts)):
  - **Capability** (role, instance-independent) — *may this user perform this kind of action at all?* Via `user.isAdmin()` / `user.isCoordenadorRegional()` (e.g. validate/pendência → coordenador **or** admin; plain reads → no capability gate).
  - **Visibility** (per-instance) — *may this user reach this specific resource?* Via `user.hasAccessTo({ ownerId, regionId })`. The caller extracts the target's **normalized** `{ ownerId, regionId }` (owner = numeric `id_usuario`; region = regional `id_reg_empresa`, "G…"); all the rule logic stays on `Usuario`, which sees only those two scalars. The single rule it encodes:
    - admin/developer → see everything.
    - coordenadorRegional → their regional **plus** their own work (union).
    - staff (extensionista) → only their own work (`tecnicoId === id_usuario`); region is ignored.
    - anything else → none.

  A plain read needs visibility only; a privileged mutation composes capability **then** visibility. The canonical list pattern is `RelatorioService.getAuthorizedRelatorios(req.user, expand)`: authenticated non-produtor users hit the DB with `{ contratoId: 2 }` (else the `{ id: 'no-access' }` sentinel → empty), then the hydrated rows are narrowed by `hasAccessTo` (the regional fields live on the produtor side, external GraphQL, not on the Prisma row). For an atendimento, `AtendimentoService.getAtendimentoAuthScope(atendimentoId)` resolves the same `{ ownerId, regionId }` shape from the external atendimento (its PK) — single source, relatório-backed or not.

  Dashboard-specific scoping is documented in [docs/app-overview.md](docs/app-overview.md#dashboard-scoping).

  New web-only endpoints that need user scoping should reuse this method (or mirror its logic), reading the user from `req.user` rather than trusting client-supplied query/body fields.

## Mobile compatibility — hard rule

The mobile app ([../pnae_mobile/](../pnae_mobile/)) is **frozen and shipped** on thousands of devices with no near-term update planned. Existing backend HTTP behaviour the mobile depends on is a contract:

- **Quick reference:** [docs/mobile-endpoint-contract.md](docs/mobile-endpoint-contract.md) lists every endpoint mobile calls. Check it first, but treat it as an audit snapshot — it does not replace the full-tree grep below.
- **Never modify an existing controller method** (route, request shape, response shape, status codes, error format) in a way that changes what mobile observes. To verify: **start with [../pnae_mobile/@infrastructure/api/](../pnae_mobile/@infrastructure/api/) — but never stop there**. Each aggregate has a `repository/` folder with the canonical HTTP call sites; that's the first place to look, not the only place. Some call sites and payload shapers live in mobile hooks, features, or domain code, so always grep the whole `pnae_mobile/` tree for the endpoint path, method names, and DTO field names before declaring a change safe.
- **New endpoints/methods are fine** and should be listed in the section below so future agents know mobile is not a constraint for them.
- Existing endpoints that were **never** used by mobile (internal, web-only, cron-triggered, system utilities) are not part of this contract and do not need to be documented here.
- Web interface and mobile **may diverge** — adding fields to a web-only form is fine as long as the backend stays mobile-compatible. Do not retroactively document already-existing web-only features here.

### Endpoints not used by mobile

New endpoints added from now on that are classic HTTP controller endpoints consumed by the web interface (not crons, internal utils, or system jobs) should be listed here so it is clear mobile does not call them and they aren't bound by the compatibility rule. Future entries must use one line with method and path, purpose, a short auth note, and a link; details go in [docs/web-only-endpoints.md](docs/web-only-endpoints.md).

- GET /relatorios/dashboard — Aggregated dashboard statistics; authenticated; role-aware via `req.user`, or the admin view via the reporting token; [details](docs/web-only-endpoints.md#dashboard).
- PATCH /atendimento/:atendimentoId/aprovar — Approve atendimento; coordenador-regional or admin; capability + visibility; [details](docs/web-only-endpoints.md#approve-atendimento).
- PATCH /atendimento/:atendimentoId/pendencia — Mark atendimento pending; coordenador-regional or admin; capability + visibility; [details](docs/web-only-endpoints.md#mark-atendimento-pending).
- PATCH /atendimento/:atendimentoId/aprovar-sei — Approve DETEC/SEI; admin-only; capability + visibility; [details](docs/web-only-endpoints.md#approve-sei).
- PATCH /atendimento/:atendimentoId/remover-aprovacao-sei — Undo DETEC/SEI approval; admin-only; capability + visibility; [details](docs/web-only-endpoints.md#remove-sei-approval).
- GET /atendimento/getArquivos?atendimentoId=&fileType=foto|relatorio — Download a stored PDF or photo; authenticated via the shared middleware; [details](docs/web-only-endpoints.md#download-atendimento-file).
- GET /atendimento/com-relatorio-manual — Paginated manual relatorios; authenticated; user-scoped upstream; [details](docs/web-only-endpoints.md#list-manual-relatorios).
- GET /atendimento/com-relatorio-demeter/:atendimentoId — Find one Demeter atendimento; authenticated; visibility check, 404 when out of scope; [details](docs/web-only-endpoints.md#find-demeter-atendimento).
- GET /relatorios/manual?id=<base64urlToken> — View a combined manual PDF; public/no auth; obfuscated id is not access control; [details](docs/web-only-endpoints.md#view-public-manual-pdf).
- POST /relatorios/zip/create-job — Generate a ZIP job; auth bypass; body `userId` must be allowlisted; [details](docs/web-only-endpoints.md#create-zip-job).
- GET /relatorios/zip/atendimentos-incluidos — Read previously included ids; public/auth bypass; [details](docs/web-only-endpoints.md#list-zip-included-atendimentos).
- GET /relatorios/zip/atendimentos-nao-incluidos — Read previously excluded ids; public/auth bypass; [details](docs/web-only-endpoints.md#list-zip-excluded-atendimentos).

## Conventions worth respecting

- **Two clients, one backend.** The mobile app authenticates with the static `CLIENT_TOKEN`; the web frontend uses real JWT (header `Authorization: Bearer` or `auth_token` cookie). Don't break either path.
- **Errors:** controllers throw Nest `HttpException` subclasses (`NotFoundException`, `BadRequestException`, etc.). Services throw the same — let the controller's `errorHandler` log and rethrow. The `PlainTextExceptionFilter` then flattens the body to plain text for older mobile clients; don't reintroduce JSON error envelopes without updating both clients.
- **Logging:** use `WinstonLoggerService` (injected). Avoid `console.log` in new code; existing call sites are legacy. Never log credentials, tokens, cookies, complete request bodies, or CPF values; prefer route patterns over resolved URLs that may contain sensitive data.
- **Prisma BigInt:** `BigIntInterceptor` serializes `BigInt` to string on the way out. When comparing IDs in domain code, normalize via the data-mapper, not ad-hoc.
- **Imports:** there are no path aliases — `tsconfig.json` only sets `baseUrl: "./"`, so absolute imports look like `src/modules/...` / `src/@domain/...`. Prefer those over deep relative paths (`../../..`).
- **Tests:** `*.spec.ts` colocated with the file under test, run with `npm test`. Domain services have the heaviest coverage and are the place to add tests when changing sync/merge logic.
- **External services:** all GraphQL/REST calls go through `@graphQL-server/` or `@rest-api-server/` services. Don't `fetch` directly from a module service.
- **Caching:** Cache lives inside hot-path hydration only; mobile routes never touch it. Implementation and invalidation details: [docs/app-overview.md](docs/app-overview.md#caching).

## Development environment

Docker/network/Redis/Prisma-regen topology lives in [docs/app-overview.md](docs/app-overview.md#environment-topology) — read it before touching containers, networking, Redis, or Prisma client generation. Full operational restrictions are in [../AGENTS.md](../AGENTS.md#operational-restrictions); the opening hard-rules reminder remains here.

- **The root [.env.example](.env.example) is the single canonical template for every environment** (`development.env`, `homolog.env`, `production.env`). It lists every variable used by any env, with commented-out placeholder values (no real URLs, paths, IDs, or secrets — see the [root sensitive-data rule](../AGENTS.md#operational-restrictions)), and flags per-env differences inline (`[dev only]`, `[hmg+prod]`, `[dev+hmg]`). The `!*.env.example` exception in [.gitignore](.gitignore) keeps it tracked while the real env files stay ignored. Whenever a variable is added, removed, or renamed in any real env file, update this template in the same change so it never drifts from reality. The current `*.env` glob covers files like `development.env`, `homolog.env`, `production.env`; LDAP credentials, JWT secrets, DB strings, and client tokens must never leak into tracked files.
- **Schema review:** Schema changes are reviewed manually before being applied.

## When in doubt

- If a "fix" would touch legacy code outside the task scope — leave it. Ask first.
- If structure feels ambiguous, mirror the closest existing module ([modules/relatorios/](src/modules/relatorios/) is the reference shape, with `@domain/relatorio/` as the matching domain layer).
- For sync/merge questions, read [docs/relatorio-sync-doc.md](docs/relatorio-sync-doc.md) and the specs in [@domain/relatorio/](src/@domain/relatorio/) before changing logic — the rules are subtle and the tests encode the intent.
- **Unsure about a library's API** — especially versions newer than your training
  cutoff (e.g. Prisma v7, which changed the client generator and output path):
  check the **context7 MCP** for current docs before guessing. If context7 is
  unreachable, **ask permission to fetch updated docs from the web** — don't rely
  on possibly-stale recall.
- After any code change, check whether the root [AGENTS.md](../AGENTS.md), this AGENTS.md (a.k.a. `.claude/CLAUDE.md` — same file via symlink), and the docs in [docs/](docs/) should be updated to reflect those changes, and update them if needed. Keep rules and short pointers in AGENTS; implementation details belong in docs. Architecture/topology detail lives in [docs/app-overview.md](docs/app-overview.md); principle rationale in [docs/decisions.md](docs/decisions.md) — keep those in sync too.
