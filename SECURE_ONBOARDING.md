# 🔒 Secure School Onboarding Guide

## Overview

The onboarding system is now **SECURED** and requires **SuperAdmin** authentication. Only the ERP system owner (SuperAdmin) can onboard new schools.

---

## 🔐 Security Features

✅ **Authentication Required:** Must be logged in as SuperAdmin  
✅ **Authorization Check:** Only SuperAdmin role can access  
✅ **JWT Token:** Secure token-based authentication  
✅ **Protected Endpoints:** All onboarding endpoints are secured  

---

## 👤 Step 1: Create SuperAdmin Account

As the ERP system owner, you need to create your SuperAdmin account first.

### Option 1: Using Script (Recommended)

```bash
cd BackEnd
node scripts/createSuperAdmin.js "Your" "Name" "your-email@example.com" "YourSecurePassword123!" "9876543210"
```

### Option 2: Using Environment Variables

Add to `.env`:
```env
SUPERADMIN_EMAIL=your-email@example.com
SUPERADMIN_PASSWORD=YourSecurePassword123!
SUPERADMIN_PHONE=9876543210
```

Then run:
```bash
node scripts/createSuperAdmin.js
```

### Option 3: Default Values

If no arguments provided, uses:
- Email: `superadmin@educationaleternity.com`
- Password: `SuperAdmin@123456`
- Phone: `9999999999`

**⚠️ IMPORTANT:** Change default password immediately after first login!

---

## 🔑 Step 2: Login as SuperAdmin

### Using API:

```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "YourSecurePassword123!",
    "userType": "SuperAdmin"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "email": "your-email@example.com",
      "userType": "SuperAdmin"
    }
  }
}
```

**Save the token!** You'll need it for onboarding.

---

## 🏫 Step 3: Onboard a School (Secure)

Now you can onboard schools using your SuperAdmin token.

### Using cURL:

```bash
curl -X POST http://localhost:5000/api/onboard/school \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPERADMIN_TOKEN" \
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

### Using Postman:

1. **Method:** POST
2. **URL:** `http://localhost:5000/api/onboard/school`
3. **Headers:**
   - `Content-Type: application/json`
   - `Authorization: Bearer YOUR_SUPERADMIN_TOKEN`
4. **Body:** Same JSON as above

---

## 📊 Step 4: Check Onboarding Status

### Get Detailed Info (SuperAdmin Only):

```bash
curl -X GET http://localhost:5000/api/onboard/info \
  -H "Authorization: Bearer YOUR_SUPERADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalInstitutions": 5,
    "inactiveInstitutions": 0,
    "totalAdminUsers": 5,
    "totalSuperAdmins": 1,
    "systemStatus": "Active",
    "recentInstitutions": [...]
  }
}
```

### Get Public Info (No Auth Required):

```bash
curl http://localhost:5000/api/onboard/public-info
```

---

## 🔄 Complete Workflow

```
1. Create SuperAdmin Account
   ↓
2. Login as SuperAdmin → Get Token
   ↓
3. Use Token to Onboard Schools
   ↓
4. Schools Get Admin Users Automatically
   ↓
5. School Admins Can Login to Their Dashboard
```

---

## 🛡️ Security Best Practices

1. **Protect Your SuperAdmin Credentials**
   - Never share SuperAdmin password
   - Use strong password (min 12 characters)
   - Enable 2FA if available

2. **Token Security**
   - Tokens expire after 4 hours
   - Don't commit tokens to code
   - Use environment variables for tokens in scripts

3. **Access Control**
   - Only SuperAdmin can onboard schools
   - Each school gets isolated data via `InstutionCode`
   - School admins can only access their own institution

4. **Audit Logging**
   - All onboarding actions are logged
   - Check logs: `BackEnd/logs/`

---

## 📝 Example: Complete Onboarding Script

```bash
#!/bin/bash

# Step 1: Login as SuperAdmin
TOKEN=$(curl -s -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@educationaleternity.com",
    "password": "SuperAdmin@123456",
    "userType": "SuperAdmin"
  }' | jq -r '.data.token')

echo "Token: $TOKEN"

# Step 2: Onboard School
curl -X POST http://localhost:5000/api/onboard/school \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "institutionName": "Test School",
    "email": "contact@testschool.com",
    "contactNumber": "9876543210",
    "state": "Maharashtra",
    "district": "Mumbai",
    "address": "123 Test Street",
    "adminFirstName": "Test",
    "adminLastName": "Admin",
    "adminEmail": "admin@testschool.com",
    "adminPassword": "Test123456!",
    "adminPhone": "9876543210"
  }'
```

---

## 🚫 Error Responses

### 401 - Unauthorized (No Token):
```json
{
  "success": false,
  "message": "Authentication required. Please provide a valid token.",
  "code": 401
}
```

### 403 - Forbidden (Not SuperAdmin):
```json
{
  "success": false,
  "message": "Access denied. Insufficient permissions.",
  "code": 403
}
```

### 401 - Invalid/Expired Token:
```json
{
  "success": false,
  "message": "Token expired. Please login again.",
  "code": 401
}
```

---

## 🔍 Verify Your Setup

1. **Check SuperAdmin exists:**
   ```bash
   # Login and check user type
   ```

2. **Test onboarding:**
   ```bash
   # Use the curl command above with your token
   ```

3. **Check logs:**
   ```bash
   tail -f BackEnd/logs/app.log
   ```

---

## 📞 Support

If you encounter issues:

1. **Check Authentication:**
   - Verify token is valid
   - Check token hasn't expired
   - Ensure you're logged in as SuperAdmin

2. **Check Permissions:**
   - User must have `UserType: "SuperAdmin"`
   - Verify in database if needed

3. **Check Logs:**
   - `BackEnd/logs/app.log`
   - `BackEnd/logs/exceptions.log`

---

## ✅ Security Checklist

- [x] SuperAdmin account created
- [x] Strong password set
- [x] Token-based authentication implemented
- [x] Authorization middleware added
- [x] Only SuperAdmin can onboard schools
- [x] All onboarding endpoints protected
- [x] Audit logging enabled

---

**Status:** ✅ Fully Secured  
**Last Updated:** 2024

