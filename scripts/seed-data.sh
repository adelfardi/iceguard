#!/usr/bin/env bash
set -uo pipefail

ICEGUARD_API="${ICEGUARD_API:-http://localhost:8080}"

# Wait for backend to be ready
echo "Waiting for backend..."
until curl -s "${ICEGUARD_API}/q/health/ready" 2>/dev/null | grep -q "UP"; do sleep 2; done
echo "Backend ready."

echo "=== Seeding test data into Iceberg tables ==="

# Get first catalog ID
CATALOG_ID=$(curl -s "${ICEGUARD_API}/api/catalogs" | python3 -c "
import sys,json
cats = json.load(sys.stdin)
rest = [c for c in cats if 'rest' in c['name'].lower()]
print(rest[0]['id'] if rest else cats[0]['id'] if cats else '')" 2>/dev/null)

if [ -z "$CATALOG_ID" ]; then
  echo "ERROR: No catalogs registered. Run seed-catalog.sh first."
  exit 1
fi
echo "Using catalog ID: $CATALOG_ID"

# Insert into analytics.events
echo ""
echo "── analytics.events ──"
curl -s -X POST "${ICEGUARD_API}/api/catalogs/${CATALOG_ID}/namespaces/analytics/tables/events/data" \
  -H "Content-Type: application/json" \
  -d '[
    {"event_id": "evt-001", "event_type": "click",    "user_id": 42,  "created_at": "2025-06-01T10:30:00Z", "payload": "{\"page\": \"home\"}"},
    {"event_id": "evt-002", "event_type": "purchase",  "user_id": 42,  "created_at": "2025-06-01T10:35:00Z", "payload": "{\"item\": \"widget\", \"price\": 29.99}"},
    {"event_id": "evt-003", "event_type": "click",    "user_id": 99,  "created_at": "2025-06-02T14:00:00Z", "payload": "{\"page\": \"pricing\"}"},
    {"event_id": "evt-004", "event_type": "signup",   "user_id": 100, "created_at": "2025-06-03T09:15:00Z"},
    {"event_id": "evt-005", "event_type": "purchase",  "user_id": 100, "created_at": "2025-06-03T09:20:00Z", "payload": "{\"item\": \"pro-plan\", \"price\": 99.00}"},
    {"event_id": "evt-006", "event_type": "click",    "user_id": 55,  "created_at": "2025-06-04T11:00:00Z", "payload": "{\"page\": \"docs\"}"},
    {"event_id": "evt-007", "event_type": "logout",   "user_id": 42,  "created_at": "2025-06-04T18:30:00Z"},
    {"event_id": "evt-008", "event_type": "click",    "user_id": 200, "created_at": "2025-06-05T08:00:00Z", "payload": "{\"page\": \"api\"}"},
    {"event_id": "evt-009", "event_type": "purchase",  "user_id": 200, "created_at": "2025-06-05T08:05:00Z", "payload": "{\"item\": \"enterprise\", \"price\": 499.00}"},
    {"event_id": "evt-010", "event_type": "click",    "user_id": 301, "created_at": "2025-06-06T16:45:00Z", "payload": "{\"page\": \"signup\"}"}
  ]' 2>&1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Inserted: {d.get(\"inserted\", d.get(\"message\",\"?\"))}')"

# Insert into analytics.user_sessions
echo ""
echo "── analytics.user_sessions ──"
curl -s -X POST "${ICEGUARD_API}/api/catalogs/${CATALOG_ID}/namespaces/analytics/tables/user_sessions/data" \
  -H "Content-Type: application/json" \
  -d '[
    {"session_id": "sess-001", "user_id": 42,  "start_time": "2025-06-01T10:25:00Z", "end_time": "2025-06-01T11:00:00Z"},
    {"session_id": "sess-002", "user_id": 99,  "start_time": "2025-06-02T13:55:00Z", "end_time": "2025-06-02T14:30:00Z"},
    {"session_id": "sess-003", "user_id": 100, "start_time": "2025-06-03T09:10:00Z", "end_time": "2025-06-03T09:45:00Z"},
    {"session_id": "sess-004", "user_id": 55,  "start_time": "2025-06-04T10:50:00Z", "end_time": "2025-06-04T12:00:00Z"},
    {"session_id": "sess-005", "user_id": 200, "start_time": "2025-06-05T07:55:00Z", "end_time": "2025-06-05T08:30:00Z"}
  ]' 2>&1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Inserted: {d.get(\"inserted\", d.get(\"message\",\"?\"))}')"

# Insert into raw.clickstream
echo ""
echo "── raw.clickstream ──"
curl -s -X POST "${ICEGUARD_API}/api/catalogs/${CATALOG_ID}/namespaces/raw/tables/clickstream/data" \
  -H "Content-Type: application/json" \
  -d '[
    {"click_id": "clk-001", "url": "https://app.example.com/home",    "ts": "2025-06-01T10:30:01Z"},
    {"click_id": "clk-002", "url": "https://app.example.com/pricing", "ts": "2025-06-02T14:00:05Z"},
    {"click_id": "clk-003", "url": "https://app.example.com/docs",    "ts": "2025-06-04T11:00:02Z"},
    {"click_id": "clk-004", "url": "https://app.example.com/api",     "ts": "2025-06-05T08:00:03Z"},
    {"click_id": "clk-005", "url": "https://app.example.com/signup",  "ts": "2025-06-06T16:45:01Z"}
  ]' 2>&1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Inserted: {d.get(\"inserted\", d.get(\"message\",\"?\"))}')"

# Verify with sample
echo ""
echo "── Verification (sample from analytics.events) ──"
curl -s "${ICEGUARD_API}/api/catalogs/${CATALOG_ID}/namespaces/analytics/tables/events/sample?limit=3" \
  | python3 -c "
import sys,json
d = json.load(sys.stdin)
print(f'  Columns: {d[\"columns\"]}')
print(f'  Rows: {d[\"rowCount\"]} (hasMore={d[\"hasMore\"]})')
for r in d['rows'][:3]:
    print(f'    {r}')"

echo ""
echo "=== Done ==="
