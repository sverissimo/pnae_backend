# Production/Hmg Container Parity Plan

Goal: make production use the same proven backend container shape as hmg, while keeping production infra separate from dev/hmg. The expected differences are runtime environment, container/service names, mounted host paths, replica count, external network suffixes, and prod-only Postgres/Redis services.

## Recommendation

Use a single Dockerfile shared by hmg and prod, named `Dockerfile.prod`. Promote the current `Dockerfile.hmg` recipe into it (replacing the stale prod content), point both `docker-compose.hmg.yaml` and `docker-compose.prod.yaml` at it, and delete `Dockerfile.hmg`.

Why `Dockerfile.prod` rather than a new `Dockerfile.release`: the single recipe is "the production-shaped image", and naming it `prod` makes it obvious that hmg builds the exact same image prod will run. `release` would be misleading here — hmg is rebuilt constantly while prod ships rarely, so a file called `release` reads like "the last prod release", which it usually would not be.

This keeps the important invariant visible: hmg and prod build from the same recipe. The compose files then own the environment-specific details.

## Step By Step

1. Freeze the current production fallback.

   Before rebuilding, tag the current prod image so it stays recoverable — e.g. `docker tag pnae_backend_prod pnae_backend_prod:rollback-<date>` — and record the commit it was built from. The current `Dockerfile.prod` content is old and will be overwritten in place by the promoted recipe, so the running image and its git history — not the file on disk — are the rollback path until the new image has been deployed and observed.

2. Promote the hmg Dockerfile into the shared `Dockerfile.prod`.

   Use `Dockerfile.hmg` as the source because it is newer and already tested. Replace the stale `Dockerfile.prod` content with its generic build/runtime logic. Keep `Dockerfile.hmg` on disk until hmg has been smoke-tested against the new file (step 4), then delete it so there is only one recipe.

   Before building, confirm `.dockerignore` excludes `*.env`. The builder stage does `COPY . .`, so without it the env files (`homolog.env`/`production.env`, full of secrets) enter the build context and the cached builder layer even though the runtime stage never copies them. `*.env` does not match `.env.example`, so the tracked template stays available. This affects hmg and prod equally now that they share the recipe.

   Keep these hmg improvements:

   - Node 24 base image.
   - Separate deps, builder, and runtime stages.
   - `npm ci` with npm cache mount.
   - Explicit `npx prisma generate --schema prisma/schema.prisma`.
   - No dockerize/wget startup wrapper.
   - Runtime-only copied files: `node_modules`, `dist`, `prisma`, `assets`, and `package*.json`.
   - Node UID/GID and supplementary host-access groups.
   - `node --max-old-space-size=1024 dist/main.js` as the image command.

3. Remove environment identity from the shared Dockerfile.

   The shared Dockerfile should not hard-code hmg identity. In particular:

   - Do not leave `NODE_ENV=homolog` as an image-level default unless both compose files deliberately override it. Safe to drop here only because both env files already set it — verified: `homolog.env` → `homolog`, `production.env` → `production`. With no image default *and* no env value the app would boot with `NODE_ENV` unset, so treat "every env file defines `NODE_ENV`" as a required invariant before removing the Dockerfile default.
   - Do not carry over the baked `/home/node/data_hmg` directory from `Dockerfile.hmg`. Hmg currently bind-mounts `/home/node/data_dev`, and prod bind-mounts `/home/node/data`, so `/home/node/data_hmg` is both unused and environment-specific.

   Preferred split:

   - Dockerfile owns generic runtime settings such as `NPM_CONFIG_CACHE`.
   - `homolog.env` owns `NODE_ENV=homolog`.
   - `production.env` owns `NODE_ENV=production`.
   - Compose owns service names, networks, mounts, replicas, and resource limits.

   For data directories, prefer letting the compose bind mount create/own the actual environment path. If the image should still pre-create a generic fallback path, use `/home/node/data`, not `/home/node/data_hmg`.

4. Update hmg compose to use the shared Dockerfile.

   Change only the build target first:

   - `dockerfile: ./Dockerfile.prod`
   - keep `image: pnae_backend_hmg`
   - keep `container_name: pnae_backend_hmg`
   - keep `env_file: homolog.env`
   - keep hmg networks: `pnae_hmg`, `demeter_gateway_hmg`
   - keep hmg host paths.
   - remove `command: "npm run start:prod"` if `Dockerfile.prod` already carries `CMD ["node", "--max-old-space-size=1024", "dist/main.js"]`.

   Rebuild hmg manually and smoke-test it before touching prod. Once hmg is green on the new file, delete `Dockerfile.hmg`.

5. Make prod compose mirror hmg's backend service shape.

   Point prod at the same `Dockerfile.prod`, but keep prod-specific runtime wiring:

   - `image: pnae_backend_prod`
   - service name `pnae_backend_prod` (the `prod` suffix). **Do not set `container_name` on the prod backend** — the current prod compose omits it on purpose, because Compose cannot scale a service (`replicas > 1`) that has a fixed `container_name`. Hmg can keep `container_name: pnae_backend_hmg` because it runs a single replica; prod relies on Compose's generated `<project>-pnae_backend_prod-N` names instead. (Prod-only infra — `postgres_pnae_prod`, `redis_prod` — keep their fixed `container_name`s; they run single instances.)
   - `env_file: production.env`
   - networks: `pnae_prod`, `demeter_gateway_prod`
   - prod storage mounts, logs, and zip paths.
   - prod replica count and resource limits. Note: `deploy.replicas`/`deploy.resources` are honored only by Compose v2 (`docker compose`, verified v2.39.2 on this host) or Swarm — legacy v1 `docker-compose` would silently ignore them. Since v2 *does* apply `replicas`, the `container_name` omission above is a live constraint, not theoretical.
   - no `command:` override if the shared Dockerfile already has the production `CMD`.

   Remove old prod-only build/runtime leftovers unless still proven necessary:

   - `HOST_UID`/`HOST_GID` build args, because the hmg Dockerfile currently hard-codes the known VM UID/GID mapping.
   - dockerize entrypoint, after replacing it with healthcheck-gated `depends_on`.
   - copying `production.env` into the image, because env files should stay runtime-only.
   - copying `certificates` into the image. Verified unused — no source reads the folder, TLS now terminates at nginx, and `*.pem` is in `.dockerignore`. The `certificates/` folder has already been removed from the repo; just drop the `COPY certificates` line when promoting the Dockerfile.

6. Keep prod infra in the prod compose file unless there is a clear reason to split it.

   Hmg has backend and infra separated because dev and hmg intentionally share the same hmg database/infra topology. Prod should not share that infra, and it is reasonable to keep `pnae_backend_prod`, `postgres_pnae_prod`, `redis_prod`, and `postgres_data_prod` together in `docker-compose.prod.yaml`.

   This keeps operations simpler:

   - one prod compose file to rebuild, recreate, inspect, and restart.
   - `depends_on` can express local backend-to-infra startup ordering.
   - fewer files to keep mentally in sync.
   - a single place to confirm prod service names, volumes, and networks.

   Splitting prod infra into `docker-compose.prod-infra.yaml` can still be useful later if Postgres/Redis lifecycle needs to be protected from routine backend deploy commands, but it should not be the default move for this cleanup.

7. Replace dockerize with explicit prod healthchecks.

   Current prod uses dockerize to wait for Postgres and Redis. Plain `depends_on` only orders container creation, so removing dockerize without readiness checks would create a startup race.

   Since prod infra stays in the same compose file, copy the same healthcheck pattern used by `docker-compose.hmg-infra.yaml`:

   - `postgres_pnae_prod`: `pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}`.
   - `redis_prod`: `redis-cli ping`.

   The Postgres check reads `POSTGRES_USER`/`POSTGRES_DB` from the container env, so it only works if `production.env` defines both — verified present (same as `homolog.env`). The Redis check needs no env vars.

   Then gate the backend service on healthy infra:

   ```yaml
   depends_on:
     postgres_pnae_prod:
       condition: service_healthy
     redis_prod:
       condition: service_healthy
   ```

   This is the clean replacement for dockerize: readiness stays in compose, and the app image no longer needs wget/dockerize installed.

8. Verify configuration parity without deploying.

   Compare the rendered hmg and prod compose output. The expected differences should be only:

   - env file name.
   - service/image name suffix (`hmg` → `prod`).
   - backend `container_name`: present on hmg (single replica), omitted on prod (scalable) — see step 5.
   - mounted host paths.
   - network names.
   - replica/resource values.
   - prod-only infra services.

9. Deploy through hmg first, then prod.

   Rebuild and run hmg from `Dockerfile.prod`. Confirm:

   - app boots with `NODE_ENV=homolog`.
   - Prisma client exists in the runtime image.
   - PDF generation still works through wkhtmltopdf.
   - logs and ZIP/PDF output are writable.
   - Redis/BullMQ can connect.
   - external GraphQL/REST gateway calls resolve over `demeter_gateway_hmg`.

   Only after that, build and deploy prod manually.

10. Keep rollback boring.

   Until the new prod container has been observed, keep the old prod deployment recoverable as a **pair**: the old image *and* the old compose. The old image is not self-starting — its `Dockerfile` CMD was commented out (`# CMD npm run start:prod`), so it only boots under the old compose, which supplied the dockerize entrypoint plus `command: "npm run start:prod"`. The new compose removed both, so retagging the old image and running it under the *new* compose would launch a bare `node` REPL, not the app.

   So capture two rollback artifacts before deploying: (1) the old image, explicitly tagged (e.g. `pnae_backend_prod:rollback-<stamp>`) — resolve the source from the *running* container's image ID (`docker inspect --format '{{.Image}}' "$(docker compose -f docker-compose.prod.yaml ps -q pnae_backend_prod)"`), not the local `pnae_backend_prod` tag, which may have moved if it was rebuilt without redeploying; and (2) a snapshot of the old compose — `git show HEAD:docker-compose.prod.yaml > docker-compose.prod.rollback.yaml`, taken before the new compose is committed. Roll back with `docker compose -f docker-compose.prod.rollback.yaml up -d --no-deps --force-recreate pnae_backend_prod` after retagging (`--no-deps` leaves the running Postgres/Redis untouched; the old backend waits for them via dockerize).

   Once prod is stable, cleanup is: delete `Dockerfile.hmg` (if not already done in step 4) plus the `docker-compose.prod.rollback.yaml` and `docs/plans/temp/` artifacts; both compose files then build from the single `Dockerfile.prod`.

## Final Target

The desired final state is:

```text
Dockerfile.prod              # one production-style backend image recipe for hmg + prod
docker-compose.hmg.yaml      # hmg backend runtime identity (builds Dockerfile.prod)
docker-compose.prod.yaml     # prod backend + prod-only Postgres/Redis (builds Dockerfile.prod)
docker-compose.hmg-infra.yaml
homolog.env
production.env
```

The Dockerfile answers "how is the app built and run?". Compose and env files answer "where is this instance running?".
