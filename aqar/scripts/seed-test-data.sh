#!/bin/bash
# ========================================
# Seed Test Data Script
# Creates test data via API endpoints
# ========================================

BASE_URL="https://aqar.codenextai.com"
ADMIN_USER="admin"
ADMIN_PASS='MhcawVJWisuH9gNcVSDFD%^%^$^%^$^$6RVj'

echo "=========================================="
echo "🚀 Seed Test Data Script for Aqar"
echo "=========================================="

# Step 1: Login and get JWT token
echo ""
echo "📝 Step 1: Authenticating..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"${ADMIN_USER}\", \"password\": \"${ADMIN_PASS}\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get authentication token"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Authentication successful!"
echo ""

# Step 2: Create Projects
echo "📦 Step 2: Creating Projects..."

# Project 1 - Almas Tower
PROJECT1_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "title": {"ar": "ألماس تاور", "en": "Almas Tower"},
    "developer": {"ar": "شركة عقار للتطوير", "en": "Aqar Development"},
    "location": {"ar": "التجمع الخامس", "en": "Fifth Settlement"},
    "locationId": "new-cairo",
    "description": {"ar": "<p>مشروع ألماس تاور هو أحد أبرز المشاريع السكنية الفاخرة في قلب التجمع الخامس</p>", "en": "<p>Almas Tower is one of the most prominent luxury residential projects in Fifth Settlement</p>"},
    "totalUnits": 120,
    "availableUnits": 45,
    "priceRange": {"min": 2500000, "max": 6000000},
    "status": "active",
    "featured": true,
    "amenities": {"ar": ["حمام سباحة", "جيم", "أمن 24 ساعة", "مواقف سيارات"], "en": ["Swimming Pool", "Gym", "24/7 Security", "Parking"]}
  }')
echo "Project 1: $PROJECT1_RESPONSE"

# Project 2 - Marina Bay
PROJECT2_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "title": {"ar": "مارينا باي ريزيدنس", "en": "Marina Bay Residence"},
    "developer": {"ar": "شركة عقار للتطوير", "en": "Aqar Development"},
    "location": {"ar": "الساحل الشمالي", "en": "North Coast"},
    "locationId": "north-coast",
    "description": {"ar": "<p>مارينا باي ريزيدنس منتجع سكني فاخر على شواطئ الساحل الشمالي</p>", "en": "<p>Marina Bay Residence is a luxurious resort on North Coast beaches</p>"},
    "totalUnits": 200,
    "availableUnits": 78,
    "priceRange": {"min": 3000000, "max": 12000000},
    "status": "active",
    "featured": true,
    "amenities": {"ar": ["شاطئ خاص", "مارينا لليخوت", "سبا"], "en": ["Private Beach", "Yacht Marina", "Spa"]}
  }')
echo "Project 2: $PROJECT2_RESPONSE"

echo ""
echo "🏠 Step 3: Creating Units..."

# Unit 1
UNIT1_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/units" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "title": {"ar": "شقة فاخرة 3 غرف", "en": "Luxury 3BR Apartment"},
    "location": {"ar": "التجمع الخامس", "en": "Fifth Settlement"},
    "locationId": "new-cairo",
    "description": {"ar": "<p>شقة فاخرة بتشطيب سوبر لوكس مع إطلالة رائعة</p>", "en": "<p>Luxury apartment with super lux finishing and great view</p>"},
    "price": 3500000,
    "area": 180,
    "bedrooms": 3,
    "bathrooms": 2,
    "type": "apartment",
    "unitStatus": "available",
    "status": "active",
    "featured": true,
    "finishing": "finished",
    "floor": "5",
    "buildingNumber": "A1",
    "unitNumber": "501",
    "features": {"ar": ["تكييف مركزي", "مطبخ مجهز", "شرفة"], "en": ["Central AC", "Equipped Kitchen", "Balcony"]}
  }')
echo "Unit 1: $UNIT1_RESPONSE"

# Unit 2
UNIT2_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/units" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "title": {"ar": "فيلا مستقلة", "en": "Standalone Villa"},
    "location": {"ar": "الشيخ زايد", "en": "Sheikh Zayed"},
    "locationId": "sheikh-zayed",
    "description": {"ar": "<p>فيلا مستقلة فاخرة مع حديقة وحمام سباحة خاص</p>", "en": "<p>Luxury standalone villa with garden and private pool</p>"},
    "price": 12000000,
    "area": 450,
    "bedrooms": 5,
    "bathrooms": 4,
    "type": "villa",
    "unitStatus": "available",
    "status": "active",
    "featured": true,
    "finishing": "finished",
    "buildingNumber": "",
    "unitNumber": "V12",
    "gardenShare": 100,
    "features": {"ar": ["حمام سباحة خاص", "حديقة", "جراج مزدوج", "غرفة خادمة"], "en": ["Private Pool", "Garden", "Double Garage", "Maid Room"]}
  }')
