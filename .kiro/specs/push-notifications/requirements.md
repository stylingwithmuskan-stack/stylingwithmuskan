# Requirements Document

## Introduction

This feature re-enables Firebase Cloud Messaging (FCM) push notifications for the full-stack app (Node.js/Express backend + React/Vite frontend). Firebase was previously removed; all push functions are currently stubs. The implementation must restore end-to-end push delivery while strictly following the project SOP (`PUSH_NOTIFICATIONS_SOP.md`), integrating with the existing `PushDevice` and `Notification` models, and guaranteeing that recurring cron-triggered notifications (reminders, escalations) are never delivered more than once per event per recipient.

The system supports four recipient roles — **user**, **provider**, **vendor**, and **admin** — each with independent auth tokens and login flows.

---

## Glossary

- **FCM**: Firebase Cloud Messaging — Google's cross-platform push notification service.
- **Firebase_Admin_SDK**: The `firebase-admin` npm package used on the backend to send messages via FCM.
- **Firebase_JS_SDK**: The `firebase` npm package used on the frontend to obtain FCM registration tokens.
- **FCM_Token**: A device-scoped registration token issued by FCM, stored in the `PushDevice` collection.
- **VAPID_Key**: Voluntary Application Server Identification key required for web push via FCM.
- **Service_Worker**: The `public/firebase-messaging-sw.js` file that handles background push messages in the browser.
- **PushDevice**: The existing Mongoose model (`backend/src/models/PushDevice.js`) that stores FCM tokens per recipient and device.
- **Notification**: The existing Mongoose model (`backend/src/models/Notification.js`) that records every notification with a `delivery.push` sub-document.
- **Push_Lib**: `backend/src/lib/push.js` — the module that wraps Firebase Admin SDK calls and token management.
- **Notify_Lib**: `backend/src/lib/notify.js` — the module that creates `Notification` documents and triggers delivery.
- **Deduplication_Guard**: A mechanism that prevents a cron job from sending more than one push notification for the same logical event to the same recipient.
- **Quiet_Hours**: The configurable time window (stored in `BookingSettings` / `OfficeSettings`) outside which provider push notifications are suppressed.
- **Broadcast**: An admin-initiated push sent to a filtered audience (by role, city, subscription plan).
- **deviceKey**: A stable, client-generated identifier (e.g., browser fingerprint or UUID) that uniquely identifies a device for a given recipient.
- **Recipient_Role**: One of `user`, `provider`, `vendor`, `admin` — determines which auth token and notification channel to use.

---

## Requirements

### Requirement 1: Backend — Firebase Admin SDK Initialization

**User Story:** As a backend developer, I want the Firebase Admin SDK initialized from environment variables, so that the server can send FCM messages without storing a service-account file in the repository.

#### Acceptance Criteria

1. THE Firebase_Admin_SDK SHALL be initialized using `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` environment variables already exported from `backend/src/config.js`.
2. IF any of `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, or `FIREBASE_PRIVATE_KEY` is empty or missing at startup, THEN THE Firebase_Admin_SDK SHALL log a warning and skip initialization, leaving push delivery disabled without crashing the server.
3. THE Firebase_Admin_SDK SHALL be initialized at most once per process lifetime (singleton pattern).
4. WHEN the Firebase_Admin_SDK is successfully initialized, THE Push_Lib SHALL export a boolean flag `pushEnabled` set to `true`.
5. WHEN the Firebase_Admin_SDK fails to initialize, THE Push_Lib SHALL export `pushEnabled` as `false` and all send functions SHALL return `{ sent: 0, failed: 0 }` without throwing.

---

### Requirement 2: Backend — Sending Push Notifications via FCM

**User Story:** As a backend developer, I want `push.js` to send FCM messages using `sendEachForMulticast`, so that notifications reach all active devices for a recipient efficiently.

#### Acceptance Criteria

1. WHEN `sendPushForNotification(notification)` is called and `pushEnabled` is `true`, THE Push_Lib SHALL query all `PushDevice` documents where `recipientId` matches, `isActive` is `true`, and `preferences.enabled` is `true`.
2. WHEN active devices are found, THE Push_Lib SHALL call `admin.messaging().sendEachForMulticast()` with a batch of up to `PUSH_BATCH_SIZE` tokens per call.
3. THE Push_Lib SHALL include `notification.title`, `notification.message`, `notification.link`, and `notification._id` (as a string in the `data` payload) in every FCM message.
4. WHEN FCM returns a response, THE Push_Lib SHALL update `delivery.push.status` to `"sent"`, set `delivery.push.sentAt` to the current timestamp, and record `delivery.push.failureCount` on the `Notification` document.
5. IF FCM returns an error code of `messaging/registration-token-not-registered` or `messaging/invalid-registration-token` for a specific token, THEN THE Push_Lib SHALL set `isActive = false` and record the error in `lastError` on the corresponding `PushDevice` document.
6. IF all tokens for a recipient are invalid or inactive, THEN THE Push_Lib SHALL set `delivery.push.status` to `"failed"` on the `Notification` document.
7. WHILE `pushEnabled` is `false`, THE Push_Lib SHALL set `delivery.push.status` to `"disabled"` and return `{ sent: 0, failed: 0 }` without calling FCM.
8. THE Push_Lib SHALL respect `PUSH_RETRY_LIMIT`: IF `delivery.push.failureCount` has already reached `PUSH_RETRY_LIMIT`, THEN THE Push_Lib SHALL skip sending and set status to `"failed"`.

---

### Requirement 3: Backend — Deduplication Guard for Recurring Notifications

**User Story:** As a backend developer, I want a deduplication guard so that cron-triggered reminder and escalation notifications are never sent more than once per event per recipient.

#### Acceptance Criteria

1. THE Push_Lib SHALL expose a function `isDuplicatePush(recipientId, dedupeKey, windowMs)` that returns `true` if a push with the same `dedupeKey` was already sent to `recipientId` within `windowMs` milliseconds.
2. WHEN `isDuplicatePush` returns `true`, THE Notify_Lib SHALL skip creating a new `Notification` document and SHALL return `null`.
3. THE deduplication check SHALL use the `Notification` collection, querying for documents matching `recipientId`, `type`, and a `meta.dedupeKey` field within the specified time window.
4. WHEN the cron job sends a provider reminder notification, THE Notify_Lib SHALL pass a `dedupeKey` composed of `"reminder:<bookingId>"` with a 23-hour window.
5. WHEN the cron job sends a vendor reminder notification, THE Notify_Lib SHALL pass a `dedupeKey` composed of `"vendor_reminder:<bookingId>"` with a 23-hour window.
6. WHEN the cron job sends a booking escalation notification, THE Notify_Lib SHALL pass a `dedupeKey` composed of `"escalation:<bookingId>"` with a 23-hour window.
7. THE `Notification` schema SHALL store an optional `meta.dedupeKey` string field, indexed for efficient lookup.

---

### Requirement 4: Backend — Quiet Hours Enforcement for Provider Push

**User Story:** As a backend developer, I want provider push notifications suppressed outside configured quiet hours, so that providers are not disturbed at night.

#### Acceptance Criteria

1. WHILE the current server time is outside the provider notification window defined in `BookingSettings` (or `OfficeSettings` as fallback), THE Push_Lib SHALL NOT send FCM messages to `provider` role recipients.
2. WHEN a provider push is suppressed due to quiet hours, THE Push_Lib SHALL set `delivery.push.status` to `"queued"` on the `Notification` document.
3. WHEN the cron job runs and the current time is within the provider notification window, THE Push_Lib SHALL process all `Notification` documents with `delivery.push.status = "queued"` for provider recipients and attempt FCM delivery.
4. THE quiet-hours check SHALL default to `07:00`–`22:00` local server time when no settings are found.

---

### Requirement 5: Backend — Token Registration and Management Endpoints

**User Story:** As a backend developer, I want the existing push registration endpoints to correctly persist and deactivate FCM tokens, so that the server always has valid tokens for each device.

#### Acceptance Criteria

1. WHEN `POST /notifications/push/register` is called with a valid `fcmToken` and `deviceKey`, THE Push_Lib SHALL upsert a `PushDevice` document keyed on `(recipientId, recipientRole, deviceKey)` and set `isActive = true`.
2. WHEN `DELETE /notifications/push/register` is called, THE Push_Lib SHALL set `isActive = false` on all matching `PushDevice` documents for the recipient.
3. THE Push_Lib SHALL enforce a maximum of 10 active `PushDevice` documents per `(recipientId, recipientRole)` pair; IF the limit is exceeded, THE Push_Lib SHALL deactivate the oldest device by `lastSeenAt`.
4. WHEN `PATCH /notifications/push/preferences` is called with `enabled = false`, THE Push_Lib SHALL set `preferences.enabled = false` and `isActive = false` on the matching `PushDevice`.
5. THE `PushDevice` collection SHALL maintain a unique compound index on `(recipientId, recipientRole, deviceKey)` (already defined in the model).

---

### Requirement 6: Frontend — Firebase JS SDK Initialization

**User Story:** As a frontend developer, I want a `firebase.js` module that initializes the Firebase JS SDK from Vite environment variables, so that the app can request FCM tokens.

#### Acceptance Criteria

1. THE Firebase_JS_SDK SHALL be initialized using `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, and `VITE_FIREBASE_VAPID_KEY` environment variables.
2. THE Firebase_JS_SDK SHALL be initialized at most once per page load (singleton via `getApps()` guard).
3. IF any required environment variable is missing, THEN THE Firebase_JS_SDK module SHALL log a warning and export `null` for the `messaging` instance, preventing runtime errors in consuming code.
4. THE Firebase_JS_SDK module SHALL export `messaging`, `getToken`, and `onMessage` for use by the push notification service.

