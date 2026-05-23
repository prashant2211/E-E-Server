# School Onboarding API Documentation

## Overview

This document describes the process and APIs for onboarding new schools/institutions to the Educational Eternity ERP system. The onboarding process creates both the institution record and an admin user account in a single transaction.

---

## 🗑️ Database Cleanup

Before onboarding schools, you may want to clean the database completely:

```bash
# Navigate to BackEnd directory
cd BackEnd

# Run cleanup script
node scripts/cleanDatabase.js
```

**⚠️ WARNING:** This will delete ALL data from the database. The script will wait 5 seconds before executing to allow cancellation.

---

## 📋 Onboarding Process

### Step 1: Onboard School

When a school wants to join the system, use the onboarding API to:
1. Create the institution record
2. Create an admin user for that institution
3. Set up default academic year (optional)
4. Send welcome email with credentials

### Step 2: Admin Login

The admin user can then:
1. Login using the credentials sent via email
2. Change password (recommended)
3. Configure institution settings
4. Start managing the school

---

## 🔌 API Endpoints

### 1. Onboard School

**Endpoint:** `POST /api/onboard/school`

**Description:** Creates a new school/institution with an admin user account.

**Access:** Public (can be protected with API key in production)

**Request Body:**

```json
{
  // Institution Information (Required)
  "institutionName": "Educational Eternity School",
  "email": "contact@educationaleternity.com",
  "contactNumber": "9876543210",
  "state": "Maharashtra",
  "district": "Mumbai",
  "address": "123 Education Street, Learning City, 400001",
  
  // Admin User Information (Required)
  "adminFirstName": "John",
  "adminLastName": "Doe",
  "adminEmail": "admin@educationaleternity.com",
  "adminPassword": "SecurePassword123!",
  "adminPhone": "9876543210",
  
  // Optional Fields
  "secondaryContact": "9876543211",
  "registrationId": "REG-2024-001",
  "affiliation": "CBSE",
  "chairmanName": "Mr. Chairman",
  "directorName": "Mr. Director",
  "registrarName": "Mr. Registrar",
  "institutionType": "School",
  "managementMembers": ["Member1", "Member2"],
  "institutionUrl": "https://educationaleternity.com/login",
  "permissionSet": "all",
  "createDefaultAcademicYear": true
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `institutionName` | String | Yes | Name of the institution (min 3 chars) |
| `email` | String | Yes | Institution contact email (must be unique) |
| `contactNumber` | String | Yes | Primary contact number (min 10 digits, must be unique) |
| `state` | String | Yes | State where institution is located |
| `district` | String | Yes | District where institution is located |
| `address` | String | Yes | Complete address (min 10 chars) |
| `adminFirstName` | String | Yes | Admin user's first name (min 2 chars) |
| `adminLastName` | String | Yes | Admin user's last name (min 2 chars) |
| `adminEmail` | String | Yes | Admin user's email (must be unique, used for login) |
| `adminPassword` | String | Yes | Admin user's password (min 8 chars) |
| `adminPhone` | String | Yes | Admin user's phone number (min 10 digits) |
| `secondaryContact` | String | No | Secondary contact number |
| `registrationId` | String | No | Institution registration ID |
| `affiliation` | String | No | Board affiliation (e.g., CBSE, ICSE) |
| `chairmanName` | String | No | Chairman's name |
| `directorName` | String | No | Director's name |
| `registrarName` | String | No | Registrar's name |
| `institutionType` | String | No | Type of institution (default: "School") |
| `managementMembers` | Array | No | Array of management member names |
| `institutionUrl` | String | No | Custom login URL for the institution |
| `permissionSet` | String | No | Permission set for admin (default: "all") |
| `createDefaultAcademicYear` | Boolean | No | Create default academic year (default: true) |

**Success Response (201):**

```json
{
  "success": true,
  "message": "School onboarded successfully!",
  "code": 201,
  "data": {
    "institution": {
      "id": "507f1f77bcf86cd799439011",
      "institutionId": "EES-001",
      "name": "Educational Eternity School",
      "email": "contact@educationaleternity.com",
      "status": true
    },
    "admin": {
      "id": "507f1f77bcf86cd799439012",
      "email": "admin@educationaleternity.com",
      "memberId": "EES-001-ADMIN-001",
      "userType": "Admin"
    },
    "loginUrl": "https://educationaleternity.com/login"
  }
}
```

**Error Responses:**

**400 - Validation Error:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "Institution name is required (minimum 3 characters)",
    "Valid email is required"
  ],
  "code": 400
}
```

**409 - Conflict (Email/Contact already exists):**
```json
{
  "success": false,
  "message": "Institution with this email or contact number already exists",
  "code": 409
}
```

**500 - Server Error:**
```json
{
  "success": false,
  "message": "Failed to onboard school",
  "error": "Internal server error",
  "code": 500
}
```

---

### 2. Get Onboarding Information

**Endpoint:** `GET /api/onboard/info`

**Description:** Get system-wide onboarding statistics and information.

**Access:** Public

**Success Response (200):**

```json
{
  "success": true,
  "message": "Onboarding information retrieved successfully",
  "code": 200,
  "data": {
    "totalInstitutions": 15,
    "totalAdminUsers": 15,
    "systemStatus": "Active"
  }
}
```

