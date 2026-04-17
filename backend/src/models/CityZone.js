import mongoose from "mongoose";

const ZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    city: { type: mongoose.Schema.Types.ObjectId, ref: "City", required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    
    // Coordinates for zone boundary (flexible polygon: 3-10 points)
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
          
          // Must have between 3 and 10 coordinates (flexible polygon)
          if (coords.length < 3 || coords.length > 10) return false;
          
          // Each coordinate must have valid lat/lng ranges
          return coords.every(c => 
            c.lat >= -90 && c.lat <= 90 && 
            c.lng >= -180 && c.lng <= 180
          );
        },
        message: 'Coordinates must be an array of 3-10 valid lat/lng pairs'
      }
    },
    
    // GeoJSON format for geo-spatial queries (Phase 1)
    // This is auto-generated from coordinates array
    geometry: {
      type: {
        type: String,
        enum: ['Polygon'],
        default: 'Polygon'
      },
      coordinates: {
        type: [[[Number]]], // Array of arrays of coordinate pairs
        default: undefined
      }
    },
    
    // Zone metadata (Phase 7 - Future)
    pricingMultiplier: { type: Number, default: 1.0, min: 0.5, max: 3.0 },
    providerCount: { type: Number, default: 0 },
    bookingCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

ZoneSchema.index({ city: 1, name: 1 }, { unique: true });

// Pre-save hook: Auto-generate GeoJSON geometry from coordinates (Phase 1)
ZoneSchema.pre('save', function(next) {
  if (this.coordinates && Array.isArray(this.coordinates) && this.coordinates.length >= 3) {
    // Convert to GeoJSON Polygon format: [[[lng, lat], [lng, lat], ...]]
    // Note: GeoJSON uses [longitude, latitude] order (opposite of our lat/lng)
    const geoCoords = this.coordinates.map(c => [c.lng, c.lat]);
    // Close the polygon by adding first point at the end
    geoCoords.push([this.coordinates[0].lng, this.coordinates[0].lat]);
    
    this.geometry = {
      type: 'Polygon',
      coordinates: [geoCoords]
    };
    
    console.log(`[CityZone] Generated GeoJSON geometry for zone: ${this.name} (${this.coordinates.length} points)`);
  }
  next();
});

// Create 2dsphere index for geo-spatial queries (Phase 1)
ZoneSchema.index({ geometry: '2dsphere' });

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
    mapCenterLat: { type: Number, default: null },
    mapCenterLng: { type: Number, default: null },
    mapZoom: { type: Number, default: 12 },
    activeVendorId: { type: String, default: "" },
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
