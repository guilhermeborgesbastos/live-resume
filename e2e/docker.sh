#!/bin/bash
# Builds the Docker image, runs it locally and runs the Playwright suite against the container.
#   npm run test:e2e:docker                       # whole suite
#   npm run test:e2e:docker -- -g "static server"  # extra arguments go to `playwright test`
# E2E_DOCKER_PORT (default 8080) and E2E_DOCKER_IMAGE (default live-resume:e2e) override the defaults.
set -euo pipefail

image="${E2E_DOCKER_IMAGE:-live-resume:e2e}"
port="${E2E_DOCKER_PORT:-8080}"
container="live-resume-e2e-$$"

docker build -t "$image" .
docker run -d --rm --name "$container" -p "127.0.0.1:$port:80" "$image" > /dev/null
trap 'docker stop "$container" > /dev/null' EXIT

for _ in $(seq 1 50); do
  curl -fs -o /dev/null "http://127.0.0.1:$port/en/" && break
  sleep 0.2
done

E2E_BASE_URL="http://127.0.0.1:$port" npx playwright test "$@"
