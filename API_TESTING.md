# 🧪 API Testing Guide

## Server Information

- **Port:** 8001
- **Base URL:** `/EducationalEternity`
- **Full API URL:** `http://localhost:8001/EducationalEternity`

---

## 🔑 SuperAdmin Login

### Using cURL:

```bash
curl -X POST http://localhost:8001/EducationalEternity/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "prashsantraj813@gmail.com",
    "password": "Educ@t!onal$123",
    "userType": "SuperAdmin"
  }'
```

**OR using email field (after server restart):**

```bash
curl -X POST http://localhost:8001/EducationalEternity/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "prashsantraj813@gmail.com",
    "password": "Educ@t!onal$123",
    "userType": "SuperAdmin"
  }'
```

### Expected Response:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "email": "prashsantraj813@gmail.com",
      "userType": "SuperAdmin"
    }
  }
}
```

---

## 🏫 Onboard School (After Login)

```bash
curl -X POST http://localhost:8001/EducationalEternity/onboard/school \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
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
  }'
```

---

## 📊 Check Onboarding Info

```bash
curl -X GET http://localhost:8001/EducationalEternity/onboard/info \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## ✅ Health Check

```bash
curl http://localhost:8001/health
```

---

## 🔍 Troubleshooting

### "No user found!"
- Check email/username spelling
- Verify user exists in database
- Use `username` field (or `email` after server restart)

### "Invalid User!"
- Check `userType` is exactly "SuperAdmin" (case-sensitive)

### "Password does not match!"
- Verify password is correct
- Password: `Educ@t!onal$123`

### Connection refused
- Make sure server is running on port 8001
- Check: `http://localhost:8001/health`

---

**Note:** Server must be restarted after code changes for updates to take effect.

