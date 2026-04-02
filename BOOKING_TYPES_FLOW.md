# Booking Types Management - Flow Diagram

## Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN PANEL                              │
│                     App Data Section                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Tabs: [Parent Categories] [Subcategories] [Services]          │
│        [Spotlights] [Gallery] [Testimonials]                   │
│        [Booking Types] ← NEW  [System Core]                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BOOKING TYPES TAB                            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐    │
│  │  Booking Types              [+ Add Booking Type]      │    │
│  │  Manage booking types that users can select           │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐    │
│  │  ⚡ Instant Booking                    [Edit] [Delete] │    │
│  │     Pro reaches within 60 mins                        │    │
│  │     ID: instant                                       │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐    │
│  │  📅 Pre-book Service                  [Edit] [Delete] │    │
│  │     Choose your own date & time                       │    │
│  │     ID: scheduled                                     │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐    │
│  │  ✨ Custom Package                    [Edit] [Delete] │    │
│  │     For events & bulk bookings                        │    │
│  │     ID: customize                                     │    │
│  └───────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## CRUD Operations Flow

### 1. CREATE Flow

```
Admin clicks [+ Add Booking Type]
         │
         ▼
┌─────────────────────────────────────┐
│  Create New Booking Type Form      │
│                                     │
│  ID:          [_____________]      │
│  Label:       [_____________]      │
│  Icon:        [_____________]      │
│  Description: [_____________]      │
│                                     │
│  [Cancel]  [Create]                │
└─────────────────────────────────────┘
         │
         ▼
Admin fills form & clicks [Create]
         │
         ▼
Frontend validates input
         │
         ▼
POST /admin/booking-types
         │
         ▼
Backend validates & checks duplicate
         │
         ├─── Duplicate ID? ──→ Error: "ID already exists"
         │
         ▼
Create in MongoDB
         │
         ▼
Invalidate cache
         │
         ▼
Return success
         │
         ▼
Frontend shows success toast
         │
         ▼
Refresh list
         │
         ▼
New booking type appears in list
```

---

### 2. READ Flow

```
Admin opens Booking Types tab
         │
         ▼
Frontend calls GET /admin/booking-types
         │
         ▼
Backend fetches from MongoDB
         │
         ▼
Return all booking types
         │
         ▼
Frontend displays list
         │
         ▼
┌─────────────────────────────────────┐
│  ⚡ Instant Booking                 │
│  📅 Pre-book Service                │
│  ✨ Custom Package                  │
└─────────────────────────────────────┘
```

---

### 3. UPDATE Flow

```
Admin clicks [Edit] button
         │
         ▼
Row enters edit mode
         │
         ▼
┌─────────────────────────────────────┐
│  ID:          [instant] (disabled)  │
│  Label:       [Instant Booking]     │
│  Icon:        [⚡]                   │
│  Description: [Pro reaches...]      │
│                                     │
│  [Cancel]  [Save Changes]          │
└─────────────────────────────────────┘
         │
         ▼
Admin edits fields & clicks [Save]
         │
         ▼
Frontend validates input
         │
         ▼
PATCH /admin/booking-types/:id
         │
         ▼
Backend validates & updates
         │
         ▼
Update in MongoDB
         │
         ▼
Invalidate cache
         │
         ▼
Return success
         │
         ▼
Frontend shows success toast
         │
         ▼
Exit edit mode & refresh
         │
         ▼
Updated data appears in list
```

---

### 4. DELETE Flow

```
Admin clicks [Delete] button
         │
         ▼
Confirmation dialog appears
         │
         ▼
"Are you sure you want to delete?"
         │
         ├─── [Cancel] ──→ Close dialog
         │
         ▼
     [Confirm]
         │
         ▼
DELETE /admin/booking-types/:id
         │
         ▼
Backend checks if type is in use
         │
         ├─── In use? ──→ Error: "Cannot delete, type in use"
         │                 Shows: X categories, Y services using it
         │
         ▼
Delete from MongoDB
         │
         ▼
Invalidate cache
         │
         ▼
Return success
         │
         ▼
Frontend shows success toast
         │
         ▼
Remove from list
         │
         ▼
Booking type disappears
```

---

## Integration Flow

### Category Form Integration

```
Admin creates/edits Category
         │
         ▼
┌─────────────────────────────────────┐
│  Category Form                      │
│                                     │
│  Name:         [_____________]      │
│  Gender:       [_____________]      │
│  Service Type: [_____________]      │
│  Booking Type: [▼ Select Type]     │  ← NEW DROPDOWN
│                 ├─ ⚡ Instant       │
│                 ├─ 📅 Scheduled    │
│                 └─ ✨ Customize    │
│                                     │
│  [Save]                             │
└─────────────────────────────────────┘
         │
         ▼
Category saved with bookingType field
         │
         ▼
Category.bookingType = "instant"
```

