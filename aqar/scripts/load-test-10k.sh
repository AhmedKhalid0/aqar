#!/bin/bash
# ========================================
# Load Test Script - 10K Units & 10K News
# Stress test for system performance
# ========================================

BASE_URL="https://aqar.codenextai.com"
ADMIN_USER="admin"
ADMIN_PASS='MhcawVJWisuH9gNcVSDFD%^%^$^%^$^$6RVj'

# Configuration
UNITS_COUNT=10000
NEWS_COUNT=10000
BATCH_SIZE=100  # Process in batches to avoid overwhelming the server

echo "=========================================="
echo "🔥 Load Test Script - Stress Testing"
echo "=========================================="
echo "Target: ${UNITS_COUNT} Units + ${NEWS_COUNT} News Articles"
echo ""

# Step 1: Login
echo "📝 Authenticating..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"${ADMIN_USER}\", \"password\": \"${ADMIN_PASS}\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Authentication failed"
  exit 1
fi
echo "✅ Authenticated!"
echo ""

# Arrays for random data generation
LOCATIONS=("new-cairo" "sheikh-zayed" "north-coast" "6th-october" "maadi")
LOCATION_NAMES_AR=("التجمع الخامس" "الشيخ زايد" "الساحل الشمالي" "6 أكتوبر" "المعادي")
LOCATION_NAMES_EN=("Fifth Settlement" "Sheikh Zayed" "North Coast" "6th October" "Maadi")
TYPES=("apartment" "villa" "duplex" "penthouse" "townhouse")
TYPES_AR=("شقة" "فيلا" "دوبلكس" "بنتهاوس" "تاون هاوس")
STATUSES=("available" "reserved" "sold")

# Start time tracking
START_TIME=$(date +%s)

# ========================================
# Creating Units
# ========================================
echo "🏠 Creating ${UNITS_COUNT} Units..."
UNITS_CREATED=0
UNITS_FAILED=0

for i in $(seq 1 $UNITS_COUNT); do
  # Random values
  LOC_INDEX=$((RANDOM % 5))
  TYPE_INDEX=$((RANDOM % 5))
  STATUS_INDEX=$((RANDOM % 3))
  BEDROOMS=$((1 + RANDOM % 6))
  BATHROOMS=$((1 + RANDOM % 4))
  AREA=$((80 + RANDOM % 400))
  PRICE=$((500000 + RANDOM % 10000000))
  FLOOR=$((1 + RANDOM % 20))
  BUILDING=$((1 + RANDOM % 50))
  UNIT_NUM=$((100 + RANDOM % 900))
  FEATURED=$((RANDOM % 2))
  
  # Build JSON
  UNIT_JSON=$(cat <<EOF
{
  "title": {"ar": "${TYPES_AR[$TYPE_INDEX]} - وحدة ${i}", "en": "${TYPES[$TYPE_INDEX]} - Unit ${i}"},
  "location": {"ar": "${LOCATION_NAMES_AR[$LOC_INDEX]}", "en": "${LOCATION_NAMES_EN[$LOC_INDEX]}"},
  "locationId": "${LOCATIONS[$LOC_INDEX]}",
  "description": {"ar": "<p>وحدة رقم ${i} - ${TYPES_AR[$TYPE_INDEX]} فاخرة</p>", "en": "<p>Unit ${i} - Luxury ${TYPES[$TYPE_INDEX]}</p>"},
  "price": ${PRICE},
  "area": ${AREA},
  "bedrooms": ${BEDROOMS},
  "bathrooms": ${BATHROOMS},
  "type": "${TYPES[$TYPE_INDEX]}",
  "unitStatus": "${STATUSES[$STATUS_INDEX]}",
  "status": "active",
  "featured": $([ $FEATURED -eq 1 ] && echo "true" || echo "false"),
  "finishing": "finished",
  "floor": "${FLOOR}",
  "buildingNumber": "B${BUILDING}",
  "unitNumber": "${UNIT_NUM}"
}
EOF
)

  # Send request
  RESPONSE=$(curl -s -X POST "${BASE_URL}/api/units" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "$UNIT_JSON" -w "%{http_code}" -o /dev/null)
  
  if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "201" ]; then
    ((UNITS_CREATED++))
  else
    ((UNITS_FAILED++))
  fi
  
  # Progress every 100 units
  if [ $((i % 100)) -eq 0 ]; then
    ELAPSED=$(($(date +%s) - START_TIME))
    RATE=$(echo "scale=2; $i / $ELAPSED" | bc 2>/dev/null || echo "N/A")
    echo "  Units: ${i}/${UNITS_COUNT} (${RATE}/sec) - Created: ${UNITS_CREATED}, Failed: ${UNITS_FAILED}"
  fi
