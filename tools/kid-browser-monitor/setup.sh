#!/bin/bash
# Kid Browser Monitor — Setup Script
# Generates API key and configures all components.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_KEY=$(openssl rand -hex 32)

echo "============================================"
echo " Kid Browser Monitor — Setup"
echo "============================================"
echo ""
echo "Generated API Key: $API_KEY"
echo ""

# Update extensions with API key
for dir in "$SCRIPT_DIR"/extension-*/; do
    kid=$(basename "$dir" | sed 's/extension-//')
    sed -i "s|PLACEHOLDER|$API_KEY|" "$dir/service_worker.js"
    echo "Updated extension for: $kid"
done

# Update systemd service with API key
sed -i "s|KBM_API_KEY=PLACEHOLDER|KBM_API_KEY=$API_KEY|" "$SCRIPT_DIR/server/kid-browser-monitor.service"
echo "Updated systemd service with API key."

echo ""
echo "============================================"
echo " Next Steps"
echo "============================================"
echo ""
echo "1. Set up Cloudflare Tunnel on Thelio:"
echo "   - Create free account at https://dash.cloudflare.com"
echo "   - Install cloudflared and create a tunnel"
echo "   - Route tunnel to http://localhost:9847"
echo ""
echo "2. Update extensions with tunnel URL:"
echo "   Replace PLACEHOLDER_URL in each extension's service_worker.js"
echo "   with your Cloudflare Tunnel URL (e.g., https://kbm-xyz.trycloudflare.com)"
echo ""
echo "   Also update host_permissions in manifest.json to match."
echo ""
echo "3. Deploy collection server:"
echo "   scp server/* to Thelio, install systemd service"
echo ""
echo "4. Install extensions in kids' Chrome profiles"
echo ""
echo "API Key (save this): $API_KEY"
echo ""
