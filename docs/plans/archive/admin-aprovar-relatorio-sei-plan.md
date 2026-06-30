# Admin — Aprovar Relatório (SEI) — Server-side Plan (gateway + PNAE backend)

Admins need to **approve a relatório at the DETEC/SEI stage** straight from the relatórios table, and to **undo that approval**. Mechanically this is a single external column write on `at_atendimento`:

- **Aprovar relatório** → set `data_sei = today()`.
- **Remover aprovação** → set `data_sei = null`.

This is the admin sibling of the coordenador *Aprovar / Registrar Pendência* feature ([aprovar-pendencia-atendimento-feature-plan.md](aprovar-pendencia-atendimento-feature-plan.md)). The flow is the same shape — React Query → PNAE backend → gateway REST → Demeter DB — but it writes a **different column** and is gated to **admins only**. The frontend half lives in a sibling doc: [web_interface/docs/plans/admin-aprovar-relatorio-sei-plan.md](../../../web_interface/docs/plans/admin-aprovar-relatorio-sei-plan.md).

> **Rev 2 (post-review):** (1) `RestAPI.patchAtendimentoValidacao` now preserves the gateway 400 message instead of only the status (2A); (2) downstream-stage locking (`seiLocked`) is explicitly **UX-only in v1**, with a ready-to-enable gateway enforcement variant (1A); (3) role wording made precise — admin-only applies to the new SEI routes; the existing validation routes keep their pre-existing coordenador+admin gate (2C).

> **Rev 3 (rebased onto the implemented step-back foundation, [centralize-permissions-on-usuario-step-back-plan.md](centralize-permissions-on-usuario-step-back-plan.md)):** (1) SEI routes now live on `AtendimentoController` keyed on `atendimentoId` alone (`PATCH /atendimento/:atendimentoId/aprovar-sei` · `/remover-aprovacao-sei`) — no `relatorioId`, no relatório-pairing IDOR check; (2) authorization is capability(`isAdmin()`) → visibility(`getAtendimentoAuthScope` + `Usuario.hasAccessTo`), reusing the controller's shared `errorHandler(error, caller)`; (3) corrected the admin env-list name to `ALLOWED_USER_IDS`; (4) the 2A error message is thrown **without** the `[RestAPI]` prefix so the propagated user-facing body stays clean. Note: visibility is a no-op for the admin-only gate today (admins always pass `hasAccessTo`) — kept for model symmetry and a future scoped DETEC perfil, not for current enforcement.

## What `data_sei` is, and why it is not `data_validacao`

`at_atendimento` carries several lifecycle dates (external Demeter schema):

| Column | Stage | Written by |
|---|---|---|
| `data_validacao` (+ `sn_validado`, `sn_pendencia`) | Coordenador regional validates the atendimento | coordenador flow (`setValidacaoStatus`) |
| **`data_sei`** | **DETEC/SEI approval of the relatório** | **this feature (admin)** |
| `data_see`, `dt_export_ok` | Later export stages | other jobs |

The coordenador's `setValidacaoStatus(id, aprovado)` writes the **validation triple** (`sn_validado`/`sn_pendencia`/`data_validacao`). The admin action must touch **only `data_sei`** and leave the triple untouched. They are distinct business operations on distinct columns — not two modes of one operation. That single fact drives the main design decision below.

The web filter already labels `data_sei` as **"Aprovados DETEC"**; the frontend `RelatorioPresentation` already carries `data_sei`, `data_validacao`, `sn_validado`, `sn_pendencia`, `id_at_atendimento`. No new fields are introduced anywhere.

## Design at a glance