done

UNITS_END_TIME=$(date +%s)
UNITS_DURATION=$((UNITS_END_TIME - START_TIME))
echo ""
echo "✅ Units Complete: ${UNITS_CREATED} created, ${UNITS_FAILED} failed in ${UNITS_DURATION}s"
echo ""

# ========================================
# Creating News
# ========================================
echo "📰 Creating ${NEWS_COUNT} News Articles..."
NEWS_CREATED=0
NEWS_FAILED=0

CATEGORIES=("projects" "offers" "market" "tips" "company")
CATEGORIES_AR=("مشاريع" "عروض" "السوق" "نصائح" "أخبار الشركة")

NEWS_START_TIME=$(date +%s)

for i in $(seq 1 $NEWS_COUNT); do
  CAT_INDEX=$((RANDOM % 5))
  
  NEWS_JSON=$(cat <<EOF
{
  "title": {"ar": "خبر عقاري رقم ${i} - ${CATEGORIES_AR[$CAT_INDEX]}", "en": "Real Estate News ${i} - ${CATEGORIES[$CAT_INDEX]}"},
  "excerpt": {"ar": "ملخص الخبر رقم ${i} في قسم ${CATEGORIES_AR[$CAT_INDEX]}", "en": "Summary of news ${i} in ${CATEGORIES[$CAT_INDEX]} section"},
  "content": {"ar": "<p>محتوى الخبر رقم ${i}. هذا خبر تجريبي لاختبار أداء النظام في معالجة كميات كبيرة من البيانات.</p>", "en": "<p>Content of news ${i}. This is a test article to measure system performance with large data volumes.</p>"},
  "category": "${CATEGORIES[$CAT_INDEX]}",
  "status": "published"
}
EOF
)

  RESPONSE=$(curl -s -X POST "${BASE_URL}/api/news" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "$NEWS_JSON" -w "%{http_code}" -o /dev/null)
  
  if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "201" ]; then
    ((NEWS_CREATED++))
  else
    ((NEWS_FAILED++))
  fi
  
  # Progress every 100 news
  if [ $((i % 100)) -eq 0 ]; then
    ELAPSED=$(($(date +%s) - NEWS_START_TIME))
    RATE=$(echo "scale=2; $i / $ELAPSED" | bc 2>/dev/null || echo "N/A")
    echo "  News: ${i}/${NEWS_COUNT} (${RATE}/sec) - Created: ${NEWS_CREATED}, Failed: ${NEWS_FAILED}"
  fi
done

# Final stats
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))
NEWS_DURATION=$((END_TIME - NEWS_START_TIME))

echo ""
echo "=========================================="
echo "🏁 Load Test Complete!"
echo "=========================================="
echo ""
echo "📊 Results:"
echo "  Units:  ${UNITS_CREATED}/${UNITS_COUNT} created (${UNITS_FAILED} failed) in ${UNITS_DURATION}s"
echo "  News:   ${NEWS_CREATED}/${NEWS_COUNT} created (${NEWS_FAILED} failed) in ${NEWS_DURATION}s"
echo "  Total:  ${TOTAL_DURATION} seconds"
echo ""
echo "📈 Performance:"
echo "  Units Rate: $(echo "scale=2; $UNITS_CREATED / $UNITS_DURATION" | bc 2>/dev/null || echo "N/A") records/sec"
echo "  News Rate:  $(echo "scale=2; $NEWS_CREATED / $NEWS_DURATION" | bc 2>/dev/null || echo "N/A") records/sec"
echo ""
