#!/usr/bin/env bash
# Restore the database from a backup. DESTRUCTIVE: replaces the current data.
#   scripts/server/restore.sh                          # list available backups
#   scripts/server/restore.sh backups/poruch-....dump  # restore that one
set -euo pipefail

DIR=/opt/poruch
LOCAL=/var/backups/poruch
C="docker compose -f $DIR/docker-compose.prod.yml --env-file $DIR/.env.production"
cd "$DIR"

if [ $# -eq 0 ]; then
  $C run --rm --no-deps -T backend python manage.py backups list
  exit 0
fi

KEY="$1"
mkdir -p "$LOCAL"
read -r -p "Replace ALL current data with $KEY? Type 'restore' to continue: " answer
[ "$answer" = "restore" ] || { echo "Cancelled."; exit 1; }

# Safety copy of the current state first.
"$DIR/scripts/server/backup.sh"
$C run --rm --no-deps -T -v "$LOCAL:/backups" backend python manage.py backups download "$KEY" /backups/restore.dump
$C stop backend celery celery-beat
$C exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < "$LOCAL/restore.dump"
rm -f "$LOCAL/restore.dump"
$C up -d
echo "Restored from $KEY"
