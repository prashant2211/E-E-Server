const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function dropOldIndexes() {
    try {
        const mongoUri = process.env.DBCONNECTIONURL || 'mongodb://localhost:27017/EducationalEternity';
        console.log('Connecting to MongoDB...');
        
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('classes');

        // Get all indexes
        console.log('\n📊 Current indexes:');
        const indexes = await collection.indexes();
        indexes.forEach(index => {
            console.log(`  - ${index.name}:`, JSON.stringify(index.key), index.unique ? '(unique)' : '');
        });

        // Drop old Class_Code index if exists
        const oldIndexes = indexes.filter(idx => 
            idx.name.includes('Class_Code') || 
            (idx.key && Object.keys(idx.key).includes('Class_Code'))
        );

        if (oldIndexes.length > 0) {
            console.log('\n🗑️  Dropping old Class_Code indexes...');
            for (const idx of oldIndexes) {
                try {
                    await collection.dropIndex(idx.name);
                    console.log(`✅ Dropped: ${idx.name}`);
                } catch (err) {
                    console.log(`⚠️  Could not drop ${idx.name}: ${err.message}`);
                }
            }
        } else {
            console.log('\n✅ No old Class_Code indexes found');
        }

        // Drop ClassCode unique index if exists (we'll enforce uniqueness at app level)
        const classCodeIndexes = indexes.filter(idx => 
            (idx.key && idx.key.ClassCode === 1 && idx.unique) ||
            idx.name === 'ClassCode_unique_index'
        );

        if (classCodeIndexes.length > 0) {
            console.log('\n🗑️  Dropping ClassCode unique indexes...');
            for (const idx of classCodeIndexes) {
                try {
                    await collection.dropIndex(idx.name);
                    console.log(`✅ Dropped: ${idx.name}`);
                } catch (err) {
                    console.log(`⚠️  Could not drop ${idx.name}: ${err.message}`);
                }
            }
        }

        // Show final indexes
        console.log('\n📋 Final indexes:');
        const finalIndexes = await collection.indexes();
        finalIndexes.forEach(index => {
            console.log(`  - ${index.name}:`, JSON.stringify(index.key));
        });

        console.log('\n✅ Index cleanup complete!');

    } catch (error) {
        console.error('\n❌ Error:', error);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log('✅ Connection closed');
    }
}

dropOldIndexes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));

