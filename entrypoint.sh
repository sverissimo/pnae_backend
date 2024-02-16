#!/bin/sh
# entrypoint.sh

# Abort on any error
set -e

echo "Changing folder permissions..."
chown -R node:node $FILES_FOLDER

# echo "Applying Prisma migrations..."
# npx prisma migrate deploy

echo "Starting the application..."
exec "$@"
