# 🏗️ TECHNICAL ARCHITECTURE - SLOTS & BOOKING SYSTEM

## 📚 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND LAYER                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   User App  │  │ Provider App│  │  Vendor App │  │  Admin App  │   │
│  │   (React)   │  │   (React)   │  │   (React)   │  │   (React)   │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│         │                │                │                │            │
│         └────────────────┴────────────────┴────────────────┘            │
│                                  │                                       │
└──────────────────────────────────┼───────────────────────────────────────┘
                                   │
                                   │ HTTPS/REST API
                                   │ WebSocket (Socket.io)
                                   │
┌──────────────────────────────────┼───────────────────────────────────────┐
│                            BACKEND LAYER                                  │
├──────────────────────────────────┼───────────────────────────────────────┤
│                                  │                                       │
│  ┌───────────────────────────────▼────────────────────────────────┐    │
│  │                      Express.js Server                          │    │
│  │                    (Node.js Runtime)                            │    │
│  └───────────────────────────────┬────────────────────────────────┘    │
│                                   │                                      │
│  ┌────────────────────────────────┼──────────────────────────────────┐ │
│  │                         MIDDLEWARE                                │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │ │
│  │  │   Auth   │  │   CORS   │  │  Upload  │  │  Roles   │        │ │
│  │  │   JWT    │  │          │  │Cloudinary│  │          │        │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                   │                                      │
│  ┌────────────────────────────────┼──────────────────────────────────┐ │
│  │                         CONTROLLERS                               │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │ │
│  │  │ Bookings │  │ Provider │  │   User   │  │  Admin   │        │ │
│  │  │Controller│  │Controller│  │Controller│  │Controller│        │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                   │                                      │
│  ┌────────────────────────────────┼──────────────────────────────────┐ │
│  │                         BUSINESS LOGIC                            │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │ │
│  │  │  Slots   │  │Availability│ │Assignment│ │  Notify  │        │ │
│  │  │  Logic   │  │  Compute  │  │ Matching │  │  System  │        │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │ │
│  │  │ Payment  │  │  Refund  │  │Subscription│ │  Geo     │        │ │
│  │  │ Service  │  │  Policy  │  │  Ledger   │  │ Matching │        │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                   │                                      │
└───────────────────────────────────┼──────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼──────────────────────────────────────┐
│                         DATA LAYER                                        │
├───────────────────────────────────┼──────────────────────────────────────┤
│                                   │                                       │
│  ┌────────────────────────────────▼────────────────────────────────┐   │
│  │                         MongoDB                                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │   │
│  │  │ Bookings │  │ Providers│  │   Users  │  │  Vendors │       │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │   │
│  │  │  Slots   │  │  Leaves  │  │  Logs    │  │ Settings │       │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                         Redis Cache                               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │   │
│  │  │  Slots   │  │ Sessions │  │  Tokens  │  │  Queues  │        │   │
│  │  │  Cache   │  │          │  │          │  │          │        │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                                     │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │Razorpay  │  │   FCM    │  │   SMS    │  │Cloudinary│  │OpenStreetMap│
│  │ Payment  │  │  Push    │  │ Gateway  │  │  Images  │  │  Geocoding │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Database Schema

### Core Collections

#### 1. Booking Collection
```javascript
{
  _id: ObjectId,
  customerId: String,              // User ID
  customerName: String,
  services: [{
    name: String,
    price: Number,
    duration: String,              // "1-2 hours", "30 mins"
    category: String,              // Category ID
    serviceType: String            // Service Type ID
  }],
  totalAmount: Number,
  discount: Number,
  convenienceFee: Number,
  prepaidAmount: Number,
  balanceAmount: Number,
  paymentStatus: String,           // "Pending", "Paid", "Refunded"
  
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
    date: String,                  // "2024-12-25"
    time: String                   // "09:00 AM"
  },
  slotStartAt: Date,               // Computed datetime
  slotEndAt: Date,                 // Computed datetime
  
  bookingType: String,             // "instant", "scheduled"
  status: String,                  // "pending", "accepted", "completed"...
  notificationStatus: String,      // "immediate", "queued"
  
  // Assignment fields
  assignedProvider: String,        // Provider ID
  maintainProvider: String,        // Preferred provider ID
  candidateProviders: [String],    // Available provider IDs
  rejectedProviders: [String],     // Rejected provider IDs
  assignmentIndex: Number,         // Current index in candidates
  lastAssignedAt: Date,
  expiresAt: Date,                 // Assignment expiry
  adminEscalated: Boolean,
  
  // Service fields
  otp: String,                     // 6-digit OTP
  beforeImages: [String],
  afterImages: [String],
  productImages: [String],
  providerImages: [String],
  providerFeedback: String,
  
  // Commission
  commissionAmount: Number,
  commissionRate: Number,
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}

// Indexes
db.bookings.createIndex({ customerId: 1, createdAt: -1 })
db.bookings.createIndex({ assignedProvider: 1, "slot.date": 1 })
db.bookings.createIndex({ status: 1, expiresAt: 1 })
db.bookings.createIndex({ "slot.date": 1, "slot.time": 1 })
db.bookings.createIndex({ "address.city": 1, "address.zone": 1 })
```

