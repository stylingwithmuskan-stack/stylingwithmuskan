# Design Document: Push Notifications

## Overview

This feature re-enables Firebase Cloud Messaging (FCM) push notifications across the full-stack app (Node.js/Express + React/Vite). Firebase was previously removed and all push functions are currently stubs. The implementation restores end-to-end push delivery by:

- Installing and initializing `firebase-admin` on the backend (ESM, env-var credentials)
- Installing and initializing the `firebase` JS SDK on the frontend (Vite env vars)
- Implementing a service worker for background push handling
- Adding a deduplication guard to prevent duplicate cron-triggered notifications
- Enforcing provider quiet hours for push delivery
- Tracking delivery status on the `Notification` model

The system supports four recipient roles — **user**, **provider**, **vendor**, **admin** — each with independent auth tokens.

---

## Architecture

```mermaid
flowchart TD
    subgraph Backend
        CRON[cron.js\nReminders / Escalations]
        CTRL[Controllers\nBookings / Admin / etc.]
        NOTIFY[notify.js\nNotification creation + dedup]
        PUSH[push.js\nFirebase Admin SDK wrapper]
        FCMAPI[FCM API\nfirebase-admin]
        MONGO[(MongoDB\nNotification + PushDevice)]
    end

    subgraph Frontend
        APP[App.jsx\nPush init on mount]
        SVC[pushNotificationService.js\nToken mgmt + foreground handler]
        FIREBASE[firebase.js\nFirebase JS SDK init]
        SW[firebase-messaging-sw.js\nService Worker]
        NOTIFCTX[NotificationContext.jsx\nSocket.io + FCM foreground]
    end

    CRON -->|notify() + dedupeKey| NOTIFY
    CTRL -->|notify()| NOTIFY
    NOTIFY -->|create Notification doc| MONGO
    NOTIFY -->|sendPushForNotification()| PUSH
    PUSH -->|query PushDevice| MONGO
    PUSH -->|sendEachForMulticast| FCMAPI
    PUSH -->|update delivery.push| MONGO

    APP -->|initPush on login| SVC
    SVC -->|getToken + register| FIREBASE
    SVC -->|POST /notifications/push/register| Backend
    FIREBASE -->|uses| SW
    SW -->|showNotification| Browser
    NOTIFCTX -->|onMessage foreground| SVC
    FCMAPI -->|push to browser| SW
```

### Key Design Decisions

1. **Credentials via env vars, not a file** — `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` are already exported from `config.js`. No service-account JSON file is committed to the repo.

2. **Graceful degradation** — If Firebase credentials are absent at startup, `pushEnabled = false` and all send functions return `{ sent: 0, failed: 0 }`. The app continues to deliver notifications via Socket.io.

3. **Deduplication in `notify.js`** — Before creating a `Notification` document, `notify()` checks for an existing document with the same `recipientId`, `type`, and `meta.dedupeKey` within the specified window. This prevents cron jobs from firing duplicate pushes.

4. **Quiet hours in `push.js`** — Provider push is suppressed outside the configured window; the `Notification` document is set to `delivery.push.status = "queued"` and processed by the next cron tick.

5. **Token lifecycle** — `PushDevice` is upserted on login and deactivated on logout. Invalid tokens returned by FCM are automatically deactivated. A maximum of 10 active devices per `(recipientId, recipientRole)` is enforced.

6. **Foreground + background split** — Background messages are handled by the service worker (`firebase-messaging-sw.js`). Foreground messages are handled by `onMessage()` in `NotificationContext`, which also refreshes the notification list.

---

## Components and Interfaces

### Backend

#### `backend/src/lib/push.js` (full rewrite)

```
Exports:
  pushEnabled: boolean
  sendPushForNotification(notification: NotificationDoc): Promise<{ sent: number, failed: number }>
  queuePushForNotification(notification: NotificationDoc, reason: string): Promise<void>
  processQueuedPushNotifications(): Promise<void>
  isDuplicatePush(recipientId: string, dedupeKey: string, windowMs: number): Promise<boolean>
  buildNotificationLink({ recipientRole, type, meta }): string
  isWithinProviderPushWindow(): Promise<boolean>
  buildFCMPayload(notification: NotificationDoc): FCMMessage
```

Internal helpers:
- `initFirebase()` — called once at module load; sets `pushEnabled`
- `deactivateToken(fcmToken, error)` — marks `PushDevice.isActive = false`
- `enforceDeviceLimit(recipientId, recipientRole)` — deactivates oldest device if > 10

#### `backend/src/lib/notify.js` (modifications)

- `notify()` gains an optional `dedupeKey` and `dedupeWindowMs` parameter
- Before `Notification.create()`, calls `isDuplicatePush()` and returns `null` if duplicate
- After `Notification.create()`, calls `sendPushForNotification()` (replacing the current stub call)

#### `backend/src/models/Notification.js` (modification)

- Add sparse index on `meta.dedupeKey` for efficient dedup queries

#### `backend/src/startup/cron.js` (modification)

