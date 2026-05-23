# 🏫 School Onboarding - Fix Summary

## ✅ Issues Fixed

1. **AcademicYear Import** - Fixed to use destructured import: `const { AcademicYear } = require('../models/academicYearModel')`
2. **Error Handling** - Improved to show detailed error messages in development mode
3. **Session Handling** - Fixed transaction session management
4. **Management_Member Field** - Added default value `['System Admin']` if not provided

## 🔍 To Debug the 500 Error

### Step 1: Check Server Console Logs
The error details are now logged to the console. Look for:
- `Error onboarding school:` - This will show the actual error
- `Error stack:` - This will show the stack trace
- `Error name:` - This will show the error type

### Step 2: Enable Development Mode
Make sure your `.env` file has:
```env
NODE_ENV=development
```

This will show detailed error messages in the API response.

### Step 3: Check Common Issues

1. **Duplicate Email/Contact**
   - Institution email or contact number already exists
   - Admin email or phone already exists
   - You'll get a 409 Conflict error (not 500)

2. **Database Connection**
   - Make sure MongoDB is running
   - Check `DBCONNECTIONURL` in `.env`

3. **Required Fields Missing**
   - Check that all required fields are provided
   - Validation errors will return 400 (not 500)

4. **Unique Constraint Violations**
   - Email, Contact_Number, or Instution_Id might already exist
   - Check database for existing records

## 📋 Correct API Usage

### URL:
```
POST http://localhost:8001/EducationalEternity/onboard/school
```

### Headers:
```
Content-Type: application/json
Authorization: Bearer YOUR_SUPERADMIN_TOKEN
```

### Body:
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

## 🔧 Next Steps

1. **Restart your server** to apply the fixes
2. **Check server console** for detailed error logs
3. **Set NODE_ENV=development** in `.env` to see detailed errors
4. **Try the request again** and check the error message

## 📝 Expected Error Responses

### 400 - Validation Error
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["Institution name is required (minimum 3 characters)"],
  "code": 400
}
```

### 409 - Duplicate Entry
```json
{
  "success": false,
  "message": "Institution with this email or contact number already exists",
  "code": 409
}
```

### 500 - Server Error (with NODE_ENV=development)
```json
{
  "success": false,
  "message": "Failed to onboard school",
  "error": "Actual error message here",
  "code": 500,
  "details": "Full stack trace",
  "errorName": "ErrorType"
}
```

## 🆘 Still Getting 500?

1. Check server console logs - they will show the exact error
2. Verify database connection is working
3. Check that all models are properly loaded
4. Verify the token is valid and not expired
5. Make sure you're using the correct URL (port 8001, base `/EducationalEternity`)

---

**The error message in the response will now be more detailed. Check your server console for the full error details.**

