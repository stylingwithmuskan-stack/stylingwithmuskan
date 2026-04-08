# 📊 BOOKING FLOW - VISUAL DIAGRAMS

## 🎯 Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE BOOKING ECOSYSTEM                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│   USER   │         │ PROVIDER │         │  VENDOR  │         │  ADMIN   │
│ Customer │         │  Beauty  │         │   Zone   │         │ Platform │
│          │         │   Pro    │         │  Manager │         │   Team   │
└────┬─────┘         └────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                     │                     │
     │ 1. Browse Services │                     │                     │
     ├───────────────────>│                     │                     │
     │                    │                     │                     │
     │ 2. Select Slot     │                     │                     │
     ├───────────────────>│                     │                     │
     │    (Check Availability)                  │                     │
     │                    │                     │                     │
     │ 3. Create Booking  │                     │                     │
     ├───────────────────>│                     │                     │
     │                    │                     │                     │
     │                    │ 4. Notify Provider  │                     │
     │                    │<────────────────────┤                     │
     │                    │                     │                     │
     │                    │ 5. Accept/Reject    │                     │
     │                    ├────────────────────>│                     │
     │                    │                     │                     │
     │ 6. Confirmation    │                     │                     │
     │<───────────────────┤                     │                     │
     │                    │                     │                     │
     │                    │ 7. Service Delivery │                     │
     │<───────────────────┤                     │                     │
     │                    │                     │                     │
     │ 8. Payment         │                     │                     │
     ├───────────────────>│                     │                     │
     │                    │                     │                     │
     │                    │ 9. Commission       │                     │
     │                    ├────────────────────>│                     │
     │                    │                     │                     │
     │                    │                     │ 10. Platform Fee    │
     │                    │                     ├────────────────────>│
     │                    │                     │                     │
     │ 11. Feedback       │                     │                     │
     ├───────────────────>│                     │                     │
     │                    │                     │                     │
     └────────────────────┴─────────────────────┴─────────────────────┘
```

---

## 🔄 Slot Availability Computation

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SLOT AVAILABILITY ALGORITHM                           │
└─────────────────────────────────────────────────────────────────────────┘

                            START
                              │
                              ▼
                    ┌─────────────────┐
                    │  Input Request  │
                    │  - providerId   │
                    │  - date         │
                    │  - duration     │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Check Redis    │
                    │     Cache       │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                  YES               NO
                    │                 │
                    ▼                 ▼
            ┌──────────────┐   ┌──────────────┐
            │ Return Cache │   │ Check Leave  │
            │    Result    │   │   Requests   │
            └──────────────┘   └──────┬───────┘
                                      │
                             ┌────────┴────────┐
                             │                 │
                        On Leave          Available
                             │                 │
                             ▼                 ▼
                    ┌──────────────┐   ┌──────────────┐
                    │ All Slots    │   │ Load Provider│
                    │   = FALSE    │   │ Availability │
                    └──────────────┘   └──────┬───────┘
                                              │
                                              ▼
                                     ┌──────────────┐
                                     │ Has Custom   │
                                     │ Availability?│
                                     └──────┬───────┘
                                            │
                                   ┌────────┴────────┐
                                   │                 │
                                 YES               NO
                                   │                 │
                                   ▼                 ▼
                          ┌──────────────┐   ┌──────────────┐
                          │ Use Custom   │   │ Use Default  │
                          │    Slots     │   │ 07:00-22:00  │
                          └──────┬───────┘   └──────┬───────┘
                                 │                   │
                                 └────────┬──────────┘
                                          │
                                          ▼
                                 ┌──────────────┐
                                 │ Load Existing│
                                 │   Bookings   │
                                 └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │ Mark Booked  │
                                 │ Slots = FALSE│
                                 └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │ Apply Buffer │
                                 │  Time (30m)  │
                                 └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │ Apply Service│
                                 │    Window    │
                                 └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │ Check Lead   │
                                 │     Time     │
                                 └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │ Filter Past  │
                                 │    Slots     │
                                 └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │ Check Busy   │
                                 │  Intervals   │
                                 └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │ Cache Result │
                                 │  (5 min TTL) │
                                 └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │    Return    │
                                 │ Available    │
                                 │    Slots     │
                                 └──────────────┘
                                        │
                                        ▼
                                      END
```

---

