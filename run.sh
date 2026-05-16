#!/usr/bin/env bash
set -euo pipefail

IMAGE="golf-booking-scraper"

sudo podman build --network=host -t "$IMAGE" -f Dockerfile .

mkdir -p logs

sudo podman run --rm \
  -v "$(pwd)/logs:/app/logs:Z" \
  "$IMAGE" "$@"
