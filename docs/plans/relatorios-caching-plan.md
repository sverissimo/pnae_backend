# Relatórios Caching — Implementation Reference

Status: **Phases 1 + 2 shipped. Phase 0 (structured instrumentation) skipped in favor of lightweight per-call log lines. Phase 3 (raw-collection cache) deferred — revisit only if measured prod latency still misses target.**
Owner: backend
Scope: `GET /relatorios/all` and `GET /relatorios/dashboard` hot paths
Last updated: 2026-05-22

---

## 1. The problem

### 1.1 Hot endpoints

Two endpoints dominate backend load and latency:

- `GET /relatorios/all` — used by the web interface (and by admins doing wide scans).
- `GET /relatorios/dashboard` — used by every signed-in user; refreshes every 3 minutes per the `useDashboardData` behavior in [web_interface/features/dashboard/use-cases/getDashboardData.ts](../../../web_interface/features/dashboard/use-cases/getDashboardData.ts).

Everything else on `/relatorios/*` is low traffic by comparison and out of scope.

### 1.2 Why those two endpoints are expensive

Both routes funnel through `RelatorioService.findAll({ contratoId: 2 }, { expand: true })`. The hot work is in `hydrateRelatorios` ([relatorios.service.ts](../../src/modules/relatorios/relatorios.service.ts)):

1. Prisma `relatorio.findMany` — internal Postgres 16, single-digit ms. Cheap.
2. `updateAtendimentoIds` → `atendimentoService.getReplacedAtendimentos()` → REST API call. Runs on **every** `findAll`, whether `expand` is true or not.
3. **Hydration fan-out:**
   - `produtorService.findManyById(produtorIds)` → external GraphQL.
   - `atendimentoService.findMany(atendimentoIds)` → external GraphQL.
4. For `/dashboard` only: `perfilService.getRegionaisEmater()` → REST. Runs in parallel with `findAll`.

The legacy DB behind the GraphQL server is the dominant bottleneck:

- Postgres 9.5 (~2015).
- Single monolithic `public` schema, hundreds of tables, millions of rows.
- Always under load from other systems.
- Heavy joins to assemble `Produtor` and `Atendimento` payloads.

The implemented caches target step 3 directly.

### 1.3 Churn profile (drives TTL choices)

| Entity | Source | Change frequency | Notes |
|---|---|---|---|
| Produtor | external (read-only) | **rarely** | Effectively static for our purposes (`nm_pessoa`, `nr_cpf_cnpj`, `id_pessoa_demeter`, `id_und_empresa`, `perfis[].propriedade` → municipio, `id_reg_empresa`). |
| Atendimento | external (read-only from PNAE) | **moderate** | Visited/edited during work hours. |
| Relatorio | internal (Prisma) | **frequent** | Mutated by web and mobile via `POST/PATCH/DELETE /relatorios/*`. |

Both `pnae` and `cmc` have **read-only** access to the legacy DB, so cross-service upstream invalidation is not a concern; we rely on TTLs + explicit busts on mutations that route through our own services.

### 1.4 Hard constraints

- **Mobile compatibility is non-negotiable.** Per [backend/.claude/CLAUDE.md](../../.claude/CLAUDE.md), shipped mobile binaries on thousands of devices cannot be updated. No request/response shape, status code, or error format on existing endpoints may change.
- **Mobile auth path leaves `req.user` undefined.** Mobile uses the static `CLIENT_TOKEN`; `RelatorioService.createFilter(undefined)` returns `{ id: 'no-access' }`. `/relatorios/all` returns `[]` to mobile today and continues to do so.
- **Read-only against the legacy DB.** No write-back; no upstream invalidation hooks; rely on TTLs.

---

## 2. The solution

Two narrow read-side caches in the hydration path, plus a payload trim on the two read endpoints. Everything else (full-list cache, nginx response cache, atendimento intercept on broader mutation paths) is deferred or out of scope.

### 2.1 Observability — what replaced Phase 0

The original plan called for a structured-JSON observability envelope (per-route, per-role, per-call-site timings) shipped before any cache. **That was not done.** Time-to-ship was prioritized, and the cache itself is small enough to revert in one commit if it doesn't help.

In place of the envelope, each cached reader emits **one log line per call** via `WinstonLoggerService.log` (stdout, captured by `docker logs`):

```
produtor.cache hits=H misses=M mgetMs=… upstreamMs=… totalIds=N
atendimento.cache hits=H misses=M tombstoned=T mgetMs=… upstreamMs=… totalIds=N
```

