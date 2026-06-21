#!/bin/bash
set -e

# Usage example:
# bash rebuild_docker.sh prod

if [ -z "$1" ]; then
  echo "Usage: $0 <environment>"
  exit 1
fi

ENV="$1"

if [ "$ENV" = "prod" ]; then
  echo
  echo "### [prod] Tagging current image as rollback point: pnae_backend_prod:rollback"
  docker tag pnae_backend_prod pnae_backend_prod:rollback || true
fi

echo
echo "### Stopping and removing containers for environment ------ $ENV"
docker compose -f docker-compose.$ENV.yaml down
# docker compose -f docker-compose.$ENV.yaml down pnae_backend_$ENV

echo
echo "### Rebuilding and starting containers for environment ------ $ENV"
COMPOSE_BAKE=true docker compose -f docker-compose.$ENV.yaml up --build -d
# COMPOSE_BAKE=true docker compose -f docker-compose.$ENV.yaml up pnae_backend_$ENV --build -d

echo
echo "### Restarting Nginx for environment ------ $ENV"
docker exec nginx_$ENV nginx -s reload

echo
echo "@@@ Rebuild and restart process completed for environment ------ $ENV @@@"

if [ "$ENV" = "prod" ]; then
  echo
  echo "### To roll back prod to the previous image, run:"
  echo "  docker tag pnae_backend_prod:rollback pnae_backend_prod"
  echo "  docker compose -f docker-compose.prod.yaml up -d --no-deps --force-recreate pnae_backend_prod"
fi