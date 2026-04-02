# Complete Testing Guide - Geo-Spatial Zone Matching

## 🎯 Testing Flow Overview

```
1. Setup (Admin) → 2. Provider Setup → 3. User Booking → 4. Provider Response → 5. Vendor/Admin Actions
```

---

## 📋 Pre-requisites

### Database Setup
```bash
# Start MongoDB
mongod

# Start Redis (for OTP)
redis-server

# Start Backend
cd backend
npm install
npm run dev
```

### Check Indexes
```javascript
// In MongoDB shell
use your_database_name

// Check CityZone indexes
db.zones.getIndexes()
// Expected: Should see "geometry_2dsphere" index

// Check ProviderAccount indexes
db.provideraccounts.getIndexes()
// Expected: Should see "currentLocation_2dsphere" index
```

---

## 🧪 Step-by-Step Testing

### STEP 1: Admin Setup (Zone Creation)

#### 1.1 Login as Admin
```bash
POST /admin/login
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

**Expected Output**:
```json
{
  "admin": { "email": "admin@example.com", ... },
  "adminToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 1.2 Create City (if not exists)
```bash
POST /admin/cities
{
  "name": "Noida",
  "status": "active"
}
```

**Expected Output**:
```json
{
  "city": {
    "_id": "60a1b2c3d4e5f6g7h8i9j0k1",
    "name": "Noida",
    "status": "active"
  }
}
```

#### 1.3 Create Zone with Polygon
```bash
POST /admin/zones
{
  "name": "Sector 18",
  "city": "60a1b2c3d4e5f6g7h8i9j0k1",
  "status": "active",
  "coordinates": [
    { "lat": 28.5355, "lng": 77.3910 },
    { "lat": 28.5365, "lng": 77.3920 },
    { "lat": 28.5375, "lng": 77.3915 },
    { "lat": 28.5370, "lng": 77.3905 },
    { "lat": 28.5360, "lng": 77.3900 }
  ]
}
```

**Expected Output**:
```json
{
  "zone": {
    "_id": "zone123",
    "name": "Sector 18",
    "city": "60a1b2c3d4e5f6g7h8i9j0k1",
    "coordinates": [...],
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[77.3910, 28.5355], [77.3920, 28.5365], ...]]
    }
  }
}
```

**Console Log (Backend)**:
```
[CityZone] Generated GeoJSON geometry for zone: Sector 18
```

**Verify in Database**:
```javascript
db.zones.findOne({ name: "Sector 18" })
// Should have "geometry" field with GeoJSON Polygon
```

---

### STEP 2: Provider Setup

#### 2.1 Provider Registration
```bash
POST /provider/register
{
  "name": "Rahul Kumar",
  "phone": "9876543210",
  "email": "rahul@example.com",
  "city": "Noida",
  "address": "Sector 18, Noida"
}
```

**Expected Output**:
```json
{
  "provider": {
    "_id": "provider123",
    "name": "Rahul Kumar",
    "phone": "9876543210",
    "city": "Noida",
    "approvalStatus": "pending_vendor"
  }
}
```

#### 2.2 Vendor Approves Provider
```bash
PATCH /vendor/providers/provider123/status
{
  "status": "approved"
}
```

**Expected Output**:
```json
{
  "provider": {
    "_id": "provider123",
    "approvalStatus": "pending_admin",
    "vendorApprovalStatus": "approved"
  }
}
```

#### 2.3 Admin Approves Provider
```bash
PATCH /admin/providers/provider123/status
{
  "status": "approved"
}
```

**Expected Output**:
```json
{
  "provider": {
    "_id": "provider123",
    "approvalStatus": "approved",
    "adminApprovalStatus": "approved"
  }
}
```

#### 2.4 Provider Requests Zone
```bash
POST /provider/request-zones
{
  "zones": ["Sector 18"]
}
```

**Expected Output**:
```json
{
  "success": true,
  "message": "Zone request submitted",
  "pendingZoneRequests": [
    {
      "zoneName": "Sector 18",
      "isNewZone": false,
      "vendorStatus": "pending",
      "adminStatus": "pending"
    }
  ]
}
```

**Console Log**:
```
[Provider] Zone request: Sector 18 (existing zone)
```

#### 2.5 Vendor Approves Zone Request
```bash
PATCH /vendor/providers/provider123/approve-zones
```

**Expected Output**:
```json
{
  "success": true,
  "provider": {
    "zones": ["Sector 18"],
    "pendingZoneRequests": []
  }
}
```

#### 2.6 Provider Updates Location
```bash
PATCH /provider/location
{
  "lat": 28.5365,
  "lng": 77.3912
}
```

**Expected Output**:
```json
{
  "provider": {
    "_id": "provider123",
    "currentLocation": {
      "lat": 28.5365,
      "lng": 77.3912
    },
    "lastLocationUpdate": "2026-04-02T10:30:00.000Z"
  }
}
```

**Console Log**:
```
[Provider] Location updated: (28.5365, 77.3912)
```

---

### STEP 3: User Booking Flow

#### 3.1 User Login
```bash
POST /auth/login
{
  "phone": "9999999999",
  "otp": "123456"
}
```

**Expected Output**:
```json
{
  "user": {
    "_id": "user123",
    "phone": "9999999999",
    "name": "Test User"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 3.2 Get Available Slots
```bash
POST /bookings/slots
{
  "date": "2026-04-05",
  "address": {
    "lat": 28.5368,
    "lng": 77.3914,
    "area": "Sector 18",
    "city": "Noida",
    "zone": "Sector 18"
  },
  "services": [
    {
      "id": "service1",
      "name": "Hair Cut",
      "category": "hair",
      "duration": "30"
    }
  ]
}
```

**Expected Output**:
```json
{
  "slots": [
    {
      "time": "09:00",
      "available": true,
      "providers": [
        {
          "id": "provider123",
          "name": "Rahul Kumar",
          "rating": 4.5,
          "distanceKm": 0.5
        }
      ]
    },
    {
      "time": "09:30",
      "available": true,
      "providers": [...]
    }
  ]
}
```

**Console Log (Backend)**:
```
[GeoMatching] Found 1 zones containing point (28.5368, 77.3914): ["Sector 18"]
[GeoMatching] Polygon matching found 1 providers
[Slots] Available providers for 09:00: 1
```

**Key Points**:
- ✅ User coordinates (28.5368, 77.3914) are INSIDE the polygon
- ✅ Provider "Rahul Kumar" is in "Sector 18" zone
- ✅ Distance calculated: 0.5 km (very close)

#### 3.3 Create Booking
```bash
POST /bookings
{
  "items": [
    {
      "name": "Hair Cut",
      "price": 500,
      "duration": "30",
      "category": "hair",
      "serviceType": "hair_cut"
    }
  ],
  "slot": {
    "date": "2026-04-05",
    "time": "09:00"
  },
  "address": {
    "houseNo": "A-123",
    "area": "Sector 18",
    "landmark": "Near Metro",
    "city": "Noida",
    "zone": "Sector 18",
    "lat": 28.5368,
    "lng": 77.3914
  },
  "bookingType": "instant"
}
```

**Expected Output**:
```json
{
  "booking": {
    "_id": "booking123",
    "customerId": "user123",
    "services": [...],
    "totalAmount": 500,
    "address": {
      "city": "Noida",
      "zone": "Sector 18",
      "lat": 28.5368,
      "lng": 77.3914
    },
    "slot": {
      "date": "2026-04-05",
      "time": "09:00",
      "provider": {
        "id": "provider123",
        "name": "Rahul Kumar",
        "rating": 4.5
      }
    },
    "status": "pending",
    "assignedProvider": "provider123",
    "candidateProviders": ["provider123"],
    "expiresAt": "2026-04-02T10:35:00.000Z"
  }
}
```

**Console Logs (Backend)**:
```
[Booking] Zone matching debug: {
  bookingCity: 'Noida',
  bookingZone: 'Sector 18',
  addressProvided: { lat: 28.5368, lng: 77.3914, ... }
}

[GeoMatching] Found 1 zones containing point (28.5368, 77.3914): ["Sector 18"]
[GeoMatching] Polygon matching found 1 providers
[GeoMatching] Final: 1 providers using polygon

[Booking] Assignment: AUTO-ASSIGNED Provider = Rahul Kumar (ID: provider123)
```

**Notifications Sent**:
1. To User: "Booking Created"
2. To Provider: "New Booking Assigned"

---

### STEP 4: Provider Response

#### CASE A: Provider Accepts Booking

```bash
PATCH /provider/bookings/booking123/accept
```

**Expected Output**:
```json
{
  "booking": {
    "_id": "booking123",
    "status": "accepted",
    "acceptedAt": "2026-04-02T10:32:00.000Z"
  }
}
```

**Console Log**:
```
[Booking] Provider provider123 accepted booking booking123
```

**Notifications Sent**:
1. To User: "Professional Accepted Your Booking"

**Next Steps**:
- Provider marks "On the Way" → User gets notification
- Provider marks "Reached" → User gets notification
- Provider starts service → Status changes to "in_progress"
- Provider completes service → Status changes to "completed"

---

#### CASE B: Provider Rejects Booking

```bash
PATCH /provider/bookings/booking123/reject
{
  "reason": "Not available"
}
```

**Expected Output**:
```json
{
  "booking": {
    "_id": "booking123",
    "status": "pending",
    "assignedProvider": "provider456",
    "rejectedProviders": ["provider123"],
    "assignmentIndex": 1
  }
}
```

**Console Log**:
```
[Booking] Provider provider123 rejected booking booking123
[Booking] Reassigning to next provider: provider456
```

**Notifications Sent**:
1. To Next Provider (provider456): "New Booking Assigned"

**Auto-Reassignment Logic**:
- System picks next provider from `candidateProviders` array
- If no more providers, escalates to vendor/admin

---

#### CASE C: Provider Doesn't Respond (Timeout)

**After 5 minutes** (expiresAt reached):

**Expected Behavior**:
```json
{
  "booking": {
    "_id": "booking123",
    "status": "pending",
    "assignedProvider": "provider456",
    "rejectedProviders": ["provider123"],
    "assignmentIndex": 1,
    "expiresAt": "2026-04-02T10:40:00.000Z"
  }
}
```

**Console Log**:
```
[Booking] Booking booking123 expired, reassigning to provider456
```

**Notifications Sent**:
1. To Next Provider: "New Booking Assigned"

---

### STEP 5: Vendor/Admin Actions

#### CASE D: No Providers Available (Escalation)

**Scenario**: All providers rejected or no providers in zone

**Expected Output**:
```json
{
  "booking": {
    "_id": "booking123",
    "status": "pending",
    "assignedProvider": "",
    "vendorEscalated": true,
    "vendorEscalatedAt": "2026-04-02T10:35:00.000Z",
    "adminEscalated": false
  }
}
```

**Console Log**:
```
[Booking] No providers found for slot 09:00 on 2026-04-05. Creating unassigned booking for manual assignment.
[Booking] Assignment: NO Provider assigned (Admin escalation required)
```

**Notifications Sent**:
1. To Vendor: "Booking Escalated - Manual Assignment Needed"
2. To Admin (copy): "Booking Escalated to Vendor"

#### Vendor Manually Assigns Provider

```bash
POST /vendor/bookings/booking123/assign
{
  "providerId": "provider789"
}
```

**Expected Output**:
```json
{
  "booking": {
    "_id": "booking123",
    "status": "pending",
    "assignedProvider": "provider789",
    "vendorEscalated": false,
    "expiresAt": "2026-04-02T10:40:00.000Z"
  }
}
```

**Notifications Sent**:
1. To Provider: "New Booking Assigned"
2. To User: "Professional Assigned"

---

## 🔍 Real-Time Location Tracking Test

### Provider Side (Mobile App)

```javascript
// Connect to Socket.IO
import io from 'socket.io-client';

const socket = io('http://localhost:5000/provider-location', {
  auth: { token: providerToken }
});

// Send location every 30 seconds
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
  console.log('✅ Location updated:', data);
  // Expected: { success: true, location: { lat: 28.5365, lng: 77.3912 }, timestamp: ... }
});