---

### Service Form Integration

```
Admin creates/edits Service
         │
         ▼
┌─────────────────────────────────────┐
│  Service Form                       │
│                                     │
│  Name:         [_____________]      │
│  Price:        [_____________]      │
│  Duration:     [_____________]      │
│  Category:     [_____________]      │
│  Booking Type: [▼ Select Type]     │  ← NEW DROPDOWN
│                 ├─ ⚡ Instant       │
│                 ├─ 📅 Scheduled    │
│                 └─ ✨ Customize    │
│                                     │
│  [Save]                             │
└─────────────────────────────────────┘
         │
         ▼
Service saved with bookingType field
         │
         ▼
Service.bookingType = "scheduled"
```

---

## User Flow (Frontend)

### User Selects Booking Type

```
User opens booking page
         │
         ▼
GET /content/booking-types
         │
         ▼
┌─────────────────────────────────────┐
│  Select Booking Type                │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  ⚡ Instant Booking          │   │
│  │  Pro reaches within 60 mins │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  📅 Pre-book Service         │   │
│  │  Choose your own date & time│   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  ✨ Custom Package           │   │
│  │  For events & bulk bookings │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
         │
         ▼
User selects "Instant Booking"
         │
         ▼
bookingType = "instant"
         │
         ▼
Proceed to service selection
```

---

## Data Flow Diagram

```
┌──────────────┐
│   ADMIN      │
│   PANEL      │
└──────┬───────┘
       │
       │ CRUD Operations
       ▼
┌──────────────────────────────────────┐
│  Backend API                         │
│  /admin/booking-types                │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  GET    - List all types       │ │
│  │  POST   - Create new type      │ │
│  │  PATCH  - Update type          │ │
│  │  DELETE - Delete type          │ │
│  └────────────────────────────────┘ │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  MongoDB                             │
│  BookingType Collection              │
│                                      │
│  { id, label, icon, description }    │
└──────────────┬───────────────────────┘
               │
               │ Referenced by
               ▼
┌──────────────────────────────────────┐
│  Category Collection                 │
│  { ..., bookingType: "instant" }     │
└──────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Service Collection                  │
│  { ..., bookingType: "scheduled" }   │
└──────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Booking Collection                  │
│  { ..., bookingType: "customize" }   │
└──────────────────────────────────────┘
               │
               │ Public API
               ▼
┌──────────────────────────────────────┐
│  /content/booking-types              │
│  (Cached in Redis)                   │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  USER PANEL                          │
│  Booking Type Selection              │
└──────────────────────────────────────┘
```

---

## Error Handling Flow

### Duplicate ID Error

```
Admin creates booking type with ID "instant"
         │
         ▼
POST /admin/booking-types
         │
         ▼
Backend checks: BookingType.findOne({ id: "instant" })
         │
         ▼
Found existing? YES
         │
         ▼
Return 400 Error
         │
         ▼
Frontend shows error toast
         │
         ▼
"Booking type ID already exists"
```

---

### Delete In-Use Error

```
Admin tries to delete "instant" booking type
         │
         ▼
DELETE /admin/booking-types/instant
         │
         ▼
Backend checks usage:
  - Category.countDocuments({ bookingType: "instant" })
  - Service.countDocuments({ bookingType: "instant" })
         │
         ▼
Found usage? YES (5 categories, 12 services)
         │
         ▼
Return 400 Error
         │
         ▼
Frontend shows error toast
         │
         ▼
"Cannot delete booking type that is in use"
"5 categories and 12 services are using this type"
```

---

## Cache Invalidation Flow

```
Admin creates/updates/deletes booking type
         │
         ▼
Backend operation successful
         │
         ▼
Call bumpContentVersion()
         │
         ▼
Redis cache cleared
         │
         ▼
Next request to /content/booking-types
         │
         ▼
Cache miss
         │
         ▼
Fetch fresh data from MongoDB
         │
         ▼
Cache in Redis
         │
         ▼
Return to user
```

---

## State Management Flow

### Frontend State

```
BookingTypesManager Component
         │
         ├─ bookingTypes: []        (list of all types)
         ├─ loading: true           (loading state)
         ├─ editingId: null         (currently editing type ID)
         ├─ showCreateForm: false   (create form visibility)
         └─ formData: {}            (create form data)
              │
              ├─ id: ""
              ├─ label: ""
              ├─ icon: ""
              └─ description: ""
```

---

## Summary

This flow diagram shows:

1. ✅ Complete CRUD operations
2. ✅ Integration with Category/Service forms
3. ✅ User-facing booking type selection
4. ✅ Data flow from admin to user
5. ✅ Error handling scenarios
6. ✅ Cache invalidation process
7. ✅ State management

**All flows are clear and ready for implementation!** 🚀
