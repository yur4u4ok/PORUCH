#!/usr/bin/env bash
# Deploy the current working tree to the production server.
#   scripts/deploy.sh
# Copies code (not .env files), rebuilds images, runs migrations, restarts the stack.
# The server's /opt/poruch/.env.production is the source of truth for production settings.
set -euo pipefail

SERVER="${PORUCH_SERVER:-root@188.245.10.156}"
KEY="${PORUCH_SSH_KEY:-$HOME/.ssh/poruch_server}"
DIR=/opt/poruch
SSH="ssh -i $KEY -o BatchMode=yes"

cd "$(dirname "$0")/.."
echo "→ Copying code to $SERVER:$DIR"
rsync -az --delete -e "$SSH" \
  --exclude .git --exclude node_modules --exclude .venv --exclude '.env' --exclude '.env.*' \
  --exclude dist --exclude test-results --exclude playwright-report --exclude __pycache__ \
  --exclude '*.pyc' --exclude .pytest_cache --exclude .mypy_cache --exclude .ruff_cache \
  --exclude 'Poruch — опис*' \
  ./ "$SERVER:$DIR/"

echo "→ Building, migrating and restarting"
$SSH "$SERVER" "cd $DIR && C='docker compose -f docker-compose.prod.yml --env-file .env.production' \
  && \$C build \
  && \$C run --rm migrate \
  && \$C up -d --remove-orphans \
  && docker image prune -f >/dev/null \
  && \$C ps --format 'table {{.Service}}\t{{.Status}}'"

echo -n "→ Waiting for the backend"
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' https://poruch-app.duckdns.org/health/ready/ || true)
  [ "$code" = "200" ] && { echo " — OK, site is up"; exit 0; }
  echo -n "."; sleep 3
done
echo " — still not healthy (last HTTP $code). Check: ssh to the server and run 'docker compose -f /opt/poruch/docker-compose.prod.yml logs backend'"
exit 1
