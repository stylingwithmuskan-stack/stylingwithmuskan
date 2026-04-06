# Implementation Plan: Push Notifications

## Overview

Re-enable Firebase Cloud Messaging end-to-end: backend Firebase Admin SDK initialization, FCM payload construction and delivery, deduplication guard, quiet-hours enforcement, frontend SDK init, service worker, token registration service, and foreground handler wiring.

## Tasks

- [x] 1. Install dependencies and add environment variable placeholders
  - Run `npm install firebase-admin` in `backend/`
  - Run `npm install firebase` in `frontend/`
  - Add Firebase placeholder vars to `backend/.env`: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `PUSH_DEFAULT_CLICK_BASE_URL`, `PUSH_BATCH_SIZE`, `PUSH_RETRY_LIMIT`
  - Add Firebase placeholder vars to `frontend/.env`: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_VAPID_KEY`
  - _Requirements: 1.1, 6.1_

- [x] 2. Rewrite `backend/src/lib/push.js` — Firebase Admin SDK init and FCM payload builder
  - [x] 2.1 Implement `initFirebase()` singleton and export `pushEnabled` boolean
    - Use `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` from `config.js`
    - If any credential is missing, log a warning, set `pushEnabled = false`, and skip init without throwing
    - Initialize at most once per process (singleton guard via `getApps()` or module-level flag)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Write property test: push disabled when Firebase not initialized
    - **Property 7: Push disabled when Firebase not initialized**
    - **Validates: Requirements 1.5, 2.7**
    - File: `backend/src/tests/push-notifications.spec.js`
    - With `pushEnabled = false`, generate any notification-like object; verify `sendPushForNotification()` returns `{ sent: 0, failed: 0 }` and sets `delivery.push.status = "disabled"`

  - [x] 2.3 Implement `buildFCMPayload(notification)` — construct and validate FCM message shape
    - `notification` object containing `title` (max 100 chars) and `body` (max 200 chars)
    - `data` object with `notificationId`, `link`, `type`, `role` — all serialized as strings
    - Truncate title at 100 chars and body at 200 chars before building payload
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] 2.4 Write property test: FCM payload round-trip
    - **Property 1: FCM payload round-trip**
    - **Validates: Requirements 13.5**
    - Generate random Notification-like objects; verify `buildFCMPayload()` → read back `data.notificationId`, `data.link`, `data.type`, `data.role` equals original values

  - [x] 2.5 Write property test: payload field truncation
    - **Property 2: Payload field truncation**
    - **Validates: Requirements 13.1, 13.3**
    - Generate titles > 100 chars and bodies > 200 chars; verify output lengths are within limits

  - [x] 2.6 Write property test: data values are strings
    - **Property 3: Data values are strings**
    - **Validates: Requirements 13.4**
    - Generate random notification objects; verify every value in `data` is `typeof === "string"`

- [x] 3. Implement `sendPushForNotification()` in `backend/src/lib/push.js`
  - [x] 3.1 Query active `PushDevice` docs and call `sendEachForMulticast` in batches
    - Query `PushDevice` where `recipientId` matches, `isActive = true`, `preferences.enabled = true`
    - Call `admin.messaging().sendEachForMulticast()` with up to `PUSH_BATCH_SIZE` tokens per call
    - Include `notification.title`, `notification.message`, `notification.link`, `notification._id` (as string) in every FCM message via `buildFCMPayload()`
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Handle FCM responses — update delivery status and deactivate invalid tokens
    - On success: set `delivery.push.status = "sent"`, `delivery.push.sentAt = now`, record `failureCount`
    - On `messaging/registration-token-not-registered` or `messaging/invalid-registration-token`: set `PushDevice.isActive = false`, record `lastError`
    - If all tokens invalid: set `delivery.push.status = "failed"`
    - If `pushEnabled = false`: set `delivery.push.status = "disabled"`, return `{ sent: 0, failed: 0 }`
    - If `failureCount >= PUSH_RETRY_LIMIT`: skip send, set status `"failed"`
    - Always set `delivery.push.lastAttemptAt = now` on every attempt
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8, 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 3.3 Write property test: invalid token deactivation
    - **Property 5: Invalid token deactivation**
    - **Validates: Requirements 2.5**
    - Generate random `PushDevice` docs; simulate FCM invalid-token response; verify `isActive = false` after `sendPushForNotification()` completes

  - [x] 3.4 Write property test: delivery status always updated
    - **Property 9: Delivery status always updated**
    - **Validates: Requirements 12.5**
    - Generate any notification; run send; verify `delivery.push.lastAttemptAt` is set to a timestamp within a few seconds of the call

- [x] 4. Implement quiet-hours enforcement and queued push processing in `backend/src/lib/push.js`
  - [x] 4.1 Implement `queuePushForNotification()` — set `delivery.push.status = "queued"`
    - Set status to `"queued"` on the `Notification` document when provider push is suppressed
    - _Requirements: 4.2_

  - [x] 4.2 Implement `processQueuedPushNotifications()` — find and send queued provider notifications
    - Query `Notification` docs with `delivery.push.status = "queued"` for provider recipients
    - Only process when `isWithinProviderPushWindow()` returns `true`
    - Attempt FCM delivery for each queued notification
    - _Requirements: 4.3_

  - [x] 4.3 Wire quiet-hours check into `sendPushForNotification()` for provider role
    - Before sending to a provider recipient, call `isWithinProviderPushWindow()`
    - If outside window, call `queuePushForNotification()` and return without calling FCM
    - Default window: `07:00`–`22:00` local server time when no settings found
    - _Requirements: 4.1, 4.4_

  - [x] 4.4 Write property test: quiet hours suppression
    - **Property 8: Quiet hours suppression**
    - **Validates: Requirements 4.1, 4.2**
    - Generate provider-role notifications with timestamps outside the configured window; verify `delivery.push.status = "queued"` and no FCM call is made

- [x] 5. Implement `enforceDeviceLimit()` and `isDuplicatePush()` in `backend/src/lib/push.js`
  - [x] 5.1 Implement `enforceDeviceLimit(recipientId, recipientRole)`
    - Count active `PushDevice` docs for the `(recipientId, recipientRole)` pair
    - If count > 10, deactivate the oldest devices by `lastSeenAt` until count = 10
    - _Requirements: 5.3_

  - [x] 5.2 Write property test: device limit enforcement
    - **Property 6: Device limit enforcement**
    - **Validates: Requirements 5.3**
    - Generate > 10 `PushDevice` docs for one recipient; run `enforceDeviceLimit()`; verify active count = 10 and deactivated devices are the ones with oldest `lastSeenAt`

  - [x] 5.3 Implement `isDuplicatePush(recipientId, dedupeKey, windowMs)`
    - Query `Notification` collection for docs matching `recipientId` and `meta.dedupeKey` within `windowMs` milliseconds
    - Return `true` if a matching document exists, `false` otherwise
    - _Requirements: 3.1, 3.3_

  - [x] 5.4 Write property test: deduplication prevents duplicate notifications
    - **Property 4: Deduplication prevents duplicate notifications**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Generate random `recipientId` + `dedupeKey`; insert a `Notification` doc, then call `notify()` again with the same dedupeKey; verify `notify()` returns `null` and total notification count is unchanged

- [x] 6. Add sparse index on `meta.dedupeKey` to `backend/src/models/Notification.js`
  - Add `{ "meta.dedupeKey": 1 }` sparse index to `NotificationSchema`
  - _Requirements: 3.7_

- [x] 7. Modify `backend/src/lib/notify.js` — wire deduplication and real FCM delivery
  - Add optional `dedupeKey` and `dedupeWindowMs` parameters to `notify()`
  - Before `Notification.create()`, call `isDuplicatePush(recipientId, dedupeKey, dedupeWindowMs)` if `dedupeKey` is provided; return `null` if duplicate
  - After `Notification.create()`, replace the current stub call with `sendPushForNotification(notification)`
  - _Requirements: 3.2, 2.1_

- [x] 8. Checkpoint — Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Update `backend/src/startup/cron.js` — add dedupeKey to reminder and escalation notify() calls
  - Provider reminder `notify()` call: add `dedupeKey: \`reminder:${b._id}\``, `dedupeWindowMs: 23 * 60 * 60 * 1000`
  - Vendor reminder `notify()` call: add `dedupeKey: \`vendor_reminder:${b._id}\``, same window
  - Booking auto-cancel / escalation `notify()` call: add `dedupeKey: \`escalation:${b._id}\``, same window
  - _Requirements: 3.4, 3.5, 3.6_