- Provider reminder `notify()` call gains `dedupeKey: "reminder:<bookingId>"`, `dedupeWindowMs: 23 * 60 * 60 * 1000`
- Vendor reminder `notify()` call gains `dedupeKey: "vendor_reminder:<bookingId>"`, same window
- Escalation `notify()` call gains `dedupeKey: "escalation:<bookingId>"`, same window

### Frontend

#### `frontend/src/firebase.js` (new)

```
Exports:
  messaging: Messaging | null
  getToken: function
  onMessage: function
```

Initializes Firebase JS SDK once using `getApps()` guard. Exports `null` for `messaging` if any required env var is missing.

#### `frontend/public/firebase-messaging-sw.js` (new)

Service worker that:
- Imports Firebase scripts via `importScripts` (CDN, version-matched to installed `firebase` package)
- Handles `onBackgroundMessage` → `self.registration.showNotification()`
- Handles `notificationclick` → navigate to `payload.data.link` or focus existing window

#### `frontend/src/services/pushNotificationService.js` (new)

```
Exports:
  initPushNotifications(authToken, role): Promise<void>
  unregisterPush(role): Promise<void>
  setupForegroundHandler(onMessage: (payload) => void): void
```

Responsibilities:
- Register service worker
- Request `Notification.requestPermission()`
- Call `getToken(messaging, { vapidKey, serviceWorkerRegistration })`
- Persist `deviceKey` in `localStorage` under `swm_push_device_key`
- Persist last FCM token under `swm_push_fcm_token`
- Call `POST /notifications/push/register` with role-appropriate token
- On logout: call `DELETE /notifications/push/register`

#### `frontend/src/modules/user/contexts/NotificationContext.jsx` (modification)

- Import `setupForegroundHandler` from `pushNotificationService`
- In the Socket.io `useEffect`, also set up `onMessage` foreground handler
- On foreground FCM message: call `fetchNotifications()` and optionally show a browser `Notification`

#### `frontend/src/App.jsx` (modification)

- On mount (after auth contexts are available), call `initPushNotifications` for the active role
- On logout events, call `unregisterPush`

---

## Data Models

### `PushDevice` (existing, no schema changes needed)

```
recipientId:      String  (indexed)
recipientRole:    "user" | "provider" | "vendor" | "admin"
fcmToken:         String
platform:         String  (default: "web")
deviceKey:        String  (stable client UUID)
permission:       String  (default: "default")
isActive:         Boolean (default: true)
lastSeenAt:       Date
lastSuccessAt:    Date
lastError:        String
preferences.enabled: Boolean (default: true)

Unique index: (recipientId, recipientRole, deviceKey)
```

### `Notification` (existing, one addition)

```
recipientId:      String  (indexed)
recipientRole:    "user" | "provider" | "vendor" | "admin"
title:            String
message:          String
type:             String
meta:             Object  ← meta.dedupeKey: String (sparse index added)
link:             String
delivery.push:
  status:         "pending" | "queued" | "sent" | "failed" | "disabled"
  failureCount:   Number
  lastAttemptAt:  Date
  sentAt:         Date
  lastError:      String
isRead:           Boolean
```

New index: `{ "meta.dedupeKey": 1 }` (sparse: true) for deduplication queries.

### FCM Payload Shape

```typescript
interface FCMMessage {
  notification: {
    title: string;   // max 100 chars
    body: string;    // max 200 chars
  };
  data: {
    notificationId: string;
    link: string;
    type: string;
    role: string;
  };
  tokens: string[];  // up to PUSH_BATCH_SIZE per call
}
```

All `data` values are strings (FCM requirement). `notificationId` is `notification._id.toString()`.

### Environment Variables

**Backend (`backend/.env`)**
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
PUSH_DEFAULT_CLICK_BASE_URL=https://your-frontend-domain.com
PUSH_BATCH_SIZE=100
PUSH_RETRY_LIMIT=3
```

**Frontend (`frontend/.env`)**
```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_VAPID_KEY=BAXnzclI...
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: FCM payload round-trip

*For any* valid `Notification` document, constructing the FCM payload via `buildFCMPayload()` and then reading back `data.notificationId`, `data.link`, `data.type`, and `data.role` should produce values equal to the original notification's `_id.toString()`, `link`, `type`, and `recipientRole`.

**Validates: Requirements 13.5**

---

### Property 2: Payload field truncation

*For any* notification with a `title` longer than 100 characters or a `message` longer than 200 characters, the FCM payload produced by `buildFCMPayload()` should have `notification.title.length <= 100` and `notification.body.length <= 200`.

**Validates: Requirements 13.1, 13.3**

---

### Property 3: Data values are strings

*For any* notification, every value in the `data` object of the FCM payload produced by `buildFCMPayload()` should be of type `string`.

**Validates: Requirements 13.4**

---

### Property 4: Deduplication prevents duplicate notifications

*For any* recipient and dedupeKey, if a `Notification` document with that `meta.dedupeKey` already exists for that recipient within the dedup window, calling `notify()` with the same dedupeKey should return `null` and the total count of `Notification` documents for that recipient should remain unchanged.