#### 2. ProviderDayAvailability Collection
```javascript
{
  _id: ObjectId,
  providerId: String,              // Provider ID
  date: String,                    // "2024-12-25"
  availableSlots: [String],        // ["09:00 AM", "09:30 AM", ...]
  createdAt: Date,
  updatedAt: Date
}

// Indexes
db.providerDayAvailability.createIndex({ providerId: 1, date: 1 }, { unique: true })
```

#### 3. LeaveRequest Collection
```javascript
{
  _id: ObjectId,
  providerId: String,
  startAt: Date,
  endAt: Date,
  reason: String,
  status: String,                  // "pending", "approved", "rejected"
  approvedBy: String,              // Admin/Vendor ID
  approvedAt: Date,
  createdAt: Date,
  updatedAt: Date
}

// Indexes
db.leaveRequests.createIndex({ providerId: 1, status: 1 })
db.leaveRequests.createIndex({ startAt: 1, endAt: 1 })
```

#### 4. ProviderAccount Collection
```javascript
{
  _id: ObjectId,
  phone: String,
  name: String,
  email: String,
  gender: String,
  dob: Date,
  experience: String,
  
  // Location
  city: String,
  zones: [String],                 // Service zones
  addressLine1: String,
  area: String,
  lat: Number,
  lng: Number,
  currentLocation: {
    lat: Number,
    lng: Number,
    updatedAt: Date
  },
  
  // Services
  primaryCategory: [String],       // Service types
  specializations: [String],       // Categories
  services: [String],              // Service names
  
  // KYC
  aadharFront: String,
  aadharBack: String,
  panCard: String,
  certifications: [{
    name: String,
    type: String,
    data: String
  }],
  
  // Bank
  bankName: String,
  accountNumber: String,
  ifscCode: String,
  upiId: String,
  
  // Status
  approvalStatus: String,          // "pending", "approved", "rejected", "blocked"
  blockedUntil: Date,
  rating: Number,
  profilePhoto: String,
  
  // Rejection tracking
  rejectCount: Number,
  rejectWindowStart: Number,       // Timestamp
  
  // Subscription
  subscriptionPlan: String,
  subscriptionStatus: String,
  
  createdAt: Date,
  updatedAt: Date
}

// Indexes
db.providerAccounts.createIndex({ phone: 1 }, { unique: true })
db.providerAccounts.createIndex({ city: 1, zones: 1 })
db.providerAccounts.createIndex({ approvalStatus: 1 })
db.providerAccounts.createIndex({ primaryCategory: 1 })
```

#### 5. User Collection
```javascript
{
  _id: ObjectId,
  phone: String,
  name: String,
  email: String,
  profilePhoto: String,
  
  addresses: [{
    houseNo: String,
    area: String,
    landmark: String,
    city: String,
    zone: String,
    lat: Number,
    lng: Number
  }],
  
  // Subscription
  subscriptionPlan: String,
  subscriptionStatus: String,
  subscriptionExpiresAt: Date,
  
  createdAt: Date,
  updatedAt: Date
}

// Indexes
db.users.createIndex({ phone: 1 }, { unique: true })
db.users.createIndex({ email: 1 })
```

---

## 🔧 Core Libraries & Utilities

### 1. Slots Library (`backend/src/lib/slots.js`)

**Purpose**: Time slot management and parsing

**Key Functions**:
```javascript
// Default 30-minute slots from 07:00 AM to 10:30 PM
DEFAULT_TIME_SLOTS = [
  "07:00 AM", "07:30 AM", ..., "10:30 PM"
]

// Check if date is ISO format (YYYY-MM-DD)
isIsoDate(dateStr)

// Check if slot label is valid
isValidSlotLabel(slotLabel)

// Generate default slots map with time window
defaultSlotsMap(startTime, endTime)

// Parse slot label to hour/minute
parseSlotLabelToHM("09:00 AM") 
// → { hour: 9, minute: 0 }

// Convert slot to local datetime
slotLabelToLocalDateTime("2024-12-25", "09:00 AM")
// → Date object

// Parse duration string to minutes
parseDurationToMinutes("1-2 hours") 
// → 120
```

