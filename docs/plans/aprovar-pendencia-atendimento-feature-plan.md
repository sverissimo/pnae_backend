# Aprovar / Registrar Pendência — Feature Plan (backend + web)

> **Superseded (historical).** This plan describes the original design, where the
> two web routes were nested under `/relatorios/:relatorioId/atendimento/:atendimentoId/...`
> on `RelatorioController` with a relatório-pairing IDOR check. They were later
> **relocated to `AtendimentoController` and re-keyed on `atendimentoId` alone**
> (`PATCH /atendimento/:atendimentoId/aprovar` · `/pendencia`), with authorization
> split into capability + visibility on the `Usuario` entity. See
> [centralize-permissions-on-usuario-step-back-plan.md](centralize-permissions-on-usuario-step-back-plan.md)
> (implemented) and the backend AGENTS.md for the current contract. The route
> shapes below are kept only as a record of the initial implementation.

Coordenadores need to **approve** an atendimento or **flag it as pendência** straight from the relatórios table. This plan wires the PNAE backend and web interface to the two gateway endpoints defined in the GraphQL server plan (`atendimento-validacao-endpoints-plan.md`), which are **assumed already implemented**:

- `PATCH /api/aprovarAtendimento/:atendimentoId`
- `PATCH /api/criarPendenciaAtendimento/:atendimentoId`

Both take a single `atendimentoId`, write the canonical validation triple, and return `204`. The PNAE backend should keep that gateway surface thin, but it must still do its own web-facing checks first: authenticate/authorize the coordenador, verify they can access the relatório, verify the atendimento belongs to that relatório, then forward the `atendimentoId` to the right gateway route.

## Design at a glance

```
RelatorioTable "Opções"  ──(coordenador only)──▶  Aprovar / Pendência icons
        │ onClick(relatorio.id, id_at_atendimento, "aprovar" | "pendencia")
        ▼
useValidarAtendimento (React Query mutation)
        │ PATCH /relatorios/:relatorioId/atendimento/:atendimentoId/aprovar
        │ PATCH /relatorios/:relatorioId/atendimento/:atendimentoId/pendencia
        ▼
RelatorioController.aprovarAtendimento / criarPendenciaAtendimento   (thin)
        │ req.user must be coordenador regional
        │ assertCanAccess(relatorioId, req.user)
        │ assert relatorio.atendimentoId matches atendimentoId
        ▼
AtendimentoService.aprovarAtendimento / criarPendenciaAtendimento
        │
        ▼
RestAPI.aprovarAtendimento / criarPendenciaAtendimento  ──▶  gateway PATCH /api/...
```

Two intent-named routes top to bottom — no boolean flags or status strings crossing the wire from the client. The client says *which action*; nobody can post an inconsistent state. This mirrors the gateway's own "two intent routes, not three free-form columns" decision.

---

## Backend

### B1. `RestAPI` — two thin PATCH callers

[backend/src/@rest-api-server/rest-api.service.ts](../../src/@rest-api-server/rest-api.service.ts)

Mirror the existing `updateTemasAndVisitaAtendimento` shape (same `this.headers`, same `${this.url}/api/...` base, `PATCH`, empty body). No request body — the id is in the path.

```ts
async aprovarAtendimento(atendimentoId: string): Promise<void> {
  await this.patchAtendimentoValidacao('aprovarAtendimento', atendimentoId);
}

async criarPendenciaAtendimento(atendimentoId: string): Promise<void> {
  await this.patchAtendimentoValidacao('criarPendenciaAtendimento', atendimentoId);
}

// One private caller — the two routes are exact inverses, same as the gateway
// collapsing them into a single setValidacaoStatus repo method.
private async patchAtendimentoValidacao(
  route: 'aprovarAtendimento' | 'criarPendenciaAtendimento',
  atendimentoId: string,
): Promise<void> {
  const res = await fetch(`${this.url}/api/${route}/${atendimentoId}`, {
    method: 'PATCH',
    headers: this.headers,
  });
  if (!res.ok) {
    const error = new Error(`[RestAPI] ${route}/${atendimentoId} failed: ${res.status}`);
    (error as Error & { status: number }).status = res.status;
    throw error;
  }
}
```

**Why throw on `!res.ok` here** when the existing `updateTemasAndVisitaAtendimento` swallows errors: that method is a fire-and-forget side-sync of an already-saved relatório. Approve/pendência is the *primary* user action — the coordenador clicks and must learn if it failed (gateway returns `404` for an unknown id, `400` for a bad one). Surfacing the failure lets the controller translate it and the UI toast it. Don't copy the silent `catch` here.

