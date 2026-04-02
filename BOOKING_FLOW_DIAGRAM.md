# Booking Flow Diagram - Geo-Spatial Matching

## 📊 Complete Flow Visualization

```
┌─────────────────────────────────────────────────────────────────┐
│                    BOOKING FLOW WITH GEO-MATCHING               │
└─────────────────────────────────────────────────────────────────┘

┌──────────┐
│  ADMIN   │
└────┬─────┘
     │
     │ 1. Create Zone with Polygon
     ▼
┌─────────────────────────────────────┐
│  Zone: "Sector 18"                  │
│  Coordinates: [5 points]            │
│  ✅ Geometry: GeoJSON Polygon       │
└─────────────────────────────────────┘
     │
     │ 2. Provider Requests Zone
     ▼
┌──────────┐      ┌──────────┐      ┌──────────┐
│ PROVIDER │─────▶│  VENDOR  │─────▶│  ADMIN   │
└────┬─────┘      └──────────┘      └──────────┘
     │              Approve           Approve
     │
     │ 3. Provider Updates Location
     ▼
┌─────────────────────────────────────┐
│  Provider: "Rahul Kumar"            │
│  Zone: "Sector 18"                  │
│  Location: (28.5365, 77.3912)       │
│  ✅ Ready for bookings              │
└─────────────────────────────────────┘
```


## 🎯 User Booking Flow

```
┌──────────┐
│   USER   │
└────┬─────┘
     │
     │ 1. Get Available Slots
     │    Address: (28.5368, 77.3914)
     ▼
┌─────────────────────────────────────────────────────────┐
│         GEO-SPATIAL MATCHING ENGINE                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Step 1: Find Zones Containing Point                   │
│  ┌────────────────────────────────────────┐            │
│  │ MongoDB $geoWithin Query               │            │
│  │ Point: (28.5368, 77.3914)              │            │
│  │ Result: ["Sector 18"]                  │            │
│  └────────────────────────────────────────┘            │
│                                                         │
│  Step 2: Find Providers in Zones                       │
│  ┌────────────────────────────────────────┐            │
│  │ Query: zones IN ["Sector 18"]         │            │
│  │ Result: [Rahul Kumar, Priya Sharma]   │            │
│  └────────────────────────────────────────┘            │
│                                                         │
│  Step 3: Calculate Distance & Sort                     │
│  ┌────────────────────────────────────────┐            │
│  │ Rahul: 0.5 km (Elite, Online)         │            │
│  │ Priya: 2.3 km (Pro, Offline)          │            │
│  │ Sort: Elite > Pro > Online > Distance │            │
│  └────────────────────────────────────────┘            │
│                                                         │
│  Step 4: Check Availability                            │
│  ┌────────────────────────────────────────┐            │
│  │ Rahul: ✅ Available at 09:00           │            │
│  │ Priya: ❌ Busy at 09:00                │            │
│  └────────────────────────────────────────┘            │
│                                                         │
└─────────────────────────────────────────────────────────┘
     │
     │ Result: Rahul Kumar (0.5 km away)
     ▼
┌─────────────────────────────────────┐
│  Available Slots Response           │
│  ┌───────────────────────────────┐  │
│  │ 09:00 - ✅ Available          │  │
│  │   Provider: Rahul Kumar       │  │
│  │   Distance: 0.5 km            │  │
│  │   Rating: 4.5 ⭐              │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```


## 📱 User Creates Booking

```
┌──────────┐
│   USER   │
└────┬─────┘
     │
     │ 2. Create Booking
     │    Slot: 09:00, Date: 2026-04-05
     │    Address: (28.5368, 77.3914)
     ▼
┌─────────────────────────────────────────────────────────┐
│         BOOKING CREATION LOGIC                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Validate Booking                                    │
│     ✅ Minimum amount check                             │
│     ✅ Lead time check                                  │
│     ✅ Service hours check                              │
│                                                         │
│  2. Find Providers (Geo-Spatial)                        │
│     ✅ Polygon matching: Found "Sector 18"              │
│     ✅ Distance sorting: Rahul (0.5km) first            │
│     ✅ Availability check: Rahul available              │
│                                                         │
│  3. Auto-Assign Provider                                │
│     ✅ Assigned: Rahul Kumar                            │
│     ✅ Expires at: 10:35 (5 min window)                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
     │
     ├─────────────────────────────────────────┐
     │                                         │
     ▼                                         ▼
┌──────────┐                            ┌──────────┐
│   USER   │                            │ PROVIDER │
└──────────┘                            └────┬─────┘
     │                                       │
     │ Notification:                         │ Notification:
     │ "Booking Created"                     │ "New Booking Assigned"
     │ "Professional Assigned"               │ "Accept within 5 min"
     │                                       │
     └───────────────────┬───────────────────┘
                         │
                         ▼
                  ⏰ 5 MIN WINDOW
```


