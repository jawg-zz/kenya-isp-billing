#!/bin/bash
# Force fresh Docker rebuild with cache busting
#
# Required environment variables (must be set before running):
#   DOKPLOY_TOKEN - Authentication token for Dokploy API
#   DOKPLOY_URL   - Base URL of the Dokploy instance (e.g., https://main.spidmax.win)
#
# Example:
#   export DOKPLOY_TOKEN="your-token-here"
#   export DOKPLOY_URL="https://main.spidmax.win"
#   ./deploy.sh

export BUILD_DATE=$(date +%s)

# Load required tokens from environment (fail fast if not set)
DOKPLOY_TOKEN="${DOKPLOY_TOKEN:?ERROR: DOKPLOY_TOKEN environment variable is not set}"
DOKPLOY_URL="${DOKPLOY_URL:?ERROR: DOKPLOY_URL environment variable is not set}"

echo "🔄 Deploying with BUILD_DATE=$BUILD_DATE"
echo "   This forces Docker to rebuild the COPY layer"

bash ~/workspace/skills/github-dokploy-deploy/scripts/restart_service.sh \
  "$DOKPLOY_URL" \
  "$DOKPLOY_TOKEN" \
  "compose" \
  "PcB8_vWgrn5APXWEttrTS" \
  "redeploy"
