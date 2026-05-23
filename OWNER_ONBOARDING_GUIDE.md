# 👑 ERP Owner - School Onboarding Guide

## You Are the ERP System Owner

As the owner of Educational Eternity ERP, you have **SuperAdmin** privileges to onboard new schools.

---

## 🚀 Quick Start (3 Steps)

### 1️⃣ Create Your SuperAdmin Account

```bash
cd BackEnd
node scripts/createSuperAdmin.js "Your" "Name" "owner@educationaleternity.com" "SecurePassword123!" "9876543210"
```

**This creates your owner account with full system access.**

---

### 2️⃣ Login and Get Token

```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@educationaleternity.com",
    "password": "SecurePassword123!",
    "userType": "SuperAdmin"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "email": "owner@educationaleternity.com",
      "userType": "SuperAdmin"
    }
  }
}
```

**Copy the token!** You'll need it for step 3.

---

### 3️⃣ Onboard a School

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

**That's it!** The school is now onboarded with an admin user.

---

## 📋 Complete Example

Here's a complete script you can use:

```bash
#!/bin/bash

# Step 1: Login as SuperAdmin
echo "🔑 Logging in as SuperAdmin..."
TOKEN=$(curl -s -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@educationaleternity.com",
    "password": "SecurePassword123!",
    "userType": "SuperAdmin"
  }' | jq -r '.data.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  exit 1
fi

echo "✅ Login successful!"
echo ""

# Step 2: Onboard School
echo "🏫 Onboarding school..."
RESPONSE=$(curl -s -X POST http://localhost:5000/api/onboard/school \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
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
  }')

SUCCESS=$(echo $RESPONSE | jq -r '.success')

if [ "$SUCCESS" == "true" ]; then
  echo "✅ School onboarded successfully!"
  echo "$RESPONSE" | jq '.'
else
  echo "❌ Onboarding failed!"
  echo "$RESPONSE" | jq '.'
fi
```

---

## 🔐 Security Features

✅ **Only You Can Onboard:** SuperAdmin authentication required  
✅ **Token-Based:** Secure JWT tokens (expire in 4 hours)  
✅ **Isolated Data:** Each school's data is completely separate  
✅ **Audit Logs:** All actions are logged  

---

## 📊 Check System Status

```bash
curl -X GET http://localhost:5000/api/onboard/info \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Shows:**
- Total institutions
- Active/inactive schools
- Total admin users
- Recent onboardings

---

## 🎯 What Happens When You Onboard a School?

1. ✅ Institution created with unique ID (e.g., `EE-001`)
2. ✅ Admin user created automatically
3. ✅ Default academic year created
4. ✅ Welcome email sent to admin
5. ✅ School can login immediately

**The school admin receives:**
- Institution ID
- Admin email & password
- Login URL
- Setup instructions

---

## 🛠️ Using Postman

1. **Login Request:**
   - Method: `POST`
   - URL: `http://localhost:5000/api/login`
   - Body:
     ```json
     {
       "email": "owner@educationaleternity.com",
       "password": "SecurePassword123!",
       "userType": "SuperAdmin"
     }
     ```
   - Copy the token from response

2. **Onboard School:**
   - Method: `POST`
   - URL: `http://localhost:5000/api/onboard/school`
   - Headers:
     - `Authorization: Bearer YOUR_TOKEN`
     - `Content-Type: application/json`
   - Body: School details JSON

---

## 📝 Required Fields for Onboarding

**Institution:**
- `institutionName` - School name
- `email` - School contact email (unique)
- `contactNumber` - School phone (unique)
- `state` - State
- `district` - District
- `address` - Full address

**Admin User:**
- `adminFirstName` - Admin first name
- `adminLastName` - Admin last name
- `adminEmail` - Admin email (for login, unique)
- `adminPassword` - Admin password (min 8 chars)
- `adminPhone` - Admin phone

**Optional:**
- `registrationId`, `affiliation`, `chairmanName`, etc.

---

## ⚠️ Important Notes

1. **Token Expiry:** Tokens expire after 4 hours - login again if needed
2. **Unique Emails:** Each institution and admin must have unique email
3. **Password Security:** Use strong passwords (min 8 characters)
4. **Save Credentials:** School admin credentials are sent via email
5. **Data Isolation:** Each school's data is completely isolated

---

## 🆘 Troubleshooting

**"Authentication required"**
- Make sure you're logged in
- Check token is valid and not expired
- Token should be in header: `Authorization: Bearer TOKEN`

**"Access denied. Insufficient permissions"**
- You must be logged in as SuperAdmin
- Check your user type in database

**"Email already exists"**
- Institution or admin email is already in use
- Use different email addresses

**"Validation failed"**
- Check all required fields are provided
- Email format must be valid
- Password must be at least 8 characters

---

## 📚 More Documentation

- **Complete Guide:** `SECURE_ONBOARDING.md`
- **API Reference:** `SCHOOL_ONBOARDING.md`
- **Quick Start:** `ONBOARDING_QUICK_START.md`

---

## ✅ Checklist

- [ ] SuperAdmin account created
- [ ] Logged in and got token
- [ ] Tested onboarding with one school
- [ ] Verified school admin can login
- [ ] Checked system status endpoint

---

**You're all set!** You can now securely onboard schools as the ERP system owner.

**Last Updated:** 2024

