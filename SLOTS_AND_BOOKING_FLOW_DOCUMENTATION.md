# 🎯 SLOTS MANAGEMENT & BOOKING FLOW - COMPLETE DOCUMENTATION

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Slot Management Architecture](#slot-management-architecture)
3. [Provider Availability Flow](#provider-availability-flow)
4. [User Booking Flow](#user-booking-flow)
5. [Assignment & Matching Logic](#assignment--matching-logic)
6. [Status Lifecycle](#status-lifecycle)
7. [Key Components](#key-components)
8. [Database Models](#database-models)

---

## 🏗️ System Overview

### Core Entities
- **User (Customer)**: Books services
- **Provider (Service Professional)**: Delivers services
- **Vendor (Zone Manager)**: Manages providers in a city
- **Admin**: Platform administrator
- **Booking**: Service request with slot, services, and assignment

### Time Slot System
- **Default Slots**: 30-minute intervals from 07:00 AM to 10:30 PM (32 slots/day)
- **Slot Format**: "HH:MM AM/PM" (e.g., "09:00 AM", "02:30 PM")
- **Date Format**: ISO date "YYYY-MM-DD"

---

## 🔧 Slot Management Architecture

### 1. Default Slot Configuration
```javascript
// backend/src/lib/slots.js
DEFAULT_TIME_SLOTS = [
  "07:00 AM", "07:30 AM", "08:00 AM", ..., "10:00 PM", "10:30 PM"
]
```

### 2. Slot Availability Computation
**File**: `backend/src/lib/availability.js`

```
┌─────────────────────────────────────────────────────────────┐
│         SLOT AVAILABILITY COMPUTATION FLOW                   │
└─────────────────────────────────────────────────────────────┘

Input: providerId, date, settings, requestedDurationMinutes
  │
  ├─► Check Redis Cache (5 min TTL)
  │    └─► Cache Hit? → Return cached result
  │
  ├─► Check Leave Requests
  │    └─► Approved leave on date? → All slots FALSE
  │
  ├─► Load Provider Day Availability
  │    ├─► Has custom availability? → Use custom slots
  │    └─► No custom availability? → Use default slots (07:00-22:00)
  │
  ├─► Load Provider Bookings for Date
  │    └─► Mark booked slots as unavailable
  │
  ├─► Apply Business Rules
  │    ├─► Service Window (serviceStartTime - serviceEndTime)
  │    ├─► Buffer Time (default 30 min between bookings)
  │    ├─► Lead Time (minimum advance booking time)
  │    ├─► Busy Intervals (ongoing bookings + buffer)
  │    └─► Requested Duration (check if slot + duration fits)
  │
  ├─► Filter Today's Past Slots
  │    └─► Current time + lead time + buffer
  │
  └─► Return: { date, slots: [...], slotMap: {...} }
       └─► Cache result in Redis
```

### 3. Slot Invalidation
```
Triggers for Cache Invalidation:
├─► New booking created
├─► Booking status changed
├─► Provider availability updated
├─► Leave request approved
└─► Provider settings changed
```

---

## 👨‍💼 Provider Availability Flow

### Step 1: Provider Sets Availability
```
┌──────────────────────────────────────────────────────────┐
│  PROVIDER AVAILABILITY CALENDAR                           │
└──────────────────────────────────────────────────────────┘

Provider Dashboard
  │
  ├─► Navigate to "Availability Calendar"
  │
  ├─► Select Date
  │
  ├─► Choose Availability Mode:
  │    ├─► Default (07:00 AM - 10:00 PM)
  │    ├─► Custom Slots (select specific slots)
  │    └─► Mark as Unavailable (all slots OFF)
  │
  ├─► Save Availability
  │    └─► POST /api/provider/availability
  │         └─► Creates/Updates ProviderDayAvailability document
  │
  └─► Cache Invalidation
       └─► Redis: slots:ver:{providerId}:{date} incremented
```

### Step 2: Leave Management
```
Provider → Request Leave
  │
  ├─► Fill Leave Form (startDate, endDate, reason)
  │
  ├─► Submit → Creates LeaveRequest (status: "pending")
  │
  ├─► Vendor/Admin Reviews
  │    ├─► Approve → status: "approved"
  │    │    └─► All slots in date range become unavailable
  │    └─► Reject → status: "rejected"
  │
  └─► Notification sent to provider
```

---

## 👤 User Booking Flow

### Complete User Journey

```
┌────────────────────────────────────────────────────────────────┐
│                    USER BOOKING FLOW                            │
└────────────────────────────────────────────────────────────────┘

STEP 1: SERVICE SELECTION
User → Browse Services
  │
  ├─► Select Service Category
  ├─► Select Multiple Services
  ├─► View Service Details (price, duration, description)
  └─► Add to Cart

STEP 2: ADDRESS SELECTION
  │
  ├─► Choose Saved Address OR
  ├─► Add New Address
  │    ├─► Use Current Location (GPS + Reverse Geocoding)
  │    ├─► Enter Manual Address
  │    └─► Select City & Zone
  └─► Validate Address

STEP 3: SLOT SELECTION
  │
  ├─► API Call: GET /api/bookings/available-slots
  │    │
  │    ├─► Input:
  │    │    ├─► date (YYYY-MM-DD)
  │    │    ├─► services (array)
  │    │    ├─► address (city, zone, lat, lng)
  │    │    └─► preferredProviderId (optional)
  │    │
  │    ├─► Backend Processing:
  │    │    │
  │    │    ├─► buildAssignmentCandidates()
  │    │    │    ├─► Find providers in zone
  │    │    │    ├─► Filter by service types
  │    │    │    ├─► Check distance (if lat/lng provided)
  │    │    │    └─► Return candidate provider IDs
  │    │    │
  │    │    ├─► For each candidate provider:
  │    │    │    └─► computeAvailableSlots()
  │    │    │         ├─► Check leave requests
  │    │    │         ├─► Load day availability
  │    │    │         ├─► Check existing bookings
  │    │    │         ├─► Apply buffer time
  │    │    │         ├─► Apply service window
  │    │    │         └─► Filter by requested duration
  │    │    │
  │    │    └─► Aggregate slots across providers
  │    │         └─► Return union of available slots
  │    │
  │    └─► Response:
  │         └─► { slots: ["09:00 AM", "09:30 AM", ...], 
  │              candidateProvidersBySlot: {...} }
  │
  ├─► User Sees Available Slots
  │    ├─► Green = Available
  │    ├─► Grey = Unavailable
  │    └─► Shows provider count per slot
  │
  └─► User Selects Slot

STEP 4: PROVIDER SELECTION (Optional)
  │
  ├─► View Available Providers for Selected Slot
  │    ├─► Provider Name
  │    ├─► Rating
  │    ├─► Experience
  │    ├─► Profile Photo
  │    └─► Distance (if location available)
  │
  ├─► User Chooses:
  │    ├─► Specific Provider (preferredProviderId)
  │    └─► Any Available Provider (auto-assign)
  │
  └─► Continue to Payment

STEP 5: PAYMENT & CONFIRMATION
  │
  ├─► API Call: POST /api/bookings/quote
  │    └─► Calculate totals, discounts, advance amount
  │
  ├─► Review Booking Summary
  │    ├─► Services & Prices
  │    ├─► Slot & Date
  │    ├─► Address
  │    ├─► Total Amount
  │    ├─► Discount (coupon + subscription)
  │    └─► Advance Payment (if required)
  │
  ├─► Apply Coupon (optional)
  │
  ├─► API Call: POST /api/bookings
  │    │
  │    ├─► Input:
  │    │    ├─► items (services)
  │    │    ├─► slot { date, time }
  │    │    ├─► address
  │    │    ├─► bookingType ("instant" | "scheduled")
  │    │    ├─► couponCode
  │    │    └─► preferredProviderId
  │    │
  │    ├─► Backend Processing:
  │    │    │
  │    │    ├─► Validate Slot
  │    │    │    ├─► Check lead time
  │    │    │    ├─► Check max booking days
  │    │    │    └─► Check service window
  │    │    │
  │    │    ├─► Calculate Totals
  │    │    │    ├─► Apply coupon discount
  │    │    │    ├─► Apply subscription discount
  │    │    │    └─► Calculate advance amount
  │    │    │
  │    │    ├─► Build Candidate Providers
  │    │    │    └─► buildAssignmentCandidates()
  │    │    │
  │    │    ├─► Check Preferred Provider
  │    │    │    ├─► Is in candidate list?
  │    │    │    ├─► YES → Prioritize
  │    │    │    └─► NO → Return error "PREFERRED_PROVIDER_BUSY"
  │    │    │
  │    │    ├─► Auto-Assignment (if enabled)
  │    │    │    ├─► pickNextProviderForBooking()
  │    │    │    ├─► Round-robin from candidates
  │    │    │    ├─► Set expiresAt (10 min hold)
  │    │    │    └─► assignedProvider = providerId
  │    │    │
  │    │    ├─► Create Booking Document
  │    │    │    ├─► status: "pending"
  │    │    │    ├─► assignedProvider
  │    │    │    ├─► candidateProviders
  │    │    │    ├─► rejectedProviders: []
  │    │    │    ├─► Generate OTP (6-digit)
  │    │    │    └─► notificationStatus: "immediate" | "queued"
  │    │    │
  │    │    ├─► Invalidate Provider Slots
  │    │    │    └─► Redis cache cleared
  │    │    │
  │    │    ├─► Create Razorpay Order (if advance required)
  │    │    │
  │    │    ├─► Create Subscription Ledger Entry
  │    │    │
  │    │    └─► Send Notifications
  │    │         ├─► User: "booking_created"
  │    │         └─► Provider: "booking_assigned"
  │    │
  │    └─► Response:
  │         └─► { booking, totals, advanceAmount, order }
  │
  ├─► Payment (if advance required)
  │    ├─► Razorpay Payment Gateway
  │    └─► Update booking.prepaidAmount
  │
  └─► Booking Confirmed
       └─► User receives confirmation notification
```

---

## 🎯 Assignment & Matching Logic

### Provider Candidate Building
**File**: `backend/src/lib/assignmentCandidates.js`

```
┌──────────────────────────────────────────────────────────┐
│         PROVIDER CANDIDATE SELECTION                      │
└──────────────────────────────────────────────────────────┘

Input: address, slot, services, settings
  │
  ├─► STEP 1: Zone-Based Filtering
  │    ├─► Find providers in address.zone
  │    ├─► Status: "approved"
  │    ├─► Not blocked (blockedUntil < now)
  │    └─► Zones array contains address.zone
  │
  ├─► STEP 2: Service Type Filtering
  │    ├─► Extract service types from services
  │    ├─► Match with provider.primaryCategory
  │    └─► Keep providers offering requested services
  │
  ├─► STEP 3: Availability Check
  │    ├─► For each provider:
  │    │    └─► computeAvailableSlots(providerId, date, settings)
  │    │         └─► Check if requested slot is available
  │    └─► Keep only providers with slot available
  │
  ├─► STEP 4: Distance Filtering (if lat/lng provided)
  │    ├─► Calculate distance from user to provider
  │    ├─► maxServiceRadiusKm (default: 5 km)
  │    └─► Keep providers within radius
  │
  ├─► STEP 5: Subscription Priority (SWM Pro Partners)
  │    ├─► Check provider subscription status
  │    ├─► Pro partners get priority
  │    └─► Sort by subscription tier
  │
  ├─► STEP 6: Rating & Experience Sort
  │    ├─► Sort by rating (descending)
  │    └─► Then by experience (descending)
  │
  └─► STEP 7: Limit Results
       ├─► providerSearchLimit (default: 5)
       └─► Return top N provider IDs
```

### Assignment Strategies

```
┌──────────────────────────────────────────────────────────┐
│           PROVIDER ASSIGNMENT STRATEGIES                  │
└──────────────────────────────────────────────────────────┘

1. PREFERRED PROVIDER
   ├─► User selects specific provider
   ├─► Check if provider is in candidate list
   ├─► YES → Assign immediately
   └─► NO → Return error "PREFERRED_PROVIDER_BUSY"

2. ANY PROFESSIONAL (Auto-Assign)
   ├─► Round-robin from candidate list
   ├─► Skip rejected providers
   ├─► Set 10-minute hold (expiresAt)
   └─► Assign to next available

3. NO ASSIGNMENT (Admin Escalation)
   ├─► No candidates found
   ├─► status: "unassigned"
   ├─► adminEscalated: true
   └─► Notify admin & vendor
```

---

## 🔄 Status Lifecycle

### Booking Status Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                  BOOKING STATUS LIFECYCLE                         │
└──────────────────────────────────────────────────────────────────┘

[CREATION]
   │
   ├─► pending
   │    ├─► Booking created
   │    ├─► Provider assigned (or unassigned)
   │    ├─► Waiting for provider response
   │    └─► expiresAt: now + 10 minutes
   │
   ├─► PROVIDER ACTIONS:
   │    │
   │    ├─► ACCEPT
   │    │    └─► accepted
   │    │         ├─► Provider confirmed
   │    │         ├─► User notified
   │    │         └─► Slot locked
   │    │
   │    └─► REJECT
   │         ├─► Is Preferred Provider?
   │         │    ├─► YES → unassigned
   │         │    │    ├─► Notify user "provider_unavailable"
   │         │    │    └─► Escalate to admin/vendor
   │         │    │
   │         │    └─► NO → Check time to slot
   │         │         ├─► < 30 min → expired
   │         │         │    ├─► Notify user "booking_expired"
   │         │         │    └─► Escalate to admin/vendor
   │         │         │
   │         │         └─► >= 30 min → Reassign
   │         │              ├─► Add to rejectedProviders
   │         │              ├─► Pick next from candidateProviders
   │         │              ├─► assignedProvider = nextProvider
   │         │              ├─► status: "pending"
   │         │              └─► Notify next provider
   │
   ├─► accepted
   │    ├─► Provider confirmed
   │    ├─► Waiting for service time
   │    └─► Provider can update to:
   │         ├─► travelling
   │         ├─► arrived
   │         └─► in_progress
   │
   ├─► travelling
   │    ├─► Provider en route
   │    ├─► User can track location
   │    └─► Next: arrived
   │
   ├─► arrived
   │    ├─► Provider at location
   │    ├─► Waiting to start service
   │    └─► Next: in_progress
   │
   ├─► in_progress
   │    ├─► Service being delivered
   │    ├─► Provider can upload images
   │    └─► Next: completed
   │
   ├─► completed
   │    ├─► Service finished
   │    ├─► OTP verification
   │    ├─► Payment settlement
   │    ├─► Commission calculated
   │    ├─► Ledger entries created
   │    └─► User can leave feedback
   │
   ├─► cancelled
   │    ├─► User/Provider/Admin cancelled
   │    ├─► Refund policy applied
   │    ├─► Slot released
   │    └─► Notifications sent
   │
   ├─► expired
   │    ├─► No provider accepted in time
   │    ├─► Slot time passed
   │    ├─► Refund processed
   │    └─► Escalated to admin
   │
   └─► unassigned
        ├─► No provider available
        ├─► Preferred provider rejected
        ├─► Admin intervention required
        └─► Vendor notified
```

### Provider Rejection Penalties

```
Provider Rejects Booking
  │
  ├─► Increment rejectCount
  │
  ├─► Check 24-hour window
  │    ├─► New window? → Reset count to 1
  │    └─► Same window? → Increment count
  │
  ├─► rejectCount >= 3?
  │    ├─► YES:
  │    │    ├─► approvalStatus = "blocked"
  │    │    ├─► blockedUntil = now + 24 hours
  │    │    ├─► rating -= 0.5
  │    │    └─► Cannot receive new bookings
  │    │
  │    └─► NO: Continue normal operation
  │
  └─► After 24 hours:
       └─► rejectCount resets to 0
```

---

## 🧩 Key Components

### 1. Slot Computation (`backend/src/lib/availability.js`)
- **computeAvailableSlots()**: Main function
- **Caching**: Redis with 5-minute TTL
- **Invalidation**: Version-based cache keys
- **Business Rules**: Buffer, lead time, service window

### 2. Assignment Logic (`backend/src/lib/assignment.js`)
- **pickNextProviderForBooking()**: Round-robin selection
- **computeExpiresAt()**: 10-minute hold calculation
- **Candidate filtering**: Zone, service, availability

### 3. Booking Controller (`backend/src/modules/bookings/controllers/bookings.controller.js`)
- **create()**: Main booking creation
- **quote()**: Price calculation
- **list()**: User's bookings
- **getById()**: Booking details
- **track()**: Real-time tracking

### 4. Provider Controller (`backend/src/modules/provider/controllers/provider.controller.js`)
- **listAssignedBookings()**: Provider's bookings
- **updateBookingStatus()**: Status transitions
- **Rejection handling**: Reassignment logic

---

## 💾 Database Models

### Booking Model
```javascript
{
  customerId: String,
  customerName: String,
  services: [{
    name: String,
    price: Number,
    duration: String,
    category: String,
    serviceType: String
  }],
  totalAmount: Number,
  discount: Number,
  prepaidAmount: Number,
  balanceAmount: Number,
  paymentStatus: String,
  address: {
    houseNo: String,
    area: String,
    landmark: String,
    city: String,
    zone: String,
    lat: Number,
    lng: Number
  },
  slot: {
    date: String,      // "YYYY-MM-DD"
    time: String       // "09:00 AM"
  },
  slotStartAt: Date,   // Computed datetime
  slotEndAt: Date,     // Computed datetime
  bookingType: String, // "instant" | "scheduled"
  status: String,      // "pending" | "accepted" | "completed" | ...
  notificationStatus: String, // "immediate" | "queued"
  assignedProvider: String,
  maintainProvider: String,  // Preferred provider
  candidateProviders: [String],
  rejectedProviders: [String],
  assignmentIndex: Number,
  lastAssignedAt: Date,
  expiresAt: Date,
  adminEscalated: Boolean,
  otp: String,
  createdAt: Date,
  updatedAt: Date
}
```

### ProviderDayAvailability Model
```javascript
{
  providerId: String,
  date: String,        // "YYYY-MM-DD"
  availableSlots: [String], // ["09:00 AM", "09:30 AM", ...]
  createdAt: Date,
  updatedAt: Date
}
```

### LeaveRequest Model
```javascript
{
  providerId: String,
  startAt: Date,
  endAt: Date,
  reason: String,
  status: String,      // "pending" | "approved" | "rejected"
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔐 Business Rules

### 1. Slot Availability Rules
- **Buffer Time**: 30 minutes between bookings (configurable)
- **Lead Time**: Minimum advance booking time (default: 30 min)
- **Service Window**: 08:00 AM - 07:00 PM (configurable)
- **Max Booking Days**: 6 days in advance (configurable)
- **Slot Interval**: 30 minutes

### 2. Assignment Rules
- **Auto-Assign**: Enabled by default (admin toggle)
- **Provider Limit**: Top 5 candidates per slot
- **Distance Limit**: 5 km radius (if GPS available)
- **Hold Time**: 10 minutes for provider response
- **Rejection Limit**: 3 rejections in 24 hours → 24-hour block

### 3. Payment Rules
- **Instant Bookings**: No advance payment
- **Scheduled Bookings**: Advance payment based on category
- **Advance Percentage**: Defined per category (0-100%)
- **Minimum Booking**: ₹500 (configurable)

### 4. Notification Rules
- **Office Hours**: 09:00 AM - 09:00 PM
- **Outside Hours**: Notifications queued
- **Provider Quiet Hours**: 07:00 AM - 10:00 PM
- **Escalation**: Admin + Vendor notified on failures

---

## 📊 Flow Diagrams

### High-Level System Flow
```
User → Select Services → Choose Address → View Slots → Select Slot
  → Choose Provider (Optional) → Review & Pay → Booking Created
  → Provider Notified → Provider Accepts → Service Delivered
  → Payment Settled → Feedback → Completed
```

### Slot Availability Check
```
Request → Cache Check → Leave Check → Availability Check
  → Booking Check → Business Rules → Filter → Return Slots
```

### Provider Assignment
```
Booking Created → Build Candidates → Preferred Provider?
  → YES: Assign Preferred → NO: Auto-Assign Round-Robin
  → Set Expiry → Notify Provider → Wait for Response
```

### Rejection Handling
```
Provider Rejects → Preferred? → YES: Unassign + Escalate
  → NO: Time Check → < 30 min: Expire + Escalate
  → >= 30 min: Next Candidate? → YES: Reassign
  → NO: Unassign + Escalate
```

---

## 🎓 Key Insights

### 1. Slot Management
- **Dynamic Computation**: Slots computed on-demand, not pre-generated
- **Cache Strategy**: Redis with version-based invalidation
- **Fallback Logic**: Default slots if no custom availability set

### 2. Provider Matching
- **Zone-First**: Strict zone matching, no city fallback
- **Service-Type**: Must offer requested service categories
- **Availability**: Real-time slot availability check
- **Distance**: Optional GPS-based filtering

### 3. Assignment Strategy
- **Preferred Priority**: User's choice takes precedence
- **Round-Robin**: Fair distribution among candidates
- **Rejection Handling**: Automatic reassignment with penalties
- **Escalation**: Admin/Vendor intervention when needed

### 4. Reliability Features
- **Cache Invalidation**: Ensures fresh availability data
- **Hold Mechanism**: 10-minute provider response window
- **Fallback Paths**: Multiple escalation strategies
- **Audit Trail**: BookingLog tracks all state changes

---

## 🚀 Performance Optimizations

1. **Redis Caching**: 5-minute TTL for slot availability
2. **Version-Based Invalidation**: Incremental cache keys
3. **Candidate Limiting**: Max 5 providers per search
4. **Lean Queries**: Selective field projection
5. **Parallel Processing**: Concurrent slot computation

---

## 📝 Notes for Developers

1. **Slot Format**: Always use "HH:MM AM/PM" format
2. **Date Format**: Always use "YYYY-MM-DD" ISO format
3. **Cache Keys**: Include all relevant parameters
4. **Invalidation**: Call after any booking/availability change
5. **Testing**: Test with different timezones and edge cases

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Author**: Senior Full Stack Developer Analysis  
**Status**: Production Documentation

