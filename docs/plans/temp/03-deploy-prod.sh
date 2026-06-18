#!/usr/bin/env bash
#
# Phase 3 — FINALIZE + DEPLOY PROD. Run ONLY after hmg (phase 2) is confirmed
# healthy.
#
#   3a. Delete the now-redundant Dockerfile.hmg (hmg already builds from
#       Dockerfile.prod). Recoverable from git history if ever needed.
#   3b. Rebuild + redeploy the prod stack from Dockerfile.prod.
#
# !!! IMPORTANT — this `up -d` will RECREATE postgres_pnae_prod and redis_prod,
# !!! because healthchecks were added to their definitions. Effects:
# !!!   - postgres_pnae_prod: brief restart. Data PERSISTS (named volume
# !!!     postgres_data_prod is reattached). No data loss, but ~seconds of DB
# !!!     downtime — deploy in a maintenance window if that matters.
# !!!   - redis_prod: recreated; its cache is flushed (BullMQ/cache repopulate).
# !!! If you do NOT want infra recreated right now, deploy only the backend:
# !!!     docker compose -f docker-compose.prod.yaml up -d --no-deps \
# !!!         --build --force-recreate pnae_backend_prod
# !!! (but note: without the healthchecks applied, the backend's
# !!!  condition: service_healthy depends_on cannot be satisfied on a cold
# !!!  start — it only matters when the whole stack starts together.)
#
set -euo pipefail
cd /home/pnae/pnae_app/backend

echo ">>> 3a. Removing redundant Dockerfile.hmg ..."
rm -f Dockerfile.hmg
echo "Dockerfile.hmg removed (restore from git history if needed)."
echo

# Safety: env secrets must be excluded from the build context (see note in 02).
grep -qxF '*.env' .dockerignore || { echo "ABORT: add '*.env' to .dockerignore before building."; exit 1; }

echo ">>> 3b. Building prod backend image from Dockerfile.prod ..."
docker compose -f docker-compose.prod.yaml build pnae_backend_prod

echo ">>> Deploying prod stack (backend + prod-only postgres/redis) ..."
echo ">>> Re-read the WARNING in this script's header before continuing."
docker compose -f docker-compose.prod.yaml up -d

echo ">>> Waiting ~8s for boot (backend waits for healthy pg/redis) ..."
sleep 8

# --- Smoke checks: non-fatal -------------------------------------------------
echo ">>> Smoke checks (read each line):"
set +e
docker compose -f docker-compose.prod.yaml ps
echo "--- infra health (expect: healthy) ---"
docker compose -f docker-compose.prod.yaml ps postgres_pnae_prod redis_prod
echo "--- NODE_ENV on a backend replica (expect: production) ---"
docker compose -f docker-compose.prod.yaml exec -T pnae_backend_prod printenv NODE_ENV
echo "--- wkhtmltopdf binary present? ---"
docker compose -f docker-compose.prod.yaml exec -T pnae_backend_prod which wkhtmltopdf
echo "--- prisma client loads? (custom generator output: dist/prisma/generated) ---"
docker compose -f docker-compose.prod.yaml exec -T pnae_backend_prod node -e "require('./dist/prisma/generated/client'); console.log('prisma client OK')"
echo "--- last 60 backend log lines (clean Nest start; no Prisma/Redis errors) ---"
docker compose -f docker-compose.prod.yaml logs --tail=60 pnae_backend_prod
set -e

echo
echo ">>> If prod is BROKEN, roll back. The OLD image only starts under the OLD"
echo ">>> compose (its Dockerfile CMD is commented out), so use BOTH the tagged"
echo ">>> image AND the captured rollback compose — NOT docker-compose.prod.yaml:"
echo ">>>   docker tag pnae_backend_prod:rollback-<stamp> pnae_backend_prod"
echo ">>>   docker compose -f docker-compose.prod.rollback.yaml up -d --no-deps --force-recreate pnae_backend_prod"
echo ">>> (--no-deps leaves the running postgres/redis alone; the old backend waits"
echo ">>>  for them via dockerize. List tags: docker images pnae_backend_prod )"
echo
echo ">>> Once prod is observed stable, this docs/plans/temp/ folder can be deleted."
