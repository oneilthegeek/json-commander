#!/usr/bin/env bash
# Nightly encrypted database backup (orders, catalogue AND Gold Card media live in Postgres).
# Cron: 15 2 * * * /opt/llh/deploy/backup.sh
set -euo pipefail
cd "$(dirname "$0")"
STAMP=$(date +%Y%m%d-%H%M)
mkdir -p backups
docker compose exec -T db pg_dump -U llh_app -d llh -Fc > "backups/llh-$STAMP.dump"
# Encrypt before it leaves the server (BACKUP_PASSPHRASE in the root user's environment)
gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" -c "backups/llh-$STAMP.dump" && rm "backups/llh-$STAMP.dump"
# Copy off-site (configure rclone for Cloudflare R2 / Google Drive / S3 first)
rclone copy "backups/llh-$STAMP.dump.gpg" offsite:llh-backups/ || echo "WARNING: off-site copy failed" >&2
find backups -name '*.gpg' -mtime +30 -delete