**Validates: Requirements 3.1, 3.2, 3.3**

---

### Property 5: Invalid token deactivation

*For any* `PushDevice` document, if FCM returns `messaging/registration-token-not-registered` or `messaging/invalid-registration-token` for its token, then after `sendPushForNotification()` completes, that device's `isActive` field should be `false`.

**Validates: Requirements 2.5**

---

### Property 6: Device limit enforcement

*For any* recipient with more than 10 active `PushDevice` documents, after `enforceDeviceLimit()` runs, the count of active devices for that recipient should be exactly 10, and the deactivated devices should be the ones with the oldest `lastSeenAt` values.

**Validates: Requirements 5.3**

---

### Property 7: Push disabled when Firebase not initialized

*For any* notification, when `pushEnabled` is `false`, calling `sendPushForNotification()` should return `{ sent: 0, failed: 0 }` and set `delivery.push.status` to `"disabled"` without making any FCM API calls.

**Validates: Requirements 1.5, 2.7**

---

### Property 8: Quiet hours suppression

*For any* provider-role notification sent outside the configured quiet-hours window, `sendPushForNotification()` should set `delivery.push.status` to `"queued"` and return without calling FCM.

**Validates: Requirements 4.1, 4.2**

---

### Property 9: Delivery status always updated

*For any* send attempt (success or failure), `delivery.push.lastAttemptAt` on the `Notification` document should be set to a timestamp within a few seconds of the call.

**Validates: Requirements 12.5**

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Firebase credentials missing at startup | Log warning, set `pushEnabled = false`, continue serving |
| FCM `sendEachForMulticast` throws | Catch error, set `delivery.push.status = "failed"`, record `lastError`, do not rethrow |
| Invalid/expired FCM token in response | Set `PushDevice.isActive = false`, record `lastError` on device |
| All tokens invalid for a recipient | Set `delivery.push.status = "failed"` on notification |
| `failureCount >= PUSH_RETRY_LIMIT` | Skip send, set status `"failed"` |
| Browser does not support Notifications API | `pushNotificationService` silently skips all setup |
| Browser permission denied | Skip registration, no error shown to user |
| Frontend Firebase env vars missing | `messaging` exported as `null`; consuming code checks for null before calling `getToken` |
| Service worker registration fails | Log error, push silently disabled for that session |
| Dedup query throws | Log error, allow notification to proceed (fail-open for dedup) |

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:
- **Unit tests** cover specific examples, integration points, and error conditions
- **Property tests** verify universal invariants across randomly generated inputs

### Unit Tests

Focus areas:
- `buildFCMPayload()` with known inputs — verify field mapping, truncation, string coercion
- `isDuplicatePush()` — verify returns `true` when duplicate exists, `false` otherwise
- `notify()` dedup path — verify `null` returned when duplicate detected
- `enforceDeviceLimit()` — verify oldest devices deactivated when limit exceeded
- `initFirebase()` — verify `pushEnabled = false` when env vars missing
- `sendPushForNotification()` with `pushEnabled = false` — verify `"disabled"` status set
- Service worker `notificationclick` handler — verify correct URL navigation
- `pushNotificationService.initPushNotifications()` — verify token registration flow with mocked FCM

### Property-Based Tests

**Library**: `fast-check` (already available in the Node.js ecosystem; add to `devDependencies` for both backend and frontend test suites)

**Configuration**: Minimum 100 runs per property (`{ numRuns: 100 }`)

**Tag format**: `// Feature: push-notifications, Property N: <property text>`

Each correctness property maps to exactly one property-based test:

| Property | Test description |
|---|---|
| P1: FCM payload round-trip | Generate random Notification-like objects; verify `buildFCMPayload` → parse back produces same IDs |
| P2: Payload truncation | Generate titles > 100 chars and bodies > 200 chars; verify output lengths are within limits |
| P3: Data values are strings | Generate random notification objects; verify all `data` values are `typeof === "string"` |
| P4: Dedup prevents duplicates | Generate random recipientId + dedupeKey; insert a doc, then call `notify()` again; verify count unchanged |
| P5: Invalid token deactivation | Generate random PushDevice docs; simulate FCM invalid-token response; verify `isActive = false` |
| P6: Device limit enforcement | Generate > 10 PushDevice docs for one recipient; run `enforceDeviceLimit`; verify count = 10 |
| P7: Push disabled behavior | With `pushEnabled = false`, generate any notification; verify return value and status |
| P8: Quiet hours suppression | Generate provider notifications with timestamps outside window; verify `"queued"` status |
| P9: Delivery status updated | Generate any notification; run send; verify `lastAttemptAt` is recent |

### Integration Tests

- End-to-end: register a device, send a notification, verify `delivery.push.status = "sent"` in DB
- Broadcast: call `/admin/push/broadcast`, verify `PushBroadcast.stats.pushSent` reflects actual FCM successes
- Logout: call `DELETE /notifications/push/register`, verify `PushDevice.isActive = false`
