#!/bin/sh
set -e

echo "Starting development backend..."

# Attendre que PostgreSQL soit prêt
echo "Waiting for PostgreSQL to be ready..."
while ! nc -z postgres 5432; do sleep 1; done
echo "PostgreSQL is ready!"

# Pousser le schéma Prisma
echo "Pushing schema with prisma db push..."
npx prisma db push --skip-generate

# Lancer le serveur en mode dev
echo "Starting dev server..."
exec npm run dev
