#!/bin/bash
# Seeds SOURCE with: catalog + principal + principal-role + catalog-role +
# grant + namespace + table. TARGET is left completely empty so that
# polaris-synchronizer creates entities on target itself.

set -euo pipefail

SOURCE="http://polaris-source:8181"
TARGET="http://polaris-target:8181"
CATALOG="test-catalog"
ROOT_CLIENT_ID="root"
ROOT_SECRET="s3cr3t"

wait_ready() {
  local base=$1
  echo "[init] Waiting for $base..."
  until curl -sf "$base/api/catalog/v1/oauth/tokens" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials&client_id=${ROOT_CLIENT_ID}&client_secret=${ROOT_SECRET}&scope=PRINCIPAL_ROLE:ALL" \
    >/dev/null 2>&1; do sleep 3; done
  echo "[init] $base is ready"
}

get_token() {
  local base=$1
  curl -sf -X POST "$base/api/catalog/v1/oauth/tokens" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials&client_id=${ROOT_CLIENT_ID}&client_secret=${ROOT_SECRET}&scope=PRINCIPAL_ROLE:ALL" \
    | jq -r '.access_token'
}

mgmt_post() {
  local base=$1 token=$2 path=$3 body=$4
  curl -sf -X POST "$base/api/management/v1$path" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$body"
}

mgmt_put() {
  local base=$1 token=$2 path=$3 body=$4
  curl -sf -X PUT "$base/api/management/v1$path" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$body"
}

catalog_post() {
  local base=$1 token=$2 path=$3 body=$4
  curl -sf -X POST "$base/api/catalog/v1$path" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$body"
}

wait_ready "$SOURCE"
wait_ready "$TARGET"

SRC_TOKEN=$(get_token "$SOURCE")
echo "[init] SOURCE admin token acquired"

# ── SOURCE: catalog (FILE storage, local to the polaris-source container) ────

mgmt_post "$SOURCE" "$SRC_TOKEN" "/catalogs" '{
  "catalog": {
    "name": "'"$CATALOG"'",
    "type": "INTERNAL",
    "properties": {"default-base-location": "file:///tmp/polaris/'"$CATALOG"'/"},
    "storageConfigInfo": {
      "storageType": "FILE",
      "allowedLocations": ["file:///tmp/polaris/'"$CATALOG"'"]
    }
  }
}'
echo "[init] SOURCE: catalog created"

# ── SOURCE: principal ─────────────────────────────────────────────────────────

PRINCIPAL_RESP=$(mgmt_post "$SOURCE" "$SRC_TOKEN" "/principals" '{
  "principal": {"name": "test-user", "type": "user"},
  "credentialRotationRequired": false
}')

USER_CLIENT_ID=$(echo "$PRINCIPAL_RESP" | jq -r '.credentials.clientId')
USER_SECRET=$(echo    "$PRINCIPAL_RESP" | jq -r '.credentials.clientSecret')
echo "[init] SOURCE: principal test-user created (clientId=$USER_CLIENT_ID)"

# ── SOURCE: principal role ────────────────────────────────────────────────────

mgmt_post "$SOURCE" "$SRC_TOKEN" "/principal-roles" '{"principalRole": {"name": "analyst-role"}}'
echo "[init] SOURCE: principal role analyst-role created"

# ── SOURCE: assign principal role → principal ─────────────────────────────────

mgmt_put "$SOURCE" "$SRC_TOKEN" "/principals/test-user/principal-roles" \
  '{"principalRole": {"name": "analyst-role"}}'
echo "[init] SOURCE: analyst-role assigned to test-user"

# ── SOURCE: catalog role ──────────────────────────────────────────────────────

mgmt_post "$SOURCE" "$SRC_TOKEN" "/catalogs/$CATALOG/catalog-roles" \
  '{"catalogRole": {"name": "catalog-analyst"}}'
echo "[init] SOURCE: catalog role catalog-analyst created"

# ── SOURCE: assign catalog role → principal role ──────────────────────────────

mgmt_put "$SOURCE" "$SRC_TOKEN" "/principal-roles/analyst-role/catalog-roles/$CATALOG" \
  '{"catalogRole": {"name": "catalog-analyst"}}'
echo "[init] SOURCE: catalog-analyst assigned to analyst-role"

# ── SOURCE: grant CATALOG_MANAGE_CONTENT to catalog role ─────────────────────

mgmt_put "$SOURCE" "$SRC_TOKEN" "/catalogs/$CATALOG/catalog-roles/catalog-analyst/grants" \
  '{"grant": {"type": "catalog", "privilege": "CATALOG_MANAGE_CONTENT"}}'
echo "[init] SOURCE: CATALOG_MANAGE_CONTENT granted to catalog-analyst"

# ── SOURCE: namespace + table (as test-user) ──────────────────────────────────

USER_TOKEN=$(curl -sf -X POST "$SOURCE/api/catalog/v1/oauth/tokens" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${USER_CLIENT_ID}&client_secret=${USER_SECRET}&scope=PRINCIPAL_ROLE:ALL" \
  | jq -r '.access_token')

catalog_post "$SOURCE" "$USER_TOKEN" "/$CATALOG/namespaces" \
  '{"namespace": ["test_ns"], "properties": {}}'
echo "[init] SOURCE: namespace test_ns created"

catalog_post "$SOURCE" "$USER_TOKEN" "/$CATALOG/namespaces/test_ns/tables" '{
  "name": "test_table",
  "location": "file:///tmp/polaris/'"$CATALOG"'/test_ns/test_table",
  "schema": {
    "type": "struct",
    "schema-id": 0,
    "fields": [
      {"id": 1, "name": "id",   "required": true,  "type": "long"},
      {"id": 2, "name": "data", "required": false, "type": "string"}
    ]
  }
}'
echo "[init] SOURCE: table test_table created"

# ── Persist seeded credentials for the CLI steps ──────────────────────────────

mkdir -p /seed
cat > /seed/credentials.json <<EOF
{
  "catalog": "$CATALOG",
  "rootClientId": "$ROOT_CLIENT_ID",
  "rootClientSecret": "$ROOT_SECRET",
  "principal": "test-user",
  "principalRole": "analyst-role",
  "catalogRole": "catalog-analyst",
  "clientId": "$USER_CLIENT_ID",
  "clientSecret": "$USER_SECRET"
}
EOF
echo "[init] Wrote seeded credentials to /seed/credentials.json"

echo ""
echo "[init] Done. SOURCE has: catalog + principal + roles + grants + namespace + table"
echo "[init]       TARGET is empty."
echo "[init] Run create-omnipotent-principal against source and target, then sync-polaris."