## 🎯 Provider Assignment Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROVIDER ASSIGNMENT LOGIC                             │
└─────────────────────────────────────────────────────────────────────────┘

                        Booking Created
                              │
                              ▼
                    ┌─────────────────┐
                    │ Build Candidate │
                    │   Provider List │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Filter by Zone  │
                    │ (Strict Match)  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Filter by       │
                    │ Service Type    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Check Slot      │
                    │ Availability    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Filter by       │
                    │ Distance (5km)  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Sort by Rating  │
                    │ & Experience    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Limit to Top 5  │
                    │   Candidates    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ User Preferred  │
                    │   Provider?     │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                  YES               NO
                    │                 │
                    ▼                 ▼
            ┌──────────────┐   ┌──────────────┐
            │ Is Preferred │   │ Auto-Assign  │
            │ in Candidate │   │   Enabled?   │
            │    List?     │   └──────┬───────┘
            └──────┬───────┘          │
                   │         ┌────────┴────────┐
          ┌────────┴────────┐│                 │
          │                 ││               YES               NO
        YES               NO ││                 │                 │
          │                 ││                 ▼                 ▼
          ▼                 ││        ┌──────────────┐   ┌──────────────┐
  ┌──────────────┐          ││        │ Round-Robin  │   │  Unassigned  │
  │ Assign to    │          ││        │  Selection   │   │   Status     │
  │  Preferred   │          ││        └──────┬───────┘   └──────────────┘
  └──────┬───────┘          ││               │
         │                  ││               ▼
         │                  │└──────>┌──────────────┐
         │                  │        │ Assign to    │
         │                  │        │ Next Provider│
         │                  │        └──────┬───────┘
         │                  │               │
         │                  ▼               │
         │          ┌──────────────┐        │
         │          │ Return Error │        │
         │          │ "PROVIDER_   │        │
         │          │   BUSY"      │        │
         │          └──────────────┘        │
         │                                  │
         └──────────────┬───────────────────┘
                        │
                        ▼
                ┌──────────────┐
                │ Set Expiry   │
                │  (10 min)    │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ Invalidate   │
                │ Slot Cache   │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ Send Push    │
                │ Notification │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ Wait for     │
                │  Response    │
                └──────────────┘
```

---

## 🔄 Booking Status Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BOOKING STATUS STATE MACHINE                          │
└─────────────────────────────────────────────────────────────────────────┘

                        ┌─────────────┐
                        │   PENDING   │◄─────────┐
                        └──────┬──────┘          │
                               │                 │
                    ┌──────────┴──────────┐      │
                    │                     │      │
              ACCEPT│                     │REJECT│
                    │                     │      │
                    ▼                     ▼      │
            ┌──────────────┐      ┌──────────────┐
            │   ACCEPTED   │      │  REASSIGN?   │
            └──────┬───────┘      └──────┬───────┘
                   │                     │
                   │              ┌──────┴──────┐
                   │              │             │
                   │            YES           NO
                   │              │             │
                   │              └─────────────┘
                   │                     │
                   │              ┌──────┴──────┐
                   │              │             │
                   │         PREFERRED?    UNASSIGNED
                   │              │             │
                   │              ▼             ▼
                   │      ┌──────────────┐ ┌──────────────┐
                   │      │  UNASSIGNED  │ │   EXPIRED    │
                   │      └──────────────┘ └──────────────┘
                   │
                   ▼
            ┌──────────────┐
            │  TRAVELLING  │
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │   ARRIVED    │
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │ IN_PROGRESS  │
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │  COMPLETED   │
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │   FEEDBACK   │
            └──────────────┘

        ┌──────────────────────────────┐
        │  CANCELLATION (Any State)    │
        │                              │
        │  User/Provider/Admin         │
        │         ↓                    │
        │    ┌──────────────┐          │
        │    │  CANCELLED   │          │
        │    └──────────────┘          │
        └──────────────────────────────┘
```

---

## 🚨 Provider Rejection Handling

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROVIDER REJECTION FLOW                               │
└─────────────────────────────────────────────────────────────────────────┘

                    Provider Rejects Booking
                              │
                              ▼
                    ┌─────────────────┐
                    │ Increment Reject│
                    │     Counter     │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Check 24-hour   │
                    │     Window      │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
              New Window        Same Window
                    │                 │
                    ▼                 ▼
            ┌──────────────┐   ┌──────────────┐
            │ Reset Count  │   │ Count >= 3?  │
            │   to 1       │   └──────┬───────┘
            └──────────────┘          │
                                ┌─────┴─────┐
                                │           │
                              YES         NO
                                │           │
                                ▼           ▼
                        ┌──────────────┐ ┌──────────────┐
                        │ Block for    │ │  Continue    │
                        │  24 hours    │ │   Normal     │
                        ├──────────────┤ └──────────────┘
                        │ Rating -= 0.5│
                        └──────┬───────┘
                               │
                               ▼
                    ┌─────────────────┐
                    │ Is Preferred    │
                    │   Provider?     │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                  YES               NO
                    │                 │
                    ▼                 ▼
            ┌──────────────┐   ┌──────────────┐
            │  Unassign    │   │ Time to Slot │
            │   Booking    │   │    < 30m?    │
            ├──────────────┤   └──────┬───────┘
            │ Notify User  │          │
            │ "Provider    │   ┌──────┴──────┐
            │ Unavailable" │   │             │
            ├──────────────┤ YES           NO
            │ Escalate to  │   │             │
            │ Admin/Vendor │   ▼             ▼
            └──────────────┘ ┌──────────────┐ ┌──────────────┐
                             │ Mark EXPIRED │ │ Next Provider│
                             ├──────────────┤ │  Available?  │
                             │ Notify User  │ └──────┬───────┘
                             ├──────────────┤        │
                             │ Escalate to  │ ┌──────┴──────┐
                             │ Admin/Vendor │ │             │
                             └──────────────┘YES          NO
                                              │             │
                                              ▼             ▼
                                      ┌──────────────┐ ┌──────────────┐
                                      │ Reassign to  │ │  Unassign    │
                                      │ Next Provider│ │   Booking    │
                                      ├──────────────┤ ├──────────────┤
                                      │ Notify New   │ │ Escalate to  │
                                      │  Provider    │ │ Admin/Vendor │
                                      └──────────────┘ └──────────────┘
