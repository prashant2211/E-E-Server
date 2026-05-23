# API Documentation - Educational Eternity

## Base URL
```
http://localhost:5000/api
```

## Authentication

All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "code": 200,
  "data": {},
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "code": 400,
  "errors": []
}
```

### Paginated Response
```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "code": 200,
  "data": [],
  "pagination": {
    "currentPage": 1,
    "pageSize": 10,
    "totalRecords": 100,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

## Authentication Endpoints

### Login
```http
POST /api/login
Content-Type: application/json

{
  "username": "admin@example.com",
  "password": "password123",
  "userType": "Admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "code": 200,
  "data": {
    "token": "jwt-token",
    "refreshtoken": "refresh-token",
    "user": {
      "_id": "user-id",
      "FirstName": "Admin",
      "LastName": "User",
      "Email": "admin@example.com",
      "UserType": "Admin",
      "InstutionCode": "EE001"
    }
  }
}
```

### Register User
```http
POST /api/user-register
Content-Type: application/json

{
  "FirstName": "John",
  "LastName": "Doe",
  "Email": "john@example.com",
  "Phone": "+91 9876543210",
  "UserName": "johndoe",
  "Password": "password123",
  "UserType": "Student",
  "MemberId": "ST001",
  "InstutionCode": "EE001"
}
```

### Forgot Password
```http
POST /api/forgot-password
Content-Type: application/json

{
  "username": "user@example.com"
}
```

### Verify OTP
```http
POST /api/otp-verification
Content-Type: application/json

{
  "otp": "123456"
}
```

### Refresh Token
```http
POST /api/refresh-token
Content-Type: application/json

{
  "refreshtoken": "refresh-token"
}
```

---

## Student Endpoints

### Get All Students
```http
GET /api/student/get-all-student?PageNumber=1&PageSize=10&SearchText=john&status=Active
Authorization: Bearer <token>
```

**Query Parameters:**
- `PageNumber` (optional): Page number (default: 1)
- `PageSize` (optional): Items per page (default: 10, max: 100)
- `SearchText` (optional): Search in name, email, registration number
- `status` (optional): Filter by status (Active/Inactive)

**Response:**
```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "code": 200,
  "data": [
    {
      "_id": "student-id",
      "First_Name": "John",
      "Last_Name": "Doe",
      "Registration_Number": "24A001",
      "Class": "10th A",
      "Email": "john@example.com",
      "Contact_Number": "+91 9876543210",
      "Status": true
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 10,
    "totalRecords": 50,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Get Student by ID
```http
GET /api/student/get-byid-student?studentId=student-id
Authorization: Bearer <token>
```

### Get Student List (for dropdowns)
```http
GET /api/student/get-all-student-list?Class=10th A
Authorization: Bearer <token>
```

### Get Student by Registration Number
```http
GET /api/student/getStudent?registrationNumber=24A001
Authorization: Bearer <token>
```

### Get Student Profile
```http
GET /api/student/getStudentProfile?registrationNumber=24A001
Authorization: Bearer <token>
```

### Register Student
```http
POST /api/student/student-Register
Authorization: Bearer <token>
Content-Type: application/json

{
  "First_Name": "John",
  "Last_Name": "Doe",
  "Class": "10th A",
  "Class_Code": "10A",
  "Email": "john@example.com",
  "Contact_Number": "+91 9876543210",
  "Father_Name": "Father Name",
  "Mother_Name": "Mother Name",
  "DOB": "2010-01-15",
  "Gender": "Male",
  "Address": "123 Street",
  "State": "State",
  "District": "District",
  "Adhar": "123456789012",
  "Password": "password123"
}
```

### Update Student
```http
PATCH /api/student/update
Authorization: Bearer <token>
Content-Type: application/json

{
  "studentId": "student-id",
  "First_Name": "Updated Name",
  "Email": "updated@example.com"
}
```

### Deactivate/Activate Student
```http
PATCH /api/student/deactivate-student
Authorization: Bearer <token>
Content-Type: application/json

{
  "studentId": "student-id",
  "status": false
}
```

### Delete Student
```http
DELETE /api/student/delete
Authorization: Bearer <token>
Content-Type: application/json

{
  "studentId": "student-id"
}
```

---

## Class Endpoints

### Get All Classes
```http
GET /api/class/get-all-class
Authorization: Bearer <token>
```

### Get Class by ID
```http
GET /api/class/get-byid-class?classId=class-id
Authorization: Bearer <token>
```

### Create Class
```http
POST /api/class/class-Register
Authorization: Bearer <token>
Content-Type: application/json

{
  "Class_Name": "10th A",
  "Class_Code": "10A",
  "InstutionCode": "EE001"
}
```

---

## Teacher Endpoints

### Get All Teachers
```http
GET /api/teacher/get-all-teacher?PageNumber=1&PageSize=10
Authorization: Bearer <token>
```

### Get Teacher by ID
```http
GET /api/teacher/get-byid-teacher?teacherId=teacher-id
Authorization: Bearer <token>
```

### Register Teacher
```http
POST /api/teacher/teacher-Register
Authorization: Bearer <token>
Content-Type: application/json

{
  "First_Name": "Teacher",
  "Last_Name": "Name",
  "Email": "teacher@example.com",
  "Contact_Number": "+91 9876543210",
  "Subject": "Mathematics",
  "Qualification": "M.Sc",
  "Experience": "5 years"
}
```

---

## Attendance Endpoints

### Get All Attendance Records
```http
GET /api/attendenceRecord/get-all-attendenceRecord?PageNumber=1&PageSize=10
Authorization: Bearer <token>
```

### Mark Attendance
```http
POST /api/attendenceRecord/add-attendenceRecord
Authorization: Bearer <token>
Content-Type: application/json

{
  "Class": "10th A",
  "Date": "2024-01-15",
  "InstutionCode": "EE001",
  "students": [
    {
      "Registration_Number": "24A001",
      "Status": "Present"
    }
  ]
}
```

---

## Fee Endpoints

### Get All Fee Payments
```http
GET /api/feePayment/get-all-feePayment?PageNumber=1&PageSize=10
Authorization: Bearer <token>
```

### Create Fee Payment
```http
POST /api/feePayment/add-feePayment
Authorization: Bearer <token>
Content-Type: application/json

{
  "Registration_Number": "24A001",
  "Amount": 5000,
  "Payment_Date": "2024-01-15",
  "Payment_Mode": "Online",
  "InstutionCode": "EE001"
}
```

### Get Fee Structure
```http
GET /api/feeStructure/get-all-feeStructure
Authorization: Bearer <token>
```

---

## Announcement Endpoints

### Get Announcements
```http
GET /api/announcement/get-announcement?InstutionCode=EE001&UserType=All
Authorization: Bearer <token>
```

### Create Announcement
```http
POST /api/announcement/add-announcement
Authorization: Bearer <token>
Content-Type: application/json

{
  "InstutionId": "EE001",
  "Subject": "Important Notice",
  "Announcement": "Message content",
  "Date": "2024-01-15",
  "UserType": "All"
}
```

---

## Timetable Endpoints

### Get Scheduled Classes
```http
GET /api/scheduleClass/show
Authorization: Bearer <token>
```

### Create Schedule
```http
POST /api/scheduleClass/store
Authorization: Bearer <token>
Content-Type: application/json

{
  "instutionId": "EE001",
  "classes": "10th A",
  "subject": "Mathematics",
  "period": 1,
  "date": "2024-01-15",
  "time": "09:00",
  "teacherName": "Teacher Name",
  "teacherId": "teacher-id"
}
```

---

## Marks Endpoints

### Get All Marksheets
```http
GET /api/academic/get-all-marksheet?PageNumber=1&PageSize=10
Authorization: Bearer <token>
```

### Get Student Marks
```http
GET /api/academic/get-student-marks?registrationNumber=24A001
Authorization: Bearer <token>
```

### Add Marks
```http
POST /api/academic/add-marks
Authorization: Bearer <token>
Content-Type: application/json

{
  "Student_Id": "student-id",
  "Class": "10th A",
  "Instution_Id": "EE001",
  "Subject": "Mathematics",
  "Total_Marks": 100,
  "Obtained_Marks": 85,
  "Exam_type": "Mid Term",
  "Year": "2024"
}
```

---

## Dashboard Endpoints

### Get Admin Dashboard
```http
GET /api/dashboard/get-admin-dashboard
Authorization: Bearer <token>
```

### Get Student Dashboard
```http
GET /api/dashboard/get-student-dashboard?registrationNumber=24A001
Authorization: Bearer <token>
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

---

## Rate Limiting

- **Limit**: 100 requests per 15 minutes per IP
- **Header**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Pagination

All list endpoints support pagination:
- `PageNumber`: Page number (default: 1)
- `PageSize`: Items per page (default: 10, max: 100)

---

## Search

Many endpoints support search via `SearchText` parameter:
- Searches across multiple fields
- Case-insensitive
- Partial matching

---

**Last Updated**: January 2024