```
RelatorioTable "Opções"  ──(admin only)──▶  Aprovar relatório  /  Remover aprovação  (toggle)
        │ onClick(id_at_atendimento, "aprovar-sei" | "remover-aprovacao-sei")
        ▼
useValidarAtendimento (React Query mutation — action union extended)
        │ PATCH /atendimento/:atendimentoId/aprovar-sei
        │ PATCH /atendimento/:atendimentoId/remover-aprovacao-sei
        ▼
AtendimentoController.aprovarSei / removerAprovacaoSei          (thin)
        │ req.user must be ADMIN
        │ getAtendimentoAuthScope(atendimentoId) + Usuario.hasAccessTo(scope)
        ▼
AtendimentoService.aprovarSei / removerAprovacaoSei
        │ delegate to RestAPI, then bust CACHE_KEYS.atendimento
        ▼
RestAPI.aprovarSei / removerAprovacaoSei  ──▶  gateway PATCH /api/aprovarSei|removerAprovacaoSei/:id
        ▼
AtendimentoRepository.setDataSeiStatus(id, aprovado)
        │ aprovado=true  → updateMany WHERE data_validacao IS NOT NULL  (precondition #5 lives here)
        │ aprovado=false → update data_sei = null
        ▼
Demeter DB: at_atendimento.data_sei
```

Two intent-named routes top to bottom (`aprovarSei` / `removerAprovacaoSei`) — no boolean flags or column names crossing the wire from the client. This mirrors the coordenador feature's "two intent routes, one repo method" decision exactly.

---

## Key decisions ("your call" items, resolved)

### D1 — New intent routes, **not** a param/flag on the existing ones. ✅

The task floated reusing/parametrizing the coordenador endpoints (`?role=admin`, a `field` param, etc.). Rejected, for three concrete reasons:

1. **Different column, different invariant.** The admin action writes `data_sei` and must *not* touch `sn_validado`/`sn_pendencia`/`data_validacao`. Overloading `setValidacaoStatus` with a "which column" switch couples two operations that share nothing but a verb.
2. **Gateway contract stability is a hard rule.** `emater_graphql_server/AGENTS.md` forbids changing the observable behavior of shipped `/api/*` routes (they are a published contract; old PNAE prod images still call them). New routes are explicitly allowed. A param that re-routes an existing endpoint to a different column is exactly the "side effect on a shipped route" the gateway AGENTS warns against.
3. **It matches the codebase's own philosophy.** The coordenador feature deliberately chose intent-named routes over flags ("nobody can post an inconsistent state"). Mirroring it keeps the whole surface uniform.

KISS here means *simple to understand and safe to ship*, not *fewest possible routes*. The added code is tiny and almost entirely a copy of an already-tested shape: **1 new gateway repo method + 2 thin gateway routes + 2 thin RestAPI callers (reusing the existing private helper) + 2 thin service methods (reusing the existing private helper) + 2 thin controller routes (a sibling auth helper, `assertCanAprovarSei`, following the same capability → visibility pattern as `assertCanValidarAtendimento` but with an admin-only gate).** The "unification" win the task wanted is captured by **reusing the RestAPI/service private helpers and the single React Query hook**, not by overloading shipped public routes.

### D2 — The coordenador-approval precondition (req #5) lives in the **gateway**, not the PNAE backend. ✅

Req #5: admin approval is only allowed when the coordenador has already validated (`data_validacao` present). The task (#5.1) prefers enforcing this in the gql server to keep the PNAE backend thin. That is also the *more reliable* place:

- The gateway owns the column and can enforce it **atomically** with a conditional `updateMany` (`WHERE data_validacao IS NOT NULL`) — no read-then-write race.
- The PNAE backend's atendimento auth scope contains only the normalized authorization scalars (`ownerId`, `regionId`), not `data_validacao` (that field is hydrated from the external server only for presentation DTOs). Enforcing the precondition in the PNAE backend would require an *extra* round-trip to the gateway purely to read a flag — more code, more latency, for no extra safety.

So: **frontend disables the button for UX, gateway enforces the invariant for correctness, PNAE backend stays a thin pass-through.** The `remover-aprovacao-sei` action has no precondition (an admin can always undo).

### D3 — Admin-only. ✅

Gate on `req.user.isAdmin()` (PNAE backend) and `usuario.isAdmin()` (web). `isAdmin` is env-list based (`ALLOWED_USER_IDS`); developers are a subset, so they are included. Coordenador and admin are mutually exclusive in the `Usuario` model, so admins never see the coordenador buttons and vice-versa — no per-row icon clash. If "DETEC" later becomes a distinct perfil rather than the admin list, only the gate predicate changes.

### D4 — Naming. ✅ (adjustable)

