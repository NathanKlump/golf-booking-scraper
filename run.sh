#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

IMAGE="golf-booking-scraper"

podman build --network=host -t "$IMAGE" -f Dockerfile .
podman run --rm --network=host -v "$(pwd)/logs:/app/logs:Z" "$IMAGE" "$@"


