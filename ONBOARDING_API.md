# 🏫 School Onboarding API - Correct Usage

## ✅ Correct API Endpoint

**Your server is running on port 8001 with base URL `/EducationalEternity`**

### Correct URL:
```
POST http://localhost:8001/EducationalEternity/onboard/school
```

**NOT:** `http://localhost:5000/api/onboard/school` ❌

---

## 📋 Postman Request

### Method: POST
### URL:
```
http://localhost:8001/EducationalEternity/onboard/school
```

### Headers:
```
Content-Type: application/json
Authorization: Bearer YOUR_SUPERADMIN_TOKEN
```

### Body (raw JSON):
```json
{
  "institutionName": "Educational Eternity School",
  "email": "contact@school.com",
  "contactNumber": "9876543210",
  "state": "Maharashtra",
  "district": "Mumbai",
  "address": "123 Education Street, Learning City, 400001",
  "adminFirstName": "Admin",
  "adminLastName": "User",
  "adminEmail": "admin@school.com",
  "adminPassword": "Admin@123456",
  "adminPhone": "9876543210"
}
```

---

## 🔑 How to Get Token

### 1. Login as SuperAdmin:
```
POST http://localhost:8001/EducationalEternity/login
```

**Body:**
```json
{
  "email": "prashsantraj813@gmail.com",
  "password": "Educ@t!onal$123",
  "userType": "SuperAdmin"
}
```

### 2. Copy the token from response

### 3. Use token in Authorization header

---

## ✅ Expected Response

```json
{
  "success": true,
  "message": "School onboarded successfully!",
  "code": 201,
  "data": {
    "institution": {
      "id": "...",
      "institutionId": "EES-001",
      "name": "Educational Eternity School",
      "email": "contact@school.com",
      "status": true
    },
    "admin": {
      "id": "...",
      "email": "admin@school.com",
      "memberId": "EES-001-ADMIN-001",
      "userType": "Admin"
    },
    "loginUrl": "http://localhost:3000/login"
  }
}
```

---

## 🆘 Common Issues

### 403 Forbidden
- Token expired (tokens expire in 4 hours)
- Not logged in as SuperAdmin
- Invalid token

**Solution:** Login again and get a new token

### 500 Internal Server Error
- Check server console logs
- Verify all required fields are provided
- Check database connection

### Wrong URL
- Use port **8001** (not 5000)
- Use base URL **/EducationalEternity** (not /api)

---

## 📝 Quick Test

```bash
# 1. Login
curl -X POST http://localhost:8001/EducationalEternity/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "prashsantraj813@gmail.com",
    "password": "Educ@t!onal$123",
    "userType": "SuperAdmin"
  }'

# 2. Copy token, then onboard
curl -X POST http://localhost:8001/EducationalEternity/onboard/school \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "institutionName": "Test School",
    "email": "test@school.com",
    "contactNumber": "9876543210",
    "state": "Maharashtra",
    "district": "Mumbai",
    "address": "123 Test Street",
    "adminFirstName": "Test",
    "adminLastName": "Admin",
    "adminEmail": "admin@test.com",
    "adminPassword": "Test123456!",
    "adminPhone": "9876543210"
  }'
```

---

**Correct URL:** `http://localhost:8001/EducationalEternity/onboard/school`