```

---

## 💰 Payment & Commission Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PAYMENT & SETTLEMENT FLOW                             │
└─────────────────────────────────────────────────────────────────────────┘

                        Booking Completed
                              │
                              ▼
                    ┌─────────────────┐
                    │ Calculate Total │
                    │    Amount       │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Apply Discounts │
                    │ - Coupon        │
                    │ - Subscription  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ User Payment    │
                    │ (Razorpay)      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Calculate       │
                    │ Commission      │
                    │ (15% default)   │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
            ┌──────────────┐   ┌──────────────┐
            │ Provider     │   │ Platform     │
            │ Settlement   │   │ Commission   │
            │ (85%)        │   │ (15%)        │
            └──────┬───────┘   └──────┬───────┘
                   │                   │
                   ▼                   ▼
            ┌──────────────┐   ┌──────────────┐
            │ Create       │   │ Vendor Share │
            │ Ledger Entry │   │ (if any)     │
            └──────┬───────┘   └──────┬───────┘
                   │                   │
                   └────────┬──────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │ Update Wallet│
                    │   Balances   │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Generate     │
                    │   Invoice    │
                    └──────────────┘
```

---

## 📱 Real-Time Tracking Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    LIVE TRACKING SYSTEM                                  │
└─────────────────────────────────────────────────────────────────────────┘

    USER APP                    BACKEND                    PROVIDER APP
        │                          │                            │
        │ 1. Request Tracking      │                            │
        ├─────────────────────────>│                            │
        │                          │                            │
        │ 2. Return Locations      │                            │
        │<─────────────────────────┤                            │
        │                          │                            │
        │                          │ 3. Provider Updates        │
        │                          │<───────────────────────────┤
        │                          │    Location (GPS)          │
        │                          │                            │
        │                          │ 4. Store in DB             │
        │                          │ (currentLocation)          │
        │                          │                            │
        │ 5. WebSocket Push        │                            │
        │<─────────────────────────┤                            │
        │   (Real-time Update)     │                            │
        │                          │                            │
        │ 6. Update Map            │                            │
        │   (Show Provider Pin)    │                            │
        │                          │                            │
        │ 7. Calculate ETA         │                            │
        │   (Distance/Speed)       │                            │
        │                          │                            │
        │                          │ 8. Status Updates          │
        │                          │<───────────────────────────┤
        │                          │    (Travelling/Arrived)    │
        │                          │                            │
        │ 9. Push Notification     │                            │
        │<─────────────────────────┤                            │
        │   "Provider Arrived"     │                            │
        │                          │                            │
        └──────────────────────────┴────────────────────────────┘
```

---

## 🔔 Notification System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION FLOW                                     │
└─────────────────────────────────────────────────────────────────────────┘

                        Event Triggered
                              │
                              ▼
                    ┌─────────────────┐
                    │ Check Office    │
                    │     Hours       │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
              Within Hours      Outside Hours
                    │                 │
                    ▼                 ▼
            ┌──────────────┐   ┌──────────────┐
            │ Immediate    │   │ Queue for    │
            │ Notification │   │ Next Morning │
            └──────┬───────┘   └──────────────┘
                   │
                   ▼
            ┌──────────────┐
            │ Check User   │
            │ Preferences  │
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │ Send via:    │
            │ - Push (FCM) │
            │ - SMS        │
            │ - Email      │
            │ - In-App     │
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │ Store in     │
            │ Notification │
            │   Database   │
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │ WebSocket    │
            │ Real-time    │
            │   Update     │
            └──────────────┘
```

---

## 🎓 Key Takeaways

### 1. Slot Management
- **Dynamic**: Computed on-demand, not pre-stored
- **Cached**: Redis with 5-minute TTL
- **Invalidated**: On booking/availability changes
- **Flexible**: Custom or default availability

### 2. Provider Matching
- **Zone-First**: Strict zone matching
- **Service-Based**: Must offer requested services
- **Real-Time**: Live availability check
- **Distance-Aware**: GPS-based filtering

### 3. Assignment Logic
- **Preferred Priority**: User choice first
- **Auto-Assign**: Round-robin distribution
- **Rejection Handling**: Automatic reassignment
- **Escalation**: Admin/Vendor backup

### 4. Status Management
- **State Machine**: Clear transitions
- **Audit Trail**: All changes logged
- **Notifications**: Multi-channel alerts
- **Rollback**: Cancellation & refunds

### 5. Payment Flow
- **Advance**: Category-based
- **Commission**: 15% platform fee
- **Settlement**: Provider 85%
- **Ledger**: Double-entry accounting

---

**Document Version**: 1.0  
**Diagram Type**: ASCII Flow Charts  
**Last Updated**: 2024  
**Purpose**: Visual Understanding of Booking System

