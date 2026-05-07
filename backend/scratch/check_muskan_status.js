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

  console.log('Connecting to MongoDB...');
  await mongoose.connect(connectionString);
  console.log('Connected.');

  const ProviderAccount = mongoose.model('ProviderAccount', new mongoose.Schema({}, { strict: false }));
  const muskan = await ProviderAccount.findOne({ name: /Muskan/i });
  
  if (!muskan) {
    console.log('Provider Muskan not found.');
  } else {
    console.log('Muskan Status:');
    console.log('  Name:', muskan.name);
    console.log('  approvalStatus:', muskan.approvalStatus);
    console.log('  registrationComplete:', muskan.registrationComplete);
    console.log('  isOnline:', muskan.isOnline);
    console.log('  city:', muskan.city);
    console.log('  zones:', muskan.zones);
  }

  const OfficeSettings = mongoose.model('OfficeSettings', new mongoose.Schema({}, { strict: false }));
  const office = await OfficeSettings.findOne();
  console.log('Office Settings:', JSON.stringify(office, null, 2));

  process.exit();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