### B2. `AtendimentoService` — two intent methods

[backend/src/modules/atendimento/atendimento.service.ts](../../src/modules/atendimento/atendimento.service.ts)

`AtendimentoService` already holds `restAPI` and `redisInvalidator` — the natural home. Keep the public API as two explicit domain actions. A private helper is fine for the shared cache invalidation, but callers should not pass a boolean to express "approve" versus "register pending". Bust the atendimento cache afterward (same `CACHE_KEYS.atendimento` invalidation the other mutations do), so `/relatorios/all` reflects the new validation status on next read.

```ts
async aprovarAtendimento(atendimentoId: string): Promise<void> {
  await this.validarAtendimento(atendimentoId, () =>
    this.restAPI.aprovarAtendimento(atendimentoId),
  );
}

async criarPendenciaAtendimento(atendimentoId: string): Promise<void> {
  await this.validarAtendimento(atendimentoId, () =>
    this.restAPI.criarPendenciaAtendimento(atendimentoId),
  );
}

private async validarAtendimento(
  atendimentoId: string,
  action: () => Promise<void>,
): Promise<void> {
  if (!atendimentoId) throw new BadRequestException('atendimentoId é obrigatório.');

  await action();
  await this.redisInvalidator.invalidate(CACHE_KEYS.atendimento, [atendimentoId]);
}
```

