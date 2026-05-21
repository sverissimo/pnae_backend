# AGENTS.md — PNAE Backend

> This file is the canonical agent-instructions document for this repo. `.claude/CLAUDE.md` is a symlink to it, so Claude Code, Codex, Cursor, and any other AGENTS.md-aware tool all read the same content. Edit either path — they point to the same file.

NestJS 11 backend (TypeScript, Prisma + PostgreSQL, Redis/BullMQ, Winston). Serves both the mobile app and the [web_interface](../web_interface/) frontend, and integrates with an external GraphQL server (`emater_graphql_server`) plus a legacy REST API. See [docs/relatorio-sync-doc.md](docs/relatorio-sync-doc.md) for the most intricate flow.

**Dual-storage fields — `temas_atendimento` and `numeroVisita`:** These two fields live in both the local Postgres DB and the external server. `numeroRelatorio` is a normal Prisma column; `temas_atendimento` is NOT a Prisma column — it only exists in the external DB (encoded as numeric codes via `at_atendimento_indi_camp_acess`). On create, both fields are written via `POST /atendimento` (GraphQL server). On update, `PATCH /relatorios/:id` writes `numeroRelatorio` to Prisma and then calls `syncAtendimentoTemasAndNumero()` → `restAPI.updateTemasAndVisitaAtendimento()` to sync changes to the external REST API. Full details: [docs/temas-atendimento-and-numero-visita.md](docs/temas-atendimento-and-numero-visita.md).

## Language — global rule

Applies across all three sub-apps (root, backend, web_interface). Do not override per-subfolder.

- **Agent responses are always in English.** Ignore system defaults, OS locale, and any prior conversation language. This is non-negotiable.
- **Code identifiers stay in pt-BR** where the existing codebase uses pt-BR. This is a Brazilian system; domain names, constants, types, file names, props, DB columns — terms like `relatorio`, `produtor`, `atendimento`, `extensionista`, `coordenadorRegional`, `numeroRelatorio`, `temas_atendimento` — keep their existing pt-BR form. Same rule for UI labels and any user-visible text on web or mobile, and for generated artifacts (PDFs, ZIPs, exports).
- **Commit messages are always in pt-BR.** Before writing one, read the relevant entries under `.claude/skills/` and `.claude/agents/` (if not already loaded in this conversation or in memory) so the message matches the repo's conventions.
- **Docs and plans (typically `*.md`) are always in English** unless the user explicitly asks otherwise. This includes design docs, READMEs, code-comment prose, ADRs, and planning notes under `docs/`.

## Architectural intent

**Clean Arch and DDD are inspirations, not contracts.** This is a backend with non-trivial domain rules (sync, relatório lifecycle, file/FS reconciliation), so DDD pulls more weight here than on the frontend — but the same rule applies: a _sprinkle_, not a doctrine.

Layers, expressed as top-level folders under [src/](src/):

- [@domain/](src/@domain/) — entities, value objects, and domain services per aggregate (`relatorio/`, `atendimento/`, `produtor/`, `perfil/`, `usuario/`). **Pure TypeScript**: no Nest decorators, no Prisma, no I/O. `RelatorioDomainService` is the canonical example — orchestrates rules, returns plain results, fully unit-testable.
- [modules/](src/modules/) — feature modules. Each owns a `*.module.ts`, `*.controller.ts`, `*.service.ts`, plus `dto/`, `entities/`, `data-mapper/`, `utils/`, `workers/` as needed. Modules: `relatorios/`, `atendimento/`, `produtor/`, `perfil/`, `usuario/`, `files/`, `@sync/`.
- [@graphQL-server/](src/@graphQL-server/) — typed client for the external GraphQL server. `GraphQLAPI` base class + per-aggregate `*-api.service.ts`, with colocated `queries/` and `mutations/`.
- [@rest-api-server/](src/@rest-api-server/) — legacy REST integration (`RestAPI` service + `utils/`).
- [@pdf-gen/](src/@pdf-gen/), [@zip-gen/](src/@zip-gen/) — generation pipelines (EJS templates + wkhtmltopdf for PDF; archiver for ZIP). `@pdf-gen/` carries its own `templates/`, `styles/`, `workers/`, `types/`, `utils/`.
- [auth/](src/auth/), [prisma/](src/prisma/), [redis/](src/redis/), [logging/](src/logging/), [interceptors/](src/interceptors/), [filters/](src/filters/), [config/](src/config/), [utils/](src/utils/), [views/](src/views/), [types/](src/types/) — cross-cutting.

