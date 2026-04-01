import mongoose from "mongoose";

const ZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    city: { type: mongoose.Schema.Types.ObjectId, ref: "City", required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    
    // Coordinates for zone boundary (pentagonal polygon)
    coordinates: {
      type: [{
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        _id: false  // Prevent Mongoose from adding _id to subdocuments
      }],
      default: null,
      validate: {
        validator: function(coords) {
          // null/undefined is valid for backward compatibility
          if (!coords) return true;
          
          // Must be an array
          if (!Array.isArray(coords)) return false;
          
          // Must have exactly 5 coordinates (pentagonal)
          if (coords.length !== 5) return false;
          
          // Each coordinate must have valid lat/lng ranges
          return coords.every(c => 
            c.lat >= -90 && c.lat <= 90 && 
            c.lng >= -180 && c.lng <= 180
          );
        },
        message: 'Coordinates must be an array of exactly 5 valid lat/lng pairs'
      }
    }
  },
  { timestamps: true }
);

// Drop problematic geospatial index on startup
async function dropGeoIndexIfExists() {
  try {
    const Zone = mongoose.model('Zone');
    const indexes = await Zone.collection.indexes();
    
    for (const index of indexes) {
      // Check if this is a geospatial index on coordinates
      if (index.key && index.key.coordinates && (index['2dsphereIndexVersion'] || index.key.coordinates === '2dsphere')) {
        console.log(`[CityZone] Dropping incompatible geospatial index: ${index.name}`);
        await Zone.collection.dropIndex(index.name);
        console.log(`[CityZone] ✓ Successfully dropped index: ${index.name}`);
      }
    }
  } catch (error) {
    // Ignore errors - index might not exist or already dropped
    if (error.code !== 27) { // 27 = IndexNotFound
      console.log('[CityZone] Note: Could not check/drop geospatial index:', error.message);
    }
  }
}

const CitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

export const City = mongoose.models.City || mongoose.model("City", CitySchema);
export const Zone = mongoose.models.Zone || mongoose.model("Zone", ZoneSchema);

// Run index cleanup after models are registered
if (mongoose.connection.readyState === 1) {
  dropGeoIndexIfExists();
} else {
  mongoose.connection.once('open', dropGeoIndexIfExists);
}
