# Centralize User Permissions on the `Usuario` Entity — Step-Back Refactor (prerequisite)

> **Status: implemented (Phases A–C).** `Usuario.hasAccessTo` is now the single visibility rule (Phase A); relatório adopts it and `relatorio-authorization.ts` is deleted (Phase B); the validation routes moved to `AtendimentoController` keyed on `atendimentoId`, with `AtendimentoService.getAtendimentoAuthScope` + `CachedMunicipiosReader` for normalization (Phase C). No gateway change was needed (`/api/getMunicipiosEmater` and the atendimento read already expose owner + unit). The admin SEI plan adjustments remain deferred.

> **This runs *before* the admin "Aprovar Relatório (SEI)" plans.** It consolidates all authorization onto the `Usuario` domain entity and reshapes the atendimento-validation routes so the existing **coordenador** flow and the upcoming **admin SEI** flow sit on one foundation. The SEI plan ([admin-aprovar-relatorio-sei-plan.md](admin-aprovar-relatorio-sei-plan.md)) and the coordenador route details are adjusted **afterward**, on top of what lands here — not in this document.

> **Rev 2 (post-review):** (1) split authorization into **capability** (role) + **visibility** (`hasAccessTo`) — visibility alone can't gate the validation/SEI routes, or staff could validate their own atendimento (P2, Phase C); (2) `getAtendimentoAuthScope` must return **normalized** scalars — `ownerId` = numeric `id_usuario` (not `login_usuario`), `regionId` = regional `id_reg_empresa` (not raw `id_und_empresa`), normalized via the canonical `GET /api/getMunicipiosEmater`; (3) P4 reworded — the dashboard's scoped/global mix is left exactly as-is, not flattened.

> **Rev 3 (post-review):** (1) atendimento auth scope now resolves from a **single source — the external atendimento (gateway)** — since `atendimentoId` is the external-DB **PK** (guaranteed unique); the relatório reverse-lookup dual-path is dropped (Phase C); (2) cleaned the residual `login_usuario` mention in P1; (3) made the AGENTS.md edit explicit — the two old `/relatorios/:relatorioId/atendimento/...` entries are removed/replaced in the same change.

> **Rev 4 (post-review):** (1) deleted the leftover "for a relatório-backed atendimento it is simply `relatorio.tecnicoId`" line so implementers don't drift back to a dual path — owner is always gateway-resolved from the atendimento; (2) named the cache helper **`CachedMunicipiosReader`** (`src/modules/relatorios/cache/cached-municipios.reader.ts`, long TTL) to match the existing `Cached*Reader` pattern.

## Implementation notes (as-built)

The sections below are the planning intent; these are the deltas between plan and shipped code:

- **`hasAccessTo` is role-gated, not the flat Phase A pseudo.** It mirrors the deleted `canUserSeeRelatorio` exactly — admin/developer → all; coordenador → region ∪ own; staff → own only; **anything else → none**. The flat `admin → owner → coord∧region → false` sketch would have granted access to a non-role user who merely owns the target, contradicting P2's "anything else → none" and the behavior-preserving goal. For all real roles the two are identical.
- **`CachedMunicipiosReader` is registered in `AtendimentoModule`, not `RelatorioModule`.** `RelatorioModule` imports `AtendimentoModule`, so registering the reader in `RelatorioModule` (and injecting it into `AtendimentoService`) would be a circular import. It is declared directly in `AtendimentoModule` — the same precedent `RedisInvalidator` already set for a cache-folder provider consumed by `AtendimentoService`.
- **No gateway change was needed.** `GET /api/getMunicipiosEmater` already exists, and the existing `atendimentoQuery` already returns `id_usuario` + `id_und_empresa`, so `getAtendimentoAuthScope` is built entirely on existing gateway surface.
- **New supporting types:** `AtendimentoAuthScope` (`src/@domain/atendimento/atendimento-auth-scope.ts`) for the normalized `{ ownerId, regionId }`, and `MunicipioEmater` (`src/@rest-api-server/types/municipio-emater.ts`) for the `RestAPI.getMunicipiosEmater()` response.
- **Tests added/migrated:** `usuario.entity.spec.ts` (ported authorization cases), `relatorios.service.spec.ts` (list-scoping via `hasAccessTo`), `atendimento.controller.spec.ts` (capability→visibility on the relocated routes), `atendimento.service.spec.ts` (`getAtendimentoAuthScope` normalization).
- **Docs updated in the same change:** backend AGENTS.md (authorization model + the two endpoint entries) and `docs/mobile-endpoint-contract.md` (route paths). The original `aprovar-pendencia-atendimento-feature-plan.md` is marked superseded.