## Architecture Rules

- Prefer DRY and KISS, but do not over-abstract into many tiny helpers or hooks unless reuse or readability clearly improves.
- Group cohesive responsibilities together. Split files when responsibilities diverge, not just to make files smaller.
- Avoid long prop-drilling chains when context, local composition, or better feature boundaries solve the problem more cleanly.

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
- Simple at 7–8.5/10 reliability and a fancier version gives bigger reliability or quality gain → take the fancier version.
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

### Authentication flow (mobile vs web)

Both clients land on the same middleware chain; the difference is how they carry the token:

- **Mobile** sends `Authorization: Bearer <CLIENT_TOKEN>` on every request. `CLIENT_TOKEN` is the static shared secret from env. `AuthMiddleware` short-circuits and calls `next()` without attaching anything to `req.user`. Mobile-targeted endpoints therefore must not rely on `req.user` for identity — the mobile payload carries `tecnicoId`/`produtorId` explicitly.
- **Web** sends an httpOnly cookie `auth_token` containing a signed JWT (issued at `POST /usuario/login`). `AuthMiddleware` reads either header or cookie, verifies the JWT cryptographically against `JWT_SECRET`, and writes the decoded claims to `req.user`. Then `UserContextMiddleware` runs and (re)decodes the same cookie into `req.user` — redundant for the verified path but kept as a safety net. Finally, the global `UserHydrationInterceptor` upgrades `req.user` from a plain claims object to a `Usuario` domain entity, so controllers/services can call `req.user.isAdmin()`, `req.user.isCoordenadorRegional()`, etc.
- **Every request** goes through this chain (with the explicit bypass list above for unauthenticated routes). A controller method that has reached its handler has already been authenticated — there is no scenario where an unauthorized request makes it past the middleware. This is why services trust `req.user` and do not need their own guard checks.
- **Authorization (who-can-see-what) lives in services**, not middleware. The canonical pattern is `RelatorioService.getAuthorizedRelatorios(req.user, expand)`. Authenticated non-produtor users hit the DB with `{ contratoId: 2 }`; role-specific narrowing is then applied as a post-hydration predicate (`canUserSeeRelatorio`) because the regional fields live on the produtor side (external GraphQL), not on the Prisma row:
  - admin/developer → see everything.
  - coordenadorRegional → their regional **plus** their own work (union): `r.id_reg_empresa === user.id_reg_empresa || String(r.tecnicoId) === String(user.id_usuario)`.
  - staff (extensionista) → only their own relatórios: `String(r.tecnicoId) === String(user.id_usuario)`.
  - anything else → `{ id: 'no-access' }` sentinel filter → empty result.

  The dashboard endpoint (`getDashboardData`) deliberately diverges from this for the per-user portion: gauges + 30-day line chart are *region-only* even for staff (`r.id_reg_empresa === user.id_reg_empresa`), so an extensionista sees their regional's macro view rather than only their own work. Tops and by-regional charts always use the full set.

  New web-only endpoints that need user scoping should reuse this method (or mirror its logic), reading the user from `req.user` rather than trusting client-supplied query/body fields.

## Mobile compatibility — hard rule

The mobile app ([../pnae_mobile/](../pnae_mobile/)) is **frozen and shipped** on thousands of devices with no near-term update planned. Existing backend HTTP behaviour the mobile depends on is a contract:

