#!/usr/bin/env bash
# Nightly database backup (run on the server by cron, see scripts/server/install-backup-cron.sh).
# pg_dump → /var/backups/poruch (last 3 kept locally) → R2 backups/ (pruned after BACKUP_KEEP_DAYS).
set -euo pipefail

DIR=/opt/poruch
LOCAL=/var/backups/poruch
C="docker compose -f $DIR/docker-compose.prod.yml --env-file $DIR/.env.production"
FILE="poruch-$(date -u +%Y-%m-%d_%H%M).dump"

mkdir -p "$LOCAL"
cd "$DIR"
# Custom format (-Fc): compressed, restorable table by table with pg_restore.
$C exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$LOCAL/$FILE"
$C run --rm --no-deps -T -v "$LOCAL:/backups" backend python manage.py backups upload "/backups/$FILE"
ls -1t "$LOCAL"/poruch-*.dump | tail -n +4 | xargs -r rm --
echo "$(date -u +%FT%TZ) backup ok: $FILE"