## Why this comes first

- **Relatório-less atendimentos are the immediate next WIP item.** Today's authorization is relatório-anchored (`RelatorioService.assertCanAccess`), so it cannot authorize an atendimento that has no relatório. Building the SEI flow on that anchor would bake in tech debt we'd rip out next week.
- **Permission logic is split and inconsistent.** The live predicate is `relatorio-authorization.ts#canUserSeeRelatorio`; meanwhile `Usuario.hasAccessTo` / `isOwnerOf` exist but are generic, unused, and `hasAccessTo` isn't even role-aware. Two homes for one concern.
- **The coordenador `aprovar`/`pendencia` routes carry a redundant `relatorioId`** and live in `RelatorioController`, anchoring auth on the relatório. `atendimentoId` already determines its relatório, so `relatorioId` is derivable noise — and impossible to supply for relatório-less atendimentos.

## Principles (our agreed conclusions)

**P1 — Authorization is identity/visibility, and it belongs on `Usuario`.** Every input to a visibility decision is user-side: perfis (external `usuario_perfil`), region (`id_und_empresa` on the external `usuario` table → regional), and admin ids (`.env`, which are themselves usuarioIds). The *target* resource contributes only two scalars — an **owner id** and a **region id** — and they mean the same thing whether the row is a relatório (`tecnicoId`) or an atendimento (its owner's numeric `id_usuario` — see Phase C for normalization, **not** the `login_usuario` string). So every decision reduces to `usuario.hasAccessTo({ ownerId, regionId })`, with all the *logic* on `Usuario` and the target merely supplying two values.

**P2 — Two user-permission checks, both on `Usuario` — don't collapse them.**

- **Resource visibility** — *can this user reach this specific instance?* The single rule, applied to any resource (relatório, atendimento, future), is `usuario.hasAccessTo({ ownerId, regionId })`:
  - admin / developer → all
  - coordenador regional → **(is coordenador ∧ same region) ∪ own**
  - staff (extensionista) → **own only**
  - anything else → none
- **Action capability** — *is this user allowed to perform this kind of action at all?* Role-based and instance-independent: e.g. **validate / pendência → coordenador or admin**; **SEI approve / remove → admin only**; plain reads → no capability gate. Expressed with the existing `usuario.isCoordenadorRegional()` / `usuario.isAdmin()`.

A plain read needs **visibility only**. A privileged mutation needs **capability first, then visibility** — both are `Usuario` methods, composed by the route. Visibility alone is *not* enough: a staff user *can see* their own atendimento (`hasAccessTo` → true via own-ownership), but must **not** be able to *validate* it. This is the one thing the prior draft got wrong by implying `hasAccessTo` was the sole gate for the validation routes.

**P3 — Three distinct layers; never conflate them.**
1. **Authentication** — middleware (JWT / mobile static token). Already in place; untouched.
2. **Authorization** — `Usuario` (this refactor). Both checks from P2: *capability* (may this user perform this kind of action?) and *visibility* (may this user reach this instance?). Mutations compose capability → visibility; reads use visibility only.
3. **Entity state / lifecycle guards** — domain/gateway. Answers *"can this be mutated right now?"* (e.g. `readOnly` after DETEC approval; `data_sei` requires `data_validacao`). These are **not** user-permission rules — they hold regardless of *who* asks, run **after** authorization passes, and stay out of `Usuario`.

**P4 — Dashboards are not authorization.** Their data is non-sensitive, read-only aggregate stats. The current dashboard intentionally **mixes** per-user-scoped pieces (gauges, 30-day line) with global pieces (tops, by-regional); `scopeRelatoriosForUser` drives the scoped part as a *presentation/view filter*, not a permission gate. This refactor **neither relies on nor changes** that behavior — it stays exactly as-is. (Whether to make the dashboard fully global is a separate UX decision, not made here.)

## Current state (verified in code)

- `canUserSeeRelatorio` (`@domain/relatorio/relatorio-authorization.ts`, 32 lines + a 104-line spec) is the **only live** visibility predicate: staff own-only, coordenador region∪own, admin all. Used by `RelatorioService.getAuthorizedRelatorios` and `assertCanAccess`.
- `Usuario.hasAccessTo` / `isOwnerOf` are defined but **unused anywhere except `usuario.entity.spec.ts`** — effectively dead. Today's `hasAccessTo` grants region access to **any** user (no role gate), i.e. it does *not* match the P2 rule. **Because it's dead, changing it has zero live blast radius.**
- Consequence: adopting P2 on `hasAccessTo` and pointing relatório at it is **behavior-preserving for relatório** (the live path already behaves per P2 via `canUserSeeRelatorio`); it simply unifies the rule and lets atendimento reuse it. The only place holding the old "staff sees whole region" logic is the unused `hasAccessTo`, so nothing live regresses.
- `AtendimentoController` already exists (`@Controller('atendimento')`) and is **mobile-touched** (POST create, GET/PATCH/DELETE `:id`). New *sub-routes* are mobile-safe; existing routes must stay untouched.
- The external `at_atendimento` row carries the *raw* anchors — `id_und_empresa` (a unit, possibly a local "H…") and the owner via `at_atendimento_usuario` — but they must be **normalized** before comparing to `Usuario` (see Phase C): owner → numeric `id_usuario` (**not** `login_usuario`, a username string), and unit → **regional** `id_reg_empresa` (the "G…" parent), since `id_und_empresa` "H…" is a local unit while users carry the regional. The gateway already encodes both: `UsuarioDataMapper` derives `id_reg_empresa = ger_und_empresa.ger_und_empresa.id_und_empresa` (self-join to the parent), and the canonical `GET /api/getMunicipiosEmater` returns the `unidadeEmpresaId → regionalId` mapping. So `{ ownerId, regionId }` is derivable from the atendimento alone — the single source for atendimento authorization (relatório-backed and relatório-less alike; `atendimentoId` is the external-DB PK, so the lookup is unique).

---

## Refactor scope — 3 phases

### Phase A — `Usuario` becomes the single authorization source

`src/@domain/usuario/usuario.entity.ts`

- Make `hasAccessTo({ ownerId, regionId })` implement the P2 **visibility** rule (this is the "few tweaks to `hasAccessTo`" we discussed):
  - admin/developer → `true`
  - else `isOwnerOf({ ownerId })` → `true`
  - else `isCoordenadorRegional() && isInRegion(regionId)` → `true`
  - else `false`
- Keep `isOwnerOf` as the **own** primitive; add `isInRegion(regionId)` as the **region** primitive (`!!this.id_reg_empresa && this.id_reg_empresa === regionId`).
- The **capability** methods (`isAdmin`, `isCoordenadorRegional`) already exist and are **unchanged** — the routes compose them with `hasAccessTo` (P2). No new capability method is needed.
- Normalize at the boundary: accept `{ ownerId, regionId }` as `string | bigint | null` and do the BigInt-safe `String(...)` coercion **inside** the entity, so callers pass raw values.
- Keep `Usuario` **pure** — it only ever sees the two scalars, never a relatório/atendimento/presentation type (hard rule: `@domain` imports nothing from `modules/`).

Tests: port the `relatorio-authorization.spec.ts` cases into `usuario.entity.spec.ts` — all four roles, owner coercion (BigInt vs string), missing region, coordenador-without-region, etc.

### Phase B — Relatório adopts the central rule; delete the split files

`src/modules/relatorios/relatorios.service.ts`

- In `getAuthorizedRelatorios` and `assertCanAccess`, replace `canUserSeeRelatorio(r, user)` with `user.hasAccessTo({ ownerId: r.tecnicoId, regionId: <produtor.id_reg_empresa> })`. The `{ ownerId, regionId }` **extraction** (tecnicoId + the produtor's region, already hydrated via `cachedProdutorReader`) is the per-entity mapping and stays in the service/data-mapper — not in `Usuario`.
- **Delete** `src/@domain/relatorio/relatorio-authorization.ts` and `relatorio-authorization.spec.ts` (coverage relocated in Phase A).
- **Preserve the mobile bypass**: the controller's `if (req.user)` guards on `findOne`/`update`/`remove` stay; mobile (no `req.user`) still skips scoping entirely.
- Dashboard untouched (**P4**) — `scopeRelatoriosForUser` remains a presentation filter.

### Phase C — Atendimento-keyed validation routes on one foundation

`src/modules/atendimento/atendimento.controller.ts` + `atendimento.service.ts`

- **Relocate + re-key** the atendimento-validation routes from `RelatorioController` to `AtendimentoController`, keyed on `atendimentoId` only (drop `relatorioId`):
  - `PATCH /atendimento/:atendimentoId/aprovar`
  - `PATCH /atendimento/:atendimentoId/pendencia`
  - (the SEI plan's `/aprovar-sei` and `/remover-aprovacao-sei` will follow the same shape, added later)
  These are **new** routes; their 2-segment paths don't shadow `@Get(':id')` / `@Patch(':id')`. Existing `AtendimentoController` routes are untouched → mobile-safe. The validation *delegate* methods already live in `AtendimentoService`.
- **Authorize in two steps (capability → visibility), both via `Usuario`** (P2):

  ```ts
  // 1) capability (role) — instance-independent. validate/pendência:
  if (!user.isCoordenadorRegional() && !user.isAdmin())   // SEI routes use: !user.isAdmin()
    throw new ForbiddenException('Sem permissão para esta ação.');

  // 2) visibility — on the resolved, NORMALIZED scope
  const scope = await this.getAtendimentoAuthScope(atendimentoId);
  if (!user.hasAccessTo(scope))
    throw new NotFoundException('Atendimento não encontrado.'); // 404 hides existence (mirrors assertCanAccess)
  ```

  The capability gate is what preserves today's "only coordenador/admin may validate" — without it, a staff user would pass visibility on their **own** atendimento and could call `/aprovar` or `/pendencia`. Error semantics: capability fail → **403** (you're the wrong role); visibility fail → **404** (don't confirm existence of something out of scope), matching the current `assertCanAccess`.

- **`getAtendimentoAuthScope(atendimentoId) → { ownerId, regionId }` must return NORMALIZED scalars comparable to `Usuario`:**
  - **`ownerId` = the external numeric `id_usuario`** — the same kind of identifier `relatorio.tecnicoId` holds and `isOwnerOf` compares against. **Not** `login_usuario` (a username string that would never match `id_usuario`). The gateway resolves it from the atendimento (via the `at_atendimento_usuario` relation, or `login_usuario` → `id_usuario`) — always from the atendimento, never by reverse-looking-up a relatório (single source, per above).
  - **`regionId` = the regional `id_reg_empresa` (the "G…" parent)** — comparable to `Usuario.id_reg_empresa`. **Not** the raw `id_und_empresa`, which may be a local "H…" unit. Normalize: a "G…" id is already the regional; an "H…" id maps to its regional parent via the canonical **`GET /api/getMunicipiosEmater`** (`unidadeEmpresaId → regionalId`) — the same parent the gateway's `UsuarioDataMapper` derives through the `ger_und_empresa` self-join. This is exactly how the relatório path already obtains `produtor.id_reg_empresa`, so both paths yield the same shape. The `/getMunicipiosEmater` table is canonical and slow-changing → **cache it behind a new `CachedMunicipiosReader`** (`src/modules/relatorios/cache/cached-municipios.reader.ts`, mirroring the existing `CachedProdutorReader` / `CachedAtendimentoReader` pattern; long TTL — e.g. 24h like `CachedProdutorReader`, since unit→regional mappings rarely change). It wraps `RestAPI.getMunicipiosEmater` and is registered in `AtendimentoModule` (its consumer — registering in `RelatorioModule` would be circular; see Implementation notes). Prefer it over the differently-shaped, currently-uncached `getRegionaisEmater` in `perfil.service.ts`.
  - **Single source = the external atendimento (gateway).** Since `relatorioId` is dropped, the route must resolve by `atendimentoId` regardless — and `atendimentoId` is the **PK of `at_atendimento` in the external DB** (no duplicates, guaranteed), so a gateway read keyed on it is authoritative and unique. One path serves **both** relatório-backed and relatório-less atendimentos, and it never depends on the app DB's `relatorio.atendimentoId` (which is **not** `@unique` here). Reuse an existing gateway atendimento read if it exposes owner `id_usuario` + `id_und_empresa`; else add a thin one. (The external-PK guarantee also makes an app-DB relatório reverse-lookup *safe*, so skipping the gateway round-trip on the relatório-backed path is a valid optimization — but it reintroduces a second code path, so we choose the single path for simplicity. This is consistent with relatório list/detail, which derives its scope from its **own** row: each resource resolves `{ ownerId, regionId }` from its own authoritative source.)

- **IDOR is preserved.** Dropping `relatorioId` weakens nothing: authorization runs on the *resolved* scope regardless of which id the client sends, so a guessed `atendimentoId` is still blocked by capability + visibility. (The old explicit `relatorio.atendimentoId === atendimentoId` pairing check is no longer needed — there's no second id to reconcile.)
- **Web transport moves in lockstep.** `web_interface/features/relatorio/api/relatorioAPI.ts` callers switch from `/relatorios/:relatorioId/atendimento/:atendimentoId/...` to `/atendimento/:atendimentoId/...`. Web + backend deploy together. Mobile never called these (new web-only routes) — unaffected.

---

## Mobile compatibility

- No existing **mobile-consumed** route changes shape. The relocated validation routes are **new web-only** routes (added recently, never called by mobile). Before merge, grep `pnae_mobile/` for `aprovar`, `pendencia`, `/atendimento/` validation fragments, and the old `/relatorios/:relatorioId/atendimento/...` paths to confirm zero hits.
- `AtendimentoController`'s existing routes (POST create, GET/PATCH/DELETE `:id`) and all relatório CRUD routes keep their exact shape.

## Docs to update in the same change

- **backend AGENTS.md (same change, mandatory — these routes are documented there today):** rewrite the "Authorization (who-can-see-what)" section to the `Usuario`-centric model (**P1–P4**); **remove the two existing "Endpoints not used by mobile" entries** for `PATCH /relatorios/:relatorioId/atendimento/:atendimentoId/aprovar` and `.../pendencia` (those routes are deleted) and **replace them** with `PATCH /atendimento/:atendimentoId/aprovar` / `.../pendencia` (capability → visibility, web-only); drop references to `relatorio-authorization.ts`. Leave the unrelated `getArquivos` / `dashboard` entries intact.
- **docs/app-overview.md** / **docs/decisions.md** — if they describe the relatório-anchored auth, align them with the new layering.

## Files touched (anticipated)

| Phase | File | Change |
|---|---|---|
| A | `src/@domain/usuario/usuario.entity.ts` | role-aware `hasAccessTo`, add `isInRegion`, boundary coercion |
| A | `src/@domain/usuario/usuario.entity.spec.ts` | port the authorization cases |
| B | `src/@domain/relatorio/relatorio-authorization.ts` | **delete** |
| B | `src/@domain/relatorio/relatorio-authorization.spec.ts` | **delete** |
| B | `src/modules/relatorios/relatorios.service.ts` | use `hasAccessTo`; keep `{ownerId,regionId}` extraction here; mobile bypass intact |
| B | `src/modules/relatorios/relatorios.controller.ts` | remove the 2 relocated validation routes (CRUD routes + mobile bypass unchanged) |
| C | `src/modules/atendimento/atendimento.controller.ts` | new `atendimentoId`-keyed validation routes; **capability (role) gate → visibility (`hasAccessTo`)** |
| C | `src/modules/atendimento/atendimento.service.ts` | `getAtendimentoAuthScope` (single gateway-sourced path) returning normalized `{ ownerId: id_usuario, regionId: id_reg_empresa }`; uses `CachedMunicipiosReader` for unit→regional |
| C | `src/modules/relatorios/cache/cached-municipios.reader.ts` | **new** `CachedMunicipiosReader` (wraps `RestAPI.getMunicipiosEmater`, long TTL); registered in `AtendimentoModule` (its consumer — `RelatorioModule` would be circular) |
| C | `emater_graphql_server` (gateway) | **no change needed** — `GET /api/getMunicipiosEmater` (unit→regional) and the existing atendimento read (owner `id_usuario` + `id_und_empresa`) already exist; both feed the validation-route auth scope (`atendimentoId` = external PK) |
| C | `web_interface/.../api/relatorioAPI.ts` | repoint validation callers to `/atendimento/...` |
| docs | backend AGENTS.md, app-overview.md, decisions.md | reflect the new model |
| tests | `relatorios.controller.spec.ts`, `atendimento.controller.spec.ts` | move/adjust route + auth assertions |

## Explicitly out of scope (handled elsewhere / later)

- **The admin SEI plan + coordenador route wiring details** — adjusted *after* this lands, on top of this foundation.
- **Dashboard scoping behavior** (**P4**) — a separate UX decision, not an auth concern.
- **Moving admin ids from `.env` to the external DB** — noted as coming "soon"; the `isAdmin()` *interface* stays stable, only its data source changes later. Not part of this refactor.
- **A `UsuarioDomainService`** — unnecessary now. Revisit only if a future resource needs a rule that can't be expressed via `Usuario` primitives (none today).

## New-behavior callout

After this lands, `hasAccessTo` is the single rule and **staff = own-only everywhere**. Relatório already behaves this way (via `canUserSeeRelatorio`), and the only code holding the older "staff sees whole region" logic is the *unused* `hasAccessTo` — so **nothing live regresses**. Atendimento authorization gains the same staff=own-only / coordenador=(region ∪ own) rule for the first time, which is the intended target behavior.