Anchored on the **column** (`data_sei`), which is stable and unambiguous, rather than the team label "DETEC" (the system already has a sei/detec naming mismatch). Proposed everywhere: `aprovarSei` / `removerAprovacaoSei`. User-facing labels stay in pt-BR business language ("Aprovar relatório" / "Remover aprovação"), matching existing UI strings like *"relatório aprovado pelo DETEC"*. Rename freely if you prefer a `Detec` anchor — it is mechanical.

---

## Phase 1 — Gateway (`emater_graphql_server`, separate repo under `/home/apps/`)

> This phase is purely additive to a published contract. Do not touch `setValidacaoStatus`, `aprovarAtendimento`, or `criarPendenciaAtendimento`.

### 1A. `AtendimentoRepository.setDataSeiStatus` — one new method

`emater_graphql_server/src/modules/atendimento/repository/AtendimentoRepository.ts`

Mirror `setValidacaoStatus` (same file, ~line 179), but write only `data_sei` and fold req #5 in:

```ts
async setDataSeiStatus(idAtendimento: bigint, aprovado: boolean) {
  if (!aprovado) {
    try {
      await this.prisma.at_atendimento.update({
        where: { id_at_atendimento: idAtendimento },
        data: { data_sei: null },
      });
    } catch (error: any) {
      this.handleRecordNotFound(error);
    }
    return;
  }

  // Approve only if the coordenador already validated. Conditional updateMany is
  // atomic (no read-then-write race) and returns count 0 — instead of throwing —
  // when the id is missing OR data_validacao is null, so we map both to 400.
  const { count } = await this.prisma.at_atendimento.updateMany({
    where: { id_at_atendimento: idAtendimento, data_validacao: { not: null } },
    data: { data_sei: getTodayBrTimezone() },
  });

  if (count === 0) {
    throw new GraphQLError(
      'Atendimento inexistente ou ainda não validado pelo coordenador regional.',
      { extensions: { code: 'BAD_REQUEST' } },
    );
  }
}
```

Notes:
- `getTodayBrTimezone()` is already imported in this file (used by `setValidacaoStatus` / `setAtendimentosExportDate`). `data_sei` is `@db.Date`, same as `data_validacao` — the helper's shape already fits.
- **Add `import { GraphQLError } from "graphql";`** at the top if not already present (the route file imports it; verify the repo does too).
- The `count === 0` throw is intentionally **outside** any `try`, so it propagates cleanly to `restErrorHandler` → 400. Don't wrap it where `handleRecordNotFound` could reclassify it. `updateMany` does not throw `P2025` on no-match, so there is nothing to catch on the approve path.

**Downstream-stage locking (`seiLocked`) — decision (per review).** The frontend disables both actions when `data_see` or `dt_export_ok` is set (W3 in the frontend plan). In **v1 this is UX-only**: the gateway does *not* block a direct `removerAprovacaoSei` call on a later-stage row. That is an accepted, explicit gap — admins are trusted, the column lifecycle ordering (`data_sei` → `data_see` → `dt_export_ok`) is not independently verified here, and the task scope is strictly "set `data_sei` to today/null". **If** downstream locking is confirmed as a hard data invariant, enforce it server-side by making the remove path conditional too (mirrors the approve precondition exactly):

```ts
// remove path, hardened variant — only when seiLocked is a confirmed invariant
const { count } = await this.prisma.at_atendimento.updateMany({
  where: { id_at_atendimento: idAtendimento, data_see: null, dt_export_ok: null },
  data: { data_sei: null },
});
if (count === 0) {
  throw new GraphQLError(
    'Não é possível remover a aprovação: relatório já está em etapa posterior (SEE/exportado).',
    { extensions: { code: 'BAD_REQUEST' } },
  );
}
```

**v1 ships UX-only — that part is decided** (the snippet above is not in v1). The only open item is whether to *additionally* enable this gateway enforcement: do so iff downstream locking is confirmed a hard data invariant. Either way, never document the client-side guard as if it were server-enforced.

### 1B. Two new REST routes

`emater_graphql_server/src/routes/atendimentoRoutes.ts`

Copy the `aprovarAtendimento` / `criarPendenciaAtendimento` handlers verbatim, swap the repo call:

