# Bugfix Requirements Document

## Introduction

Push notifications stop working after users logout and login again. When a user logs out, the system calls `revokePushRegistration()` which marks the device as `isActive: false` in the database. Upon subsequent login, the device remains inactive, preventing push notifications from being sent. This affects all user roles (user, provider, vendor, admin) as all auth contexts call `revokePushRegistration()` during logout.

The root cause is that logout is incorrectly treated as an explicit "disable push notifications" action, when it should only be triggered by the user explicitly clicking a "Disable Push" button. Push notification registration should persist across login/logout cycles unless explicitly disabled by the user.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user (any role: user, provider, vendor, admin) logs out THEN the system calls `revokePushRegistration()` which marks the device as `isActive: false` in MongoDB

1.2 WHEN a user logs in after logout THEN the device remains marked as `isActive: false` in the database

1.3 WHEN the system attempts to send push notifications to a device with `isActive: false` THEN the push notification is not sent because the device is filtered out by the query `isActive: true`

1.4 WHEN `revokePushRegistration()` is called during logout THEN the device's `lastError` field is set to "Unregistered by client logout"

### Expected Behavior (Correct)

2.1 WHEN a user (any role: user, provider, vendor, admin) logs out THEN the system SHALL NOT call `revokePushRegistration()` and the device SHALL remain active

2.2 WHEN a user logs in after logout THEN the device SHALL remain marked as `isActive: true` in the database

2.3 WHEN the system attempts to send push notifications to a device with `isActive: true` THEN the push notification SHALL be sent successfully

2.4 WHEN a user explicitly clicks a "Disable Push Notifications" button THEN the system SHALL call a function that marks the device as `isActive: false`

2.5 WHEN a user logs in and has an inactive device from a previous session THEN the system SHALL reactivate the device by setting `isActive: true` if push permissions are still granted

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user explicitly disables push notifications via a "Disable Push" button THEN the system SHALL CONTINUE TO mark the device as inactive

3.2 WHEN push notifications are sent to active devices with valid FCM tokens THEN the system SHALL CONTINUE TO deliver notifications successfully

3.3 WHEN an FCM token becomes invalid (e.g., "registration-token-not-registered") THEN the system SHALL CONTINUE TO mark the device as inactive

3.4 WHEN `ensurePushRegistration()` is called with valid permissions THEN the system SHALL CONTINUE TO register or update the device with `isActive: true`

3.5 WHEN the backend queries for devices to send push notifications THEN the system SHALL CONTINUE TO filter by `isActive: true` and `preferences.enabled: { $ne: false }`

3.6 WHEN a device registration is updated via POST `/push/register` THEN the system SHALL CONTINUE TO set `isActive: true` and clear the `lastError` field