## ✅ Provider Accepts Booking

```
┌──────────┐
│ PROVIDER │
└────┬─────┘
     │
     │ ACCEPT Booking
     ▼
┌─────────────────────────────────────┐
│  Booking Status: "accepted"         │
│  Provider: Rahul Kumar              │
│  ✅ Confirmed                        │
└─────────────────────────────────────┘
     │
     ├─────────────────────────────────────────┐
     │                                         │
     ▼                                         ▼
┌──────────┐                            ┌──────────┐
│   USER   │                            │ PROVIDER │
└──────────┘                            └────┬─────┘
     │                                       │
     │ Notification:                         │
     │ "Professional Accepted"               │ 1. Mark "On the Way"
     │                                       │ 2. Real-time location tracking
     │                                       │ 3. Mark "Reached"
     │                                       │ 4. Start Service
     │                                       │ 5. Complete Service
     │                                       │
     └───────────────────┬───────────────────┘
                         │
                         ▼
                  ✅ BOOKING COMPLETE
```

## ❌ Provider Rejects Booking

```
┌──────────┐
│ PROVIDER │
└────┬─────┘
     │
     │ REJECT Booking
     │ Reason: "Not available"
     ▼
┌─────────────────────────────────────────────────────────┐
│         AUTO-REASSIGNMENT LOGIC                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Add to rejectedProviders: [Rahul]                   │
│  2. Get next from candidateProviders: Priya             │
│  3. Assign to Priya                                     │
│  4. New expiry: 10:40 (5 min window)                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
     │
     ├─────────────────────────────────────────┐
     │                                         │
     ▼                                         ▼
┌──────────┐                            ┌──────────┐
│   USER   │                            │  PRIYA   │
└──────────┘                            └────┬─────┘
     │                                       │
     │ (No notification)                     │ Notification:
     │ (Seamless reassignment)               │ "New Booking Assigned"
     │                                       │
     └───────────────────┬───────────────────┘
                         │
                         ▼
                  ⏰ NEW 5 MIN WINDOW
```


## ⏰ Provider Timeout (No Response)

```
┌──────────┐
│ PROVIDER │
└────┬─────┘
     │
     │ ❌ No response for 5 minutes
     ▼
┌─────────────────────────────────────────────────────────┐
│         AUTO-TIMEOUT & REASSIGNMENT                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Booking expired at: 10:35                           │
│  2. Add to rejectedProviders: [Rahul]                   │
│  3. Assign to next provider: Priya                      │
│  4. New expiry: 10:40                                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
     │
     ├─────────────────────────────────────────┐
     │                                         │
     ▼                                         ▼
┌──────────┐                            ┌──────────┐
│   USER   │                            │  PRIYA   │
└──────────┘                            └────┬─────┘
     │                                       │
     │ Notification:                         │ Notification:
     │ "Finding another professional"        │ "New Booking Assigned"
     │                                       │
     └───────────────────┬───────────────────┘
                         │
                         ▼
                  ⏰ NEW 5 MIN WINDOW
```

## 🚨 No Providers Available (Escalation)

```
┌──────────┐
│   USER   │
└────┬─────┘
     │
     │ Create Booking
     │ But NO providers available
     ▼
┌─────────────────────────────────────────────────────────┐
│         ESCALATION LOGIC                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Scenario: All providers rejected OR no providers      │
│                                                         │
│  1. Create booking with:                                │
│     - assignedProvider: "" (empty)                      │
│     - vendorEscalated: true                             │
│     - adminEscalated: false                             │
│                                                         │
│  2. Notify vendor for manual assignment                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
     │
     ├─────────────────────────────────────────┐
     │                                         │
     ▼                                         ▼
┌──────────┐                            ┌──────────┐
│   USER   │                            │  VENDOR  │
└──────────┘                            └────┬─────┘
     │                                       │
     │ Notification:                         │ Notification:
     │ "Finding professional"                │ "Manual Assignment Needed"
     │ (Booking created)                     │ "Booking #123456"
     │                                       │
     │                                       │ Vendor manually assigns
     │                                       │ provider from dashboard
     │                                       │
     └───────────────────┬───────────────────┘
                         │
                         ▼
                  👤 MANUAL ASSIGNMENT
```


