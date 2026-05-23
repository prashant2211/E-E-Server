# 🔐 Your SuperAdmin Credentials

## ✅ Account Created Successfully!

Your SuperAdmin account has been created. **Save these credentials securely!**

---

## 📋 Your Credentials

- **Name:** Prashant Raj
- **Email:** prashsantraj813@gmail.com
- **Password:** Educ@t!onal$123
- **Phone:** 9934001660
- **User Type:** SuperAdmin
- **Member ID:** SUPERADMIN-001

---

## 🚀 How to Login

### Using cURL:

```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "prashsantraj813@gmail.com",
    "password": "Educ@t!onal$123",
    "userType": "SuperAdmin"
  }'
```

### Using Postman:

1. **Method:** POST
2. **URL:** `http://localhost:5000/api/login`
3. **Headers:** `Content-Type: application/json`
4. **Body:**
```json
{
  "email": "prashsantraj813@gmail.com",
  "password": "Educ@t!onal$123",
  "userType": "SuperAdmin"
}
```

**Response will include a token - save it!**

---

## 🏫 Onboard Schools

After logging in, you'll get a token. Use it to onboard schools:

```bash
curl -X POST http://localhost:5000/api/onboard/school \
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

## 🔒 Security Reminders

1. **Never share your SuperAdmin password**
2. **Change password regularly** (recommended)
3. **Tokens expire after 4 hours** - login again if needed
4. **Keep this file secure** - don't commit to git

---

## 📚 Documentation

- **Complete Guide:** `SECURE_ONBOARDING.md`
- **Owner Guide:** `OWNER_ONBOARDING_GUIDE.md`
- **Quick Start:** `ONBOARDING_QUICK_START.md`

---

**Created:** 2024  
**Status:** ✅ Active