socket.on('location:error', (error) => {
  console.error('❌ Location error:', error);
});
```

**Expected Console Output (Provider)**:
```
✅ Location updated: { success: true, location: { lat: 28.5365, lng: 77.3912 }, timestamp: 2026-04-02T10:30:00.000Z }
```

**Expected Console Output (Backend)**:
```
[Socket] Provider provider123 connected for location tracking
[Socket] Provider provider123 location updated: (28.5365, 77.3912)
```

### User Side (Tracking Provider)

```javascript
// Connect to Socket.IO
const socket = io('http://localhost:5000/provider-location', {
  auth: { token: userToken }
});

// Track provider
socket.emit('track:provider', { providerId: 'provider123' });

socket.on('track:started', (data) => {
  console.log('✅ Tracking started:', data);
  // Expected: { providerId: 'provider123' }
});

// Listen for location updates
socket.on('provider:provider123:location', (data) => {
  console.log('📍 Provider location:', data);
  // Expected: { providerId: 'provider123', location: { lat: 28.5365, lng: 77.3912 }, timestamp: ... }
  
  // Update map marker
  updateMapMarker(data.location.lat, data.location.lng);
});

// Stop tracking
socket.emit('untrack:provider', { providerId: 'provider123' });
```

**Expected Console Output (User)**:
```
✅ Tracking started: { providerId: 'provider123' }
📍 Provider location: { providerId: 'provider123', location: { lat: 28.5365, lng: 77.3912 }, timestamp: ... }
```

---

## 📊 Database Verification

### Check Zone Geometry
```javascript
db.zones.findOne({ name: "Sector 18" })

