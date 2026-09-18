#!/usr/bin/env sh
set -eu

API_BASE="${API_BASE:-http://localhost:8000/api}"
EMAIL="smoke.$(date +%s)@example.com"
PASSWORD="strongpass123"

json_value() {
  python -c "import json,sys; print(json.loads(sys.argv[1])${2})" "$1"
}

fail_if_not_200() {
  if [ "$1" != "200" ]; then
    echo "Expected HTTP 200, got $1"
    echo "$2"
    exit 1
  fi
}

echo "[1/10] Register user"
REGISTER_RESPONSE=$(curl -sS -X POST "${API_BASE}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")
TOKEN=$(json_value "$REGISTER_RESPONSE" "['access_token']")
AUTH_HEADER="Authorization: Bearer ${TOKEN}"

echo "[2/10] Create project"
PROJECT_RESPONSE=$(curl -sS -X POST "${API_BASE}/projects" \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Project","description":"automated smoke test"}')
PROJECT_ID=$(json_value "$PROJECT_RESPONSE" "['id']")

echo "[3/10] Create named site"
SITE_RESPONSE=$(curl -sS -X POST "${API_BASE}/projects/${PROJECT_ID}/sites" \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Site","geometry":{"type":"Polygon","coordinates":[[[77.58,12.97],[77.60,12.97],[77.60,12.99],[77.58,12.99],[77.58,12.97]]]}}')
SITE_ID=$(json_value "$SITE_RESPONSE" "['id']")

 echo "[4/10] List project sites"
SITES_LIST=$(curl -sS "${API_BASE}/projects/${PROJECT_ID}/sites" -H "${AUTH_HEADER}")
COUNT=$(python -c "import json,sys; print(len(json.loads(sys.argv[1])))" "$SITES_LIST")

if [ "$COUNT" != "1" ]; then
  echo "Expected 1 site, got ${COUNT}"
  exit 1
fi

echo "[5/10] Get site detail"
SITE_DETAIL=$(curl -sS "${API_BASE}/sites/${SITE_ID}" -H "${AUTH_HEADER}")
AREA=$(json_value "$SITE_DETAIL" "['area_hectares']")

 echo "[6/10] Seed 18 months demo analytics"
SEED_RESPONSE=$(curl -sS -X POST "${API_BASE}/projects/${PROJECT_ID}/analytics/seed" \
  -H "${AUTH_HEADER}")
CREATED_COUNT=$(json_value "$SEED_RESPONSE" "['created_count']")

 echo "[7/10] Verify site analytics"
SITE_ANALYTICS=$(curl -sS "${API_BASE}/sites/${SITE_ID}/analytics" -H "${AUTH_HEADER}")
METRIC_COUNT=$(python -c "import json,sys; print(len(json.loads(sys.argv[1])['metrics']))" "$SITE_ANALYTICS")
LATEST_CARBON=$(json_value "$SITE_ANALYTICS" "['latest_carbon_tonnes_co2e']")
LATEST_BIODIVERSITY=$(json_value "$SITE_ANALYTICS" "['latest_biodiversity_score']")

if [ "$METRIC_COUNT" != "18" ]; then
  echo "Expected 18 metrics, got ${METRIC_COUNT}"
  exit 1
fi

 echo "[8/10] Verify project analytics"
PROJECT_ANALYTICS=$(curl -sS "${API_BASE}/projects/${PROJECT_ID}/analytics" -H "${AUTH_HEADER}")
PROJECT_SITE_COUNT=$(json_value "$PROJECT_ANALYTICS" "['site_count']")
PROJECT_METRIC_SITES=$(json_value "$PROJECT_ANALYTICS" "['sites_with_metrics']")

if [ "$PROJECT_SITE_COUNT" != "1" ] || [ "$PROJECT_METRIC_SITES" != "1" ]; then
  echo "Project analytics summary invalid"
  echo "$PROJECT_ANALYTICS"
  exit 1
fi

 echo "[9/10] Validate invalid polygon returns 422"
STATUS_CODE=$(curl -sS -o /tmp/smoke_invalid_body.json -w "%{http_code}" -X POST "${API_BASE}/projects/${PROJECT_ID}/sites" \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Invalid Smoke Site","geometry":{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1]]]}}')

if [ "$STATUS_CODE" != "422" ]; then
  echo "Expected 422, got ${STATUS_CODE}"
  cat /tmp/smoke_invalid_body.json
  exit 1
fi

 echo "[10/10] Re-seed is idempotent"
SECOND_SEED=$(curl -sS -X POST "${API_BASE}/projects/${PROJECT_ID}/analytics/seed" \
  -H "${AUTH_HEADER}")
SECOND_CREATED=$(json_value "$SECOND_SEED" "['created_count']")

if [ "$SECOND_CREATED" != "0" ]; then
  echo "Expected second seed to create 0 rows, got ${SECOND_CREATED}"
  exit 1
fi

echo ""
echo "Smoke test passed"
echo "Email: ${EMAIL}"
echo "Project ID: ${PROJECT_ID}"
echo "Site ID: ${SITE_ID}"
echo "Site count: ${COUNT}"
echo "Area hectares: ${AREA}"
echo "Metrics: ${METRIC_COUNT}"
echo "Created metrics: ${CREATED_COUNT}"
echo "Latest carbon: ${LATEST_CARBON}"
echo "Latest biodiversity: ${LATEST_BIODIVERSITY}"
