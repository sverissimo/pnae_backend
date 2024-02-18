docker compose -f docker-compose.hmg.yaml down pnae_backend_hmg
docker compose -f docker-compose.hmg.yaml up pnae_backend_hmg --build -d
docker exec pnae_app-nginx-1 nginx -s reload