// Expected:
{
  "_id": ObjectId("..."),
  "name": "Sector 18",
  "coordinates": [
    { "lat": 28.5355, "lng": 77.3910 },
    ...
  ],
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [[77.3910, 28.5355], [77.3920, 28.5365], ...]
    ]
  }
}
```

### Check Provider Location
```javascript
db.provideraccounts.findOne({ _id: ObjectId("provider123") })

// Expected:
{
  "_id": ObjectId("provider123"),
  "name": "Rahul Kumar",
  "zones": ["Sector 18"],
  "currentLocation": {
    "lat": 28.5365,
    "lng": 77.3912
  },
  "lastLocationUpdate": ISODate("2026-04-02T10:30:00.000Z")
}
```

### Check Booking Assignment
```javascript
db.bookings.findOne({ _id: ObjectId("booking123") })

// Expected:
{
  "_id": ObjectId("booking123"),
  "customerId": "user123",
  "assignedProvider": "provider123",
  "candidateProviders": ["provider123", "provider456"],
  "address": {
    "city": "Noida",
    "zone": "Sector 18",
    "lat": 28.5368,
    "lng": 77.3914
  },
  "status": "pending"
}
```

---

## 🐛 Troubleshooting

### Issue 1: "No providers found" despite zone match

**Check**:
```bash
# 1. Verify zone has geometry
db.zones.findOne({ name: "Sector 18" }, { geometry: 1 })

