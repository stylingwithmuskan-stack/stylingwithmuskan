# Geo-Spatial Zone Matching & Real-Time Location Tracking

## Implementation Summary

This document describes the newly implemented geo-spatial features for the booking system.

## Features Implemented

### 1. ✅ Polygon-Based Zone Matching ($geoWithin)

**Location**: `backend/src/lib/geoMatching.js`

**How it works**:
- Admin creates zones with 5-point polygon boundaries using the map interface
- Zones are stored with GeoJSON Polygon format in `CityZone.geometry` field
- When user books a service, their lat/lng coordinates are checked against zone polygons
- MongoDB's `$geoWithin` query finds which zones contain the user's location
- Providers assigned to those zones are matched

**Fallback Strategy**:
1. **Priority 1**: Polygon-based matching (if user has lat/lng)
2. **Priority 2**: Text-based zone name matching (if no coordinates)
3. **Priority 3**: City-wide search (if no zone match)

**Benefits**:
- Accurate zone boundaries (no false matches like "Sector 1" matching "Sector 18")
- Works with any polygon shape (not just circles)
- Automatic fallback ensures backward compatibility

---

### 2. ✅ Distance-Based Provider Sorting ($geoNear)

**Location**: `backend/src/lib/geoMatching.js` - `sortProvidersByProximity()`

**How it works**:
- Providers with `currentLocation` (lat/lng) are sorted by distance from user
- Uses Haversine formula to calculate distance in kilometers
- Sorting priority: Elite > Pro > Online > **Distance** > Rating > Jobs

**Benefits**:
- Nearest provider gets priority (faster service, lower travel cost)
- Still respects subscription tiers (Elite/Pro)
- Graceful handling when provider location is not available

---

### 3. ✅ Real-Time Location Tracking (Socket.IO)

**Location**: `backend/src/startup/socket.js` - `/provider-location` namespace

**How it works**:

#### Provider Side:
```javascript
// Connect to Socket.IO
const socket = io('https://api.example.com/provider-location', {
  auth: { token: providerToken }
});

// Send location updates every 30 seconds
setInterval(() => {
  navigator.geolocation.getCurrentPosition((position) => {
    socket.emit('location:update', {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    });
  });
}, 30000);

// Listen for acknowledgment
socket.on('location:updated', (data) => {
  console.log('Location updated:', data);
});
```

#### User/Admin Side:
```javascript
// Connect to Socket.IO
const socket = io('https://api.example.com/provider-location', {
  auth: { token: userToken }
});

// Track a specific provider
socket.emit('track:provider', { providerId: '507f1f77bcf86cd799439011' });

// Listen for location updates
socket.on(`provider:${providerId}:location`, (data) => {
  console.log('Provider location:', data.location);
  // Update map marker
  updateMapMarker(data.location.lat, data.location.lng);
});

// Stop tracking
socket.emit('untrack:provider', { providerId: '507f1f77bcf86cd799439011' });
```

**Database Updates**:
- `ProviderAccount.currentLocation` updated on every location event
- `ProviderAccount.lastLocationUpdate` timestamp added

**Benefits**:
- Real-time provider tracking on map
- ETA calculation possible
- Better user experience ("provider is 5 minutes away")

---

## API Changes

### Booking Creation (`POST /bookings`)

**Before**:
```javascript
// Text-based regex matching only
providers = await ProviderAccount.find({
  city: { $regex: /^Noida/i },
  zones: { $in: [/^Sector 18/i] }
});
```

**After**:
```javascript
// Hybrid approach with polygon matching
providers = await findProvidersInZone(
  { lat: 28.5355, lng: 77.3910, zone: "Sector 18", city: "Noida" },
  { approvalStatus: "approved", registrationComplete: true }
);

// Sort by distance
sorted = await sortProvidersByProximity(
  providers, userLat, userLng, proPartnerIds, qualifiesAsElite
);
```

**Backward Compatibility**: ✅ Maintained
- If user has no coordinates, falls back to text-based matching
- If zones have no polygon boundaries, falls back to text-based matching
- Existing bookings continue to work without changes

---

## Database Schema Changes

### CityZone Model

**Added**:
```javascript
geometry: {
  type: { type: String, enum: ['Polygon'], default: 'Polygon' },
  coordinates: { type: [[[Number]]], default: undefined }
}
```

**Index**:
```javascript
ZoneSchema.index({ geometry: '2dsphere' });
```

**Pre-save Hook**:
- Automatically converts `coordinates` array to GeoJSON `geometry` format
- Closes polygon by adding first point at the end

---

### ProviderAccount Model

**Added**:
```javascript
lastLocationUpdate: { type: Date, default: null }
```

**Index**:
```javascript
ProviderAccountSchema.index({ currentLocation: '2dsphere' });
```