Enough signal to (a) confirm the cache is hitting, (b) estimate hit rate, (c) surface the upstream-absent-ID pattern (see §2.3 tombstones).

**These info lines are gated to non-prod environments only** via `CACHE_LOG_ENABLED = process.env.NODE_ENV !== 'production'` in [cache.constants.ts](../../src/modules/relatorios/cache/cache.constants.ts). In prod, dashboard volume × 3 lines per call (produtor + atendimento + regionais) would be noisy without buying steady-state observability anyone is actively watching. Verification in prod is done via before/after timing on the endpoints themselves; if richer metrics become useful later, the natural step is exporting structured telemetry to a metrics backend rather than turning these lines back on. Error logs (Redis failures inside the readers and `PerfilService`) remain unconditional — they're rare and load-bearing when Redis breaks.

### 2.2 Phase 1 — `CachedProdutorReader`

A **narrow read adapter** consumed only by `hydrateRelatorios`, not a replacement of `ProdutorService` in DI.

- Class [`CachedProdutorReader`](../../src/modules/relatorios/cache/cached-produtor.reader.ts) exposing exactly one method: `findManyById(ids: string[]): Promise<ProdutorFindManyOutputDTO[]>`.
- Internally injects `ProdutorService` and the Redis client.
- **Key:** `produtor:v1:{id_pessoa_demeter}` → JSON of the `ProdutorFindManyOutputDTO` shape. The `v1` segment is a **cache-schema version**: bump to `v2` whenever the projection shape changes in code, so a deploy doesn't read entries from the old shape under a 24h TTL.
- **TTL:** 24 hours (essentially static per churn profile).
- **Lookup:** `MGET` over requested IDs; misses fetched via `ProdutorService.findManyById(missingIds)` then `SETEX`'d back via pipeline; merge preserves input order.
- **Single-flight:** in-process `Map<string, Promise>` keyed by the sorted unique ID list, so concurrent identical calls share one upstream fetch.
- **Invalidation:** TTL-only. Manual escape hatch: `npm run cache:flush:produtor` (no args → SCAN+DEL all `produtor:v1:*`; with args → DEL `produtor:v1:<id>` each). Script at [scripts/cache/flush-produtor.ts](../../scripts/cache/flush-produtor.ts).
- **No tombstone.** Produtor orphans are ~0% by data-flow contract — both mobile and web require selecting an existing produtor before creating a relatório, and there is no upstream-delete path our app calls. Keeping the reader positive-only preserves the 24h TTL benefit without sentinel overhead. If an orphan ever appears, the `produtor.cache hits=N misses=1` log line will sit constant after warmup — that's the signal to investigate.

Wiring change in `RelatorioService`: explicit edit to `hydrateRelatorios` to call `cachedProdutorReader.findManyById(...)` instead of `produtorService.findManyById(...)`. All other call sites of `ProdutorService` are untouched — `RelatorioExportService` still uses it directly for PDF gen. No DI token swap.

### 2.3 Phase 2 — `CachedAtendimentoReader` + `RedisInvalidator` + tombstone

Same reader shape as Phase 1, scoped tightly to the hydration path:

- Class [`CachedAtendimentoReader`](../../src/modules/relatorios/cache/cached-atendimento.reader.ts) exposing exactly one method: `findMany(ids: string[]): Promise<AtendimentoModel[]>`.
- Internally injects `AtendimentoService` and the Redis client.
- **Key:** `atendimento:v1:{id_at_atendimento}` → JSON payload (post-mapping shape returned by `AtendimentoService.findMany`). Same `v1` schema-version convention as Phase 1.
- **TTL:** 90 seconds.
- **Lookup / SETEX / single-flight:** same pattern as `CachedProdutorReader`.

#### Invalidation — `RedisInvalidator`

A standalone service [`RedisInvalidator`](../../src/modules/relatorios/cache/redis-invalidator.ts) exposes exactly:

```ts
invalidate(prefix: string, ids: Array<string | bigint | number>): Promise<void>
```

It depends only on the Redis client. `AtendimentoService` injects `RedisInvalidator` and, after each successful upstream mutation, calls `redisInvalidator.invalidate(CACHE_KEYS.atendimento, ids)`. The reader does **not** depend on `RedisInvalidator`; the graph is unidirectional:

- reader → `AtendimentoService` (miss path)
- reader → Redis client (`MGET`/`SETEX`)
- `AtendimentoService` → `RedisInvalidator` → Redis client

No cycle, no `forwardRef`. The rejected alternative (injecting `CachedAtendimentoReader` into `AtendimentoService`) would have created exactly that cycle, since the reader already depends on `AtendimentoService.findMany` for cache misses.

Mutation hooks that bust in `AtendimentoService`:

- `update` ([atendimento.service.ts](../../src/modules/atendimento/atendimento.service.ts)) — generic update; busts the single ID. Transitively covers `logicRemove` (which calls `update`) and `fixDatesIfNeeded` (which may call `update`).
- `updateTemasAndVisita` — busts after the REST mutation succeeds. Separate from the GraphQL path, so the `update` bust does not cover it.
- `setAtendimentosExportDate` — busts the listed IDs after the GraphQL mutation succeeds.

Methods that deliberately do **not** bust: `create` (returns a brand-new ID that cannot already be in cache) and `updateIfNecessary` (calls `logicRemove` on the old ID — covered transitively — and `createAtendimento` on a fresh ID).

Even with a 90s TTL, the explicit busts matter because a user editing a relatório-linked atendimento on the web will refresh the dashboard within seconds and expect the new state.

#### Tombstone for upstream-absent IDs

Relatórios can reference `atendimentoIds` whose upstream rows are `ativo: false` (logic-removed). Those IDs return empty from `AtendimentoService.findMany`, so a positive-only cache stores nothing for them and re-queries every call, defeating the cache for that slice.

The reader SETEXes a `__nil__` sentinel for any requested ID the upstream did not return. On read, sentinels are skipped silently and counted as `tombstoned=N` in the log line. Tombstone TTL matches the data TTL (90s) — lifecycle alignment over the conventional longer negative-cache window, because the intra-window saving wasn't worth the extra reasoning surface. `RedisInvalidator.invalidate` `DEL`s the key regardless of contents, so a real atendimento that later reappears is unblocked by the next mutation through the hooks above; in the meantime worst-case staleness is the 90s TTL.

Tombstones are not applied to produtor — see §2.2.

### 2.4 Payload trim — `omit: { orientacao: true }` when `expand: true`

The `orientacao` field is ~90% of each relatório's payload weight and is not used by either hot endpoint (no chart math, no list-view column, no scoping predicate). The Prisma `findMany` inside `findAll` omits it when `expand: true`:

```ts
this.prismaService.relatorio.findMany({
  where: filter,
  orderBy: { createdAt: 'desc' },
  ...(options.expand ? { omit: { orientacao: true } } : {}),
})
```

This affects only `/relatorios/all` and `/relatorios/dashboard`. Other paths that need the field are untouched:

- `RelatorioExportService.findAll()` (PDF gen) — calls `findAll()` with no expand option; omit is skipped.
- `GET /relatorios/:id` → `findOne` → `prisma.relatorio.findUnique` — separate Prisma call.
- `GET /relatorios?produtorId=X` → `findMany(produtorId)` — separate Prisma call.
- Sync subsystem → `findMany({ ids, produtorIds })` — separate Prisma call.

`Relatorio.toModel` spreads the row as-is, so a row missing `orientacao` flows through cleanly; the field is simply undefined on the resulting model. `RelatorioDataMapper.manyToPresentationModel` and `relatorio-dashboard-stats` do not reference `orientacao`. `Relatorio.validate` (which does require `orientacao`) is only called on create.

### 2.5 `getRegionaisEmater` — single-key Redis cache inside `PerfilService`

The dashboard hits `perfilService.getRegionaisEmater()` in parallel with `findAll` on every call. That method is a thin wrapper around a REST call to the legacy DB which assembles the regional list via several joins. The payload is small (~4 KB), the data is effectively immutable (regional administrative structure changes maybe once a year), and the call was otherwise uncached — every dashboard load was paying for the same upstream query.

Implementation lives inline in [`PerfilService.getRegionaisEmater`](../../src/modules/perfil/perfil.service.ts) — a separate reader class would be overkill for a single key + single method:

- **Key:** `perfil:regionaisEmater:v1` — full key, no id suffix (it's a singleton list). Same `v1` schema-version convention.
- **TTL:** 24 hours (matches produtor — essentially static).
- **Lookup:** plain `GET`; on hit, parse JSON and return. On miss, fetch via `RestAPI.getRegionaisEmater()`, then `SETEX` the mapped result.
- **Single-flight:** instance-level `Promise | null` field; concurrent calls share one upstream fetch.
- **Fall-through:** Redis errors are caught and logged via `WinstonLoggerService`, then the method falls through to the underlying REST call. No 5xx leak.
- **Invalidation:** TTL-only. There is no app-side mutation path for this data.
- **Log line:** `regionais.cache hit=0|1 getMs=… upstreamMs=… count=N` per call.

Both consumers benefit: the `/dashboard` hot path and the direct `GET /perfil/getRegionaisEmater` endpoint.

### 2.6 Phase 3 (deferred) — service-level raw-collection cache

A controller-level cache for the full expanded list under a single shared key would leak cross-role data, because both read paths apply per-user transforms after hydration:

- `getAuthorizedRelatorios` runs `user.hasAccessTo({ ownerId, regionId })` per user — admin/coordenadorRegional/staff get different slices.
- `getDashboardData` derives a per-user `scopedRelatorios` and a per-user `regionalLabel` from the same hydrated set.

If Phases 1+2 prove insufficient, the correct placement is a private service-level loader inside `RelatorioService`:

- `getRawExpandedRelatorios()` — returns the **raw hydrated collection only** (no auth filtering, no dashboard shaping).
- Cache key: `relatorios:v1:expanded:contrato2` → JSON array.
- TTL: 15s, just enough to coalesce simultaneous requests.
- Both `getAuthorizedRelatorios(expand=true)` and `getDashboardData` would call it, then continue to apply their own per-user transforms.
- Invalidation: busted from `RelatorioService` write paths (`create`, `update`, `remove`).
- **Cross-layer note:** entries would contain **post-hydration** data (relatórios merged with produtor + atendimento snapshots). A Phase 1 or Phase 2 invalidation does **not** propagate into a Phase 3 entry. The 15s TTL is what bounds the staleness; do not raise it without revisiting this.

Do not ship Phase 3 unless prod traffic shows Phases 1+2 fall short of latency target.

### 2.7 Nginx response caching — out of scope

Enabling response caching at Nginx for this API is a separate, larger decision because:

- Auth comes in as `Authorization: Bearer` **and** as the `auth_token` httpOnly cookie ([backend/src/auth/auth.middleware.ts](../../src/auth/auth.middleware.ts) — accepts either). The current nginx bypass only inspects `$http_authorization`, so a cookie-only request would bypass nothing and risk caching a per-user response under a shared key.
- Responses are per-user (see §2.6). A correctly-keyed cache would need user identity in the key, which means moving auth into Nginx or adding an internal auth subrequest.

If revisited, do it as its own document.

---

## 3. Architecture & isolation

The cache classes live in a single directory and are consumed by **explicit, narrow** call sites rather than by transparent DI substitution:

```
backend/src/modules/relatorios/cache/
├── cache.constants.ts            // CACHE_KEYS, CACHE_TTLS, REDIS_CLIENT DI symbol
├── cached-produtor.reader.ts     // Phase 1 — injected into RelatorioService only
├── cached-atendimento.reader.ts  // Phase 2 — injected into RelatorioService only
└── redis-invalidator.ts          // Phase 2 — injected into AtendimentoService only
```

There is intentionally **no** `relatorios-cache.module.ts`. The original plan placed all four providers in one cache module, but routing the readers and the invalidator through a single module would have created a Nest module cycle:

- The cache module would need `AtendimentoModule` (the reader's miss path uses `AtendimentoService`).
- `AtendimentoModule` would need the cache module (for `RedisInvalidator`).

Nest's `forwardRef` resolves cycles but is fragile and hard to test. Instead, provider declarations are colocated with the modules that consume them:

- [AtendimentoModule](../../src/modules/atendimento/atendimento.module.ts) declares the `REDIS_CLIENT` provider + `RedisInvalidator`, and injects them into `AtendimentoService`.
- [RelatorioModule](../../src/modules/relatorios/relatorios.module.ts) declares the `REDIS_CLIENT` provider + both readers, and injects them into `RelatorioService`.

Cost: two IORedis connections to the same Redis server (one per module). Operationally negligible — connections are cheap and consistency across connections to a single Redis instance is not an issue.

### 3.1 Why narrow readers instead of DI substitution

`RelatorioService` calls `atendimentoService` for far more than `findMany`: `logicRemove`, `updateTemasAndVisita` (via `syncAtendimentoTemasAndNumero`), `getReplacedAtendimentos` (via `updateAtendimentoIds`), `fixDatesIfNeeded`. [RelatorioExportService](../../src/modules/relatorios/relatorios.export.service.ts) injects the same tokens. `AtendimentoService` is exported as a concrete provider from `AtendimentoModule` and used elsewhere.

A token-level decorator either becomes a full proxy of every method (high blast radius, easy to get wrong) or silently changes the behavior of write-adjacent flows. A narrow reader injected only into the hydration path is small, explicit, and trivially reasoned about.

### 3.2 What the controller sees

Nothing changes at the controller. The controller continues to call `relatorioService.getAuthorizedRelatorios(req.user, true)` and `relatorioService.getDashboardData(req.user)` exactly as before. There is no controller-level cache guard and no `if (!req.user)` branch — mobile traffic still returns `[]` via the existing `{ id: 'no-access' }` sentinel and never reaches `hydrateRelatorios` anyway.

### 3.3 Redis client

Re-uses the existing `createRedisConnection()` factory in [backend/src/redis/redis.provider.ts](../../src/redis/redis.provider.ts). Each module that needs Redis instantiates its own IORedis via `useFactory: createRedisConnection`. Both connections target db0; key prefixes (`produtor:v1:*`, `atendimento:v1:*`) keep cache data namespaced alongside BullMQ (`bull:*`). No new infra.

---

## 4. Mobile safety

### 4.1 Inventory of mobile `/relatorios/*` calls

From [pnae_mobile/@infrastructure/api/relatorio/repository/RelatorioAPIRepository.ts](../../../pnae_mobile/@infrastructure/api/relatorio/repository/RelatorioAPIRepository.ts):

| Method | HTTP | Used by mobile? |
|---|---|---|
| `create` | `POST /relatorios` | yes |
| `createMany` | loops `create` | yes |
| `findByProdutorId` | `GET /relatorios?produtorId=` | yes |
| `findAll` | `GET /relatorios/all` | **NO** — interface filler |
| `update` | `PATCH /relatorios/:id` | yes |
| `updateMany` | loops `update` | yes |
| `delete` | `DELETE /relatorios/:id` | yes |
| `getSyncInfo` | sync subsystem | yes (not in cache scope) |

`RelatorioAPIRepository.findAll` is verified unused via full-tree grep — only `localRepository.findAll()` (SQLite) is called; the single grep hit for `remoteRepository.findAll` is a negative assertion: `expect(remoteRepository.findAll).not.toHaveBeenCalled()`.

### 4.2 None of the mobile-active routes are in cache scope

The caches live inside `hydrateRelatorios`, reached only via `findAll(filter, { expand: true })`, which is in turn reached only via `/all` and `/dashboard` — neither of which mobile calls. The orientacao trim (§2.4) is also gated on `expand: true`, so it's bound by the same scope.

### 4.3 Belt-and-braces guard

Mobile reaches `RelatorioService.findAll` only via routes that either don't exist on mobile (`/all`) or with `expand: false` (no hydration). The `createFilter(undefined)` path returns `{ id: 'no-access' }`, so Prisma returns `[]` and `hydrateRelatorios` is never called.

### 4.4 Write-path side effects

Phase 2's invalidation hooks run *after* the upstream mutation succeeds and never throw outward (Redis errors are caught and logged). They do not change request/response shape, status codes, or error format for any caller.

---

## 5. Sharp edges

| Risk | Mitigation |
|---|---|
| **Shape parity between cache hit and miss.** Cached read shapes are string-typed today ([produtores.output-dto.ts](../../src/modules/produtor/types/produtores.output-dto.ts), [atendimento-model.ts](../../src/@domain/atendimento/atendimento-model.ts)) — `id_pessoa_demeter`, `id_und_empresa`, `id_reg_empresa`, `id_at_atendimento`, `id_at_anterior` are all `string`. The downstream join in [relatorio.data-mapper.ts](../../src/modules/relatorios/data-mapper/relatorio.data-mapper.ts) builds `Map<string, T>` and looks values up by `r.produtorId` / `r.atendimentoId`. If a cache hit returns one of those IDs as `bigint` while the miss path returns `string`, the Map lookup silently fails — no error, just an empty merge. **Rule:** preserve the exact shape the un-cached reader returns. If the upstream reader's shape ever changes (BigInt → string or vice versa), bump the cache schema version (`v1` → `v2`) in the same PR. |
| **Cold-start stampede.** First dashboard hits after deploy could trigger N concurrent upstream fetches for the same ID set. | In-process single-flight (Promise dedup keyed by sorted ID set) inside each reader. |
| **Redis down.** | Every cache op wrapped in try/catch; on error → log via `WinstonLoggerService` + fall through to the underlying service. Reads degrade to today's latency, not to 5xx. |
| **Stale produtor data.** | 24h TTL means an upstream edit shows up here within a day. Acceptable per churn profile; tunable. |
| **Stale atendimento data.** | 90s TTL + explicit busts in `AtendimentoService` mutation methods. |
| **Memory.** | 10k produtores × ~500 B ≈ 5 MB. 10k atendimentos × similar. Trivial for Redis. |
| **MGET blocking.** | At ≤10k keys, server-side MGET is single-digit ms. If we ever exceed ~5k keys per call, chunk via `pipeline`. |
| **Orphan atendimentoIds (logic-removed upstream).** | Tombstone with sentinel `__nil__`, 90s TTL. Counted as `tombstoned=N` in the log line. |

---

## 6. What shipped

| Item | Status |
|---|---|
| Phase 0 — structured instrumentation envelope | **Skipped.** Replaced by one log line per reader call. |
| Phase 1 — `CachedProdutorReader` (24h TTL, no tombstone) | **Shipped.** Wired into `hydrateRelatorios`. |
| Phase 2 — `CachedAtendimentoReader` (90s TTL, tombstone for upstream-absent IDs) | **Shipped.** Wired into `hydrateRelatorios`. |
| Phase 2 — `RedisInvalidator` bust hooks in `AtendimentoService` | **Shipped.** Three hooks: `update` (covers `logicRemove` + `fixDatesIfNeeded` transitively), `updateTemasAndVisita`, `setAtendimentosExportDate`. |
| Payload trim — `omit: { orientacao: true }` when `expand: true` | **Shipped.** Affects only `/relatorios/all` and `/relatorios/dashboard`. |
| `getRegionaisEmater` single-key cache (24h TTL) | **Shipped.** Inline in `PerfilService.getRegionaisEmater`. Benefits both the `/dashboard` hot path and the direct `GET /perfil/getRegionaisEmater` endpoint. |
| Manual flush escape hatch | **Shipped.** `npm run cache:flush:produtor [ids…]` — ts-node script. |
| Phase 3 — service-level raw-collection cache | **Deferred.** Revisit only if prod measurements show Phases 1+2 fall short. |
| Nginx response caching | **Out of scope.** Needs cookie-aware auth bypass design first. |

---

## 7. Tests

Pre-merge test coverage was deliberately skipped in favor of measuring on prod with realistic load. Existing 203/203 tests still pass; the spec for `RelatorioService` was updated only to satisfy the new constructor signature.

If the cache stays in production, the following coverage is the natural follow-up:

- **Shape parity (hit vs miss)** — for `id_pessoa_demeter` and `id_at_atendimento`, assert `typeof cached[field] === typeof fresh[field]` for the same record. Catches the silent bigint/string Map-lookup failure mode.
- **Cache hit/miss/tombstone split** — assert MGET runs once, upstream gets only the missing IDs, the SETEX pipeline covers both data and tombstones for atendimento, and the log line counters are correct.
- **Redis failure falls through** — inject a stubbed Redis that throws; the reader must return the un-cached service result and log the failure. No 5xx leak.
- **Bust on atendimento mutation** — after `update`, `updateTemasAndVisita`, or `setAtendimentosExportDate`, `RedisInvalidator.invalidate(...)` was called with the right IDs and a subsequent hydration observes the new upstream payload.
- **Scoping preserved on both endpoints** — `Usuario.hasAccessTo` and `scopeRelatoriosForUser` still derive role-appropriate slices before and after cache warm.
- **Mobile path unchanged** — request to `/relatorios/all` with mobile auth (no `req.user`) still returns `[]` with the same status code, headers, and body.

---

## 8. Out of scope (deliberately)

- Pagination on `/relatorios/all`. With ≤10k rows in the 12-month horizon and only 2–3 admins triggering full payloads, not yet a problem.
- GraphQL-server-side caching in `emater_graphql_server`. Possible follow-up if other consumers (cmc, etc.) ever need the same speedup.
- Nginx response caching — see §2.7.
- Any change to the existing HTTP contract on `/relatorios/*`.