## 📍 Real-Time Location Tracking

```
┌──────────────────────────────────────────────────────────────┐
│              SOCKET.IO LOCATION TRACKING                     │
└──────────────────────────────────────────────────────────────┘

┌──────────┐                                    ┌──────────┐
│ PROVIDER │                                    │   USER   │
│  (App)   │                                    │  (App)   │
└────┬─────┘                                    └────┬─────┘
     │                                               │
     │ 1. Connect to Socket.IO                       │
     │    Namespace: /provider-location              │
     ▼                                               │
┌─────────────────────────────────────┐              │
│  Socket Connected                   │              │
│  Provider ID: provider123           │              │
└─────────────────────────────────────┘              │
     │                                               │
     │ 2. Send Location (every 30 sec)               │
     │    Event: location:update                     │
     │    Data: { lat: 28.5365, lng: 77.3912 }       │
     ▼                                               │
┌─────────────────────────────────────────────────────────┐
│              BACKEND (Socket.IO Server)                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Validate coordinates                                │
│  2. Update database:                                    │
│     - currentLocation: { lat, lng }                     │
│     - lastLocationUpdate: NOW                           │
│  3. Broadcast to tracking users                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
     │                                               │
     │ 3. Broadcast Event                            │
     │    Event: provider:provider123:location       │
     │    Data: { location: { lat, lng }, timestamp }│
     │                                               │
     │                                               │ 1. Track Provider
     │                                               │    Event: track:provider
     │                                               │    Data: { providerId }
     │                                               │
     │                                               ▼
     │                                          ┌─────────────────┐
     │                                          │ Tracking Active │
     │                                          └────────┬────────┘
     │                                                   │
     └───────────────────────────────────────────────────┤
                                                         │
                                                         ▼
                                                    ┌─────────────────┐
                                                    │  User Receives  │
                                                    │  Real-time      │
                                                    │  Location       │
                                                    │  Updates        │
                                                    └─────────────────┘
                                                         │
                                                         ▼
                                                    🗺️ MAP UPDATES
```

## 🎬 Complete Booking Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    BOOKING LIFECYCLE                            │
└─────────────────────────────────────────────────────────────────┘

1. PENDING (Initial)
   ├─ User creates booking
   ├─ Provider auto-assigned (Rahul)
   ├─ Expires in 5 minutes
   └─ Status: "pending"

2. ACCEPTED (Provider Response)
   ├─ Provider accepts within 5 min
   ├─ Status: "accepted"
   └─ User notified

3. ON_THE_WAY (Provider Action)
   ├─ Provider marks "On the Way"
   ├─ Real-time location tracking starts
   ├─ User sees provider on map
   └─ Status: "on_the_way"

4. REACHED (Provider Action)
   ├─ Provider marks "Reached"
   ├─ User notified
   └─ Status: "reached"

5. IN_PROGRESS (Service Started)
   ├─ Provider starts service
   ├─ Timer starts
   └─ Status: "in_progress"

6. COMPLETED (Service Done)
   ├─ Provider completes service
   ├─ User verifies with OTP
   ├─ Payment processed
   └─ Status: "completed"

7. RATED (User Feedback)
   ├─ User rates provider
   ├─ Provider rating updated
   └─ Status: "rated"

ALTERNATE FLOWS:

❌ REJECTED (Provider Rejects)
   ├─ Provider rejects booking
   ├─ Auto-reassign to next provider
   └─ Back to step 1 (PENDING)

⏰ EXPIRED (Timeout)
   ├─ Provider doesn't respond in 5 min
   ├─ Auto-reassign to next provider
   └─ Back to step 1 (PENDING)

🚨 ESCALATED (No Providers)
   ├─ All providers rejected/busy
   ├─ Vendor manually assigns
   └─ Back to step 1 (PENDING)

❌ CANCELLED (User/Admin Action)
   ├─ User cancels booking
   ├─ Refund processed (if paid)
   └─ Status: "cancelled"
```
