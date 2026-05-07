import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB || 'swm';
  const connectionString = uri.includes('?') ? uri.replace('?', `${dbName}?`) : `${uri}/${dbName}`;

  await mongoose.connect(connectionString);
  const ProviderAccount = mongoose.model('ProviderAccount', new mongoose.Schema({}, { strict: false }));
  
  const allProviders = await ProviderAccount.find({}).select('name city registrationComplete approvalStatus isOnline').lean();
  console.log('All Providers in DB:');
  console.log(JSON.stringify(allProviders, null, 2));

  process.exit();
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});
