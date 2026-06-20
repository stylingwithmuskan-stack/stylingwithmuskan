import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'dykqqkmqy',
  api_key: '351289775527126',
  api_secret: 'NjpWz7VLSK93nWvHiY5IfX6FPMk',
});

async function checkAllTypes() {
  const types = ['image', 'video', 'raw'];
  
  for (const rType of types) {
    try {
      let count = 0;
      let nextCursor = null;
      do {
        const res = await cloudinary.api.resources({
          resource_type: rType,
          max_results: 500,
          next_cursor: nextCursor
        });
        count += res.resources.length;
        nextCursor = res.next_cursor;
      } while (nextCursor);
      console.log(`Total ${rType}s in Cloudinary: ${count}`);
    } catch (err) {
      console.error(`Error fetching ${rType}:`, err.message);
    }
  }
}

checkAllTypes();
