# PNAE source change — reporting access for Gestão Estratégica

Status: handoff brief, 2026-10-06, based on read-only inspection of PNAE;
revised twice on 2026-10-11 after review. It authorizes nothing by itself.
Implement it as a separate task in the PNAE
repository, following its `AGENTS.md`, which governs the design details and
includes the mobile-compatibility hard rule. Sibling paths below are relative to
`/home/apps/pnae/` (a symlink to `/home/pnae/pnae_app/`).

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

- `AuthMiddleware` runs on every route (`backend/src/app.module.ts`, via
  `forRoutes('*')`) except a bypass list matched by substring
  (`backend/src/auth/auth.middleware.ts`). It reads the bearer header, or the
  `auth_token` cookie when no header is sent:
  - a value equal to `CLIENT_TOKEN` passes without a user;
  - any other value must be a valid JWT, or the request gets 401;
  - a request with no token gets 403.
- Under that wildcard mount (Nest 11 on Express 5), `req.path` is always `/`
  inside the middleware. `req.baseUrl` holds the full request path, without
  the query string or a trailing slash. Its case is preserved. A scratch
  check against the installed Express 5 showed this. The mounted middleware
  tests below must confirm it.
- `cookieParser()` is registered in `main.ts`, not in `AppModule`. A test app
  built from a module alone has no `req.cookies` until it registers the parser
  itself.
- `UserContextMiddleware` runs next and re-decodes only the `auth_token`
  cookie into `req.user`. `UserHydrationInterceptor` then turns `req.user`
  into a `Usuario`. Neither runs anything when there is no user.
- `CLIENT_TOKEN` is the shipped mobile app's build-time `ACCESS_TOKEN`, which
  the app sends on every request (`pnae_mobile/@infrastructure/api/API.ts`; the
  "Authentication flow (mobile vs web)" section of `backend/AGENTS.md`).
- `RelatorioController.getDashboard` passes only `req.user` to
  `RelatorioService.getDashboardData`
  (`backend/src/modules/relatorios/relatorios.service.ts`). The service picks
  the dashboard's scope in three places, each keyed on the user:
  - `getRole()` (or `other` without a user) sets the role that
    `buildDashboardData`
    (`backend/src/@domain/relatorio/relatorio-dashboard-stats.ts`) uses for
    `topSREs`, the line-chart series, and `scope.role`;
  - `scopeRelatoriosForUser` builds the scoped set behind `summary` and
    `lineChart`;
  - `getDashboardManualRegionalScope` decides which manual-report dates are
    fetched for `manuais30Dias`.

  Both scoping helpers return the same three outcomes. Without a user they
  return nothing. For an admin they return everything. For anyone else they
  return the user's `id_reg_empresa`, or nothing when it is missing.
- Without a user, therefore:
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
  `backend/docs/mobile-endpoint-contract.md` already lists the route as not
  called by mobile.
- No logger records request headers today. The only code that reads
  `Authorization` is the middleware itself.

## Change

Keep it cohesive: one middleware branch, one typed request marker, and one
explicit scope decision in the dashboard service. Add no new domain identity,
permission abstraction, or dependency.

- **Credential.** Add a static reporting token from a new env variable
  (proposed name: `REPORTING_BEARER_TOKEN`), distinct from `CLIENT_TOKEN` and
  `JWT_SECRET`. List it in `.env.example` under "Tokens / secrets" as a
  commented-out placeholder, following that template's convention
  (`# REPORTING_BEARER_TOKEN=<random-reporting-token>`). If the variable is
  missing or empty, the reporting path is disabled.
