#!/bin/bash
set -e

# Load prod env vars
set -a
. production.env
set +a
PROD_USER=$POSTGRES_USER
PROD_PASS=$POSTGRES_PASSWORD
PROD_DB=$POSTGRES_DB
unset POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB

# Load dev env vars
set -a
. development.env
set +a
DEV_USER=$POSTGRES_USER
DEV_PASS=$POSTGRES_PASSWORD
DEV_DB=$POSTGRES_DB
unset POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB

PROD_CONTAINER=postgres_pnae_prod
DEV_CONTAINER=postgres_pnae_dev

DUMP_FILE=prod_db.dump
NEW_DEV_DB="${DEV_DB}_new"

echo "1. Dumping production DB ($PROD_DB) from container ($PROD_CONTAINER)..."
docker exec -e PGPASSWORD="$PROD_PASS" \
  $PROD_CONTAINER \
  pg_dump -U $PROD_USER -Fc -d $PROD_DB > $DUMP_FILE

echo "2. Creating new dev DB ($NEW_DEV_DB) in container ($DEV_CONTAINER)..."
docker exec -e PGPASSWORD="$DEV_PASS" \
  $DEV_CONTAINER \
  createdb -U $DEV_USER $NEW_DEV_DB

echo "3. Restoring dump into new dev DB ($NEW_DEV_DB)..."
cat $DUMP_FILE | docker exec -i -e PGPASSWORD="$DEV_PASS" \
  $DEV_CONTAINER \
  pg_restore -U $DEV_USER -d $NEW_DEV_DB --no-owner --clean

 echo "4. Swapping DBs inside dev container ($DEV_CONTAINER)... Nah"
docker exec -i -e PGPASSWORD="$DEV_PASS" $DEV_CONTAINER psql -U $DEV_USER -d postgres <<EOF
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_database WHERE datname = '${DEV_DB}_old') THEN
    PERFORM pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DEV_DB}_old';
    EXECUTE 'ALTER DATABASE "${DEV_DB}_old" RENAME TO "${DEV_DB}_veryold"';
  END IF;
END\$\$;
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DEV_DB}';
ALTER DATABASE "${DEV_DB}" RENAME TO "${DEV_DB}_old";
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${NEW_DEV_DB}';
ALTER DATABASE "${NEW_DEV_DB}" RENAME TO "${DEV_DB}";
EOF

echo "✅ All done! Old dev DB is now '${DEV_DB}_old'. New DB is '${DEV_DB}'."
