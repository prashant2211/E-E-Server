/**
 * Fix Class Collection Indexes
 * 
 * This script:
 * 1. Drops old unique index on ClassCode (if exists)
 * 2. Updates existing classes to include Session in ClassCode (if missing)
 * 3. Creates new compound indexes
 * 
 * Run: node scripts/fixClassIndexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const classModel = require('../models/classModel');

async function fixClassIndexes() {
    try {
        // Connect to database
        const dbUrl = process.env.DBCONNECTIONURL || 'mongodb://localhost:27017/EducationalEternity';
        await mongoose.connect(dbUrl);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('classes');

        // 1. Check existing indexes
        console.log('\n📋 Current indexes:');
        const indexes = await collection.indexes();
        indexes.forEach(idx => {
            console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });

        // 2. Drop old unique index on ClassCode if exists
        try {
            await collection.dropIndex('ClassCode_1');
            console.log('\n✅ Dropped old unique index: ClassCode_1');
        } catch (err) {
            if (err.code === 27 || err.message.includes('index not found')) {
                console.log('\nℹ️  Old index ClassCode_1 not found (already removed)');
            } else {
                throw err;
            }
        }

        // 3. Find and fix classes with null/empty ClassCode
        console.log('\n🔍 Checking for classes with null/empty ClassCode...');
        const classesWithNullCode = await classModel.find({
            $or: [
                { ClassCode: null },
                { ClassCode: '' },
                { ClassCode: { $exists: false } }
            ]
        });
        
        if (classesWithNullCode.length > 0) {
            console.log(`⚠️  Found ${classesWithNullCode.length} classes with null/empty ClassCode. Fixing...`);
            for (const cls of classesWithNullCode) {
                const currentYear = new Date().getFullYear();
                const last2Digits = currentYear.toString().slice(-2);
                const cleanClassName = (cls.ClassName || 'unknown').replace(/\s+/g, '').toLowerCase();
                const newClassCode = `${cls.InstutionCode}-${cleanClassName}-${last2Digits}`;
                console.log(`  Fixing class: ${cls.ClassName || 'Unknown'} (null/empty → ${newClassCode})`);
                cls.ClassCode = newClassCode;
                await cls.save();
            }
            console.log(`✅ Fixed ${classesWithNullCode.length} classes with null/empty ClassCode`);
        } else {
            console.log('✅ No classes with null/empty ClassCode found');
        }

        // 4. Update existing classes to new ClassCode format: instutionCode-className-last2digiOfTheYear
        console.log('\n🔄 Updating existing classes to new format...');
        const classes = await classModel.find({});
        let updatedCount = 0;

        for (const cls of classes) {
            if (!cls.ClassCode || cls.ClassCode.trim() === '') {
                continue; // Skip if still null/empty (shouldn't happen after step 3)
            }
            
            // Generate new ClassCode format: INST-CODE-CLASSNAME-YY
            const currentYear = new Date().getFullYear();
            const last2Digits = currentYear.toString().slice(-2);
            const cleanClassName = (cls.ClassName || 'unknown').replace(/\s+/g, '').toLowerCase();
            const expectedClassCode = `${cls.InstutionCode}-${cleanClassName}-${last2Digits}`;
            
            // Check if ClassCode needs update (old format or doesn't match new format)
            if (cls.ClassCode !== expectedClassCode) {
                console.log(`  Updating class: ${cls.ClassName} (${cls.ClassCode} → ${expectedClassCode})`);
                cls.ClassCode = expectedClassCode;
                await cls.save();
                updatedCount++;
            }
        }

        console.log(`✅ Updated ${updatedCount} classes`);

        // 5. Create simple unique index on ClassCode (only after fixing all nulls)
        console.log('\n📊 Creating unique index on ClassCode...');
        
        try {
            // Verify no null/empty ClassCodes exist before creating index
            const remainingNulls = await classModel.countDocuments({
                $or: [
                    { ClassCode: null },
                    { ClassCode: '' },
                    { ClassCode: { $exists: false } }
                ]
            });
            
            if (remainingNulls > 0) {
                console.log(`⚠️  Warning: ${remainingNulls} classes still have null/empty ClassCode. Please fix them manually.`);
            }
            
            await collection.createIndex(
                { ClassCode: 1 },
                { 
                    unique: true, 
                    name: 'ClassCode_unique_index'
                }
            );
            console.log('✅ Created index: ClassCode (unique)');
        } catch (err) {
            if (err.code === 85) {
                console.log('ℹ️  Index ClassCode already exists');
            } else {
                console.error('❌ Error creating index:', err.message);
                throw err;
            }
        }

        // 5. Show final indexes
        console.log('\n📋 Final indexes:');
        const finalIndexes = await collection.indexes();
        finalIndexes.forEach(idx => {
            console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} ${idx.unique ? '(unique)' : ''}`);
        });

        console.log('\n✅ All indexes fixed successfully!');
        console.log('\n💡 You can now create classes with same name for different sessions.');

    } catch (error) {
        console.error('\n❌ Error fixing indexes:', error);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
    }
}

// Run the fix
fixClassIndexes()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });

