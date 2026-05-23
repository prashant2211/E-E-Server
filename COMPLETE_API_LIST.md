# Complete API List - Educational Eternity Backend

## 📋 All Available APIs

### Base URL: `/api`

---

## 🔐 Authentication APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | User login |
| POST | `/api/user-register` | User registration |
| POST | `/api/forgot-password` | Password reset request |
| POST | `/api/otp-verification` | Verify OTP |
| POST | `/api/refresh-token` | Refresh JWT token |
| POST | `/api/update-password` | Update password |

---

## 👥 Student Management APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/student/get-all-student` | Get all students (paginated) |
| GET | `/api/student/get-byid-student` | Get student by ID |
| GET | `/api/student/get-all-student-list` | Get student list (dropdown) |
| GET | `/api/student/getStudent` | Get student by registration number |
| GET | `/api/student/getStudentProfile` | Get student profile |
| POST | `/api/student/student-Register` | Register new student |
| PATCH | `/api/student/update` | Update student |
| PATCH | `/api/student/deactivate-student` | Activate/Deactivate student |
| DELETE | `/api/student/delete` | Delete student |

---

## 🏫 Class Management APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/class/get-all-class` | Get all classes |
| GET | `/api/class/get-byid-class` | Get class by ID |
| POST | `/api/class/class-Register` | Create class |
| PATCH | `/api/class/update` | Update class |
| DELETE | `/api/class/delete` | Delete class |

---

## 👨‍🏫 Teacher Management APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teacher/get-all-teacher` | Get all teachers |
| GET | `/api/teacher/get-byid-teacher` | Get teacher by ID |
| POST | `/api/teacher/teacher-Register` | Register teacher |
| PATCH | `/api/teacher/update` | Update teacher |
| DELETE | `/api/teacher/delete` | Delete teacher |

---

## 📅 Attendance Management APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attendenceRecord/get-all-attendenceRecord` | Get all attendance records |
| GET | `/api/attendenceRecord/get-byid-attendenceRecord` | Get attendance by ID |
| POST | `/api/attendenceRecord/add-attendenceRecord` | Mark attendance |
| PATCH | `/api/attendenceRecord/update` | Update attendance |
| DELETE | `/api/attendenceRecord/delete` | Delete attendance |

---

## 💰 Fee Management APIs

### Fee Payment
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feePayment/get-all-feePayment` | Get all fee payments |
| GET | `/api/feePayment/get-byid-feePayment` | Get payment by ID |
| POST | `/api/feePayment/add-feePayment` | Create fee payment |
| PATCH | `/api/feePayment/update` | Update payment |
| DELETE | `/api/feePayment/delete` | Delete payment |

### Fee Structure
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feeStructure/get-all-feeStructure` | Get all fee structures |
| POST | `/api/feeStructure/add-feeStructure` | Create fee structure |
| PATCH | `/api/feeStructure/update` | Update fee structure |

---

## 📚 Library Management APIs (NEW)

### Books
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/library/get-all-books` | Get all books (paginated) |
| GET | `/api/library/get-byid-book` | Get book by ID |
| POST | `/api/library/add-book` | Add new book |
| PATCH | `/api/library/update-book` | Update book |
| DELETE | `/api/library/delete-book` | Delete book |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/library/issue-book` | Issue book to student |
| POST | `/api/library/return-book` | Return book |
| GET | `/api/library/get-all-transactions` | Get all transactions |

---

## 🚌 Transport Management APIs (NEW)

### Vehicles
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transport/get-all-vehicles` | Get all vehicles |
| POST | `/api/transport/add-vehicle` | Add vehicle |
| PATCH | `/api/transport/update-vehicle` | Update vehicle |
| DELETE | `/api/transport/delete-vehicle` | Delete vehicle |

### Drivers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transport/get-all-drivers` | Get all drivers |
| POST | `/api/transport/add-driver` | Add driver |

### Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transport/get-all-routes` | Get all routes |
| POST | `/api/transport/add-route` | Add route |

