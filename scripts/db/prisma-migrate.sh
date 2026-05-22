#!/bin/sh

npx prisma db pull
mkdir -p prisma/migrations/0_init

echo "Creating the application..."

npx prisma migrate diff \
--from-empty \
--to-schema-datamodel prisma/schema.prisma \
--script > prisma/migrations/0_init/migration.sql

echo "Migration complete."
