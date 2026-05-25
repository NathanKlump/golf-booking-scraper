#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

IMAGE="golf-booking-scraper"

docker build --network=host -t "$IMAGE" -f Dockerfile .
docker run --rm --network=host -v "$(pwd)/logs:/app/logs" "$IMAGE" "$@"

jq 'unique_by({date, startTime, endTime, bay, url})' logs/bookings.json > logs/bookings.tmp \
  && mv logs/bookings.tmp logs/bookings.json

git add logs/
git commit -m "bookings update $(date +'%Y-%m-%d')" || true
GIT_SSH_COMMAND="ssh -i /home/klumpn/.ssh/id_ed25519 -o StrictHostKeyChecking=accept-new" \
  git push origin main || echo "Push failed"