- **Middleware branch.** In `AuthMiddleware`, add one branch **after** the
  `CLIENT_TOKEN` check and **before** JWT verification. It passes only when all
  of these hold:
  - the token came from the `Authorization` header (a cookie is never
    reporting access);
  - `req.method === 'GET'` and `req.baseUrl === '/relatorios/dashboard'`. This
    is an exact match, not the substring match of the bypass list. Other
    methods, suffixes, and mixed-case paths fall through, even though Express
    would route a mixed-case path to the same controller. A trailing slash or
    a query string still matches, and that is intended: the controller serves
    the same route and ignores query parameters.
  - the configured value is non-empty and matches the token in constant time.
    `crypto.timingSafeEqual` throws on unequal lengths, so compare SHA-256
    digests of both values instead. A token of a different length must yield
    401, never 500.

  Anything that fails a check falls through to JWT verification and gets 401,
  as unknown tokens do today. Never log the token or the configured value.
- **Why after `CLIENT_TOKEN`.** The new branch only intercepts tokens that
  would otherwise fail JWT verification, so the mobile path runs exactly as
  before. If an environment is misconfigured with the reporting token equal to
  `CLIENT_TOKEN`, that value keeps its mobile behavior everywhere, including
  the no-user dashboard. It never gains the admin view, so no extra equality
  guard is needed. A test pins this ordering (see below).
- **Request marker.** Add `reportingAccess?: true` to the existing
  `express-serve-static-core` `Request` augmentation in
  `backend/src/types/express.d.ts`, next to `user`. Only `AuthMiddleware` sets
  it. Nothing derived from client headers, query, or body may set it.
- **Controller.** `getDashboard` passes the marker explicitly:
  `getDashboardData(req.user, req.reportingAccess === true)`.
- **Service.** `getDashboardData` must make the reporting decision once and
  apply it to all three scope points together: role `admin`, the full
  relatório set, and manual dates for all regionais. Changing only the role
  would return the admin layout with empty totals. Because both helpers already
  return the same three outcomes, the simplest shape is one private resolver.
  It returns `{ role, regionScope }`, and both the relatório filter and the
  manual-dates fetch consume it. Reporting access takes precedence over any
  `req.user`. None is expected, because the portal sends no cookie. Don't
  invent a user ID, build a fake `Usuario`, or add an ID to
  `ALLOWED_USER_IDS`.
- **Why at all.** Today's only service path, `CLIENT_TOKEN`, carries no user,
  so the user-scoped blocks come back empty and the admin-only blocks come back
  null.
- **Rejected alternatives.**
  - Mapping `CLIENT_TOKEN` itself to the admin view. Anyone who extracts that
    token from the mobile app would then get the full dashboard.
  - A synthetic admin `Usuario` on `req.user`. It would leak admin identity
    into every downstream check that trusts `req.user`, not just this route.

## Constraints

- The mobile-compatibility hard rule in `AGENTS.md` applies. `CLIENT_TOKEN`
  behavior, the bypass list, and every endpoint in
  `backend/docs/mobile-endpoint-contract.md` stay unchanged. That covers
  request shapes, response shapes and payload projections, status codes, and
  the plain-text error format. Authentication is shared, so mobile is exposed
  through the middleware even though this route is web-only. Before merging,
  grep the whole `pnae_mobile/` tree again for the route and for any changed
  auth behavior, as that rule requires.
- Web JWT users, with a header or a cookie, see the same dashboard as before,
  for every role.
- The response shape stays unchanged, and the token grants only this route's
  admin view.
- Use a distinct token for each environment (dev, hmg, prod), and share none
  with another source or client.

## Acceptance criteria

- The reporting token in the header on `GET /relatorios/dashboard` returns 200
  with `scope.role: "admin"`, a non-null `topSREs`, and the SEE line series.
  The whole response equals an admin user's response on the same data and
  clock. The same holds for `/relatorios/dashboard/` and for the path with a
  query string.
- `CLIENT_TOKEN` requests behave as before on every route. On the dashboard
  they still get the no-user view. That holds even when the reporting token is
  misconfigured to equal `CLIENT_TOKEN`.
- The reporting token returns 401 in each of these cases:
  - with another method on the dashboard path;
  - on any other path, including suffixes such as `/relatorios/dashboard/x`
    and `/relatorios/dashboardx`, and mixed-case variants such as
    `/Relatorios/Dashboard`;
  - when sent as the `auth_token` cookie;
  - when the env value is missing or empty.