### Student Assignment
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transport/assign-transport` | Assign transport to student |
| GET | `/api/transport/get-student-transport` | Get student transport details |

---

## 🏠 Hostel Management APIs (NEW)

### Rooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hostel/get-all-rooms` | Get all rooms |
| POST | `/api/hostel/add-room` | Add room |
| PATCH | `/api/hostel/update-room` | Update room |

### Allocation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/hostel/allocate-room` | Allocate room to student |
| POST | `/api/hostel/release-room` | Release room |
| GET | `/api/hostel/get-student-allocation` | Get student allocation |

### Maintenance
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/hostel/create-maintenance` | Create maintenance request |
| GET | `/api/hostel/get-all-maintenance` | Get all maintenance requests |
| PATCH | `/api/hostel/update-maintenance` | Update maintenance status |

---

## 📝 Homework/Assignments APIs (NEW)

### Homework
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/homework/get-all-homework` | Get all homework |
| POST | `/api/homework/create-homework` | Create homework |
| PATCH | `/api/homework/update-homework` | Update homework |
| DELETE | `/api/homework/delete-homework` | Delete homework |

### Submissions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/homework/submit-homework` | Submit homework |
| PATCH | `/api/homework/grade-homework` | Grade homework |
| GET | `/api/homework/get-student-submissions` | Get student submissions |
| GET | `/api/homework/get-homework-submissions` | Get submissions for homework |

---

## 📊 Reports & Analytics APIs (NEW)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/attendance-report` | Get attendance report |
| GET | `/api/reports/fee-collection-report` | Get fee collection report |
| GET | `/api/reports/academic-report` | Get academic performance report |
| GET | `/api/reports/student-statistics` | Get student statistics |
| GET | `/api/reports/dashboard-data` | Get dashboard data |

---

## ⚙️ System Configuration APIs (NEW)

### Academic Year
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/system-config/get-all-academic-years` | Get all academic years |
| GET | `/api/system-config/get-current-academic-year` | Get current academic year |
| POST | `/api/system-config/create-academic-year` | Create academic year |
| PATCH | `/api/system-config/update-academic-year` | Update academic year |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/system-config/get-settings` | Get system settings |
| PATCH | `/api/system-config/update-settings` | Update system settings |

---

## 📢 Announcement APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/announcement/get-announcement` | Get announcements |
| POST | `/api/announcement/add-announcement` | Create announcement |
| DELETE | `/api/announcement/delete-announcement` | Delete announcement |

---

## 📅 Holiday Management APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/holidays/get-holidays` | Get holidays |
| POST | `/api/holidays/add-holidays` | Add holidays |

---

## 📚 Timetable APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scheduleClass/show` | Get scheduled classes |
| POST | `/api/scheduleClass/store` | Create schedule |
| POST | `/api/scheduleClass/delete` | Delete schedule |

---

## 📊 Academic/Marks APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/academic/get-all-marksheet` | Get all marksheets |
| GET | `/api/academic/get-byid-marksheet` | Get marksheet by ID |
| GET | `/api/academic/get-student-marks` | Get student marks |
| POST | `/api/academic/add-marks` | Add marks |
| POST | `/api/academic/store-marks` | Store marks |
| PATCH | `/api/academic/update-marks` | Update marks |
| POST | `/api/academic/publish-marks` | Publish marks |

---

## 📈 Dashboard APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/get-admin-dashboard` | Get admin dashboard |
| GET | `/api/dashboard/get-student-dashboard` | Get student dashboard |
| GET | `/api/dashboard/get-teacher-dashboard` | Get teacher dashboard |
| GET | `/api/dashboard/get-statistics` | Get statistics |

---

## 🏥 Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |

---

## 📊 API Statistics

- **Total Endpoints**: 100+
- **New APIs Added**: 40+
- **Features Covered**: All requested features
- **Status**: ✅ Complete

---

## 🔒 Authentication

All protected endpoints require:
```
Authorization: Bearer <token>
```

---

**Last Updated**: January 2024