echo "Unit 2: $UNIT2_RESPONSE"

# Unit 3
UNIT3_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/units" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "title": {"ar": "شاليه على البحر", "en": "Beachfront Chalet"},
    "location": {"ar": "الساحل الشمالي", "en": "North Coast"},
    "locationId": "north-coast",
    "description": {"ar": "<p>شاليه فاخر بإطلالة مباشرة على البحر</p>", "en": "<p>Luxury chalet with direct sea view</p>"},
    "price": 5500000,
    "area": 150,
    "bedrooms": 2,
    "bathrooms": 2,
    "type": "apartment",
    "unitStatus": "available",
    "status": "active",
    "featured": true,
    "finishing": "finished",
    "floor": "1",
    "buildingNumber": "B3",
    "unitNumber": "101",
    "view": "Sea View",
    "features": {"ar": ["إطلالة بحر", "تراس واسع", "تكييف"], "en": ["Sea View", "Wide Terrace", "AC"]}
  }')
echo "Unit 3: $UNIT3_RESPONSE"

echo ""
echo "📰 Step 4: Creating News..."

# News 1
NEWS1_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/news" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "title": {"ar": "افتتاح مشروع ألماس تاور", "en": "Almas Tower Project Launch"},
    "excerpt": {"ar": "تعلن شركة عقار عن افتتاح أحدث مشاريعها السكنية", "en": "Aqar announces the launch of its newest residential project"},
    "content": {"ar": "<p>يسر شركة عقار للتطوير العقاري أن تعلن عن افتتاح مشروع ألماس تاور الفاخر في قلب التجمع الخامس. المشروع يضم 120 وحدة سكنية بتصميمات عصرية ومرافق متكاملة.</p>", "en": "<p>Aqar Real Estate Development is pleased to announce the launch of the luxurious Almas Tower project in the heart of Fifth Settlement. The project includes 120 residential units with modern designs and integrated facilities.</p>"},
    "category": "projects",
    "status": "published"
  }')
echo "News 1: $NEWS1_RESPONSE"

# News 2
NEWS2_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/news" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "title": {"ar": "عروض الصيف الحصرية", "en": "Exclusive Summer Offers"},
    "excerpt": {"ar": "خصومات تصل إلى 15% على جميع وحدات الساحل الشمالي", "en": "Up to 15% discount on all North Coast units"},
    "content": {"ar": "<p>استمتع بعروض الصيف الحصرية من شركة عقار! خصومات مميزة تصل إلى 15% على جميع وحدات الساحل الشمالي بالإضافة إلى خطط سداد مرنة تصل إلى 8 سنوات.</p>", "en": "<p>Enjoy exclusive summer offers from Aqar! Special discounts up to 15% on all North Coast units plus flexible payment plans up to 8 years.</p>"},
    "category": "offers",
    "status": "published"
  }')
echo "News 2: $NEWS2_RESPONSE"

echo ""
echo "⭐ Step 5: Creating Reviews..."

# Note: Reviews might need to go through admin approval
REVIEW1_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/reviews" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "name": "أحمد محمد",
    "comment": {"ar": "تجربة رائعة مع شركة عقار. فريق محترف وخدمة ممتازة. أنصح بالتعامل معهم.", "en": "Great experience with Aqar. Professional team and excellent service. Highly recommended."},
    "rating": 5,
    "status": "approved"
  }')
echo "Review 1: $REVIEW1_RESPONSE"

REVIEW2_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/reviews" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "name": "سارة حسن",
    "comment": {"ar": "اشتريت شقة في مشروعهم الجديد. الجودة ممتازة والتسليم في الموعد.", "en": "I bought an apartment in their new project. Quality is excellent and delivery was on time."},
    "rating": 5,
    "status": "approved"
  }')
echo "Review 2: $REVIEW2_RESPONSE"

REVIEW3_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/reviews" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "name": "محمود علي",
    "comment": {"ar": "شركة موثوقة ومشاريع راقية. خدمة ما بعد البيع ممتازة.", "en": "Reliable company with upscale projects. Excellent after-sales service."},
    "rating": 4,
    "status": "approved"
  }')
echo "Review 3: $REVIEW3_RESPONSE"

echo ""
echo "=========================================="
echo "✅ Test Data Seeding Complete!"
echo "=========================================="
echo ""
echo "Created:"
echo "  - 2 Projects"
echo "  - 3 Units"
echo "  - 2 News Articles"
echo "  - 3 Reviews"
echo ""
echo "Now visit https://aqar.codenextai.com to test the website!"