(If `BadRequestException` import feels heavy for a service, an inline `if (!atendimentoId) return;` is acceptable since the controller already guards; prefer the explicit throw so a future caller can't silently no-op.)

### B3. `RelatorioController` — two thin routes

[backend/src/modules/relatorios/relatorios.controller.ts](../../src/modules/relatorios/relatorios.controller.ts)

`RelatorioModule` already imports `AtendimentoModule` (which exports `AtendimentoService`), so inject it into the existing constructor — no module wiring needed.

```ts
constructor(
  private readonly relatorioService: RelatorioService,
  private readonly relatorioExportService: RelatorioExportService,
  private readonly atendimentoService: AtendimentoService,   // add
  private readonly logger: WinstonLoggerService,
) {}
```

Two routes, nested under `/relatorios/:relatorioId/atendimento/:atendimentoId/...` so they read as "validate this atendimento for this relatório" and never collide with the existing `@Patch(':id')` (relatório-id) route — that one matches `PATCH /relatorios/:id`; a deeper path can't be swallowed by it.

```ts
@Patch(':relatorioId/atendimento/:atendimentoId/aprovar')
async aprovarAtendimento(
  @Param('relatorioId') relatorioId: string,
  @Param('atendimentoId') atendimentoId: string,
  @Req() req: Request,
) {
  try {
    await this.assertCanValidarAtendimento(relatorioId, atendimentoId, req);
    await this.atendimentoService.aprovarAtendimento(atendimentoId);
  } catch (error) {
    this.errorHandler({ error, caller: 'RelatorioController.aprovarAtendimento' });
  }
}

@Patch(':relatorioId/atendimento/:atendimentoId/pendencia')
async criarPendenciaAtendimento(
  @Param('relatorioId') relatorioId: string,
  @Param('atendimentoId') atendimentoId: string,
  @Req() req: Request,
) {
  try {
    await this.assertCanValidarAtendimento(relatorioId, atendimentoId, req);
    await this.atendimentoService.criarPendenciaAtendimento(atendimentoId);
  } catch (error) {
    this.errorHandler({ error, caller: 'RelatorioController.criarPendenciaAtendimento' });
  }
}

private async assertCanValidarAtendimento(
  relatorioId: string,
  atendimentoId: string,
  req: Request,
) {
  if (!req.user?.isCoordenadorRegional()) {
    throw new ForbiddenException('Apenas coordenadores regionais podem validar atendimentos.');
  }

  const relatorio = await this.relatorioService.assertCanAccess(relatorioId, req.user);
  if (String(relatorio?.atendimentoId) !== String(atendimentoId)) {
    throw new ForbiddenException('Atendimento não pertence ao relatório informado.');
  }
}
```

**Field name is verified, not assumed.** `assertCanAccess` returns the **raw Prisma `relatorio` row** (it does `findUnique` and returns `row` directly — not `Relatorio.toModel`, not the presentation shape). The Prisma model declares `atendimentoId BigInt? @map("id_at_atendimento")`, so `relatorio.atendimentoId` is the correct property and the `String(...)` coercion is required (it's a nullable `BigInt`). A `relatorio` with no atendimento (`null`) can never match a real `atendimentoId`, so it's correctly rejected.

**Why `403`, not `400`, on the mismatch.** The request is well-formed — the caller just isn't allowed to validate that atendimento/relatório pairing. `400` would mislabel an authorization failure as a malformed input. `403 Forbidden` keeps it in the same family as the role check one line above and matches the actual intent: this is the IDOR guard, not input validation. (`404` is the alternative if we'd rather not confirm the relatório exists, but `assertCanAccess` already throws `404` for an invisible/missing relatório, so a coordenador reaching this line has legitimately seen the relatório — `403` on the pairing is the honest signal.)

Reuse the existing private `errorHandler` — it already maps an upstream `status`/`statusCode` onto the right `HttpException` and otherwise 500s, then `PlainTextExceptionFilter` flattens the body. `RestAPI.patchAtendimentoValidacao` attaches `res.status` to its thrown error, so gateway `400`/`404` responses pass through instead of becoming `500`.

**Authorization:** every request through this controller is already authenticated (middleware chain), but this mutation still needs server-side authorization in v1. The UI hides the buttons, but the backend must enforce that `req.user` is a coordenador regional. The route carries both `relatorioId` and `atendimentoId` so the backend can first reuse `RelatorioService.assertCanAccess(relatorioId, req.user)` and then verify the atendimento id belongs to that relatório before mutating the external atendimento. This prevents a coordenador from validating an arbitrary guessed atendimento id outside their visible set.

### B4. Mobile safety

These are **brand-new routes** — mobile never calls them, so the compatibility rule doesn't bind them. Still required by the gateway plan's step 3 / backend AGENTS:

- The existing `@Patch(':id')` is **untouched** (still `PATCH /relatorios/:id`), so no mobile contract changes.
- Grep `pnae_mobile/` for `aprovarAtendimento`, `criarPendenciaAtendimento`, and `/atendimento/` route fragments to confirm zero collisions before merge.
- Document both new routes in **backend AGENTS.md** under "Endpoints not used by mobile":
  - `PATCH /relatorios/:relatorioId/atendimento/:atendimentoId/aprovar`
  - `PATCH /relatorios/:relatorioId/atendimento/:atendimentoId/pendencia`

---

## Web interface

### W1. API transport

[web_interface/features/relatorio/api/relatorioAPI.ts](../../../web_interface/features/relatorio/api/relatorioAPI.ts)

The generic `patch` helper already exists in [web_interface/api/api.ts](../../../web_interface/api/api.ts). Add two thin callers (empty body — both ids are in the path):

```ts
export const aprovarAtendimento = (relatorioId: string, atendimentoId: string) =>
  patch<void>(
    `/relatorios/${relatorioId}/atendimento/${atendimentoId}/aprovar`,
    {},
  );

export const criarPendenciaAtendimento = (
  relatorioId: string,
  atendimentoId: string,
) =>
  patch<void>(
    `/relatorios/${relatorioId}/atendimento/${atendimentoId}/pendencia`,
    {},
  );
```

### W2. React Query mutation hook

New: `web_interface/features/relatorio/use-cases/useValidarAtendimento.ts`. Mirror `useEditRelatorioMultipart`'s invalidation: on success, invalidate `["relatorios"]` so the table re-reads the new validation status (drives the `sn_pendencias` / `data_validacao` columns and `useRelatorioFilter`).

```ts
"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { aprovarAtendimento, criarPendenciaAtendimento } from "../api/relatorioAPI";

type Acao = "aprovar" | "pendencia";

export function useValidarAtendimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["relatorio", "validar-atendimento"],
    mutationFn: ({
      relatorioId,
      atendimentoId,
      acao,
    }: {
      relatorioId: string;
      atendimentoId: string;
      acao: Acao;
    }) =>
      acao === "aprovar"
        ? aprovarAtendimento(relatorioId, atendimentoId)
        : criarPendenciaAtendimento(relatorioId, atendimentoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relatorios"] });
    },
  });
}
```

One hook, action param — same reasoning as the single backend method. Optional polish: a `window.confirm` before pendência (destructive-ish) and a toast on error; both live in the component, not the hook.

### W3. Icons in "Opções" (coordenador only)

[web_interface/features/relatorio/components/RelatorioTableActionButtons.tsx](../../../web_interface/features/relatorio/components/RelatorioTableActionButtons.tsx) renders the "Opções" cell ([relatorioTableColumns.tsx:124-131](../../../web_interface/features/relatorio/content/relatorioTableColumns.tsx#L124-L131)). Add the two icons here — no new column, no table changes.

- Gate purely on role + data presence:
  ```ts
  const isCoordenador = !!usuario?.isCoordenadorRegional();
  const atendimentoId = data.id_at_atendimento;
  const canValidar = isCoordenador && !!atendimentoId;
  ```
  `useUsuario()` is already imported in this component. Render the two buttons only when `canValidar`. (`isCoordenadorRegional()` is the canonical coordenador check; admins/devs already manage validation elsewhere and aren't the target user — keep the gate to coordenador exactly as the task asks. Widen to `|| usuario?.isAdmin()` only if the user later asks.)

- Reuse `react-icons/fa` (already imported: `FaEdit`, `FaFilePdf`, `FaMapMarkerAlt`). Suggested:
  - **Aprovar** → `FaCheckCircle`, green.
  - **Pendência** → `FaExclamationTriangle`, amber/orange.
  These echo the `CheckCircleIcon` / `ExclamationTriangleIcon` already used in the `sn_pendencias` column, so the visual language is consistent.

- Wire to the hook:
  ```ts
  const { mutate, isPending } = useValidarAtendimento();
  // ...
  {canValidar && (
    <>
      <button
        title="Aprovar atendimento"
        disabled={isPending}
        onClick={() =>
          mutate({ relatorioId: data.id, atendimentoId: atendimentoId!, acao: "aprovar" })
        }
        className="text-green-600 hover:text-green-700 disabled:text-gray-400"
      >
        <FaCheckCircle size={19} />
      </button>
      <button
        title="Registrar pendência"
        disabled={isPending}
        onClick={() => {
          if (confirm("Registrar pendência neste atendimento?"))
            mutate({ relatorioId: data.id, atendimentoId: atendimentoId!, acao: "pendencia" });
        }}
        className="text-amber-600 hover:text-amber-700 disabled:text-gray-400"
      >
        <FaExclamationTriangle size={19} />
      </button>
    </>
  )}
  ```
  Place them after the map button, before the PDF link, so the row reads: map · (edit, staff only) · **aprovar · pendência (coordenador only)** · PDF. Keep the existing `flex gap-2` layout — the new icons inherit spacing for free.

---

## Files touched

| # | File | Change |
|---|------|--------|
| B1 | `backend/src/@rest-api-server/rest-api.service.ts` | 2 public + 1 private PATCH caller |
| B2 | `backend/src/modules/atendimento/atendimento.service.ts` | `aprovarAtendimento(id)` / `criarPendenciaAtendimento(id)` + cache bust |
| B3 | `backend/src/modules/relatorios/relatorios.controller.ts` | inject `AtendimentoService`; 2 authorized routes |
| B4 | `backend/AGENTS.md` (= `.claude/CLAUDE.md`) | document 2 new mobile-unused routes |
| W1 | `web_interface/features/relatorio/api/relatorioAPI.ts` | 2 transport one-liners |
| W2 | `web_interface/features/relatorio/use-cases/useValidarAtendimento.ts` | **new** mutation hook |
| W3 | `web_interface/features/relatorio/components/RelatorioTableActionButtons.tsx` | 2 coordenador-only icons |

No schema, no Prisma, no migrations, no new modules, no table/column changes.

## Test notes (optional, light)

- `atendimento.service.spec.ts` — add cases asserting `aprovarAtendimento(id)` calls `restAPI.aprovarAtendimento` and invalidates cache; `criarPendenciaAtendimento(id)` calls `restAPI.criarPendenciaAtendimento` and invalidates cache.
- `relatorios.controller.spec.ts` — both routes enforce coordenador-only access, assert the relatório belongs to the user, reject atendimento/relatório mismatches, delegate to the correct service method, and translate an upstream throw via `errorHandler`.

## Out of scope (v1)

- Stamping `usuario_validacao` — the gateway plan defers it; the path stays id-only.
- Admin/developer access to the icons — gate is coordenador-only as requested.
- Optimistic row updates — a plain `["relatorios"]` invalidate is simpler and reliable enough here.
