import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const ProviderSchema = new mongoose.Schema({
  name: String,
  categories: mongoose.Schema.Types.Mixed,
  documents: {
    primaryCategory: mongoose.Schema.Types.Mixed,
    specializations: mongoose.Schema.Types.Mixed,
  }
}, { strict: false });

const ProviderAccount = mongoose.models.ProviderAccount || mongoose.model('ProviderAccount', ProviderSchema);

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const muskan = await ProviderAccount.findOne({ name: /Muskan/i }).lean();
  console.log('MUSKAN DATA:', JSON.stringify({
    name: muskan.name,
    categories: muskan.categories,
    primaryCategory: muskan.documents?.primaryCategory,
    specializations: muskan.documents?.specializations
  }, null, 2));
  process.exit(0);
}
check().catch(err => {
  console.error(err);
  process.exit(1);
});