- [x] 10. Update `adminPush.controller.js` — track real FCM push count in broadcast stats
  - After each `notify()` call in the broadcast loop, check `notification.delivery.push.status`
  - Set `history.stats.pushSent` to the count of notifications where `delivery.push.status === "sent"`
  - For `POST /admin/push/test`, send a real FCM push to the calling admin's registered devices
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 11. Create `frontend/src/firebase.js` — Firebase JS SDK initialization
  - Initialize Firebase JS SDK using `VITE_FIREBASE_*` env vars with `getApps()` singleton guard
  - If any required env var is missing, log a warning and export `null` for `messaging`
  - Export `messaging`, `getToken`, and `onMessage`
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 12. Create `frontend/public/firebase-messaging-sw.js` — background push service worker
  - Import Firebase app and messaging scripts via `importScripts` using CDN URLs version-matched to installed `firebase` package
  - Initialize Firebase with the same project config as the main app (inline config values)
  - Handle `onBackgroundMessage`: call `self.registration.showNotification()` with `title`, `body`, `icon`
  - Handle `notificationclick`: close notification, navigate to `payload.data.link` or `/notifications`; focus existing window if already open at target URL
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 13. Create `frontend/src/services/pushNotificationService.js` — token acquisition and registration
  - [x] 13.1 Implement `initPushNotifications(authToken, role)`
    - Check browser support for Notifications API and Service Workers; silently skip if unsupported
    - Register service worker at `/firebase-messaging-sw.js`
    - Call `Notification.requestPermission()`; skip silently if denied or default
    - Call `getToken(messaging, { vapidKey, serviceWorkerRegistration })` to obtain FCM token
    - Persist `deviceKey` in `localStorage` under `swm_push_device_key` (generate UUID on first use)
    - Persist FCM token under `swm_push_fcm_token`; re-register only if token changed
    - Call `POST /notifications/push/register` with `fcmToken`, `deviceKey`, `platform = "web"`, using role-appropriate auth token
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 10.1, 10.2, 10.3_

  - [x] 13.2 Implement `unregisterPush(role)`
    - Call `DELETE /notifications/push/register` with stored `deviceKey` to deactivate device on backend
    - _Requirements: 8.7_

  - [x] 13.3 Implement `setupForegroundHandler(onMessage)`
    - Call `onMessage(messaging, handler)` to receive foreground FCM messages
    - In handler: show browser `Notification` if `Notification.permission === "granted"` with `title`, `body`, `icon`
    - On notification click: navigate to `payload.data.link`
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 14. Modify `frontend/src/modules/user/contexts/NotificationContext.jsx` — wire foreground handler
  - Import `setupForegroundHandler` from `pushNotificationService`
  - In the Socket.io `useEffect`, also call `setupForegroundHandler` with a callback that calls `fetchNotifications()`
  - _Requirements: 9.4_

- [x] 15. Modify `frontend/src/App.jsx` — call push init and unregister on auth events
  - After successful login for any role (user, provider, vendor, admin), call `initPushNotifications(token, role)` with the role-appropriate auth token
  - On logout events for any role, call `unregisterPush(role)`
  - _Requirements: 8.1, 8.7_

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use `fast-check` (already in `backend/devDependencies`); all 9 properties are required
- All property tests go in `backend/src/tests/push-notifications.spec.js`
- Each property test should be tagged with `// Feature: push-notifications, Property N: <property text>`
- `fast-check` minimum 100 runs per property (`{ numRuns: 100 }`)
- The `FIREBASE_PRIVATE_KEY` env var contains newlines — ensure `config.js` handles `\\n` → `\n` replacement