### 2. Availability Library (`backend/src/lib/availability.js`)

**Purpose**: Compute provider slot availability

**Key Functions**:
```javascript
// Main availability computation
async computeAvailableSlots(
  providerId,
  date,
  settings,
  { useCache, requestedDurationMinutes }
)
// Returns: { date, slots: [...], slotMap: {...} }

// Invalidate cached slots
async invalidateProviderSlots(providerId, dates)
```

**Algorithm**:
1. Check Redis cache (5-min TTL)
2. Check leave requests
3. Load provider day availability
4. Load existing bookings
5. Apply business rules:
   - Buffer time (30 min)
   - Service window (08:00-19:00)
   - Lead time (30 min)
   - Busy intervals
   - Requested duration
6. Filter past slots (for today)
7. Cache result

### 3. Assignment Library (`backend/src/lib/assignment.js`)

**Purpose**: Provider assignment logic

**Key Functions**:
```javascript
// Pick next provider from candidates
async pickNextProviderForBooking(booking, startIndex)
// Returns: { providerId, index }

// Calculate assignment expiry
computeExpiresAt(assignedAt)
// Returns: Date (assignedAt + 10 minutes)
```

### 4. Assignment Candidates Library (`backend/src/lib/assignmentCandidates.js`)

**Purpose**: Build list of eligible providers

**Key Functions**:
```javascript
async buildAssignmentCandidates({
  address,
  slot,
  items,
  settings,
  customerId,
  subscriptionSnapshot,
  requestedDurationMinutes,
  useCache
})
// Returns: { candidateProviders: [...] }
```

**Filtering Steps**:
1. Zone-based filtering
2. Service type matching
3. Availability check
4. Distance filtering (5 km)
5. Subscription priority
6. Rating & experience sort
7. Limit to top 5

### 5. Notification Library (`backend/src/lib/notify.js`)

**Purpose**: Multi-channel notifications

**Channels**:
- Push notifications (FCM)
- SMS (India Hub)
- Email
- In-app notifications
- WebSocket real-time

**Key Functions**:
```javascript
async notify({
  recipientId,
  recipientRole,
  type,
  meta,
  respectProviderQuietHours
})
```

**Notification Types**:
- `booking_created`
- `booking_assigned`
- `booking_accepted`
- `booking_completed`
- `booking_cancelled`
- `booking_expired`
- `booking_escalated`
- `provider_unavailable`

---

## 🔐 Security & Authentication

### JWT Authentication
```javascript
// Token structure
{
  sub: userId,           // Subject (user ID)
  role: "user",          // Role (user/provider/vendor/admin)
  iat: timestamp,        // Issued at
  exp: timestamp         // Expiry
}
```

### Middleware Chain
```javascript
// Auth middleware
auth.js → Verify JWT → Attach req.user

// Role middleware
roles.js → Check user role → Allow/Deny

// Upload middleware
upload.js → Cloudinary integration → File upload
```

### API Security
- CORS enabled
- Rate limiting
- Input validation (express-validator)
- SQL injection prevention (Mongoose)
- XSS protection (sanitization)

---

## 📊 Caching Strategy

### Redis Cache Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    REDIS CACHE KEYS                          │
└─────────────────────────────────────────────────────────────┘

1. Slot Availability Cache
   Key: slots:{providerId}:{date}:{version}:{settingsKey}:{duration}
   TTL: 300 seconds (5 minutes)
   Value: JSON { date, slots, slotMap }

2. Slot Version Counter
   Key: slots:ver:{providerId}:{date}
   TTL: None (persistent)
   Value: Integer (incremented on invalidation)

3. Session Cache
   Key: session:{userId}
   TTL: 3600 seconds (1 hour)
   Value: JSON { user data }

4. JWT Blacklist
   Key: blacklist:{token}
   TTL: Token expiry time
   Value: "1"
```

### Cache Invalidation Triggers
1. New booking created
2. Booking status changed
3. Provider availability updated
4. Leave request approved/rejected
5. Provider settings changed

---

## 🔄 Real-Time Features

### WebSocket (Socket.io)

**Events**:
```javascript
// Client → Server
socket.emit('join-room', { bookingId })
socket.emit('update-location', { lat, lng })