# 2. Check if user coordinates are inside polygon
# Use this query:
db.zones.find({
  geometry: {
    $geoWithin: {
      $geometry: {
        type: "Point",
        coordinates: [77.3914, 28.5368]  // [lng, lat]
      }
    }
  }
})

# 3. Check provider zones
db.provideraccounts.find({ zones: "Sector 18" })
```

**Console Logs to Check**:
```
[GeoMatching] Found X zones containing point (28.5368, 77.3914): [...]
[GeoMatching] Polygon matching found X providers
```

### Issue 2: Distance sorting not working

**Check**:
```bash
# Verify provider has currentLocation
db.provideraccounts.findOne(
  { _id: ObjectId("provider123") },
  { currentLocation: 1 }
)

# Should return:
{ "currentLocation": { "lat": 28.5365, "lng": 77.3912 } }
```

### Issue 3: Socket.IO not connecting

**Check**:
```bash
# 1. Verify CORS settings
# In backend/.env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# 2. Check Socket.IO namespace
# Should be: /provider-location

# 3. Verify token is valid
# Decode JWT token and check expiry
```

---

## ✅ Success Criteria

### Polygon Matching Works
- [ ] User inside polygon → Provider matched
- [ ] User outside polygon → Fallback to text/city
- [ ] Console shows: "[GeoMatching] Polygon matching found X providers"

### Distance Sorting Works
- [ ] Nearest provider assigned first
- [ ] Provider with location gets priority over provider without location
- [ ] Console shows distance in candidateProviders

### Real-Time Tracking Works
- [ ] Provider sends location → Database updated
- [ ] User tracks provider → Receives real-time updates
- [ ] Console shows: "[Socket] Provider location updated"

### Backward Compatibility
- [ ] Bookings without coordinates still work (text-based fallback)
- [ ] Zones without polygons still work (text-based matching)
- [ ] Providers without location still matched by zone name

---

## 📝 Test Checklist

- [ ] Admin creates zone with polygon
- [ ] Provider requests and gets zone approved
- [ ] Provider updates location
- [ ] User creates booking with coordinates
- [ ] System matches provider using polygon
- [ ] Provider is sorted by distance
- [ ] Provider accepts/rejects booking
- [ ] Real-time location tracking works
- [ ] Escalation to vendor/admin works
- [ ] Backward compatibility maintained

---

**Testing Complete!** 🎉

Agar koi step mein issue aaye, toh console logs check karo aur database verify karo.
