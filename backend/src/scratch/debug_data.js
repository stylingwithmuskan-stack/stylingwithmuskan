import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const ParentSchema = new mongoose.Schema({ label: String });
const CategorySchema = new mongoose.Schema({ name: String, serviceType: mongoose.Schema.Types.ObjectId });
const ServiceSchema = new mongoose.Schema({ name: String, category: mongoose.Schema.Types.ObjectId });
const ProviderSchema = new mongoose.Schema({ documents: Object });

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Parent = mongoose.model('ServiceType', ParentSchema);
        const Category = mongoose.model('Category', CategorySchema);
        const Service = mongoose.model('Service', ServiceSchema);
        const Provider = mongoose.model('ProviderAccount', ProviderSchema);

        const parents = await Parent.find({ label: { $in: ['Gold Bleach', 'new'] } });
        console.log('--- Parents Found ---');
        console.log(JSON.stringify(parents, null, 2));

        for (const p of parents) {
            const cats = await Category.find({ serviceType: p._id });
            console.log(`--- Categories for ${p.label} (${p._id}) ---`);
            console.log(JSON.stringify(cats, null, 2));
            
            for (const c of cats) {
                const svcs = await Service.find({ category: c._id });
                console.log(`--- Services for ${c.name} (${c._id}) ---`);
                console.log(JSON.stringify(svcs, null, 2));
            }
        }
        
        const provider = await Provider.findOne({'documents.primaryCategory': 'Gold Bleach'});
        if (provider) {
            console.log('--- Provider Portfolio Example ---');
            console.log(JSON.stringify(provider.documents, null, 2));
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}
checkData();
