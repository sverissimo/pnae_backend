#!/usr/bin/env bash
#
# Phase 2 — REBUILD + REDEPLOY HMG from the shared Dockerfile.prod, then smoke
# test. hmg is the canary: it must be green here before prod is touched.
#
# Pre-req: hmg infra (postgres_pnae_hmg, redis_hmg) is already running via
#          docker-compose.hmg-infra.yaml. Dockerfile.hmg is still on disk as a
#          fallback and is NOT deleted until phase 3.
#
set -euo pipefail
cd /home/pnae/pnae_app/backend

# Safety: env secrets must be excluded from the build context. Dockerfile.prod's
# builder stage does `COPY . .`, so without this the *.env files would enter the
# build cache / builder layer even though the runtime image never copies them.
grep -qxF '*.env' .dockerignore || { echo "ABORT: add '*.env' to .dockerignore before building."; exit 1; }

echo ">>> Building hmg backend image from Dockerfile.prod ..."
docker compose -f docker-compose.hmg.yaml build pnae_backend_hmg

echo ">>> Recreating hmg backend container ..."
docker compose -f docker-compose.hmg.yaml up -d --force-recreate pnae_backend_hmg

echo ">>> Waiting ~5s for boot ..."
sleep 5

# --- Smoke checks: non-fatal so you see ALL results, not just the first fail --
echo ">>> Smoke checks (read each line):"
set +e
docker compose -f docker-compose.hmg.yaml ps
echo "--- NODE_ENV (expect: homolog) ---"
docker compose -f docker-compose.hmg.yaml exec -T pnae_backend_hmg printenv NODE_ENV
echo "--- wkhtmltopdf binary present? ---"
docker compose -f docker-compose.hmg.yaml exec -T pnae_backend_hmg which wkhtmltopdf
echo "--- prisma client loads? ---"
docker compose -f docker-compose.hmg.yaml exec -T pnae_backend_hmg node -e "require('@prisma/client'); console.log('prisma client OK')"
echo "--- logs/zipFiles writable by node? ---"
docker compose -f docker-compose.hmg.yaml exec -T pnae_backend_hmg sh -c 'touch /home/node/logs/.w && rm /home/node/logs/.w && touch /home/node/zipFiles/.w && rm /home/node/zipFiles/.w && echo writable'
echo "--- last 60 log lines (look for a clean Nest start; no Prisma/Redis errors) ---"
docker compose -f docker-compose.hmg.yaml logs --tail=60 pnae_backend_hmg
set -e

echo
echo ">>> If hmg is healthy, continue:  bash docs/plans/temp/03-deploy-prod.sh"
echo ">>> If hmg is BROKEN, roll hmg back:"
echo ">>>   1) git checkout -- docker-compose.hmg.yaml   # restores dockerfile: ./Dockerfile.hmg + command"
echo ">>>   2) docker compose -f docker-compose.hmg.yaml up -d --build --force-recreate pnae_backend_hmg"
echo ">>>   (Dockerfile.hmg is still on disk during this phase, so this works.)"
