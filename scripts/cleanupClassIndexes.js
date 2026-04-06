const mongoose = require('mongoose');
require('dotenv').config();

const classModel = require('../models/classModel');

async function cleanupClassIndexes() {
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
            console.log(`  - ${index.name}:`, JSON.stringify(index.key), index.unique ? '(unique)' : '');
        });

        // Drop ALL indexes except _id
        console.log('\n🗑️  Dropping all indexes except _id...');
        for (const index of indexes) {
            if (index.name !== '_id_') {
                try {
                    await collection.dropIndex(index.name);
                    console.log(`✅ Dropped index: ${index.name}`);
                } catch (err) {
                    if (err.code === 27 || err.message.includes('index not found')) {
                        console.log(`ℹ️  Index ${index.name} not found (already removed)`);
                    } else {
                        console.error(`❌ Error dropping ${index.name}:`, err.message);
                    }
                }
            }
        }

        // Show final indexes
        console.log('\n📋 Final indexes:');
        const finalIndexes = await collection.indexes();
        finalIndexes.forEach(index => {
            console.log(`  - ${index.name}:`, JSON.stringify(index.key));
        });

        console.log('\n✅ All indexes cleaned up! ClassCode uniqueness will be enforced at application level.');

    } catch (error) {
        console.error('\n❌ Error cleaning up indexes:', error);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
    }
}

// Run the cleanup
cleanupClassIndexes()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });

