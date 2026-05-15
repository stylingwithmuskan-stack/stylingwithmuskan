import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const CategorySchema = new mongoose.Schema({
  id: String,
  name: String,
});
const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const cats = await Category.find().lean();
  console.log('CATEGORIES:', cats.map(c => ({ id: c.id, name: c.name, _id: c._id })));
  process.exit(0);
}
check().catch(err => {
  console.error(err);
  process.exit(1);
});
