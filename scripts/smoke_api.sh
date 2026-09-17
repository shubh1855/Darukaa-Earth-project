#!/usr/bin/env sh
set -eu

API_BASE="http://localhost:8000/api"
EMAIL="smoke.$(date +%s)@example.com"
PASSWORD="strongpass123"

echo "[1/6] Register user"
REGISTER_RESPONSE=$(curl -sS -X POST "${API_BASE}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(python -c "import json,sys;print(json.loads(sys.argv[1])['access_token'])" "$REGISTER_RESPONSE")
AUTH_HEADER="Authorization: Bearer ${TOKEN}"

echo "[2/6] Create project"
PROJECT_RESPONSE=$(curl -sS -X POST "${API_BASE}/projects" \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Project","description":"automated smoke test"}')

PROJECT_ID=$(python -c "import json,sys;print(json.loads(sys.argv[1])['id'])" "$PROJECT_RESPONSE")

echo "[3/6] Create site"
SITE_RESPONSE=$(curl -sS -X POST "${API_BASE}/projects/${PROJECT_ID}/sites" \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d '{"geometry":{"type":"Polygon","coordinates":[[[77.58,12.97],[77.60,12.97],[77.60,12.99],[77.58,12.99],[77.58,12.97]]]}}')

SITE_ID=$(python -c "import json,sys;print(json.loads(sys.argv[1])['id'])" "$SITE_RESPONSE")

echo "[4/6] List project sites"
SITES_LIST=$(curl -sS "${API_BASE}/projects/${PROJECT_ID}/sites" -H "${AUTH_HEADER}")
COUNT=$(python -c "import json,sys;print(len(json.loads(sys.argv[1])))" "$SITES_LIST")

echo "[5/6] Get site detail"
SITE_DETAIL=$(curl -sS "${API_BASE}/sites/${SITE_ID}" -H "${AUTH_HEADER}")
AREA=$(python -c "import json,sys;print(json.loads(sys.argv[1])['area_hectares'])" "$SITE_DETAIL")

echo "[6/6] Validate invalid polygon returns 422"
STATUS_CODE=$(curl -sS -o /tmp/smoke_invalid_body.json -w "%{http_code}" -X POST "${API_BASE}/projects/${PROJECT_ID}/sites" \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d '{"geometry":{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1]]]}}')

if [ "$STATUS_CODE" != "422" ]; then
  echo "Expected 422, got ${STATUS_CODE}"
  cat /tmp/smoke_invalid_body.json
  exit 1
fi

echo "\nSmoke test passed"
echo "Email: ${EMAIL}"
echo "Project ID: ${PROJECT_ID}"
echo "Site ID: ${SITE_ID}"
echo "Site count: ${COUNT}"
echo "Area hectares: ${AREA}"
