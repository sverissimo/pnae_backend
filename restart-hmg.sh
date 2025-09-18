docker compose -f docker-compose.hmg.yaml down pnae_backend_hmg
docker compose -f docker-compose.hmg.yaml up pnae_backend_hmg -d
docker exec nginx_hmg nginx -s reload