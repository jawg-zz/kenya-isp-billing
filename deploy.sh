#!/bin/bash
# Force fresh Docker rebuild with cache busting
export BUILD_DATE=$(date +%s)

echo "🔄 Deploying with BUILD_DATE=$BUILD_DATE"
echo "   This forces Docker to rebuild the COPY layer"

bash ~/workspace/skills/github-dokploy-deploy/scripts/restart_service.sh \
  "https://main.spidmax.win" \
  "joRUEwoOTIASFxsIOMgLvFDXseyKZNRqKDhwgOXnNOARTrGdTihxmqynjebraUOy" \
  "compose" \
  "PcB8_vWgrn5APXWEttrTS" \
  "redeploy"