// Server → Client
socket.emit('booking-update', { booking })
socket.emit('provider-location', { lat, lng })
socket.emit('status-change', { status })
```

**Rooms**:
- `booking:{bookingId}` - Booking-specific updates
- `user:{userId}` - User notifications
- `provider:{providerId}` - Provider notifications

---

## 📈 Performance Optimizations

### 1. Database Optimizations
- Compound indexes on frequently queried fields
- Lean queries (`.lean()`) for read-only operations
- Selective field projection
- Connection pooling

### 2. Caching Strategy
- Redis for hot data (slots, sessions)
- 5-minute TTL for slot availability
- Version-based cache invalidation
- Lazy cache warming

### 3. Query Optimizations
- Limit candidate providers to 5
- Parallel slot computation
- Aggregation pipelines for analytics
- Pagination for list endpoints

### 4. API Optimizations
- Response compression (gzip)
- ETags for conditional requests
- Batch operations where possible
- Async/await for I/O operations

---

## 🚨 Error Handling

### Error Types
```javascript
// Validation errors
{ error: "Invalid input", code: "VALIDATION_ERROR" }

// Business logic errors
{ error: "Slot unavailable", code: "SLOT_UNAVAILABLE" }
{ error: "Provider busy", code: "PREFERRED_PROVIDER_BUSY" }

// System errors
{ error: "Internal server error", code: "INTERNAL_ERROR" }
```

### Error Responses
```javascript
// 400 Bad Request - Validation errors
// 401 Unauthorized - Auth errors
// 403 Forbidden - Permission errors
// 404 Not Found - Resource not found
// 409 Conflict - Business logic conflicts
// 500 Internal Server Error - System errors
```

---

## 📝 Logging & Monitoring

### Log Levels
- **INFO**: Normal operations
- **WARN**: Potential issues
- **ERROR**: Errors requiring attention
- **DEBUG**: Development debugging

### Key Metrics
- Booking creation rate
- Provider acceptance rate
- Average response time
- Cache hit rate
- Error rate by endpoint
- Slot availability computation time

### Audit Trail
```javascript
// BookingLog collection
{
  action: String,              // "booking:create", "booking:status"
  userId: String,
  bookingId: String,
  meta: Object,                // Additional context
  createdAt: Date
}
```

---

## 🔧 Configuration Management

### Environment Variables
```bash
# Server
PORT=5000
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/swm
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRY=7d

# Payment
RAZORPAY_KEY_ID=rzp_xxx
RAZORPAY_KEY_SECRET=xxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

# SMS
SMS_API_KEY=xxx
SMS_SENDER_ID=SWMAPP

# FCM
FCM_SERVER_KEY=xxx
```

### Settings Collections
- **BookingSettings**: Booking rules
- **OfficeSettings**: Office hours, auto-assign
- **PaymentSettings**: Payment gateway config

---

## 🎯 API Endpoints

### User Endpoints
```
POST   /api/bookings/quote              - Get price quote
POST   /api/bookings                    - Create booking
GET    /api/bookings                    - List user bookings
GET    /api/bookings/:id                - Get booking details
GET    /api/bookings/:id/track          - Track booking
GET    /api/bookings/available-slots    - Get available slots
POST   /api/bookings/custom-enquiry     - Create custom enquiry
```

### Provider Endpoints
```
GET    /api/provider/bookings           - List assigned bookings
PUT    /api/provider/bookings/:id       - Update booking status
GET    /api/provider/availability       - Get availability
PUT    /api/provider/availability       - Update availability
POST   /api/provider/leave              - Request leave
PUT    /api/provider/location           - Update location
```

### Admin/Vendor Endpoints
```
GET    /api/admin/bookings              - List all bookings
PUT    /api/admin/bookings/:id          - Update booking
GET    /api/admin/providers             - List providers
PUT    /api/admin/providers/:id         - Update provider
GET    /api/admin/stats                 - Get statistics
```

---

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION DEPLOYMENT                     │
└─────────────────────────────────────────────────────────────┘

                        Load Balancer
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
          ┌─────────┐   ┌─────────┐   ┌─────────┐
          │ Node.js │   │ Node.js │   │ Node.js │
          │Instance1│   │Instance2│   │Instance3│
          └────┬────┘   └────┬────┘   └────┬────┘
               │             │             │
               └─────────────┼─────────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
          ┌─────────┐  ┌─────────┐  ┌─────────┐
          │ MongoDB │  │  Redis  │  │Cloudinary│
          │ Cluster │  │ Cluster │  │   CDN    │
          └─────────┘  └─────────┘  └─────────┘
```

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Purpose**: Technical Reference for Development Team

