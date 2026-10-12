const mongoose = require('mongoose');
require('dotenv').config();

const classModel = require('../models/classModel');

async function fixClassCodeIndex() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.DBCONNECTIONURL;
        if (!mongoUri) {
            console.error('DBCONNECTIONURL not set in .env file!');
            process.exit(1);
        }

        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('classes');

        // Get all indexes
        console.log('\n📊 Current indexes on classes collection:');
        const indexes = await collection.indexes();
        indexes.forEach(index => {
            console.log(`  - ${index.name}:`, JSON.stringify(index.key));
        });

        // Check if old Class_Code index exists
        const oldIndex = indexes.find(idx => idx.name.includes('Class_Code') || Object.keys(idx.key).includes('Class_Code'));
        
        if (oldIndex) {
            console.log('\n⚠️  Found old Class_Code index. Dropping it...');
            try {
                await collection.dropIndex(oldIndex.name);
                console.log(`✅ Dropped old index: ${oldIndex.name}`);
            } catch (err) {
                console.error('Error dropping old index:', err.message);
            }
        }

        // Check if ClassCode index exists
        const classCodeIndex = indexes.find(idx => 
            idx.name.includes('ClassCode') || 
            Object.keys(idx.key).includes('ClassCode') ||
            idx.name === 'ClassCode_unique_index'
        );

        if (!classCodeIndex) {
            console.log('\n📝 Creating ClassCode unique index...');
            try {
                await collection.createIndex({ ClassCode: 1 }, { unique: true, name: 'ClassCode_unique_index' });
                console.log('✅ Created ClassCode unique index');
            } catch (err) {
                console.error('Error creating ClassCode index:', err.message);
            }
        } else {
            console.log('\n✅ ClassCode index already exists');
        }

        // List all classes to verify
        console.log('\n📋 All classes in database:');
        const allClasses = await classModel.find({}).select('ClassName ClassCode InstutionCode Session').lean();
        console.log(`Total classes: ${allClasses.length}`);
        allClasses.forEach(cls => {
            console.log(`  - ${cls.ClassName} → ${cls.ClassCode} (${cls.InstutionCode}, ${cls.Session})`);
        });

        // Check for duplicates
        console.log('\n🔍 Checking for duplicate ClassCodes...');
        const classCodes = allClasses.map(c => c.ClassCode);
        const duplicates = classCodes.filter((code, index) => classCodes.indexOf(code) !== index);
        if (duplicates.length > 0) {
            console.log('⚠️  Found duplicate ClassCodes:', duplicates);
        } else {
            console.log('✅ No duplicate ClassCodes found');
        }

        await mongoose.connection.close();
        console.log('\n✅ Done!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixClassCodeIndex();

