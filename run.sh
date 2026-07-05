#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

IMAGE="golf-booking-scraper"
DATA_REPO="../golf-booking-data"

docker build --network=host -t "$IMAGE" -f Dockerfile .
docker run --rm --network=host -v "$(realpath "$DATA_REPO"):/app/logs" "$IMAGE" "$@"

jq 'unique_by({date, startTime, endTime, bay, url})' "$DATA_REPO/bookings.json" > "$DATA_REPO/bookings.tmp" \
  && mv "$DATA_REPO/bookings.tmp" "$DATA_REPO/bookings.json"

cd "$DATA_REPO"
git add -A
git commit -m "data update $(date +'%Y-%m-%d')" || true
GIT_SSH_COMMAND="ssh -i /home/klumpn/.ssh/id_ed25519 -o StrictHostKeyChecking=accept-new" \
  git push origin main

