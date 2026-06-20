#!/usr/bin/env bash
set -uo pipefail

ICEGUARD_API="${ICEGUARD_API:-http://localhost:8080}"

echo "============================================"
echo "  IceGuard - Multi-Catalog Seed Script"
echo "============================================"
echo ""

# ── 1. Seed REST Catalog (8181) ──
echo "── Catalog 1: REST Catalog ──"
curl -s -X POST http://localhost:8181/v1/namespaces -H "Content-Type: application/json" \
  -d '{"namespace": ["analytics"], "properties": {"owner": "data-team"}}' > /dev/null 2>&1
curl -s -X POST http://localhost:8181/v1/namespaces -H "Content-Type: application/json" \
  -d '{"namespace": ["raw"], "properties": {"owner": "ingestion-team"}}' > /dev/null 2>&1

curl -s -X POST http://localhost:8181/v1/namespaces/analytics/tables -H "Content-Type: application/json" \
  -d '{"name":"events","stage-create":false,"schema":{"type":"struct","schema-id":0,"fields":[{"id":1,"name":"event_id","type":"string","required":true},{"id":2,"name":"event_type","type":"string","required":true},{"id":3,"name":"user_id","type":"long","required":false},{"id":4,"name":"created_at","type":"timestamptz","required":true},{"id":5,"name":"payload","type":"string","required":false}]},"properties":{"write.format.default":"parquet","format-version":"2"}}' > /dev/null 2>&1
curl -s -X POST http://localhost:8181/v1/namespaces/analytics/tables -H "Content-Type: application/json" \
  -d '{"name":"user_sessions","stage-create":false,"schema":{"type":"struct","schema-id":0,"fields":[{"id":1,"name":"session_id","type":"string","required":true},{"id":2,"name":"user_id","type":"long","required":true},{"id":3,"name":"start_time","type":"timestamptz","required":true},{"id":4,"name":"end_time","type":"timestamptz","required":false}]},"properties":{"write.format.default":"parquet","format-version":"2"}}' > /dev/null 2>&1
curl -s -X POST http://localhost:8181/v1/namespaces/raw/tables -H "Content-Type: application/json" \
  -d '{"name":"clickstream","stage-create":false,"schema":{"type":"struct","schema-id":0,"fields":[{"id":1,"name":"click_id","type":"string","required":true},{"id":2,"name":"url","type":"string","required":true},{"id":3,"name":"ts","type":"timestamptz","required":true}]},"properties":{"write.format.default":"parquet","format-version":"2"}}' > /dev/null 2>&1
echo "  analytics: events, user_sessions"
echo "  raw: clickstream"