```ts
router.patch("/aprovarSei/:atendimentoId", async (req: Request, res: Response) => {
  const id = parseAtendimentoId(routeParam(req.params.atendimentoId));
  await atendimentoRepository.setDataSeiStatus(id, true);
  return res.status(204).send();
});

router.patch("/removerAprovacaoSei/:atendimentoId", async (req: Request, res: Response) => {
  const id = parseAtendimentoId(routeParam(req.params.atendimentoId));
  await atendimentoRepository.setDataSeiStatus(id, false);
  return res.status(204).send();
});
```

`parseAtendimentoId` (400 on a non-numeric id) and `routeParam` already exist in the file. No change to `routes.ts` — these handlers register on the same `atendimentoRoutes` router already mounted under `/api`.

### 1C. Gateway contract / safety

- Purely additive: no existing route, resolver, field, scalar, or status code changes.
- `restErrorHandler` already maps `extensions.code` → HTTP (`BAD_REQUEST` → 400, `NOT_FOUND` → 404, else 500), so the precondition surfaces as a clean 400.
- Service-token auth applies automatically (same middleware as the other `/api/*` routes); no auth-bypass change.
- Update `emater_graphql_server/AGENTS.md` "REST surface" notes + its `docs/plans/atendimento-validacao-endpoints-plan.md` to list the two new routes, in the same change.

---

## Phase 2 — PNAE backend (`backend/`)

### 2A. `RestAPI` — two thin PATCH callers (reuse the private helper)

[backend/src/@rest-api-server/rest-api.service.ts](../../src/@rest-api-server/rest-api.service.ts)

The existing `patchAtendimentoValidacao(route, atendimentoId)` (private, ~line 156) has the right *shape* — `PATCH ${url}/api/${route}/${id}` with `this.headers`, throwing on `!res.ok` with `status` attached — but it **discards the gateway response body**, throwing only `[RestAPI] ${route}/${id} failed: ${res.status}`. That loses the precise 400 reason ("Atendimento inexistente ou ainda não validado pelo coordenador regional."), which is exactly the message req #5 needs to show the admin. So this widening also **fixes the message-propagation gap**: widen the `route` union, add two public callers, and capture the gateway body.

```ts
async aprovarSei(atendimentoId: string): Promise<void> {
  await this.patchAtendimentoValidacao('aprovarSei', atendimentoId);
}

async removerAprovacaoSei(atendimentoId: string): Promise<void> {
  await this.patchAtendimentoValidacao('removerAprovacaoSei', atendimentoId);
}

private async patchAtendimentoValidacao(
  route: 'aprovarAtendimento' | 'criarPendenciaAtendimento' | 'aprovarSei' | 'removerAprovacaoSei',
  atendimentoId: string,
): Promise<void> {
  const res = await fetch(`${this.url}/api/${route}/${atendimentoId}`, {
    method: 'PATCH',
    headers: this.headers,
  });
  if (!res.ok) {
    // Gateway restErrorHandler returns { error: "<message>" }; surface it so the
    // coordenador-validation 400 reason reaches the controller → UI, not just the status.
    // No "[RestAPI]" prefix on the thrown message: it becomes the user-facing body
    // via PlainTextExceptionFilter, so it must read as a clean business message.
    // (Keep that prefix only if/where the value is logged, not on `error.message`.)
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    const reason = body?.error ?? `${route}/${atendimentoId} failed`;
    const error = new Error(reason) as Error & { status: number };
    error.status = res.status;
    throw error;
  }
}
```

**Verified end-to-end chain** (so the adjustment is sufficient and localized): gateway `restErrorHandler` → `res.status(400).send({ error: msg })`; `patchAtendimentoValidacao` now puts `msg` **verbatim** on `error.message` (no `[RestAPI]` prefix) with `error.status = 400`; controller `errorHandler` does `new HttpException(error.message, status)`; `PlainTextExceptionFilter.pickMessage` returns the string body and sends it as `text/plain`; the web `handleHttpError` reads `res.text()` into `HTTPError.userMessage`. The only previously-broken link was this RestAPI helper. (See W3 in the [frontend plan](../../../web_interface/docs/plans/admin-aprovar-relatorio-sei-plan.md) — to actually *display* `userMessage`, the component needs an `onError` toast; without it the message is propagated but not shown.)