---

### Requirement 7: Frontend — Service Worker for Background Push

**User Story:** As a frontend developer, I want a Firebase messaging service worker at `public/firebase-messaging-sw.js`, so that push notifications are displayed when the app is in the background or closed.

#### Acceptance Criteria

1. THE Service_Worker SHALL import Firebase app and messaging scripts via `importScripts` using the versioned CDN URLs compatible with the installed `firebase` package version.
2. THE Service_Worker SHALL initialize Firebase with the same project configuration as the main app.
3. WHEN a background FCM message is received, THE Service_Worker SHALL call `self.registration.showNotification()` with the message's `title`, `body`, and `icon`.
4. WHEN a notification is clicked, THE Service_Worker SHALL close the notification and navigate the browser to the URL specified in `payload.data.link`, falling back to `/notifications`.
5. WHEN the app window is already open at the target URL, THE Service_Worker SHALL focus the existing window instead of opening a new one.
6. THE Service_Worker SHALL be registered from `public/firebase-messaging-sw.js` so Vite serves it at the root path.

---

### Requirement 8: Frontend — FCM Token Acquisition and Registration

**User Story:** As a frontend developer, I want a push notification service that requests browser permission, obtains an FCM token, and registers it with the backend after login, so that the user's device receives push notifications.

#### Acceptance Criteria

1. WHEN a user successfully logs in (any role: user, provider, vendor, admin), THE Push_Notification_Service SHALL request browser notification permission using `Notification.requestPermission()`.
2. WHEN permission is `"granted"`, THE Push_Notification_Service SHALL call `getToken(messaging, { vapidKey, serviceWorkerRegistration })` to obtain the FCM token.
3. WHEN an FCM token is obtained, THE Push_Notification_Service SHALL call `POST /notifications/push/register` with `fcmToken`, `deviceKey` (a stable UUID stored in `localStorage`), and `platform = "web"`, using the role-appropriate auth token.
4. THE Push_Notification_Service SHALL generate and persist a `deviceKey` in `localStorage` under the key `swm_push_device_key` on first use, reusing it on subsequent logins.
5. WHEN permission is `"denied"` or `"default"`, THE Push_Notification_Service SHALL silently skip registration without showing an error to the user.
6. IF the FCM token obtained differs from the previously registered token stored in `localStorage` under `swm_push_fcm_token`, THEN THE Push_Notification_Service SHALL re-register with the new token.
7. WHEN a user logs out (any role), THE Push_Notification_Service SHALL call `DELETE /notifications/push/register` with the stored `deviceKey` to deactivate the device on the backend.

---

### Requirement 9: Frontend — Foreground Notification Handling

**User Story:** As a frontend developer, I want foreground FCM messages handled inside the app, so that users see notifications even when the app tab is active.

