#!/usr/bin/env bash
# scripts/dev.sh — Start dev servers (Astro + Worker)
set -euo pipefail

echo "🚀 Starting GasoIA dev environment..."

# Start Astro dev server in background
npm run dev &
ASTRO_PID=$!

echo "🔧 Astro dev → http://localhost:4321"
echo "   Press Ctrl+C to stop."

# Trap to kill background process
trap "kill $ASTRO_PID 2>/dev/null; echo ''; echo 'Stopped.'" EXIT

wait $ASTRO_PID