Notes:
- The two existing callers still pass their own literals — widening the union is additive. Reading the body on `!res.ok` is a benign improvement that also upgrades the **coordenador** routes' error messages (success path and status codes unchanged); call it out in the PR description since it touches a shared helper.
- Don't copy the silent `catch` of `updateTemasAndVisitaAtendimento`: this is the admin's primary action and must surface failures.
- Optional cosmetic: the name `patchAtendimentoValidacao` is now slightly narrow; rename to `patchAtendimentoRoute` if you like — private, zero external consumers. Not required.

### 2B. `AtendimentoService` — two intent methods (reuse the private helper)

[backend/src/modules/atendimento/atendimento.service.ts](../../src/modules/atendimento/atendimento.service.ts)

The existing private `validarAtendimento(atendimentoId, action)` (~line 153) already guards the id and busts `CACHE_KEYS.atendimento` after the action. Reuse it as-is — `data_sei` feeds `/relatorios/all` hydration (`readOnly` / "exportado" derive from it), so the cache bust is exactly what we want:

```ts
async aprovarSei(atendimentoId: string): Promise<void> {
  await this.validarAtendimento(atendimentoId, () =>
    this.restAPI.aprovarSei(atendimentoId),
  );
}

async removerAprovacaoSei(atendimentoId: string): Promise<void> {
  await this.validarAtendimento(atendimentoId, () =>
    this.restAPI.removerAprovacaoSei(atendimentoId),
  );
}
```

No new dependencies; `restAPI` and `redisInvalidator` are already injected.

### 2C. `AtendimentoController` — two thin atendimento-keyed routes

[backend/src/modules/atendimento/atendimento.controller.ts](../../src/modules/atendimento/atendimento.controller.ts)

Add the SEI routes beside the relocated coordenador validation routes, keyed on `atendimentoId` alone:

```ts
@Patch(':atendimentoId/aprovar-sei')
async aprovarSei(
  @Param('atendimentoId') atendimentoId: string,
  @Req() req: Request,
) {
  try {
    await this.assertCanAprovarSei(atendimentoId, req);
    await this.atendimentoService.aprovarSei(atendimentoId);
  } catch (error) {
    this.errorHandler(error, 'AtendimentoController.aprovarSei');
  }
}

@Patch(':atendimentoId/remover-aprovacao-sei')
async removerAprovacaoSei(
  @Param('atendimentoId') atendimentoId: string,
  @Req() req: Request,
) {
  try {
    await this.assertCanAprovarSei(atendimentoId, req);
    await this.atendimentoService.removerAprovacaoSei(atendimentoId);
  } catch (error) {
    this.errorHandler(error, 'AtendimentoController.removerAprovacaoSei');
  }
}
```

**Auth — same foundation as the relocated validation routes, different capability gate.** The step-back refactor moved validation to `AtendimentoController` and dropped `relatorioId`; SEI follows that same shape. The SEI helper composes:

1. **Capability:** admin-only.
2. **Visibility:** resolve the normalized atendimento scope via `AtendimentoService.getAtendimentoAuthScope(atendimentoId)` and pass it to `req.user.hasAccessTo(scope)`.

```ts
private async assertCanAprovarSei(atendimentoId: string, req: Request) {
  const user = req.user;
  if (!user?.isAdmin()) {
    throw new ForbiddenException(
      'Apenas administradores podem aprovar relatórios no SEI.',
    );
  }

  const scope =
    await this.atendimentoService.getAtendimentoAuthScope(atendimentoId);
  if (!user.hasAccessTo(scope)) {
    throw new NotFoundException('Atendimento não encontrado.');
  }
}
```

There is no atendimento↔relatório IDOR pairing check anymore because there is no `relatorioId` in the request. Authorization runs on the resolved atendimento scope, and `atendimentoId` is the external DB PK. For admins, visibility is effectively all-access today, but keeping the two-step shape matches the authorization model and leaves the route ready if the SEI capability later moves from env-admins to a scoped DETEC perfil.

