# PNAE source change — reporting access for Gestão Estratégica

Status: handoff brief, 2026-10-06, based on read-only inspection of PNAE. It
authorizes nothing by itself. Implement it as a separate task in the PNAE
repository, following its `AGENTS.md`, which governs the design details and
includes the mobile-compatibility hard rule. Sibling paths below are relative to
`/home/apps/pnae/`.

## Context

Gestão Estratégica is a read-only executive reporting portal. Its backend reads
source dashboards server-to-server and shows them to an allowlisted management
audience, and every portal user sees the full admin view. It never reads
operational records and calls no other PNAE route. The portal keeps its PNAE
feed disabled until this change lands.

## What the portal needs

- **Call.** `GET /relatorios/dashboard` on PNAE's backend (dev:
  `pnae_backend_dev:3000`) over `demeter_gateway_<env>`, with
  `Authorization: Bearer <token>`, no cookie, and no query parameters. The
  portal stores the token as `PNAE_BEARER_TOKEN`.
- **Data.** The existing `DashboardData` in its admin view: `summary`, a
  non-null `topSREs`, `topTecnicos`, `relatoriosByRegional`, `lineChart`,
  `manuais30Dias`, and `scope.role: "admin"`. The portal uses `scope.role` to
  tell the admin view from the no-user view. No new fields are needed.

## Current behavior

- `AuthMiddleware` runs on every route (`backend/src/app.module.ts`) except a
  bypass list matched by substring (`backend/src/auth/auth.middleware.ts`). It
  reads the bearer header or the `auth_token` cookie:
  - a value equal to `CLIENT_TOKEN` passes without a user;
  - any other value must be a valid JWT, or the request gets 401;
  - a request with no token gets 403.
- `CLIENT_TOKEN` is the shipped mobile app's build-time `ACCESS_TOKEN`, which
  the app sends on every request (`pnae_mobile/@infrastructure/api/API.ts`; the
  "Authentication flow (mobile vs web)" section of `backend/AGENTS.md`).
- `RelatorioService.getDashboardData`
  (`backend/src/modules/relatorios/relatorios.service.ts`) and
  `buildDashboardData` (`backend/src/@domain/relatorio/relatorio-dashboard-stats.ts`)
  handle a request without a user as role `other`:
  - `summary` and `lineChart` are built from an empty set;
  - no manual-report dates are fetched, so `manuais30Dias` is zero;
  - `topSREs` is `null`, and the line chart uses the DETEC series instead of
    the admin SEE series;
  - only `topTecnicos` and `relatoriosByRegional` use the full set.
- An admin is a user whose `id_usuario` appears in `ALLOWED_USER_IDS`
  (`Usuario.isAdmin()` in `backend/src/@domain/usuario/usuario.entity.ts`).
  Admins get the full set in every block, manual dates for all regionais,
  `topSREs`, the SEE series, and `scope.role: "admin"`.
- The web dashboard consumes this route
  (`web_interface/features/dashboard/api/dashboardAPI.ts`). The mobile app has
  no `dashboard` call anywhere under `pnae_mobile/`; its relatório calls live in
  `pnae_mobile/@infrastructure/api/relatorio/repository/RelatorioAPIRepository.ts`.

## Change

- Add a static reporting token from a new env variable (proposed name:
  `REPORTING_BEARER_TOKEN`), distinct from `CLIENT_TOKEN` and `JWT_SECRET`. Add
  the name with an empty value to `.env.example`. If the variable is missing or
  empty, the reporting path is disabled.
- Accept the token only on the exact `GET /relatorios/dashboard` route, not by
  substring match as the bypass list does. Check it before the `CLIENT_TOKEN`
  branch, compare it in constant time, and never log it. On every other route
  the token falls through to JWT verification and gets 401, as unknown tokens do
  today.
- Mark the request as reporting access. The dashboard then treats it as the
  admin view for scoping, for manual dates, and for role-dependent blocks.
  Don't invent a user ID or add one to `ALLOWED_USER_IDS`; make the decision
  explicit where the dashboard decides its scope.
- Why: today's only service path, `CLIENT_TOKEN`, carries no user, so the
  user-scoped blocks come back empty and the admin-only blocks come back null.
- Rejected alternative: mapping `CLIENT_TOKEN` itself to the admin view. Anyone
  who extracts that token from the mobile app would then get the full dashboard.

## Constraints

- The mobile-compatibility hard rule in `AGENTS.md` applies. `CLIENT_TOKEN`
  behavior, the bypass list, and every existing route's request shape, response
  shape, status codes, and error format stay unchanged. Before merging, grep
  the whole `pnae_mobile/` tree again for the route and for any changed auth
  behavior, as that rule requires.
- Web JWT users, with a header or a cookie, see the same dashboard as before,
  for every role.
- The response shape stays unchanged, and the token grants only this route's
  admin view.
- Use a distinct token for each environment (dev, hmg, prod), and share none
  with another source or client.

## Acceptance criteria

- The reporting token on `GET /relatorios/dashboard` returns 200 with
  `scope.role: "admin"`, a non-null `topSREs`, and the SEE line series. Its
  `summary`, `lineChart`, and `manuais30Dias` equal an admin user's response on
  the same data.
- `CLIENT_TOKEN` requests behave as before on every route. On the dashboard
  they still get the no-user view.
- A wrong token returns 401, as does the reporting token when the env value is
  missing or empty.
- The reporting token on any other route returns 401. Bypass-list routes stay
  public, as today.
- Web dashboard responses for admins, regional coordinators, and staff are
  unchanged, and the mobile grep finds no affected call site.
- No log contains the token, and `.env.example` lists the variable with an
  empty value.

## Tests to add

- Middleware:
  - the reporting token on the dashboard route passes and is marked as
    reporting access;
  - the reporting token on another route returns 401;
  - a wrong token returns 401;
  - an empty env value returns 401;
  - `CLIENT_TOKEN` still passes without a user;
  - valid JWTs behave as before.
- Dashboard: on one fixture, reporting access and an admin user produce equal
  output, with non-empty summary and manual totals, while the no-user output
  stays unchanged.

## User-run steps

1. Generate a long random token for each environment. Don't reuse
   `CLIENT_TOKEN`, CMC's `TOKEN`, or another source's reporting token.
2. Put the token in PNAE's gitignored backend env file for that environment,
   under the new variable. Then restart or recreate PNAE's backend, following
   its docs, so it reads the value.
3. Using PNAE's usual dev checks, confirm the web dashboard for an admin and for
   a regional user, and confirm that mobile (`CLIENT_TOKEN`) traffic behaves as
   before.
4. Once the portal's PNAE client exists, set `PNAE_BEARER_TOKEN` in the portal's
   gitignored `backend/.env.<env>` to this value, then recreate the portal's
   backend container. Don't use the shared dev/hmg token here: it returns the
   no-user view.
5. Repeat these steps for hmg and prod, with their own tokens, when those
   deployments happen.

Portal-side design: `docs/architecture.md`, "Source readiness" section, in the
Gestão Estratégica repository (`/home/apps/gestao_estrategica/`).