- **Never modify an existing controller method** (route, request shape, response shape, status codes, error format) in a way that changes what mobile observes. To verify: **start with [../pnae_mobile/@infrastructure/api/](../pnae_mobile/@infrastructure/api/) — but never stop there**. Each aggregate has a `repository/` folder with the canonical HTTP call sites; that's the first place to look, not the only place. Some call sites and payload shapers live in mobile hooks, features, or domain code, so always grep the whole `pnae_mobile/` tree for the endpoint path, method names, and DTO field names before declaring a change safe.
- **New endpoints/methods are fine** and should be listed in the section below so future agents know mobile is not a constraint for them.
- Existing endpoints that were **never** used by mobile (internal, web-only, cron-triggered, system utilities) are not part of this contract and do not need to be documented here.
- Web interface and mobile **may diverge** — adding fields to a web-only form is fine as long as the backend stays mobile-compatible. Do not retroactively document already-existing web-only features here.

### Endpoints not used by mobile

New endpoints added from now on that are classic HTTP controller endpoints consumed by the web interface (not crons, internal utils, or system jobs) should be listed here so it is clear mobile does not call them and they aren't bound by the compatibility rule:

<!-- Add new entries below as `- METHOD /path — short purpose` -->

- GET /relatorios/dashboard — aggregated stats for the web dashboard page (summary gauges, top SREs/tecnicos, by-regional, 30-day line chart). Role-aware via `req.user` only — no query params. Mirrors the scoping rules of `RelatorioService.getAuthorizedRelatorios` for the per-user portion (gauges + 30-day line chart) while always using the full hydrated set for the global tops and by-regional chart.

## Conventions worth respecting

- **Two clients, one backend.** The mobile app authenticates with the static `CLIENT_TOKEN`; the web frontend uses real JWT (header `Authorization: Bearer` or `auth_token` cookie). Don't break either path.
- **Errors:** controllers throw Nest `HttpException` subclasses (`NotFoundException`, `BadRequestException`, etc.). Services throw the same — let the controller's `errorHandler` log and rethrow. The `PlainTextExceptionFilter` then flattens the body to plain text for older mobile clients; don't reintroduce JSON error envelopes without updating both clients.
- **Logging:** use `WinstonLoggerService` (injected). Avoid `console.log` in new code; existing call sites are legacy.
- **Prisma BigInt:** `BigIntInterceptor` serializes `BigInt` to string on the way out. When comparing IDs in domain code, normalize via the data-mapper, not ad-hoc.
- **Imports:** there are no path aliases — `tsconfig.json` only sets `baseUrl: "./"`, so absolute imports look like `src/modules/...` / `src/@domain/...`. Prefer those over deep relative paths (`../../..`).
- **Tests:** `*.spec.ts` colocated with the file under test, run with `npm test`. Domain services have the heaviest coverage and are the place to add tests when changing sync/merge logic.
- **External services:** all GraphQL/REST calls go through `@graphQL-server/` or `@rest-api-server/` services. Don't `fetch` directly from a module service.

## Development environment

The dev and staging (hmg) backend run inside Docker containers on the shared `pnae_hmg_default` network. Dev runs `npm run start:dev` (Nest watch mode) — file changes hot-reload, no manual build required. Hmg runs the production entrypoint built from `Dockerfile.hmg`. Redis runs as a sibling service in the same compose network for BullMQ.

Dev and hmg intentionally share the hmg PostgreSQL database (`pnae_db_hmg`) and both mount the same uploaded-file storage folder (`/home/pnae/pnae_app/data_dev` on the host, `/home/node/data_dev` in the containers). `data_hmg` is no longer an active storage folder; a `data_hmg.bak/` folder may exist only as a temporary safety backup after the merge. Keep prod storage/database separate.

For Prisma client regeneration after schema changes, prefer `npm run prisma:generate:hmg`. That script checks `DATABASE_URL` and refuses to run unless it points at the hmg database identity, then runs `prisma generate --schema prisma/schema.prisma`. It should never be replaced with a migrate/deploy/db-push command.