`errorHandler` should mirror the existing validation routes in `AtendimentoController`: preserve upstream `status` / `statusCode` (the gateway 400 from req #5) and message, then let `PlainTextExceptionFilter` flatten it.

### 2D. Mobile safety + docs

Brand-new routes — mobile never calls them, so the compatibility rule doesn't bind them. Still required:

- `@Patch(':id')` is untouched → no mobile contract change.
- Grep `pnae_mobile/` for `aprovarSei`, `removerAprovacaoSei`, `aprovar-sei`, `remover-aprovacao-sei`, and `data_sei` to confirm zero collisions before merge.
- Document both new routes in **backend AGENTS.md** under "Endpoints not used by mobile":
  - `PATCH /atendimento/:atendimentoId/aprovar-sei` — admin-only; two-step authorization on `Usuario` (admin capability, then atendimento visibility via `getAtendimentoAuthScope`). Sets `at_atendimento.data_sei = today()` via gateway `PATCH /api/aprovarSei/:id`. Coordenador-validation precondition (`data_validacao` present) enforced in the gateway. Busts the atendimento cache.
  - `PATCH /atendimento/:atendimentoId/remover-aprovacao-sei` — admin-only; same auth shape. Sets `data_sei = null` via gateway `PATCH /api/removerAprovacaoSei/:id`. Busts the atendimento cache.

---

## Files touched (server-side)

| # | Repo | File | Change |
|---|------|------|--------|
| 1A | gateway | `modules/atendimento/repository/AtendimentoRepository.ts` | `setDataSeiStatus(id, aprovado)` (+ `GraphQLError` import if missing) |
| 1B | gateway | `routes/atendimentoRoutes.ts` | 2 new PATCH routes |
| 1C | gateway | `AGENTS.md` + `docs/plans/atendimento-validacao-endpoints-plan.md` | document 2 new routes |
| 2A | backend | `src/@rest-api-server/rest-api.service.ts` | 2 public callers; widen private union |
| 2B | backend | `src/modules/atendimento/atendimento.service.ts` | `aprovarSei(id)` / `removerAprovacaoSei(id)` (reuse helper) |
| 2C | backend | `src/modules/atendimento/atendimento.controller.ts` | 2 admin routes + `assertCanAprovarSei(atendimentoId, req)` using capability → visibility |
| 2D | backend | `AGENTS.md` (= `.claude/CLAUDE.md`) | document 2 new mobile-unused routes |

No schema, no Prisma migration, no new modules, no new env var. The frontend is in the [sibling plan](../../../web_interface/docs/plans/admin-aprovar-relatorio-sei-plan.md).

## Test notes (light)

- **gateway** — if/when the atendimento repo gets a spec: `setDataSeiStatus(id, true)` issues an `updateMany` filtered on `data_validacao: { not: null }` and throws `BAD_REQUEST` on `count === 0`; `setDataSeiStatus(id, false)` clears `data_sei` via `update`.
- `atendimento.service.spec.ts` — `aprovarSei(id)` calls `restAPI.aprovarSei` then invalidates `CACHE_KEYS.atendimento`; `removerAprovacaoSei(id)` calls `restAPI.removerAprovacaoSei` then invalidates. Mirror the existing `aprovarAtendimento` cases.
- `atendimento.controller.spec.ts` — both new SEI routes are admin-only (coordenador/staff → `ForbiddenException`), resolve `getAtendimentoAuthScope(atendimentoId)`, deny failed visibility with `NotFoundException`, delegate to the correct service method, and translate an upstream 400 (req #5) via `errorHandler` **with the gateway's message preserved** (assert the thrown `HttpException` carries the gateway `{ error }` text, not just the status). Add a regression assertion that the existing coordenador validation routes still accept **both coordenador and admin** (pre-existing behavior, unchanged by this feature).

## Out of scope (v1)

- Stamping a "who approved" user id on `data_sei` — the path stays id-only, like the coordenador feature.
- Splitting the gateway precondition failure into distinct 404 (missing) vs 400 (not validated) — one 400 with a clear message is enough; the UI already gates on `data_validacao`.
- **Server-side downstream-stage locking** (block remove when `data_see`/`dt_export_ok` set) — v1 keeps it UX-only; the ready-to-enable gateway variant is documented in 1A. Promote it to enforced only if confirmed as a hard invariant.
- Letting coordenadores set `data_sei` — admin-only by design (the new SEI routes only; existing validation routes keep their current coordenador+admin gate).
