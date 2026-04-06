const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const studentModel = require('../models/studentModel');

async function checkStudentRegNumbers() {
    try {
        const mongoUri = process.env.DBCONNECTIONURL || 'mongodb://localhost:27017/EducationalEternity';
        console.log('Connecting to MongoDB...');
        
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // Get all students
        const students = await studentModel.find({})
            .select('Registration_Number Class Class_Code Section SectionCode InstutionCode First_Name Last_Name')
            .sort({ Registration_Number: 1 })
            .lean();

        console.log(`📊 Total Students: ${students.length}\n`);

        // Group by pattern
        const year = new Date().getFullYear().toString().slice(-2);
        const patterns = {};

        students.forEach(student => {
            const regNum = student.Registration_Number || '';
            if (regNum.startsWith(year)) {
                // Extract pattern (everything except last 3 digits)
                const pattern = regNum.slice(0, -3);
                const sequence = regNum.slice(-3);
                
                if (!patterns[pattern]) {
                    patterns[pattern] = [];
                }
                patterns[pattern].push({
                    regNum,
                    sequence: parseInt(sequence),
                    class: student.Class,
                    classCode: student.Class_Code,
                    section: student.Section,
                    sectionCode: student.SectionCode,
                    name: `${student.First_Name} ${student.Last_Name}`,
                    instutionCode: student.InstutionCode
                });
            }
        });

        // Display results
        console.log('📋 Registration Number Patterns:\n');
        Object.keys(patterns).sort().forEach(pattern => {
            const students = patterns[pattern];
            students.sort((a, b) => a.sequence - b.sequence);
            console.log(`Pattern: ${pattern}XXX`);
            console.log(`  Count: ${students.length}`);
            console.log(`  Sequences: ${students.map(s => s.sequence.toString().padStart(3, '0')).join(', ')}`);
            students.forEach(s => {
                console.log(`    - ${s.regNum}: ${s.name} (Class: ${s.class || 'N/A'}, Section: ${s.section || 'N/A'})`);
            });
            console.log('');
        });

        // Check for "3rd" class specifically
        console.log('\n🔍 Checking "3rd" class students:\n');
        const thirdClassStudents = students.filter(s => 
            s.Class && s.Class.toLowerCase().includes('3rd') ||
            s.Registration_Number && s.Registration_Number.includes('3rd')
        );
        
        if (thirdClassStudents.length > 0) {
            console.log(`Found ${thirdClassStudents.length} student(s) in 3rd class:\n`);
            thirdClassStudents.forEach(s => {
                console.log(`  - ${s.Registration_Number}: ${s.First_Name} ${s.Last_Name}`);
                console.log(`    Class: ${s.Class || 'N/A'}, ClassCode: ${s.Class_Code || 'N/A'}`);
                console.log(`    Section: ${s.Section || 'N/A'}, SectionCode: ${s.SectionCode || 'N/A'}`);
                console.log(`    InstutionCode: ${s.InstutionCode || 'N/A'}\n`);
            });
        } else {
            console.log('No students found in 3rd class\n');
        }

    } catch (error) {
        console.error('\n❌ Error:', error);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log('✅ Connection closed');
    }
}

checkStudentRegNumbers()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));