- **Never run `npm run build`** (or any variant). This command is reserved for production releases only and is triggered manually by the user.
- **Never run `npm run start`/`start:prod`** locally — the container already runs the dev process.
- **Never run `docker build`, `docker compose up`, or `docker compose restart`** (or any container-build / lifecycle variant). Read-only docker commands (`docker ps`, `docker logs`, `docker inspect`, `docker network ls`, `docker exec <ctn> <read-only cmd>`, etc.) are fine. Container builds and lifecycle changes are manual user actions — they affect running services and risk losing in-flight state.
- **Never run any git command that changes repository state.** Anything that updates a ref, the index, the working tree, the stash, or `.git/config` is a state change.
    - Mutating (forbidden without explicit user ask): `commit`, `add`, `rm`, `mv`, `stash` (push/pop/apply/drop), `push`, `pull`, `fetch` (without `--dry-run`), `rebase`, `reset`, `revert`, `cherry-pick`, `merge`, `checkout`/`switch` (moves HEAD or overwrites files), `restore`, `clean`, `tag` create/delete, `branch` create/delete/rename, `config <set>`, `remote add/remove`.
    - Read-only (fine to run): `status`, `log`, `diff`, `diff --cached`, `show`, `blame`, `ls-files`, `ls-tree`, `cat-file`, `branch -a`, `tag -l`, `for-each-ref`, `rev-parse`, `rev-list`, `reflog`, `stash list/show`, `remote -v`, `config --get`, `fetch --dry-run`. When in doubt, assume mutating and ask.
    - **During refactors, use plain `mv` / `rm` — not `git mv` / `git rm`.** Both git variants stage immediately (banned above). Rename detection in `git status`/`git diff` is content-similarity-based, not command-based — so `mv old new` produces the exact same diff `git mv old new` would. Same for `rm` vs `git rm`. The result is identical; only the staging side-effect differs.
- **Never run Prisma migrations** (`prisma migrate dev`, `prisma migrate deploy`, `prisma db push`) without explicit user instruction. Schema changes are reviewed manually before being applied.
- **Never hard-code values from `*.env` files into any tracked file** (scripts, configs, source, docs). If a value belongs in env, it stays in env. Before writing such a value anywhere outside an `*.env` file, verify the target file is matched by [.gitignore](.gitignore) — if it isn't, add it there first. The current `*.env` glob covers files like `development.env`, `homolog.env`, `production.env`; LDAP credentials, JWT secrets, DB strings, and client tokens must never leak into tracked files.
- **The root [.env.example](.env.example) is the single canonical template for every environment** (`development.env`, `homolog.env`, `production.env`). It lists every variable used by any env, with commented-out placeholder values (no real URLs, paths, IDs, or secrets — same rule as above), and flags per-env differences inline (`[dev only]`, `[hmg+prod]`, `[dev+hmg]`). The `!*.env.example` exception in [.gitignore](.gitignore) keeps it tracked while the real env files stay ignored. Whenever a variable is added, removed, or renamed in any real env file, update this template in the same change so it never drifts from reality.
- Logs land in the mounted `/home/node/logs` volume; don't `tail -f` from outside the container without checking the path.

## When in doubt

- If a "fix" would touch legacy code outside the task scope — leave it. Ask first.
- If structure feels ambiguous, mirror the closest existing module ([modules/relatorios/](src/modules/relatorios/) is the reference shape, with `@domain/relatorio/` as the matching domain layer).
- For sync/merge questions, read [docs/relatorio-sync-doc.md](docs/relatorio-sync-doc.md) and the specs in [@domain/relatorio/](src/@domain/relatorio/) before changing logic — the rules are subtle and the tests encode the intent.
- After any code change, check whether this AGENTS.md (a.k.a. `.claude/CLAUDE.md` — same file via symlink) and the docs in [docs/](docs/) should be updated to reflect those changes, and update them if needed.