---

## Testing

### Test Polygon Matching

```bash
# Create a test zone with polygon
POST /admin/zones
{
  "name": "Test Zone",
  "city": "60a1b2c3d4e5f6g7h8i9j0k1",
  "coordinates": [
    { "lat": 28.5355, "lng": 77.3910 },
    { "lat": 28.5365, "lng": 77.3920 },
    { "lat": 28.5375, "lng": 77.3915 },
    { "lat": 28.5370, "lng": 77.3905 },
    { "lat": 28.5360, "lng": 77.3900 }
  ]
}

# Create booking with coordinates inside polygon
POST /bookings
{
  "address": {
    "lat": 28.5365,
    "lng": 77.3912,
    "city": "Noida",
    "zone": "Test Zone"
  },
  ...
}

# Check logs for: "[GeoMatching] Polygon matching found X providers"
```

### Test Distance Sorting

```bash
# Update provider location
PATCH /provider/location
{
  "lat": 28.5360,
  "lng": 77.3908
}

# Create booking and check provider order
# Nearest provider should be first in candidateProviders array
```

### Test Real-Time Location

```javascript
// Provider app
const socket = io('http://localhost:5000/provider-location', {
  auth: { token: providerToken }
});

socket.emit('location:update', { lat: 28.5355, lng: 77.3910 });

socket.on('location:updated', (data) => {
  console.log('✅ Location updated:', data);
});

// User app
const userSocket = io('http://localhost:5000/provider-location', {
  auth: { token: userToken }
});

userSocket.emit('track:provider', { providerId: 'PROVIDER_ID' });

userSocket.on('provider:PROVIDER_ID:location', (data) => {
  console.log('📍 Provider location:', data.location);
});
```

---

## Performance Considerations

### Indexes
- `CityZone.geometry` has 2dsphere index for fast polygon queries
- `ProviderAccount.currentLocation` has 2dsphere index for distance queries
- Queries are optimized with proper filtering before geo-spatial operations

### Caching
- Zone polygons are cached in MongoDB's index
- Provider locations are updated in real-time but not cached (always fresh)

### Scalability
- Socket.IO can handle thousands of concurrent connections
- Geo-spatial queries are O(log n) with proper indexes
- Location updates are broadcast only to subscribed users (not global)

---

## Migration Guide

### For Existing Zones

Zones without `coordinates` will continue to work with text-based matching. To enable polygon matching:

1. Admin opens zone in edit mode
2. Draws 5-point polygon on map
3. Saves zone
4. Pre-save hook automatically generates `geometry` field

### For Existing Providers

Providers without `currentLocation` will still be matched by zone name. To enable distance-based sorting:

1. Provider app requests location permission
2. Provider app sends location updates via Socket.IO or REST API
3. `currentLocation` field is updated
4. Provider appears in distance-sorted results

---

## Troubleshooting

### "No providers found" despite zone match

**Cause**: Polygon boundaries might be too restrictive

**Solution**:
1. Check zone polygon in admin panel
2. Verify user coordinates are inside polygon
3. Check logs for "[GeoMatching] Found X zones containing point"

### Location updates not working

**Cause**: Socket.IO connection issues

**Solution**:
1. Check CORS settings in `backend/src/config.js`
2. Verify provider token is valid
3. Check browser console for Socket.IO errors
4. Ensure `/provider-location` namespace is accessible

### Distance sorting not working

**Cause**: Providers don't have `currentLocation` set

**Solution**:
1. Check `ProviderAccount.currentLocation` in database
2. Ensure providers are sending location updates
3. Verify 2dsphere index exists: `db.provideraccounts.getIndexes()`

---

## Future Enhancements

### Phase 5: Zone Search & Filtering
- Add search bar in zone request modal
- Show zone preview on map
- Display provider count per zone

### Phase 6: Zone Hierarchy
- Support parent-child zone relationships
- Enable "all providers in Noida" (parent zone) search

### Phase 7: Zone-Based Pricing
- Use `CityZone.pricingMultiplier` in booking calculation
- Implement surge pricing for high-demand zones

### Phase 8: Analytics Dashboard
- Track bookings per zone
- Calculate provider density
- Identify underserved zones
- Show heatmap of demand

---

## Summary

✅ **Implemented**:
1. Polygon-based zone matching with `$geoWithin`
2. Distance-based provider sorting with Haversine formula
3. Real-time location tracking with Socket.IO

✅ **Backward Compatible**:
- Text-based matching still works as fallback
- Existing bookings unaffected
- No breaking changes to API

✅ **Production Ready**:
- Error handling for invalid coordinates
- Graceful fallbacks for missing data
- Proper indexes for performance
- Comprehensive logging for debugging

---

**Generated**: April 2, 2026
**Status**: Implementation Complete ✅
