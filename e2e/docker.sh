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

# On Linux the container's host-side veth gets its IPv6 link-local address a second or two
# after the container already answers. Chromium treats that as a network change and aborts
# in-flight requests (net::ERR_NETWORK_CHANGED), so wait for it before starting the browser.
# Skipped where the host can't see the veth (no iproute2, Docker Desktop VMs, IPv6 off).
if command -v ip > /dev/null; then
  iflink="$(docker exec "$container" cat /sys/class/net/eth0/iflink 2> /dev/null || true)"
  veth="$(ip -o link show 2> /dev/null | awk -F': ' -v i="$iflink" '$1 == i { sub(/@.*/, "", $2); print $2 }')"
  if [ -n "$veth" ]; then
    for _ in $(seq 1 50); do
      ip -6 -o addr show dev "$veth" scope link 2> /dev/null | grep -q . && break
      sleep 0.1
    done
  fi
fi

E2E_BASE_URL="http://127.0.0.1:$port" npx playwright test "$@"