- A wrong token returns 401 whatever its length, and never 500. A request with
  no token still returns 403, and bypass-list routes stay public.
- Web dashboard responses for admins, regional coordinators, and staff are
  unchanged, and the mobile grep finds no affected call site.
- No log contains the token, and `.env.example` lists the variable as a
  placeholder.

## Tests to add

Run with `npm test`. Mock downstream dependencies, and touch no database or
container.

- **Middleware** (`src/auth/auth.middleware.spec.ts`). Boot a minimal Nest app
  that applies `AuthMiddleware` with the same `forRoutes('*')` wiring as
  `AppModule`. Give it a stub controller exposing `GET` and `POST`
  `/relatorios/dashboard`, another route, and a bypass-list route. Use a real
  `JwtService` with a test secret. Register `cookieParser()` on the app before
  `init()`, as `main.ts` does. Without it every cookie case degrades to "no
  token" (403), and the cookie assertions stop testing anything. Call the app
  over a real listener (`app.listen(0)` and Node's `fetch`) so the route match
  goes through the actual Nest/Express mount. These tests are what confirm the
  `req.baseUrl` behavior described above. Set env values per test and restore
  them afterwards. Cover:
  - the reporting token in the header on `GET /relatorios/dashboard`,
    `GET /relatorios/dashboard/`, and `GET /relatorios/dashboard?x=1` passes,
    and the handler sees `reportingAccess === true` with no `req.user`;
  - the reporting token returns 401 on `POST /relatorios/dashboard`, on
    another route, on `/relatorios/dashboard/x`, on `/relatorios/dashboardx`,
    on `/Relatorios/Dashboard` and `/relatorios/DASHBOARD`, and as the
    `auth_token` cookie;
  - a missing or empty env value makes the reporting token 401;
  - wrong tokens shorter than, equal in length to, and longer than the
    configured one all return 401;
  - `CLIENT_TOKEN` passes without a user and without the marker. When the
    reporting token is set equal to `CLIENT_TOKEN`, that value still passes
    without the marker on the dashboard and on another route;
  - a valid JWT, by header and by cookie, passes with its claims on
    `req.user`, and an invalid JWT returns 401;
  - no token returns 403, and the bypass-list route passes with no token.
- **Controller** (`relatorios.controller.spec.ts`). `getDashboard` calls
  `getDashboardData(user, true)` when the marker is set and
  `getDashboardData(user, false)` when it is absent.
- **Service** (`relatorios.service.spec.ts`, extending the existing mocked
  `getDashboardData` tests). Use a fixed clock and one fixture with
  relatórios in several regionais and non-empty manual dates:
  - reporting access and an admin user produce deep-equal responses, with
    non-empty `summary` and `manuais30Dias`, and the manual fetch is unscoped;
  - the no-user, regional-coordinator, and staff outputs and manual-fetch
    scopes match the current behavior.

## Docs to update in the same change

- `backend/AGENTS.md`:
  - "Authentication flow (mobile vs web)": add one bullet for reporting access,
    covering the header-only static token, the single route, the
    `req.reportingAccess` marker, and the absence of `req.user`;
  - the `GET /relatorios/dashboard` line under "Endpoints not used by mobile":
    note the reporting-token admin view.
- `backend/docs/web-only-endpoints.md`, "Dashboard": describe reporting access
  and its admin scoping.
- `backend/docs/app-overview.md`, "Dashboard scoping": reporting access
  resolves to the admin scope.
- `backend/.env.example`: the new placeholder.
- `backend/docs/mobile-endpoint-contract.md` needs no change.

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
   backend container. Don't use `CLIENT_TOKEN` here: it returns the no-user
   view.
5. Repeat these steps for hmg and prod, with their own tokens, when those
   deployments happen.

Portal-side design: `docs/architecture.md`, "Source readiness" section, in the
Gestão Estratégica repository (`/home/apps/gestao_estrategica/`).