---

## 🔐 Institution ID Generation

Institution IDs are automatically generated in the format: `[INITIALS]-[NUMBER]`

**Examples:**
- "Educational Eternity School" → `EES-001`
- "Delhi Public School" → `DPS-001`
- "St. Mary's Convent" → `SMC-001`

The system extracts the first letter of each word and appends a 3-digit sequential number.

---

## 👤 Admin User Creation

When a school is onboarded, an admin user is automatically created with:

- **Username:** Same as admin email
- **User Type:** "Admin"
- **Member ID:** `[INSTITUTION_ID]-ADMIN-001`
- **Institution Code:** Same as Institution ID
- **Verified Status:** `true` (auto-verified)
- **Permission Set:** "all" (full access by default)

---

## 📧 Welcome Email

After successful onboarding, a welcome email is automatically sent to the admin user containing:

- Institution details (ID, name, registration ID)
- Admin credentials (email, password)
- Login URL
- Security reminder to change password

**Email Configuration:**

Make sure these environment variables are set in `.env`:

```env
ORGANIZATION_EMAIL=your-email@gmail.com
ORGANIZATION_PASSWORD=your-app-password
FRONTEND_URL=http://localhost:3000
```

---

## 🔄 Transaction Safety

The onboarding process uses MongoDB transactions to ensure data consistency:

- If institution creation fails, admin user is not created
- If admin user creation fails, institution creation is rolled back
- If academic year creation fails, previous steps are rolled back

This ensures the database remains in a consistent state even if errors occur.

---

## 📝 Example cURL Request

```bash
curl -X POST http://localhost:5000/api/onboard/school \
  -H "Content-Type: application/json" \
  -d '{
    "institutionName": "Educational Eternity School",
    "email": "contact@educationaleternity.com",
    "contactNumber": "9876543210",
    "state": "Maharashtra",
    "district": "Mumbai",
    "address": "123 Education Street, Learning City, 400001",
    "adminFirstName": "John",
    "adminLastName": "Doe",
    "adminEmail": "admin@educationaleternity.com",
    "adminPassword": "SecurePassword123!",
    "adminPhone": "9876543210",
    "registrationId": "REG-2024-001",
    "affiliation": "CBSE",
    "institutionType": "School"
  }'
```

---

## 📝 Example JavaScript/Node.js Request

```javascript
const axios = require('axios');

const onboardSchool = async () => {
  try {
    const response = await axios.post('http://localhost:5000/api/onboard/school', {
      institutionName: "Educational Eternity School",
      email: "contact@educationaleternity.com",
      contactNumber: "9876543210",
      state: "Maharashtra",
      district: "Mumbai",
      address: "123 Education Street, Learning City, 400001",
      adminFirstName: "John",
      adminLastName: "Doe",
      adminEmail: "admin@educationaleternity.com",
      adminPassword: "SecurePassword123!",
      adminPhone: "9876543210",
      registrationId: "REG-2024-001",
      affiliation: "CBSE",
      institutionType: "School"
    });

    console.log('School onboarded:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
};

onboardSchool();
```

---

## 🧪 Testing the API

### Using Postman:

1. Create a new POST request
2. URL: `http://localhost:5000/api/onboard/school`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON): Use the example request body above
5. Send request

### Using Browser Console:

```javascript
fetch('http://localhost:5000/api/onboard/school', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    institutionName: "Test School",
    email: "test@school.com",
    contactNumber: "9876543210",
    state: "Maharashtra",
    district: "Mumbai",
    address: "123 Test Street, Test City",
    adminFirstName: "Test",
    adminLastName: "Admin",
    adminEmail: "admin@test.com",
    adminPassword: "Test123456!",
    adminPhone: "9876543210"
  })
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));
```

---

## 🔒 Security Considerations

1. **Password Requirements:** Minimum 8 characters (can be enhanced)
2. **Email Validation:** Proper email format validation
3. **Unique Constraints:** Email and contact numbers must be unique
4. **Transaction Safety:** All-or-nothing approach using MongoDB transactions
5. **Production:** Consider adding API key authentication for onboarding endpoint

---

## 🚀 Next Steps After Onboarding

After a school is onboarded:

1. **Admin Login:** Admin can login using credentials from email
2. **Change Password:** Admin should change password immediately
3. **Configure Settings:** Set up institution-specific settings
4. **Create Academic Year:** If not created automatically, create academic year
5. **Add Classes:** Create classes and sections
6. **Add Teachers:** Onboard teaching staff
7. **Add Students:** Start student admissions
8. **Configure Fees:** Set up fee structures
9. **Set Timetable:** Create class schedules

---

## 📞 Support

For issues or questions:
- Email: support@educationaleternity.com
- Check logs: `BackEnd/logs/`
- Review error responses for specific error messages

---

## ✅ Checklist for Onboarding

- [ ] Database cleaned (if needed)
- [ ] Environment variables configured (email, database)
- [ ] Test onboarding with sample data
- [ ] Verify welcome email is sent
- [ ] Test admin login with created credentials
- [ ] Verify institution appears in system
- [ ] Check that admin user has correct permissions

---

**Last Updated:** 2024
**Version:** 1.0.0

