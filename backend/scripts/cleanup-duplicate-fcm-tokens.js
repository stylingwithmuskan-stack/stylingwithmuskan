/**
 * Cleanup script to remove duplicate FCM tokens with different platforms
 * Keeps the most recent entry for each unique token
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Import models after env is loaded
const User = (await import('../src/models/User.js')).default;
const ProviderAccount = (await import('../src/models/ProviderAccount.js')).default;
const Vendor = (await import('../src/models/Vendor.js')).default;
const AdminAccount = (await import('../src/models/AdminAccount.js')).default;

const MONGO_URI = process.env.MONGO_URI;

async function cleanupDuplicates(Model, modelName) {
  console.log(`\n🔍 Checking ${modelName} for duplicate FCM tokens...`);
  
  const documents = await Model.find({ 'fcmTokens.0': { $exists: true } });
  console.log(`Found ${documents.length} ${modelName} documents with FCM tokens`);
  
  let totalCleaned = 0;
  
  for (const doc of documents) {
    if (!doc.fcmTokens || doc.fcmTokens.length <= 1) continue;
    
    // Group tokens by token+platform combination
    const tokenMap = new Map();
    
    for (const fcmToken of doc.fcmTokens) {
      const key = `${fcmToken.token}::${fcmToken.platform}`;
      const existing = tokenMap.get(key);
      
      if (!existing) {
        tokenMap.set(key, fcmToken);
      } else {
        // Keep the one with the most recent lastSeenAt
        if (new Date(fcmToken.lastSeenAt) > new Date(existing.lastSeenAt)) {
          tokenMap.set(key, fcmToken);
        }
      }
    }
    
    // If we found duplicates (same token+platform combination)
    if (tokenMap.size < doc.fcmTokens.length) {
      const uniqueTokens = Array.from(tokenMap.values());
      const removed = doc.fcmTokens.length - uniqueTokens.length;
      
      console.log(`  📝 ${modelName} ${doc._id}: Removing ${removed} duplicate(s)`);
      console.log(`     Before: ${doc.fcmTokens.length} tokens`);
      console.log(`     After: ${uniqueTokens.length} tokens`);
      
      // Show breakdown by platform
      const platformCount = uniqueTokens.reduce((acc, t) => {
        acc[t.platform] = (acc[t.platform] || 0) + 1;
        return acc;
      }, {});
      console.log(`     Platforms:`, platformCount);
      
      // Update the document
      await Model.updateOne(
        { _id: doc._id },
        { $set: { fcmTokens: uniqueTokens } }
      );
      
      totalCleaned += removed;
    }
  }
  
  console.log(`✅ Cleaned ${totalCleaned} duplicate tokens from ${modelName}`);
  return totalCleaned;
}

async function main() {
  try {
    console.log('🚀 Starting FCM token cleanup...');
    console.log('📡 Connecting to MongoDB:', MONGO_URI.replace(/\/\/.*@/, '//***@'));
    
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    let totalCleaned = 0;
    
    totalCleaned += await cleanupDuplicates(User, 'User');
    totalCleaned += await cleanupDuplicates(ProviderAccount, 'ProviderAccount');
    totalCleaned += await cleanupDuplicates(Vendor, 'Vendor');
    totalCleaned += await cleanupDuplicates(AdminAccount, 'AdminAccount');
    
    console.log(`\n🎉 Cleanup complete! Removed ${totalCleaned} duplicate tokens in total.`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

main();
