#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$ROOT_DIR/cloudflared/config.yml"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed. Install it first and login with Cloudflare."
  exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Missing config file: $CONFIG_FILE"
  echo "Create a Cloudflare tunnel and place the config at cloudflared/config.yml"
  exit 1
fi

cd "$ROOT_DIR"
cloudflared tunnel run --config "$CONFIG_FILE"
