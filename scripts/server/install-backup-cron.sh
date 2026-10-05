#!/usr/bin/env bash
# Installs the nightly backup (03:30 server time) with a log in /var/log/poruch-backup.log.
set -euo pipefail
chmod +x /opt/poruch/scripts/server/*.sh
echo "30 3 * * * root /opt/poruch/scripts/server/backup.sh >> /var/log/poruch-backup.log 2>&1" > /etc/cron.d/poruch-backup
chmod 644 /etc/cron.d/poruch-backup
echo "Nightly backup installed: $(cat /etc/cron.d/poruch-backup)"
