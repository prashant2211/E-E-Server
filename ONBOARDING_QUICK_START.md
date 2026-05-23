# 🚀 School Onboarding - Quick Start Guide

## 🔒 SECURITY UPDATE

**The onboarding system is now SECURED!** Only SuperAdmin (ERP owner) can onboard schools.

**See `SECURE_ONBOARDING.md` for complete secure onboarding guide.**

---

## Step 1: Create SuperAdmin Account (Required)

As the ERP system owner, create your SuperAdmin account:

```bash
cd BackEnd
node scripts/createSuperAdmin.js "Your" "Name" "your-email@example.com" "YourSecurePassword123!" "9876543210"
```

Or use defaults:
```bash
node scripts/createSuperAdmin.js
```

---

## Step 2: Login as SuperAdmin

```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "YourSecurePassword123!",
    "userType": "SuperAdmin"
  }'
```

**Save the token from response!**

---

## Step 3: Clean Database (Optional)

If you want to start fresh:

```bash
cd BackEnd
node scripts/cleanDatabase.js
```

Wait 5 seconds or press Ctrl+C to cancel.

---

## Step 4: Onboard Your First School (Secure)

### Using cURL:

```bash
curl -X POST http://localhost:5000/api/onboard/school \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPERADMIN_TOKEN" \
  -d '{
    "institutionName": "Educational Eternity",
    "email": "contact@educationaleternity.com",
    "contactNumber": "9876543210",
    "state": "Maharashtra",
    "district": "Mumbai",
    "address": "123 Education Street, Learning City, 400001",
    "adminFirstName": "Admin",
    "adminLastName": "User",
    "adminEmail": "admin@educationaleternity.com",
    "adminPassword": "Admin@123456",
    "adminPhone": "9876543210"
  }'
```

### Using Postman:

1. **Method:** POST
2. **URL:** `http://localhost:5000/api/onboard/school`
3. **Headers:** 
   - `Content-Type: application/json`
4. **Body (raw JSON):**

```json
{
  "institutionName": "Educational Eternity",
  "email": "contact@educationaleternity.com",
  "contactNumber": "9876543210",
  "state": "Maharashtra",
  "district": "Mumbai",
  "address": "123 Education Street, Learning City, 400001",
  "adminFirstName": "Admin",
  "adminLastName": "User",
  "adminEmail": "admin@educationaleternity.com",
  "adminPassword": "Admin@123456",
  "adminPhone": "9876543210"
}
```

---

## Step 5: Check Response

**Success Response:**

```json
{
  "success": true,
  "message": "School onboarded successfully!",
  "code": 201,
  "data": {
    "institution": {
      "institutionId": "EE-001",
      "name": "Educational Eternity",
      "email": "contact@educationaleternity.com"
    },
    "admin": {
      "email": "admin@educationaleternity.com",
      "memberId": "EE-001-ADMIN-001",
      "userType": "Admin"
    }
  }
}
```

**Save these credentials:**
- **Institution ID:** `EE-001`
- **Admin Email:** `admin@educationaleternity.com`
- **Admin Password:** `Admin@123456`

---

## Step 6: School Admin Can Login to ERP System

1. Go to: `http://localhost:3000/login`
2. Select **"Admin"** user type
3. Enter:
   - Email: `admin@educationaleternity.com`
   - Password: `Admin@123456`
4. Click **Login**

---

## 📋 Required Fields

**Minimum Required:**
- `institutionName` - School name
- `email` - School contact email
- `contactNumber` - School phone
- `state` - State
- `district` - District
- `address` - Full address
- `adminFirstName` - Admin first name
- `adminLastName` - Admin last name
- `adminEmail` - Admin email (for login)
- `adminPassword` - Admin password (min 8 chars)
- `adminPhone` - Admin phone

**Optional Fields:**
- `registrationId` - Registration number
- `affiliation` - Board (CBSE, ICSE, etc.)
- `chairmanName` - Chairman name
- `directorName` - Director name
- `institutionType` - Type (School, College, etc.)

---

## 🔍 Check Onboarding Status

```bash
curl http://localhost:5000/api/onboard/info
```

---

## 📧 Email Configuration

Make sure `.env` has:

```env
ORGANIZATION_EMAIL=your-email@gmail.com
ORGANIZATION_PASSWORD=your-app-password
FRONTEND_URL=http://localhost:3000
```

Welcome email will be sent automatically to admin email.

---

## ✅ What Happens After Onboarding?

1. ✅ Institution created with unique ID
2. ✅ Admin user created
3. ✅ Default academic year created (optional)
4. ✅ Welcome email sent
5. ✅ Ready to login and start using ERP

---

## 🆘 Troubleshooting

**Error: "Email already exists"**
- Use a different email address

**Error: "Contact number already exists"**
- Use a different contact number

**Error: "Validation failed"**
- Check all required fields are provided
- Ensure email format is correct
- Password must be at least 8 characters

**Email not received?**
- Check spam folder
- Verify email configuration in `.env`
- Check server logs

---

**For detailed API documentation, see:** `SCHOOL_ONBOARDING.md`

