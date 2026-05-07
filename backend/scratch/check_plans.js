
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const SubscriptionPlanSchema = new mongoose.Schema({}, { strict: false });
const SubscriptionPlan = mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);

async function checkPlans() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI not found in .env');
      return;
    }
    await mongoose.connect(mongoUri, { dbName: process.env.MONGO_DB || 'swm' });
    console.log('Connected to MongoDB');
    
    const plans = await SubscriptionPlan.find({}).lean();
    console.log('--- Current Subscription Plans ---');
    console.log(JSON.stringify(plans, null, 2));
    console.log('---------------------------------');
    console.log(`Total Plans found: ${plans.length}`);
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkPlans();
