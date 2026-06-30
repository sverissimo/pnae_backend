#!/usr/bin/env bash
#
# Phase 1 — PRE-FLIGHT (safe: no container is created/recreated here).
#   - Tags the currently-running prod image so you have a named rollback point.
#   - Renders both compose configs and diffs them so you can eyeball parity
#     BEFORE anything is rebuilt or deployed.
#
# Run order: 01 -> 02 (verify hmg) -> 03 (prod). Read each script before running.
#
set -euo pipefail
cd /home/pnae/pnae_app/backend

# --- 1. Freeze the rollback point -------------------------------------------
# Tag the EXACT image the live prod containers are running on. Don't trust the
# local 'pnae_backend_prod' tag — if it was rebuilt locally without a redeploy,
# it points at an image the running containers never used. Resolve the real
# image ID from a running container instead; fall back to the tag only if none
# is found (and warn loudly).
ROLLBACK_TAG="pnae_backend_prod:rollback-$(date +%Y%m%d-%H%M%S)"
RUNNING_CID="$(docker compose -f docker-compose.prod.yaml ps -q pnae_backend_prod 2>/dev/null | head -n1)"
if [ -n "$RUNNING_CID" ]; then
  ROLLBACK_SRC="$(docker inspect --format '{{.Image}}' "$RUNNING_CID")"
  echo "Live prod backend container: $RUNNING_CID"
  echo "Live prod backend image ID:  $ROLLBACK_SRC"
else
  ROLLBACK_SRC="pnae_backend_prod"
  echo "WARN: no running pnae_backend_prod container found — falling back to the"
  echo "      'pnae_backend_prod' tag, which may NOT match what was last deployed."
fi
docker tag "$ROLLBACK_SRC" "$ROLLBACK_TAG"
echo "Rollback image tagged: $ROLLBACK_TAG  (source: $ROLLBACK_SRC)"
echo "Current working-tree commit (for your records):"
git rev-parse HEAD
echo "NOTE: the live prod image may have been built from an OLDER commit than"
echo "      HEAD — confirm against your own deploy records, not just this hash."
echo

# The OLD prod image is NOT self-starting: its Dockerfile CMD was commented out,
# so it only boots under the OLD compose (dockerize entrypoint + `command: npm
# run start:prod`). The new compose dropped both. Rollback therefore needs the
# old image AND a snapshot of the old compose, captured here as
# docker-compose.prod.rollback.yaml.
if [ ! -f docker-compose.prod.rollback.yaml ]; then
  echo "Rollback compose missing — regenerating from HEAD ..."
  git show HEAD:docker-compose.prod.yaml > docker-compose.prod.rollback.yaml
fi
grep -q dockerize docker-compose.prod.rollback.yaml || {
  echo "ABORT: docker-compose.prod.rollback.yaml lacks the old dockerize startup wiring."
  echo "       HEAD may already be the NEW compose. Recover the old compose from an"
  echo "       earlier commit before deploying, so rollback stays possible."
  exit 1
}
echo "Rollback compose ready: docker-compose.prod.rollback.yaml"
echo

# --- 2. Parity check, no deploy ---------------------------------------------
# Expected differences ONLY:
#   - env file (homolog.env vs production.env) and NODE_ENV value
#   - service/image name suffix (hmg -> prod)
#   - backend container_name: present on hmg (1 replica), absent on prod (scales)
#   - mounted host paths
#   - network names (pnae_hmg/demeter_gateway_hmg vs pnae_prod/demeter_gateway_prod)
#   - replica / cpu values (hmg 1x cpus '3', prod 3x cpus '4')
#   - prod-only infra services (postgres_pnae_prod, redis_prod) + their healthchecks
docker compose -f docker-compose.hmg.yaml  config > /tmp/hmg.rendered.yaml
docker compose -f docker-compose.prod.yaml config > /tmp/prod.rendered.yaml
echo "Rendered: /tmp/hmg.rendered.yaml  and  /tmp/prod.rendered.yaml"
echo "===== diff (hmg < vs > prod) ====="
diff -u /tmp/hmg.rendered.yaml /tmp/prod.rendered.yaml || true
echo "==================================="
echo
echo "If the diff shows only the expected differences above, proceed to:"
echo "  bash docs/plans/temp/02-deploy-hmg.sh"
