#!/bin/bash

# Usage example:
# ./rebuild-hmg.sh prod

if [ -z "$1" ]; then
  echo "Usage: $0 <environment>"
  exit 1
fi

ENV="$1"

echo "### Stopping and removing containers for environment ------ $ENV"
docker compose -f docker-compose.$ENV.yaml down pnae_backend_$ENV

echo "### Rebuilding and starting containers for environment ------ $ENV"
docker compose -f docker-compose.$ENV.yaml up pnae_backend_$ENV --build -d

echo "### Restarting Nginx for environment ------ $ENV"
docker exec nginx_$ENV nginx -s reload

echo "@@@ Rebuild and restart process completed for environment ------ $ENV @@@"