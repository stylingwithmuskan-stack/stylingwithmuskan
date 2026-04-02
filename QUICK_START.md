# Quick Start Guide - Testing Geo-Spatial Features

## 🚀 Start Karne Ke Liye

### 1. Backend Start Karo
```bash
cd backend
npm run dev
```

### Expected Console Output:
```
[MongoDB] Connected to: mongodb://localhost:27017/your_db
[Redis] Connected successfully
[Socket.IO] Namespace /provider-location initialized
[Server] Server running on port 5000
```

Agar ye sab dikhe toh backend successfully start ho gaya! ✅

---

## ⚡ Quick Test Commands

### Test 1: Check Server Health
```bash
curl http://localhost:5000/health
```
**Expected**: `{"status":"ok"}`

---

### Test 2: Get Available Slots (Geo-Matching Test)
```bash
curl -X POST http://localhost:5000/bookings/slots \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{
    "date": "2026-04-05",
    "address": {
      "lat": 28.5368,
      "lng": 77.3914,
      "zone": "Sector 18",
      "city": "Noida"
    },
    "services": [
      {
        "id": "service1",
        "name": "Hair Cut",
        "category": "hair",
        "duration": "30"
      }
    ]
  }'
```

**Console Logs to Watch**:
```
[GeoMatching] Found X zones containing point (28.5368, 77.3914): ["Sector 18"]
[GeoMatching] Polygon matching found X providers
[Slots] Available providers for 09:00: X
```

**Expected Response**:
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
    }
  ]
}
```

---

### Test 3: Create Booking (Auto-Assignment Test)
```bash
curl -X POST http://localhost:5000/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{
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
  }'
```

**Console Logs to Watch**:
```
[Booking] Zone matching debug: { bookingCity: 'Noida', bookingZone: 'Sector 18' }
[GeoMatching] Found 1 zones containing point
[GeoMatching] Polygon matching found X providers
[Booking] Assignment: AUTO-ASSIGNED Provider = Rahul Kumar (ID: provider123)
```

**Expected Response**:
```json
{
  "booking": {
    "_id": "booking123",
    "assignedProvider": "provider123",
    "candidateProviders": ["provider123", "provider456"],
    "status": "pending",
    "expiresAt": "2026-04-02T10:35:00.000Z"
  }
}
```

---

## 🔍 Console Logs Samajhna

### Geo-Matching Logs:
| Log | Matlab |
|-----|--------|
| `[GeoMatching] Found X zones` | User ke coordinates kis zone mein hain |
| `[GeoMatching] Polygon matching found X providers` | Polygon se kitne providers mile |
| `[GeoMatching] Text matching found X providers` | Text se kitne providers mile (fallback) |
| `[GeoMatching] Final: X providers using polygon` | Final result - polygon matching use hua |

### Booking Assignment Logs:
| Log | Matlab |
|-----|--------|
| `[Booking] AUTO-ASSIGNED Provider = Name` | Provider automatically assign ho gaya |
| `[Booking] NO Provider assigned` | Koi provider nahi mila, vendor escalation |
| `[Booking] Provider rejected booking` | Provider ne reject kiya |
| `[Booking] Reassigning to next provider` | Next provider ko assign kar rahe hain |

### Socket.IO Logs:
| Log | Matlab |
|-----|--------|
| `[Socket] Provider xxx connected` | Provider location tracking ke liye connect hua |
| `[Socket] Provider xxx location updated` | Provider ne location update kiya |
| `[Socket] User xxx tracking provider` | User provider ko track kar raha hai |

---

## ✅ Success Indicators

### ✓ Polygon Matching Working:
- Console mein dikhe: `[GeoMatching] Polygon matching found X providers`
- User coordinates inside polygon → Provider matched
- User coordinates outside polygon → Fallback to text/city

### ✓ Distance Sorting Working:
- Nearest provider pehle assign ho
- Console mein distance dikhe candidateProviders mein
- Provider with location ko priority mile

### ✓ Real-Time Tracking Working:
- Provider location send kare → Database update ho
- User track kare → Real-time updates mile
- Console mein dikhe: `[Socket] Provider location updated`

### ✓ Backward Compatibility:
- Bookings without coordinates work kare (text fallback)
- Zones without polygons work kare (text matching)
- Providers without location bhi match ho (by zone name)

---

## 🐛 Common Issues & Solutions

### Issue 1: "Cannot connect to MongoDB"
**Solution**:
```bash
# Check if MongoDB is running
mongod --version

# Start MongoDB
mongod
```

### Issue 2: "Cannot connect to Redis"
**Solution**:
```bash
# Check if Redis is running
redis-cli ping

