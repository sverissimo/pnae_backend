# Plan — Relatórios à mão: validation actions + situação tweak + 80/20 caching

> **Status (2026-07-02):** implemented — Parts 1 and 2, the `dt_export_ok` chain, and the
> page-level cache (built ahead of the DBA indexes; fail-open, so it is safe either way).
> Outstanding: the three DBA indexes, and the gateway `IN`-list scope switch that follows index #3.

Scope: the **Relatórios à mão** table (`web_interface/app/relatorios/manuais/RelatoriosManuaisPage.tsx`
→ `AtendimentosManuaisTable` → `AtendimentoManualTableActions`). Three parts:

1. Add the same validation actions the regular relatórios table has — **admin and coordenador
   regional only**; other roles get **no new actions** (note Part 2's situação change applies to
   all roles).
2. Situação column: drop the "Pendente" label → blank.
3. 80/20 caching for the list, plus the DB indexes to hand the DBA.

Everything is web-only and additive; mobile is untouched (no existing endpoint changes).

## Part 1 — validation actions (reuse verdict: yes, ~100% fit)

### What already exists and is reused as-is

- **Backend routes** (all live and manually verified end-to-end by the user on the regular
  relatórios table; automated coverage is unit/spec-level. Keyed on `atendimentoId` alone — the
  Demeter PK):
  - `PATCH /atendimento/:id/aprovar` + `/pendencia` — capability `isCoordenadorRegional() || isAdmin()`, then visibility via `getAtendimentoAuthScope`.
  - `PATCH /atendimento/:id/aprovar-sei` + `/remover-aprovacao-sei` — capability `isAdmin()`, then visibility.
  - `getAtendimentoAuthScope` explicitly serves **relatório-backed and relatório-less** atendimentos (resolves owner from `at_atendimento_usuario`, region via the cached municipios H→G map). Manual rows need nothing new.
- **Frontend transports**: `aprovarAtendimento`, `criarPendenciaAtendimento`, `aprovarSei`,
  `removerAprovacaoSei` — all take `atendimentoId` only. They currently live in
  `features/relatorio/api/relatorioAPI.ts`, but they hit `/atendimento/*` routes — importing them
  from the atendimento feature would be a backwards cross-feature dependency. **Relocate the four
  functions to `features/atendimento/api/atendimentoAPI.ts`** (which already exists) and update the
  single import site (`useValidarAtendimento`). Mechanical move, no behavior change. Note the move
  doesn't eliminate cross-feature coupling — it flips it: `useValidarAtendimento` (relatorio) then
  imports from the atendimento feature. That's accepted deliberately (endpoint ownership wins, and
  cross-feature imports already exist in both directions — e.g. `AtendimentoManualTableActions`
  imports `extractPropriedadeCoords` from relatorio), but it's a seam worth watching: if a third
  feature ever needs these transports, promote them to the top-level `api/` layer instead of adding
  another feature-to-feature edge.
- **Role gating + disabled predicates** from `RelatorioTableActionButtons.tsx`, mapped 1:1:
  - **coordenadorRegional** → *Registrar pendência* (`FaExclamationTriangle`) + *Aprovar atendimento* (`FaCheckCircle`); disabled logic identical (`exportado`, already-validated / already-pendência states).
  - **admin** → *Aprovar relatório* / *Remover aprovação* SEI toggle (`FaClipboardCheck` / `FaUndo`); same `coordValidou` precondition tooltip and `seiLocked` client-side guard.
  - Predicate inputs `sn_validado`, `sn_pendencia`, `data_validacao`, `data_sei`, `data_see`
    already exist on `AtendimentoComRelatorioManual` with the same names — every predicate is
    computable today **except** the `seiLocked` guard's `dt_export_ok` half, which needs the
    additive chain in caveat 2 below for exact parity.

### The two details that keep it from being literal copy-zero-changes (§2.2)

