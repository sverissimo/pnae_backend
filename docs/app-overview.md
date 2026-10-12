# App Overview — PNAE Backend

Architecture narrative and environment topology moved out of the root
[AGENTS.md](../AGENTS.md) to keep the always-on rules lean. This is orientation —
the "where things live" and "how the stack is wired" — not coding rules. The
*rules* (architecture boundaries, request-lifecycle invariants, hard rules) stay
in AGENTS.md; trust current code and config when they conflict with anything here.

Links to `plans/archive/` are historical implementation background; current rules must stand independently.

## Layers / folder map

**Clean Arch and DDD are inspirations, not contracts.** This is a backend with
non-trivial domain rules (sync, relatório lifecycle, file/FS reconciliation), so
DDD pulls more weight here than on the frontend — but the same rule applies: a
_sprinkle_, not a doctrine.

Layers, expressed as top-level folders under [src/](../src/):

- [@domain/](../src/@domain/) — entities, value objects, and domain services per aggregate (`relatorio/`, `atendimento/`, `produtor/`, `perfil/`, `usuario/`). **Pure TypeScript**: no Nest decorators, no Prisma, no I/O. `RelatorioDomainService` is the canonical example — orchestrates rules, returns plain results, fully unit-testable.
- [modules/](../src/modules/) — feature modules. Each owns a `*.module.ts`, `*.controller.ts`, `*.service.ts`, plus `dto/`, `entities/`, `data-mapper/`, `utils/`, `workers/` as needed. Modules: `relatorios/`, `atendimento/`, `produtor/`, `perfil/`, `usuario/`, `files/`, `@sync/`.
- [@graphQL-server/](../src/@graphQL-server/) — typed client for the external GraphQL server. `GraphQLAPI` base class + per-aggregate `*-api.service.ts`, with colocated `queries/` and `mutations/`.
- [@rest-api-server/](../src/@rest-api-server/) — legacy REST integration (`RestAPI` service + `utils/`).
- [@pdf-gen/](../src/@pdf-gen/), [@zip-gen/](../src/@zip-gen/) — generation pipelines (EJS templates + wkhtmltopdf for PDF; archiver for ZIP; `demeter-pdf-assembler.ts` composes the combined manual-relatório PDF with `@cantoo/pdf-lib` + `sharp`). `@pdf-gen/` carries its own `templates/`, `styles/`, `workers/`, `types/`, `utils/`.
- [auth/](../src/auth/), [prisma/](../src/prisma/), [redis/](../src/redis/), [logging/](../src/logging/), [interceptors/](../src/interceptors/), [filters/](../src/filters/), [config/](../src/config/), [utils/](../src/utils/), [views/](../src/views/), [types/](../src/types/) — cross-cutting.

## Dual-storage fields

**Dual-storage fields — `temas_atendimento` and `numeroVisita`:** These two fields live in both the local Postgres DB and the external server. `numeroRelatorio` is a normal Prisma column; `temas_atendimento` is NOT a Prisma column — it only exists in the external DB (encoded as numeric codes via `at_atendimento_indi_camp_acess`). On create, both fields are written via `POST /atendimento` (GraphQL server). On update, `PATCH /relatorios/:id` writes `numeroRelatorio` to Prisma and then calls `syncAtendimentoTemasAndNumero()` → `restAPI.updateTemasAndVisitaAtendimento()` to sync changes to the external REST API. Full details: [docs/plans/temas-atendimento-and-numero-visita.md](plans/archive/temas-atendimento-and-numero-visita.md).

## Dashboard scoping

  The dashboard endpoint (`getDashboardData`) deliberately diverges from this for the per-user portion: gauges + 30-day line chart are *region-only* even for staff (`r.id_reg_empresa === user.id_reg_empresa`), so an extensionista sees their regional's macro view rather than only their own work. Tops and by-regional charts always use the full set — `topTecnicos` and `relatoriosByRegional` are intentionally never region-scoped so extensionistas and regionais can "compete" with each other across the whole state; never add per-user filtering to these two.

Reporting access (`req.reportingAccess`, set by `AuthMiddleware` for the dashboard-only reporting token) resolves role, relatório filtering, and manual dates together to the full admin scope, taking precedence over any `req.user`. Its response equals an admin user's for the same data. Details: [web-only-endpoints.md](web-only-endpoints.md#dashboard).

## Caching

- **Caching:** `/relatorios/all` and `/relatorios/dashboard` hydrate through narrow Redis-backed readers, module-local to their aggregate — `CachedProdutorReader` ([src/modules/produtor/cache/](../src/modules/produtor/cache/), 24h TTL), `CachedAtendimentoReader` (90s TTL + tombstone for upstream-absent IDs) and `CachedReplacedAtendimentosReader` (3m TTL, web hot path only) in [src/modules/atendimento/cache/](../src/modules/atendimento/cache/); cross-cutting pieces (`CachedMunicipiosReader`, `RedisInvalidator`, constants) live in [src/cache/](../src/cache/). `GET /atendimento/com-relatorio-manual` serves whole pages from `CachedDemeterListReader` (same atendimento cache folder, 90s TTL, per-scope keys, version-bumped by the validation mutations). `AtendimentoService` mutations bust via `RedisInvalidator`. Cache lives inside hot-path hydration only; mobile routes never touch it. Full contract: [docs/plans/relatorios-caching-plan.md](plans/archive/relatorios-caching-plan.md) + [docs/plans/atendimentos-manuais-validation-actions-and-caching.md](plans/archive/atendimentos-manuais-validation-actions-and-caching.md).

## Environment topology

The dev and staging (hmg) backend run inside Docker containers, each on its own compose network (`pnae_dev` and `pnae_hmg` respectively; prod still uses `pnae_prod_default` for now). Dev runs `npm run start:dev` (Nest watch mode) — file changes hot-reload, no manual build required. Hmg and prod build from the same shared `Dockerfile.prod` image recipe — the compose files own the environment-specific identity (env file, service/image names, networks, mounts, replicas); see [plans/prod-hmg-container-parity.md](plans/archive/prod-hmg-container-parity.md). Redis runs as a sibling service inside each stack's own network for BullMQ — dev and hmg do not share a Redis instance.

Dev and hmg intentionally share the hmg PostgreSQL database (`pnae_db_hmg`) and both mount the same uploaded-file storage folder (`/home/pnae/pnae_app/data_dev` on the host, `/home/node/data_dev` in the containers). `data_hmg` is no longer an active storage folder; a `data_hmg.bak/` folder may exist only as a temporary safety backup after the merge. Keep prod storage/database separate.

For Prisma client regeneration after schema changes, prefer `npm run prisma:generate:hmg`. That script checks `DATABASE_URL` and refuses to run unless it points at the hmg database identity, then runs `prisma generate --schema prisma/schema.prisma`. It should never be replaced with a migrate/deploy/db-push command.

Logs land in the mounted `/home/node/logs` volume; don't `tail -f` from outside the container without checking the path.