#### Acceptance Criteria

1. WHEN the app is in the foreground and an FCM message is received via `onMessage(messaging, handler)`, THE Push_Notification_Service SHALL display a browser `Notification` if `Notification.permission === "granted"`.
2. THE foreground notification SHALL include the message `title`, `body`, and `icon` from the FCM payload.
3. WHEN a foreground notification is clicked, THE Push_Notification_Service SHALL navigate to `payload.data.link` using the React Router `navigate` function or `window.location`.
4. THE `NotificationContext` SHALL refresh the notification list upon receiving a foreground FCM message, in addition to the existing Socket.io `new_notification` event handler.

---

### Requirement 10: Frontend — Notification Permission UI

**User Story:** As a user, I want to be prompted to allow push notifications after logging in, so that I can receive real-time updates on my device.

#### Acceptance Criteria

1. WHEN a user logs in and `Notification.permission === "default"`, THE Push_Notification_Service SHALL trigger the browser permission prompt within 3 seconds of successful login.
2. WHEN `Notification.permission === "denied"`, THE Push_Notification_Service SHALL NOT re-prompt the user.
3. WHERE the browser does not support the Notifications API or Service Workers, THE Push_Notification_Service SHALL silently skip all push setup without affecting other app functionality.

---

### Requirement 11: Admin — Push Broadcast via FCM

**User Story:** As an admin, I want the broadcast endpoint to actually deliver FCM pushes to the targeted audience, so that marketing campaigns reach users on their devices.

#### Acceptance Criteria

1. WHEN `POST /admin/push/broadcast` is called with valid `roles`, `title`, and `message`, THE Admin_Push_Controller SHALL call `notify()` for each recipient, which SHALL in turn call `sendPushForNotification()` to deliver via FCM.
2. THE Admin_Push_Controller SHALL record `stats.pushSent` as the count of FCM messages successfully sent (not just notifications created) in the `PushBroadcast` document.
3. WHEN `POST /admin/push/test` is called, THE Admin_Push_Controller SHALL send a real FCM push to the calling admin's registered devices.
4. IF no active `PushDevice` records exist for a broadcast recipient, THEN THE Admin_Push_Controller SHALL skip that recipient without failing the entire broadcast.

---

### Requirement 12: Notification Delivery Status Tracking

**User Story:** As a backend developer, I want the `Notification` model's `delivery.push` sub-document to accurately reflect FCM delivery outcomes, so that failed deliveries can be diagnosed and retried.

#### Acceptance Criteria

1. THE Notification model's `delivery.push.status` field SHALL use the values: `"pending"`, `"queued"`, `"sent"`, `"failed"`, `"disabled"`.
2. WHEN FCM delivery succeeds for at least one token, THE Push_Lib SHALL set `delivery.push.status = "sent"` and `delivery.push.sentAt` to the current UTC timestamp.
3. WHEN FCM delivery fails for all tokens, THE Push_Lib SHALL set `delivery.push.status = "failed"`, increment `delivery.push.failureCount`, and store the last error message in `delivery.push.lastError`.
4. WHEN push is disabled (Firebase not initialized), THE Push_Lib SHALL set `delivery.push.status = "disabled"`.
5. THE Push_Lib SHALL set `delivery.push.lastAttemptAt` to the current UTC timestamp on every send attempt regardless of outcome.

---

### Requirement 13: Parser / Serializer — FCM Payload Construction

**User Story:** As a backend developer, I want FCM message payloads constructed and validated consistently, so that all notification types render correctly on client devices.

#### Acceptance Criteria

1. THE Push_Lib SHALL construct FCM payloads with a `notification` object containing `title` (string, max 100 chars) and `body` (string, max 200 chars).
2. THE Push_Lib SHALL construct FCM payloads with a `data` object containing `notificationId` (string), `link` (string), `type` (string), and `role` (string).
3. THE Push_Lib SHALL truncate `title` to 100 characters and `body` to 200 characters before sending to FCM.
4. THE Push_Lib SHALL serialize all `data` payload values as strings (FCM requires string-only data values).
5. FOR ALL valid `Notification` documents, constructing then parsing the FCM payload SHALL produce an equivalent object with the same `notificationId`, `link`, `type`, and `role` values (round-trip property).