1. **The mutation hook doesn't transfer verbatim.** `useValidarAtendimento.onSuccess` patches the
   regular list's React Query cache (`relatoriosQuery.queryKey`) by `relatorioId` — manual rows have
   no `relatorioId` and live under `["atendimento", "com-relatorio-manual", {pageSize, cursor}]`.
   Fix: a thin sibling hook `useValidarAtendimentoManual` in `features/atendimento/use-cases/`
   reusing the **same four transports**, whose `onSuccess` applies the **same field patch** (aprovar
   → `sn_validado:1, sn_pendencia:0, data_validacao:now`; pendencia → inverse; sei → `data_sei`
   set/null) via `qc.setQueriesData({ queryKey: ["atendimento", "com-relatorio-manual"] })` matched
   by `id_at_atendimento`. ~40 lines; no new endpoints, no new backend code. (No dashboard
   invalidation — the dashboard is built from PNAE relatórios, which manual atendimentos don't have.)
2. **`dt_export_ok` is missing from the manual-list projection.** The regular table's `seiLocked`
   UX guard reads `data_see || dt_export_ok`; `AtendimentoListItem` (gateway) only carries
   `data_see`. Recommended: add `dt_export_ok` end-to-end — gateway `select` +
   `atendimentoListMapper` + `AtendimentoListItem` in `atendimento.graphql` (additive, allowed by
   the contract rules), backend gql query + DTO + data-mapper, FE type. Eight one-line touches.
   Fallback if we want zero gateway changes: derive `seiLocked` from `data_see` alone — acceptable
   because the lock is client-side UX only (v1, not server-enforced), but loses exact parity.

### Files to touch

| File | Change |
|---|---|
| `web_interface/features/atendimento/components/AtendimentoManualTableActions.tsx` | append the two role-gated button groups (via `useUsuario()`), after the existing download buttons |
| `web_interface/features/atendimento/use-cases/useValidarAtendimentoManual.ts` (new) | thin mutation hook described above |
| `web_interface/features/atendimento/api/atendimentoAPI.ts` + `features/relatorio/api/relatorioAPI.ts` + `features/relatorio/use-cases/useValidarAtendimento.ts` | relocate the four validation transports to the atendimento feature; update the one import site |
| `web_interface/features/atendimento/content/atendimentoManualTableColumns.tsx` | widen `actions` column (~120 → ~160) for the extra buttons; Part 2 change |
| `features/relatorio/utils/validacaoActionState.ts` (new) | extract the disabled/title predicate block shared by both action components (2 call sites, but ~20 lines of stateful predicates where drift would be a real bug — and extraction is what makes the role/state matrix unit-testable) |
| `dt_export_ok` chain (if taken) | gateway repo select + mapper + `.graphql`; backend `atendimento-queries.ts`, `atendimento-com-relatorio-manual.dto.ts`, `atendimento.data-mapper.ts`; FE `AtendimentoComRelatorioManual.ts` |

No changes to `AuthMiddleware` bypass list, no new routes, no mobile surface.

## Part 2 — situação column: blank instead of "Pendente"

In `atendimentoManualTableColumns.tsx`:

- `getSituacaoValue`: return `""` instead of `"Pendente"` (keeps sorting/filtering sane — empty
  strings group together).
- `SituacaoBadge`: when the value is empty, render `null` (no gray clock badge). "Pendência" and
  "Validado" badges stay as-is.

Note the semantics stay correct after Part 1: aprovar flips the row to "Validado", pendência to
"Pendência", via the React Query patch — the blank state simply means "nothing recorded yet".

## Part 3 — caching (80/20)

### Cost anatomy of `GET /atendimento/com-relatorio-manual` today

1. **Step 1 (gateway)** — raw keyset over `at_atendimento` (`link_pdf IS NULL` + indicador-4550
   `EXISTS` + scope `EXISTS`). Backward PK scan; no index narrows `link_pdf IS NULL`.
2. **Step 2 (gateway)** — hydrate page ids; the `at_cli_atend_prop` stitch is a **seq scan**
   (`id_at_atendimento` not indexed there) → the single most expensive join, as observed.
3. **Step 3 (gateway)** — `at_arquivo` metadata batch: also a seq scan (`id_at_atendimento` not
   indexed) on a binary-heavy table. Same gap hits the raw-download and combined-PDF paths.
4. **Backend enrichment** — municipio/regional names + H→G mapping: **already cached**
   (`CachedMunicipiosReader`, Redis, 24h TTL) — §4.3 is already satisfied; nothing to build.

The honest 80/20: **the DBA indexes are the 80**. Caching is the 20 that smooths repeated views.

### What to cache (PNAE backend, existing Redis infra)

**One page-level cache** of the assembled `AtendimentoComRelatorioManualPageDTO`:

- Key: `atendimento:manual-list:v1:<ver>:<scopeKey>:<pageSize>:<cursor|first>`, where `scopeKey` is
  `admin` | `staff:<id_usuario>` | `coord:<id_usuario>:<id_reg_empresa>` (derived from the same
  `getRelatorioManualScope` output — per-user keys, so no cross-user leakage).
- TTL: **90s**, matching `CACHE_TTLS.atendimento` — `at_atendimento` is hot (inserts + status
  updates), so this is the volatility ceiling per §4.6.
- Invalidation: `<ver>` is a version counter under its own key (`atendimento:manual-list:ver`,
  no TTL — a single tiny key). **This is new wiring, not `RedisInvalidator`** (that class only
  `DEL`s `prefix:id` keys and stays untouched): the reader exposes `bumpVersion()` (`INCR`) and
  reads the current version (`GET`, defaulting to `0` on miss/error) when composing page keys.
  `AtendimentoService.aprovarAtendimento` / `criarPendenciaAtendimento` / `aprovarSei` /
  `removerAprovacaoSei` call `bumpVersion()` right where they already call
  `redisInvalidator.invalidate(CACHE_KEYS.atendimento, …)`. Stale-version page keys die by their
  own 90s TTL. Keeps the post-mutation refetch consistent with the row patch the frontend applies.
- **Invalidation coverage — be explicit about the boundary:** the version bump only covers
  PNAE-initiated writes. Rows created or edited **outside PNAE** (Demeter web interface, direct DB
  work — the normal origin of manual relatórios) are covered by the 90s TTL alone; up to 90s of
  staleness for external changes is the accepted contract, same tolerance as
  `CachedAtendimentoReader`. Corollary as a standing rule: **any future PNAE-side mutation that can
  change manual-list membership or row status must also call `bumpVersion()`** — today that means
  the four validation actions, and `AtendimentoService.update` / `logicRemove` if they're ever
  pointed at manual rows (e.g. `ativo` toggling, which the list displays). A single short line on
  `bumpVersion()` (e.g. `// call from any PNAE mutation that can change manual-list rows`) carries
  the rule — no comment wall.
- Shape: a small `CachedManualListReader` in `src/modules/atendimento/cache/` — deliberately
  module-local, next to `cached-atendimento.reader.ts` / `cached-replaced-atendimentos.reader.ts`
  (`src/cache/` is reserved for cross-cutting pieces: municipios reader, invalidator, constants).
  It mirrors `CachedMunicipiosReader`'s
  error handling (fail-open: any Redis error → log and fall through to the loader). To avoid a
  `AtendimentoService ↔ reader` circular dependency, the reader **does not** depend on
  `AtendimentoService` or `AtendimentoGraphQLAPI` — it exposes
  `getOrLoad(keyParts, loader: () => Promise<PageDTO>)` and the service passes its existing
  gql+enrich pipeline as the loader:

  ```ts
  // AtendimentoService.listAtendimentosComRelatorioManual
  return this.cachedManualListReader.getOrLoad(scopeKeyParts(query), () =>
    this.loadComRelatorioManual(query), // current Promise.all + data-mapper body
  );
  ```

  Dependencies of the reader: `REDIS_CLIENT` + `WinstonLoggerService` only — same DI shape as the
  other readers, registered in the existing cache providers.

This collapses the common patterns: several admins/coordenadores viewing page 1, back/forward page
flips (each cursor is a key), and React Query remount refetches (FE `staleTime` is 300s, so Redis
mostly serves *other* users and fresh sessions).

### Considered and rejected (§4.4, §4.6)

- **Caching at the gateway (DemeterGateway/graphql_server):** rejected. It has no Redis and is
  deliberately stateless; prod runs 3 replicas, so in-process caches would be cold and mutually
  inconsistent. Adding a Redis dependency there for one list violates KISS when the PNAE backend
  already owns a cache layer for exactly this kind of hydration.
- **Long-TTL (6–12h) fragment caches for `ger_pessoa` / `pl_propriedade` / `at_cli_atend_prop`
  children:** their volatility allows it (§4.6), but once `at_cli_atend_prop(id_at_atendimento)`
  and `at_arquivo(id_at_atendimento)` exist, the child stitches are millisecond index lookups —
  a second cache layer buys nothing and adds staleness rules. Skip.
- **Regional scope via unit `IN`-list now:** the repository comment (§1b) already records that the
  planner abandons the keyset for a seq scan while `at_atendimento(id_und_empresa)` is unindexed.
  Keep the correlated `EXISTS`; **after** the index lands, switch the regional branch to an
  `IN`-list (the unit→regional map is already available from the cached municipios if we ever want
  to resolve it PNAE-side, but resolving it in-gateway from tiny `ger_und_empresa` is simpler and
  keeps the GraphQL contract unchanged).

### Indexes to request from the DBA (§4.5)

Final list (3 indexes):

| # | Index | Serves | Note |
|---|---|---|---|
| 1 | `at_cli_atend_prop (id_at_atendimento)` | list hydration step 2 (the worst join today), any produtor/propriedade stitch | table is insert-heavy / rarely updated — one btree is cheap to maintain |
| 2 | `at_arquivo (id_at_atendimento)` | list step 3 metadata batch, single-file download, combined manual PDF | plain (non-partial) btree |
| 3 | `at_atendimento (id_und_empresa)` | unlocks the `IN`-list regional-scope form (repo §1b); general regional analytics | `at_atendimento` is update-hot; the only new index on it |

A partial index on the manual filter (`at_atendimento (id_at_atendimento DESC) WHERE link_pdf IS
NULL`) was considered for keyset step 1 but dropped from the request — step 1's backward PK scan is
acceptable today, and keeping `at_atendimento` (the hottest table) to a single new index limits
write overhead. Revisit only if step 1 shows up as the bottleneck after #1–#3 land.

## Tests / verification

Automated (colocated `*.spec.ts` / existing FE test patterns, e.g. `getManualRelatorioActions.test.ts`):

- **`useValidarAtendimentoManual` cache patch** — with a real `QueryClient` holding two cursor
  pages under `["atendimento", "com-relatorio-manual", …]`, assert each acao patches the matching
  `id_at_atendimento` row on **every** cached page (partial-key `setQueriesData`) and leaves other
  rows untouched.
- **Role-gated visibility** — with the predicates extracted to `validacaoActionState.ts`, unit-test
  the state matrix there (aprovar/pendência disabled transitions, `coordValidou`, `seiLocked`);
  a light component check that admin renders only the SEI toggle, coordenador only
  pendência+aprovar, staff/produtor neither.
- **Blank situação** — `getSituacaoValue` returns `""` when `sn_pendencia`/`sn_validado`/
  `data_validacao` are all empty; no badge element rendered for the blank value.
- **`dt_export_ok` projection** — gateway: `atendimentoListMapper` test carries the field through
  (`AtendimentoRepository.test.ts` / mapper spec); backend: data-mapper spec asserts it lands on
  the DTO; FE type compiles against a fixture using it in `seiLocked`.
- **Cache reader** — `getOrLoad` unit tests: hit path skips loader; miss path loads + `SETEX`;
  Redis `get`/`setex`/`incr` throwing → logged and loader result still returned (fail-open);
  `bumpVersion()` changes the composed key so the next read is a miss.

Manual (agent must not hit live endpoints; user-run):

- On the manual table: coordenador aprovar → badge flips to "Validado" without refetch; pendência →
  "Pendência"; admin SEI toggle sets/clears `data_sei`; confirm `at_atendimento` columns in Demeter.
- After any action, force a refetch (page flip and back) and confirm the fresh page agrees with the
  patch (version bump worked). With Redis stopped in dev, the list must still load (fail-open).

## Rollout order

1. Part 1 + Part 2 (frontend, plus the optional `dt_export_ok` additive chain) — independent of
   everything else, ship first.
2. DBA indexes #1–#3 (follow-up once #3 lands: switch the gateway's regional scope branch to the
   `IN`-list form per repo §1b).
3. Page-level Redis cache — last; measure after the indexes, since they may make it unnecessary at
   current traffic. If deferred, note it and stop there (KISS).

Docs to touch when implementing: backend `AGENTS.md` entry for `GET /atendimento/com-relatorio-manual`
(new cache + `dt_export_ok` field), `docs/plans/atendimentos-manuais-list.md` cross-reference, and the
gateway `AGENTS.md` route list if `AtendimentoListItem` gains the field.