# ── 3. Polaris (8182) ──
echo ""
echo "── Catalog 3: Polaris ──"
POLARIS_TOKEN=$(curl -s -X POST http://localhost:8182/api/catalog/v1/oauth/tokens \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=polaris-root&client_secret=polaris-secret&scope=PRINCIPAL_ROLE:ALL" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

# Polaris uses real AWS S3 (MinIO does not work for Polaris writes — see CLAUDE.md).
# Configure the bucket/region; creds come from the Polaris container env (POLARIS_AWS_*).
POLARIS_S3_LOCATION="${POLARIS_S3_LOCATION:-s3://polaris-iceguard/warehouse}"
POLARIS_S3_REGION="${POLARIS_S3_REGION:-us-east-1}"

if [ -z "$POLARIS_TOKEN" ]; then
  echo "  WARNING: Could not get Polaris token — skipping"
else
  curl -s -X POST http://localhost:8182/api/management/v1/catalogs \
    -H "Authorization: Bearer $POLARIS_TOKEN" -H "Content-Type: application/json" \
    -d "{\"catalog\":{\"name\":\"polaris-warehouse\",\"type\":\"INTERNAL\",\"properties\":{\"default-base-location\":\"${POLARIS_S3_LOCATION}\"},\"storageConfigInfo\":{\"storageType\":\"S3\",\"allowedLocations\":[\"${POLARIS_S3_LOCATION}\"],\"region\":\"${POLARIS_S3_REGION}\"}}}" > /dev/null 2>&1
  # Authorize the admin principal role to manage the catalog content
  curl -s -X PUT "http://localhost:8182/api/management/v1/principal-roles/service_admin/catalog-roles/polaris-warehouse" \
    -H "Authorization: Bearer $POLARIS_TOKEN" -H "Content-Type: application/json" \
    -d '{"catalogRole":{"name":"catalog_admin"}}' > /dev/null 2>&1
  curl -s -X POST "http://localhost:8182/api/catalog/v1/polaris-warehouse/namespaces" \
    -H "Authorization: Bearer $POLARIS_TOKEN" -H "Content-Type: application/json" \
    -d '{"namespace": ["production"], "properties": {"owner": "platform-team"}}' > /dev/null 2>&1
  echo "  production (namespace)"
fi

# ── 4. Register in IceGuard backend (using Docker-internal hostnames) ──
echo ""
echo "── Registering in IceGuard backend ──"

# How the IceGuard BACKEND reaches the catalogs depends on where it runs:
#   - backend on the host (mvn quarkus:dev) → localhost + published ports   (default)
#   - backend in Docker (compose `backend`) → docker service names; set SEED_BACKEND_IN_DOCKER=1
if [ "${SEED_BACKEND_IN_DOCKER:-0}" = "1" ]; then
  REST_URI="http://rest-catalog:8181";  POLARIS_BASE="http://polaris:8181";   S3_ENDPOINT="http://minio:9000"
  NESSIE_REAL_URI="http://nessie:19120/iceberg"
else
  REST_URI="http://localhost:8181";     POLARIS_BASE="http://localhost:8182"; S3_ENDPOINT="http://localhost:9000"
  NESSIE_REAL_URI="http://localhost:19120/iceberg"
fi
# MinIO S3 creds for the client FileIO (so table loads / file analysis can read S3).
MINIO_CREDS="\"s3.endpoint\":\"${S3_ENDPOINT}\",\"s3.access-key-id\":\"minioadmin\",\"s3.secret-access-key\":\"minioadmin\",\"s3.path-style-access\":\"true\",\"client.region\":\"us-east-1\""

curl -s -X POST "${ICEGUARD_API}/api/catalogs" -H "Content-Type: application/json" \
  -d "{\"name\":\"rest-catalog\",\"uri\":\"${REST_URI}\",\"warehouse\":\"s3://warehouse/rest/\",\"authType\":\"NONE\",\"credentials\":{${MINIO_CREDS}}}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  rest-catalog (id={d.get(\"id\",\"?\")})')" 2>/dev/null

# A REAL Nessie Catalog Server (the `nessie` compose service): vendor=NESSIE so IceGuard
# reconstructs the full snapshot history from the Nessie commit log. warehouse = the Nessie
# warehouse NAME ("warehouse"); the server writes to MinIO, the client FileIO reads it back.
curl -s -X POST "${ICEGUARD_API}/api/catalogs" -H "Content-Type: application/json" \
  -d "{\"name\":\"nessie-real\",\"uri\":\"${NESSIE_REAL_URI}\",\"warehouse\":\"warehouse\",\"vendor\":\"NESSIE\",\"authType\":\"NONE\",\"credentials\":{${MINIO_CREDS}}}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  nessie-real (id={d.get(\"id\",\"?\")})')" 2>/dev/null

if [ -n "${POLARIS_TOKEN:-}" ]; then
  # URI = REST base (/api/catalog); warehouse = the Polaris catalog NAME.
  # OAuth2 client_credentials ("credential") so the client refreshes its own token.
  # AWS S3 creds for the client FileIO come from env (same as the Polaris container).
  curl -s -X POST "${ICEGUARD_API}/api/catalogs" -H "Content-Type: application/json" \
    -d "{\"name\":\"polaris\",\"uri\":\"${POLARIS_BASE}/api/catalog\",\"warehouse\":\"polaris-warehouse\",\"authType\":\"OAUTH2\",\"credentials\":{\"credential\":\"polaris-root:polaris-secret\",\"oauth2-server-uri\":\"${POLARIS_BASE}/api/catalog/v1/oauth/tokens\",\"scope\":\"PRINCIPAL_ROLE:ALL\",\"s3.region\":\"${POLARIS_S3_REGION}\",\"s3.access-key-id\":\"${POLARIS_AWS_ACCESS_KEY_ID:-}\",\"s3.secret-access-key\":\"${POLARIS_AWS_SECRET_ACCESS_KEY:-}\",\"s3.session-token\":\"${POLARIS_AWS_SESSION_TOKEN:-}\"}}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  polaris (id={d.get(\"id\",\"?\")})')" 2>/dev/null
fi

echo ""
echo "============================================"
echo "  Done! Open http://localhost:5173"
echo "============================================"
