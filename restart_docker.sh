#!/bin/bash

# Usage example:
# bash restart-docker.sh prod

if [ -z "$1" ]; then
  echo "Usage: $0 <environment>"
  exit 1
fi

ENV="$1"

echo
echo "### Restarting containers for environment ------ $ENV"
docker compose -f docker-compose.$ENV.yaml down pnae_backend_$ENV
docker compose -f docker-compose.$ENV.yaml up pnae_backend_$ENV -d
echo
echo "### Restarting Nginx for environment ------ $ENV"
docker exec nginx_$ENV nginx -s reload
echo
echo "@@@ Restart process completed for environment ------ $ENV @@@"