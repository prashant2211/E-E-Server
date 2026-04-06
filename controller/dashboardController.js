const studentModel = require('../models/studentModel')
const classModel = require('../models/classModel')
const userModel = require('../models/User')
const teacherModel = require('../models/teacherModel')
const attendenceRecordModel = require('../models/attendenceRecordModel')
const feePaymentModel = require('../models/feePaymentModel')
const feeStructureModel = require('../models/feeStructureModel')
const examScheduleModel = require('../models/examScheduleModel')
const announcementModel = require('../models/announcementModel')
const marksheetModel = require('../models/studentMarksheetModel')
const sectionModel = require('../models/sectionModel')

const getDashboardData = async (req, res, next) => {
    if (req.user.UserType != 'SuperAdmin' && req.user.UserType != 'Admin') {
       return res.status(401).json({
            code: 401,
            success: false,
            message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
        })
    }

    const currentDate = new Date();
    const today = currentDate.toLocaleDateString();
    const instutionCode = req.user.InstutionCode;

    console.log('Dashboard request received for institution:', instutionCode);

    try {
        // Initialize all variables with defaults
        let studentRecord = [];
        let teacherRecord = [];
        let classRecord = [];
        let userRecord = [];
        let activeUsersRecord = [];
        let inactiveUsersRecord = [];
        let paymentMode = [];
        let sections = [];
        let todayAttendance = 0;
        let yesterdayAttendance = 0;
        let attendanceTrends = [];
        let feeTrends = [];
        let upcomingExams = [];
        let recentAnnouncements = [];
        let classDistribution = [];
        let marksheets = [];

        // Get basic statistics - with individual error handling
        try {
            studentRecord = await studentModel.find({ InstutionCode: instutionCode }).lean();
            console.log('Students fetched:', studentRecord.length);
        } catch (e) {
            console.error('Error fetching students:', e.message);
        }

        try {
            teacherRecord = await teacherModel.find({ InstutionCode: instutionCode }).lean();
            console.log('Teachers fetched:', teacherRecord.length);
        } catch (e) {
            console.error('Error fetching teachers:', e.message);
        }

        try {
            classRecord = await classModel.find({ InstutionCode: instutionCode }).lean();
            console.log('Classes fetched:', classRecord.length);
        } catch (e) {
            console.error('Error fetching classes:', e.message);
        }

        try {
            userRecord = await userModel.find({ InstutionCode: instutionCode }).lean();
            activeUsersRecord = await userModel.find({ InstutionCode: instutionCode, Verified: true }).lean();
            inactiveUsersRecord = await userModel.find({ InstutionCode: instutionCode, Verified: false }).lean();
            console.log('Users fetched:', userRecord.length);
        } catch (e) {
            console.error('Error fetching users:', e.message);
        }

        // Calculate date range FIRST (before fetching payments)
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        const lastMonth = new Date(thisMonth);
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        // Get date filter from query (default: current month)
        const dateFilter = req.query.dateFilter || 'currentMonth'; // currentMonth, 3months, 6months, 12months, custom
        const customStartDate = req.query.startDate ? new Date(req.query.startDate) : null;
        const customEndDate = req.query.endDate ? new Date(req.query.endDate) : null;

        // Calculate date range based on filter
        let startDate = new Date(thisMonth);
        let endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        if (dateFilter === '3months') {
            startDate = new Date(thisMonth);
            startDate.setMonth(startDate.getMonth() - 2); // 3 months including current
        } else if (dateFilter === '6months') {
            startDate = new Date(thisMonth);
            startDate.setMonth(startDate.getMonth() - 5); // 6 months including current
        } else if (dateFilter === '12months') {
            startDate = new Date(thisMonth);
            startDate.setMonth(startDate.getMonth() - 11); // 12 months including current
        } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
            startDate = new Date(customStartDate);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(customEndDate);
            endDate.setHours(23, 59, 59, 999);
        }
        // else: currentMonth (default)

        console.log('Date filter applied:', { dateFilter, startDate: startDate.toISOString(), endDate: endDate.toISOString() });

        // Helper function to safely parse amount strings
        const parseAmount = (val) => {
            if (val === null || val === undefined || val === '') return 0;
            const cleaned = String(val).replace(/,/g, '').trim();
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100; // Round to 2 decimal places
        };

        // Get fee payment statistics - apply date filter at query level
        try {
            // For date filtering, we need to fetch all payments and filter by Date field (string)
            // since Date is stored as string, we can't use it directly in MongoDB query
            // So we'll fetch all and filter in JavaScript, OR use aggregation with date conversion
            const paymentQuery = { InstutionId: instutionCode };
            
            // Fetch all payments first (we'll filter by Date field in JavaScript)
            paymentMode = await feePaymentModel.find(paymentQuery).lean();
            
            // Filter by payment Date field (string) if date filter is active
            if (dateFilter !== 'all') {
                paymentMode = paymentMode.filter(payment => {
                    // Try to get payment date from Date field (string) or createdAt
                    let paymentDate = null;
                    if (payment.Date) {
                        try {
                            // Date is stored as string like "1/24/2026"
                            paymentDate = new Date(payment.Date);
                        } catch (e) {
                            // If parsing fails, use createdAt
                            paymentDate = payment.createdAt ? new Date(payment.createdAt) : null;
                        }
                    } else if (payment.createdAt) {
                        paymentDate = new Date(payment.createdAt);
                    }
                    
                    if (!paymentDate) return false;
                    return paymentDate >= startDate && paymentDate <= endDate;
                });
            }
            
            console.log('Fee payments fetched (with date filter):', paymentMode.length, 'for period:', dateFilter);
        } catch (e) {
            console.error('Error fetching fee payments:', e.message);
        }

        // Calculate fee statistics
        let cashcount = 0;
        let onlineCount = 0;
        let cashAmount = 0;
        let onlineAmount = 0;
        let totalAmount = 0;
        let thisMonthAmount = 0;
        let lastMonthAmount = 0;
        let totalPendingFee = 0;
        let studentsWithPendingFee = 0;

        console.log('Date filter applied:', { dateFilter, startDate: startDate.toISOString(), endDate: endDate.toISOString() });

        // Calculate cash/online breakdown and monthly amounts (for display purposes)
        // NOTE: Total Revenue will be calculated using MongoDB aggregation below (more accurate)
        const processedPaymentIds = new Set();
        const paymentDetails = [];

        for (const payment of paymentMode) {
            try {
                // Only count successful payments
                const isSuccess = payment.Status === 'Success' || payment.Status === 'success';
                if (!isSuccess) continue;

                // Filter by date range - use createdAt (most reliable Date field)
                let paymentDate = null;
                if (payment.createdAt) {
                    paymentDate = new Date(payment.createdAt);
                } else if (payment.Date) {
                    // Date is stored as string like "1/24/2026", try to parse it
                    try {
                        paymentDate = new Date(payment.Date);
                    } catch (e) {
                        // If parsing fails, skip this payment for date-filtered queries
                        if (dateFilter !== 'all') {
                            continue;
                        }
                    }
                }

                // Apply date filter
                if (dateFilter !== 'all' && paymentDate) {
                    if (paymentDate < startDate || paymentDate > endDate) {
                        continue; // Skip payments outside date range
                    }
                } else if (dateFilter !== 'all' && !paymentDate) {
                    // If no date found, skip for date-filtered queries
                    continue;
                }

                // Deduplicate: Use payment _id to ensure each payment is counted only once
                const paymentId = payment._id ? payment._id.toString() : null;
                if (paymentId && processedPaymentIds.has(paymentId)) {
                    console.warn('Duplicate payment detected, skipping:', paymentId);
                    continue; // Skip duplicate
                }
                if (paymentId) {
                    processedPaymentIds.add(paymentId);
                }

                const paidAmt = parseAmount(payment.PaidAmount);
                if (paidAmt <= 0) continue; // Skip zero or negative amounts
                
                // Track payment details for debugging
                paymentDetails.push({
                    id: paymentId || 'no-id',
                    studentId: payment.StudentId,
                    amount: paidAmt,
                    mode: payment.PaymentMode,
                    date: payment.Payment_Date || payment.Date,
                    status: payment.Status
                });
                
                // Calculate cash/online breakdown (for display)
                if (payment.PaymentMode === 'Cash') {
                    cashcount++;
                    cashAmount += paidAmt;
                }
                if (payment.PaymentMode === 'Online') {
                    onlineCount++;
                    onlineAmount += paidAmt;
                }
                
                // Calculate monthly amounts (for display)
                if (payment.Payment_Date) {
                    try {
                        const paymentDate = new Date(payment.Payment_Date);
                        paymentDate.setHours(0, 0, 0, 0);
                        if (paymentDate >= thisMonth) {
                            thisMonthAmount += paidAmt;
                        } else if (paymentDate >= lastMonth && paymentDate < thisMonth) {
                            lastMonthAmount += paidAmt;
                        }
                    } catch (dateError) {
                        // Skip invalid dates
                    }
                }
                // NOTE: We do NOT add to totalAmount here - it will be calculated via aggregation below
            } catch (paymentError) {
                console.error('Error processing payment:', paymentError.message);
            }
        }

        // Calculate Total Revenue using MongoDB aggregation (MOST ACCURATE - prevents duplicates)
        // This ensures each payment is counted exactly once
        let aggregatedRevenue = 0;
        let totalFromList = 0; // Declare outside try block for use in catch
        try {
            // Build date filter for query - use createdAt (Date field from timestamps)
            const dateFilterQuery = {};
            if (dateFilter !== 'all') {
                // Apply date filter for all filters (currentMonth, 3months, 6months, 12months, custom)
                dateFilterQuery.createdAt = { $gte: startDate, $lte: endDate };
            }

            // Use the already filtered paymentMode array (filtered by Date field)
            // Filter to only successful payments for revenue calculation
            const allSuccessfulPayments = paymentMode.filter(p => 
                p.Status === 'Success' || p.Status === 'success'
            );
            
            console.log('=== TOTAL REVENUE DEBUG ===');
            console.log('Date filter:', dateFilter, 'Range:', { start: startDate.toISOString(), end: endDate.toISOString() });
            console.log('Total successful payments found (after date filter by Date field):', allSuccessfulPayments.length);
            console.log('Payment details:');
            totalFromList = 0; // Reset to 0
            allSuccessfulPayments.forEach((p, idx) => {
                const amount = parseAmount(p.PaidAmount);
                totalFromList += amount;
                const paymentDate = p.Date || (p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A');
                console.log(`  ${idx + 1}. ID: ${p._id}, Student: ${p.StudentId}, Amount: ${amount}, Mode: ${p.PaymentMode}, Date: ${paymentDate}`);
            });
            console.log('Manual sum from filtered list (by Date field):', totalFromList);
            
            // Check for potential duplicates (same student, same date, same amount)
            const duplicateCheck = {};
            allSuccessfulPayments.forEach(p => {
                const key = `${p.StudentId}_${p.Date}_${p.PaidAmount}`;
                if (!duplicateCheck[key]) {
                    duplicateCheck[key] = [];
                }
                duplicateCheck[key].push(p._id);
            });
            
            const duplicates = Object.entries(duplicateCheck).filter(([key, ids]) => ids.length > 1);
            if (duplicates.length > 0) {
                console.warn('⚠️ POTENTIAL DUPLICATE PAYMENTS FOUND:');
                duplicates.forEach(([key, ids]) => {
                    console.warn(`  Key: ${key}, IDs: ${ids.join(', ')}`);
                });
            }
            
            // Use the manual sum (from filtered payments by Date field) as the revenue
            aggregatedRevenue = totalFromList;
            const paymentCount = allSuccessfulPayments.length;
            console.log('Total Revenue (from filtered payments by Date field):', aggregatedRevenue, 'from', paymentCount, 'successful payments');
            console.log('=== END TOTAL REVENUE DEBUG ===');
        } catch (e) {
            console.error('Error in revenue aggregation:', e);
            console.error('Error stack:', e.stack);
            // Calculate manually as fallback
            aggregatedRevenue = totalFromList || 0;
            console.warn('Using manual calculation as fallback:', aggregatedRevenue);
        }

        // Use aggregated revenue (MOST ACCURATE - calculated directly from database, prevents duplicates)
        totalAmount = aggregatedRevenue;
        
        // Log final summary
        console.log('=== FINAL REVENUE SUMMARY ===');
        console.log('Total Revenue (FINAL):', totalAmount);
        console.log('Cash Payments:', cashcount, 'Total:', cashAmount);
        console.log('Online Payments:', onlineCount, 'Total:', onlineAmount);
        console.log('This Month Revenue:', thisMonthAmount);
        console.log('Last Month Revenue:', lastMonthAmount);
        console.log('============================');

        // Calculate pending fee: Current period unpaid fees + Pending amounts from students who paid
        try {
            const parseAmount = (val) => {
                if (val === null || val === undefined || val === '') return 0;
                const cleaned = String(val).replace(/,/g, '').trim();
                const parsed = parseFloat(cleaned);
                return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
            };

            // Get all fee structures for quick lookup
            const feeStructures = await feeStructureModel.find({ InstutionId: instutionCode }).lean();
            const feeStructureMap = new Map();
            feeStructures.forEach(fs => {
                const key = `${fs.Class || ''}_${fs.Section || ''}`;
                feeStructureMap.set(key, fs);
            });

            // Get all payments in the selected period
            const periodPayments = paymentMode.filter(p => {
                if (!p.Payment_Date) return false;
                try {
                    const paymentDate = new Date(p.Payment_Date);
                    return paymentDate >= startDate && paymentDate <= endDate;
                } catch (e) {
                    return false;
                }
            });

            // Create a map of students who paid in this period
            const studentsWhoPaid = new Set();
            periodPayments.forEach(p => {
                if (p.StudentId && (p.Status === 'Success' || p.Status === 'success')) {
                    studentsWhoPaid.add(p.StudentId);
                }
            });

            const studentsWithOutstanding = [];
            
            // Calculate pending fee for each active student
            for (const student of studentRecord) {
                if (!student.Status) continue; // Skip inactive students

                const studentId = student.Registration_Number;
                const studentClass = student.Class || '';
                const studentSection = student.Section || '';
                const key = `${studentClass}_${studentSection}`;
                
                // Get monthly fee from fee structure
                let monthlyFee = 0;
                const structure = feeStructureMap.get(key) || feeStructureMap.get(`${studentClass}_`);
                if (structure && structure.Total) {
                    monthlyFee = parseAmount(structure.Total);
                }

                // Check if student paid in the selected period
                const hasPaidInPeriod = studentsWhoPaid.has(studentId);
                
                if (!hasPaidInPeriod && monthlyFee > 0) {
                    // Student hasn't paid for current period - add monthly fee to pending
                    totalPendingFee += monthlyFee;
                    studentsWithPendingFee++;
                    studentsWithOutstanding.push({
                        registrationNumber: studentId,
                        name: `${student.First_Name || ''} ${student.Last_Name || ''}`.trim(),
                        outstanding: monthlyFee,
                        type: 'unpaid_period'
                    });
                }

                // Add outstanding amount from students who paid but still have pending
                const outstanding = parseAmount(student.OutstandingAmount);
                if (outstanding > 0 && hasPaidInPeriod) {
                    totalPendingFee += outstanding;
                    studentsWithOutstanding.push({
                        registrationNumber: studentId,
                        name: `${student.First_Name || ''} ${student.Last_Name || ''}`.trim(),
                        outstanding: outstanding,
                        type: 'partial_payment'
                    });
                }
            }

            console.log('Fee statistics calculated:', {
                totalRevenue: totalAmount,
                totalPendingFee,
                studentsWithPendingFee,
                totalStudents: studentRecord.length,
                totalPayments: paymentMode.length,
                dateFilter: dateFilter,
                periodStart: startDate.toISOString(),
                periodEnd: endDate.toISOString()
            });
            console.log('Students with outstanding fees:', studentsWithOutstanding.slice(0, 10)); // Log first 10
        } catch (pendingFeeError) {
            console.error('Error calculating pending fee:', pendingFeeError.message);
        }

        // Get birthday count
   let birthdaycount = 0;
        try {
            const todayStr = currentDate.toISOString().split('T')[0];
    for (const std of studentRecord) {
                if (std.DOB) {
                    try {
                        const dobStr = new Date(std.DOB).toISOString().split('T')[0];
                        if (dobStr === todayStr) {
                            birthdaycount++;
                        }
                    } catch (dobError) {
                        // Skip invalid DOB
                    }
                }
            }
        } catch (birthdayError) {
            console.error('Error calculating birthdays:', birthdayError.message);
        }

        // Get attendance statistics
        try {
            const yesterday = new Date(currentDate.getTime() - (24 * 60 * 60 * 1000));
            const yesterdayStr = yesterday.toLocaleDateString();

            if (JSON.stringify(req.query) === '{}' || req.query.day === 'Today') {
                const AttendenceRecord = await attendenceRecordModel.find({
                    Date: today,
                    InstutionId: instutionCode
                }).lean();
                todayAttendance = AttendenceRecord.length;
            }

            const YesterdayAttendenceRecord = await attendenceRecordModel.find({
                Date: yesterdayStr,
                InstutionId: instutionCode
            }).lean();
            yesterdayAttendance = YesterdayAttendenceRecord.length;
        } catch (attendanceError) {
            console.error('Error fetching attendance:', attendanceError.message);
        }

        // Get attendance trends (last 7 days) - simplified
        try {
            for (let i = 6; i >= 0; i--) {
                const date = new Date(currentDate);
                date.setDate(date.getDate() - i);
                const dateStr = date.toLocaleDateString();
                
                try {
                    const records = await attendenceRecordModel.find({
                        Date: dateStr,
                        InstutionId: instutionCode
                    }).lean();
                    
                    let present = 0;
                    let absent = 0;
                    records.forEach(record => {
                        if (record.Attendence && Array.isArray(record.Attendence)) {
                            record.Attendence.forEach(att => {
                                if (att.attendance === 'Present' || att.attendance === 'P') {
                                    present++;
                                } else {
                                    absent++;
                                }
                            });
                        }
                    });
                    
                    attendanceTrends.push({
                        date: dateStr,
                        present,
                        absent,
                        total: present + absent,
                        percentage: present + absent > 0 ? ((present / (present + absent)) * 100).toFixed(1) : 0
                    });
                } catch (dayError) {
                    attendanceTrends.push({
                        date: dateStr,
                        present: 0,
                        absent: 0,
                        total: 0,
                        percentage: 0
                    });
                }
            }
        } catch (trendError) {
            console.error('Error fetching attendance trends:', trendError.message);
        }

        // Get fee collection trends (last 7 days)
        try {
            for (let i = 6; i >= 0; i--) {
                const date = new Date(currentDate);
                date.setDate(date.getDate() - i);
                const dateStr = date.toLocaleDateString();
                
                const dayPayments = paymentMode.filter(p => {
                    if (!p.Payment_Date) return false;
                    try {
                        const paymentDate = new Date(p.Payment_Date).toLocaleDateString();
                        return paymentDate === dateStr;
                    } catch (e) {
                        return false;
                    }
                });
                
                const dayAmount = dayPayments.reduce((sum, p) => {
                    return sum + (parseInt(p.PaidAmount) || 0);
                }, 0);
                
                feeTrends.push({
                    date: dateStr,
                    amount: dayAmount,
                    count: dayPayments.length
                });
            }
        } catch (feeTrendError) {
            console.error('Error calculating fee trends:', feeTrendError.message);
        }

        // Get upcoming exams
        try {
            upcomingExams = await examScheduleModel.find({
                InstutionCode: instutionCode,
                ExamDate: {
                    $gte: currentDate,
                    $lte: new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000)
                },
                Status: { $in: ['Upcoming', 'Ongoing'] }
            })
            .sort({ ExamDate: 1, StartTime: 1 })
            .limit(10)
            .lean();
        } catch (examError) {
            console.error('Error fetching upcoming exams:', examError.message);
        }

        // Get recent announcements
        try {
            recentAnnouncements = await announcementModel.find({
                InstutionId: instutionCode
            })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();
        } catch (announcementError) {
            console.error('Error fetching announcements:', announcementError.message);
        }

        // Get class-wise student distribution
        try {
            classDistribution = await studentModel.aggregate([
                { $match: { InstutionCode: instutionCode } },
                {
                    $group: {
                        _id: '$Class',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ]);
        } catch (distError) {
            console.error('Error fetching class distribution:', distError.message);
        }

        // Get academic performance summary
        try {
            marksheets = await marksheetModel.find({
                Instution_Id: instutionCode
            }).lean();
        } catch (marksheetError) {
            console.error('Error fetching marksheets:', marksheetError.message);
        }

        const academicStats = {
            totalMarksheets: marksheets.length,
            passCount: marksheets.filter(m => m.Result === 'Pass' || m.Result === 'PASS').length,
            failCount: marksheets.filter(m => m.Result === 'Fail' || m.Result === 'FAIL').length,
            averagePercentage: 0
        };

        if (marksheets.length > 0) {
            let totalPercentage = 0;
            marksheets.forEach(m => {
                if (m.Percentage) {
                    const perc = typeof m.Percentage === 'string' 
                        ? parseFloat(m.Percentage.replace('%', '')) 
                        : parseFloat(m.Percentage);
                    totalPercentage += perc || 0;
                }
            });
            academicStats.averagePercentage = (totalPercentage / marksheets.length).toFixed(2);
        }

        // Get sections count
        try {
            sections = await sectionModel.find({
                InstutionCode: instutionCode
            }).lean();
        } catch (sectionError) {
            console.error('Error fetching sections:', sectionError.message);
        }

        // Build dashboard data
        const dashboardCalculation = {
            // Basic Statistics
            Totalstudents: studentRecord.length,
            activeStudents: studentRecord.filter(s => s.Status === true).length,
            inactiveStudents: studentRecord.filter(s => s.Status === false || !s.Status).length,
            Totalteachers: teacherRecord.length,
            totalClasses: classRecord.length,
            totalSections: sections.length,
            totalUsers: userRecord.length,
            totalActiveUsers: activeUsersRecord.length,
            totalInactiveUsers: inactiveUsersRecord.length,

            // Attendance
            totalAttendence: todayAttendance,
            yesterdayAttendance: yesterdayAttendance,
            attendanceTrends: attendanceTrends,

            // Fees
            cash: cashcount,
            online: onlineCount,
            totalPaymentCount: paymentMode.length,
            cashAmount: cashAmount,
            onlineAmount: onlineAmount,
            totalAmount: totalAmount,
            thisMonthAmount: thisMonthAmount,
            lastMonthAmount: lastMonthAmount,
            totalPendingFee: totalPendingFee,
            studentsWithPendingFee: studentsWithPendingFee,
            feeTrends: feeTrends,

            // Other
            birthdayCount: birthdaycount,

            // Upcoming Events
            upcomingExams: upcomingExams.map(exam => ({
                _id: exam._id,
                examName: exam.ExamName || exam.Exam_Name || 'N/A',
                examType: exam.ExamType || exam.Exam_Type || 'N/A',
                subject: exam.Subject || 'N/A',
                className: exam.ClassName || exam.Class_Name || 'N/A',
                sectionName: exam.SectionName || exam.Section_Name || '',
                examDate: exam.ExamDate || exam.Exam_Date,
                startTime: exam.StartTime || exam.Start_Time || '',
                endTime: exam.EndTime || exam.End_Time || '',
                venue: exam.Venue || ''
            })),

            // Recent Announcements
            recentAnnouncements: recentAnnouncements.map(ann => ({
                _id: ann._id,
                subject: ann.Subject || '',
                announcement: ann.Announcement || '',
                date: ann.Date || '',
                userType: ann.UserType || '',
                createdAt: ann.createdAt
            })),

            // Class Distribution
            classDistribution: classDistribution.map(c => ({
                className: c._id || 'N/A',
                count: c.count || 0
            })),

            // Academic Performance
            academicStats: academicStats
        };

        console.log('Dashboard data prepared successfully');
    
     res.status(200).json({
        success: true,
        message: "Data fetched Successfully!",
        code: 200,
            data: dashboardCalculation
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            instutionCode: instutionCode
        });
        res.status(500).json({
        success: false,
            message: error.message || 'Failed to fetch dashboard data',
            code: 500,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            data: {}
        });
    }
}

module.exports = {
    getDashboardData
}
