#!/usr/bin/env bash
# scripts/bootstrap.sh — One-time setup for Cloudflare D1 + Worker
set -euo pipefail

ACCOUNT_ID="${CF_ACCOUNT_ID:?Set CF_ACCOUNT_ID}"
DB_NAME="gasoia-db"

echo "🗄️  Creating D1 database..."
DB_OUTPUT=$(npx wrangler d1 create "$DB_NAME" 2>&1)
DB_ID=$(echo "$DB_OUTPUT" | grep -oP 'database_id = "\K[^"]+' || true)

if [ -z "$DB_ID" ]; then
  echo "⚠️  Database may already exist. Proceeding..."
else
  echo "✅ D1 database created: $DB_ID"
  sed -i "s/YOUR_D1_DATABASE_ID/$DB_ID/" wrangler.toml
fi

echo "📐 Applying migrations..."
npx wrangler d1 execute "$DB_NAME" --file=./migrations/0001_initial.sql

echo "⚙️  Setting production secrets..."
echo "   Set ADSENSE_PUBLISHER_ID if you have one:"
echo "   npx wrangler secret put ADSENSE_PUBLISHER_ID"

echo "🚀 Deploying worker..."
npx wrangler deploy worker/index.ts

echo ""
echo "✅ Bootstrap complete!"
echo "   Next: connect Cloudflare Pages to your GitHub repo and set these build settings:"
echo "   Build Command: npm run build"
echo "   Build Output:  dist/"
echo "   ENV: SITE_URL=https://gasoia.com"
