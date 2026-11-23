#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
HERMES_CONTAINER="${HERMES_CONTAINER:-hermes-agent}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-url)
      API_URL="$2"
      shift 2
      ;;
    --hermes-container)
      HERMES_CONTAINER="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [--api-url http://localhost:3000] [--hermes-container hermes-agent]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

echo "=== Hermes Finance Stack Smoke Test ==="
echo "API URL          : $API_URL"
echo "Hermes Container : $HERMES_CONTAINER"
echo ""

echo "1) Checking REST /api/health..."
HEALTH_JSON="$(curl -sf "${API_URL}/api/health")"
echo "   Response: $HEALTH_JSON"

echo ""
echo "2) Checking MCP JSON-RPC tools/list & health_check..."
MCP_INIT_RES="$(curl -sf -X POST "${API_URL}/api/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0.0"}}}')"
echo "   Initialize OK"

MCP_TOOLS_RES="$(curl -sf -X POST "${API_URL}/api/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}')"

TOOLS_COUNT="$(python3 -c '
import json, sys
data = json.loads(sys.stdin.read())
tools = data.get("result", {}).get("tools", [])
print(len(tools))
' <<< "$MCP_TOOLS_RES")"
echo "   MCP tools/list count: $TOOLS_COUNT"
if [[ "$TOOLS_COUNT" -lt 35 ]]; then
  echo "❌ Expected at least 35 MCP tools, got $TOOLS_COUNT"
  exit 1
fi

MCP_HEALTH_RES="$(curl -sf -X POST "${API_URL}/api/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"health_check","arguments":{}}}')"
echo "   MCP health_check call OK: $(echo "$MCP_HEALTH_RES" | tr -d '\n' | head -c 240)"
echo ""

echo ""
echo "3) Checking Hermes Agent -> MCP connection inside container ($HERMES_CONTAINER)..."
if docker ps --format '{{.Names}}' | grep -qx "$HERMES_CONTAINER"; then
  docker exec "$HERMES_CONTAINER" hermes mcp test expenses
else
  echo "⚠️  Container '$HERMES_CONTAINER' is not running locally; skipping 'hermes mcp test'."
fi

echo ""
echo "✅ Smoke test passed!"