# Start Redis
redis-server
```

### Issue 3: "No providers found" despite zone match
**Check**:
1. Zone mein geometry field hai? → `db.zones.findOne({ name: "Sector 18" })`
2. Provider ke zones array mein zone name hai? → `db.provideraccounts.find({ zones: "Sector 18" })`
3. Provider approved hai? → `approvalStatus: "approved"`
4. Provider online hai? → `onlineStatus: "online"`

### Issue 4: "Distance not showing"
**Check**:
1. Provider ke paas currentLocation hai? → `db.provideraccounts.findOne({ _id: "xxx" }, { currentLocation: 1 })`
2. Coordinates valid hain? → lat: -90 to 90, lng: -180 to 180

### Issue 5: "Socket.IO not connecting"
**Check**:
1. CORS settings → `.env` mein `ALLOWED_ORIGINS` check karo
2. Namespace correct hai? → `/provider-location`
3. Token valid hai? → JWT token expire toh nahi?

---

## 📱 Frontend Integration

### Slots Page (Available Providers Dikhana)
```javascript
// Get user's current location
navigator.geolocation.getCurrentPosition(async (position) => {
  const response = await fetch('/bookings/slots', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      date: selectedDate,
      address: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        zone: selectedZone,
        city: selectedCity
      },
      services: selectedServices
    })
  });
  
  const data = await response.json();
  // Display slots with providers and distance
  displaySlots(data.slots);
});
```

### Booking Page (Booking Create Karna)
```javascript
const createBooking = async () => {
  const response = await fetch('/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      items: selectedServices,
      slot: { date: selectedDate, time: selectedTime },
      address: {
        ...userAddress,
        lat: userLocation.lat,
        lng: userLocation.lng
      },
      bookingType: 'instant'
    })
  });
  
  const data = await response.json();
  // Show booking confirmation
  showBookingConfirmation(data.booking);
};
```

### Tracking Page (Provider Location Track Karna)
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000/provider-location', {
  auth: { token: userToken }
});

// Track provider
socket.emit('track:provider', { providerId: booking.assignedProvider });

// Listen for location updates
socket.on(`provider:${booking.assignedProvider}:location`, (data) => {
  console.log('Provider location:', data.location);
  
  // Update map marker
  updateMapMarker(data.location.lat, data.location.lng);
  
  // Calculate ETA
  const distance = calculateDistance(userLocation, data.location);
  updateETA(distance);
});

// Stop tracking when done
socket.emit('untrack:provider', { providerId: booking.assignedProvider });
```

---

## 📊 Database Queries (Debugging Ke Liye)

### Check Zone Geometry:
```javascript
db.zones.findOne({ name: "Sector 18" })
```

### Check Provider Location:
```javascript
db.provideraccounts.findOne(
  { _id: ObjectId("provider123") },
  { name: 1, zones: 1, currentLocation: 1, lastLocationUpdate: 1 }
)
```

### Check Booking Assignment:
```javascript
db.bookings.findOne(
  { _id: ObjectId("booking123") },
  { assignedProvider: 1, candidateProviders: 1, status: 1, address: 1 }
)
```

### Find Providers in Zone (Manual Test):
```javascript
db.provideraccounts.find({
  zones: "Sector 18",
  approvalStatus: "approved",
  onlineStatus: "online"
})
```

### Test Polygon Matching (Manual):
```javascript
// Find zones containing a point
db.zones.find({
  geometry: {
    $geoIntersects: {
      $geometry: {
        type: "Point",
        coordinates: [77.3914, 28.5368]  // [lng, lat]
      }
    }
  }
})
```

---

## 🎯 Testing Checklist

- [ ] Backend starts without errors
- [ ] MongoDB connected
- [ ] Redis connected
- [ ] Socket.IO initialized
- [ ] Slots API returns providers with distance
- [ ] Booking creates with auto-assignment
- [ ] Console shows geo-matching logs
- [ ] Provider can accept/reject booking
- [ ] Auto-reassignment works on reject
- [ ] Real-time location tracking works
- [ ] Backward compatibility maintained

---

## 📚 Full Documentation

- **TESTING_GUIDE.md** - Complete step-by-step testing
- **BOOKING_FLOW_DIAGRAM.md** - Visual flow diagrams
- **CURRENT_STATUS.md** - Current status in Hindi
- **backend/GEO_SPATIAL_IMPLEMENTATION.md** - Technical details

---

**Ready to test!** Backend start karo aur console logs dekho. Har step pe expected logs aane chahiye.
