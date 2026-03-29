# Push Notification Logout Fix Design

## Overview

This bugfix removes the incorrect `revokePushRegistration()` call from logout flows across all user roles (user, provider, vendor, admin). The current implementation treats logout as an explicit "disable push notifications" action, when it should only be triggered by the user explicitly clicking a "Disable Push" button. The fix ensures push notification registration persists across login/logout cycles and reactivates devices on login if they were previously inactive.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a user logs out, `revokePushRegistration()` is called, marking the device as `isActive: false`
- **Property (P)**: The desired behavior - logout should NOT call `revokePushRegistration()`, and devices should remain active across login/logout cycles
- **Preservation**: Existing explicit disable functionality and FCM error handling that must remain unchanged by the fix
- **revokePushRegistration()**: Function in `frontend/src/modules/user/lib/firebasePush.js` that marks a device as inactive by calling DELETE `/push/register`
- **ensurePushRegistration()**: Function in `frontend/src/modules/user/lib/firebasePush.js` that registers or updates a device with `isActive: true`
- **PushDevice**: MongoDB model in `backend/src/models/PushDevice.js` that stores device registration state
- **isActive**: Boolean field in PushDevice that determines if push notifications are sent to the device
- **Auth Contexts**: Four context files that manage authentication and call `revokePushRegistration()` on logout:
  - `frontend/src/modules/user/contexts/AuthContext.jsx` (user role)
  - `frontend/src/modules/serviceprovider/contexts/ProviderAuthContext.jsx` (provider role)
  - `frontend/src/modules/vender/contexts/VenderAuthContext.jsx` (vendor role)
  - `frontend/src/modules/admin/contexts/AdminAuthContext.jsx` (admin role)

## Bug Details

### Bug Condition

The bug manifests when a user of any role (user, provider, vendor, admin) logs out. The logout function in each auth context calls `revokePushRegistration(role)`, which sends a DELETE request to `/push/register` that marks the device as `isActive: false` in MongoDB. Upon subsequent login, the device remains inactive because there is no reactivation logic, preventing push notifications from being sent.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: string, role: string }
  OUTPUT: boolean
  
  RETURN input.action === "logout"
         AND input.role IN ["user", "provider", "vendor", "admin"]
         AND revokePushRegistration_is_called(input.role)
         AND device_marked_inactive_in_database()
END FUNCTION
```

### Examples

- **User Logout**: User logs out from the customer app → `revokePushRegistration("user")` is called → device marked `isActive: false` → user logs back in → device remains inactive → booking notifications not received
- **Provider Logout**: Service provider logs out → `revokePushRegistration("provider")` is called → device marked `isActive: false` → provider logs back in → device remains inactive → booking assignment notifications not received
- **Vendor Logout**: Vendor logs out → `revokePushRegistration("vendor")` is called → device marked `isActive: false` → vendor logs back in → device remains inactive → SOS alerts not received
- **Admin Logout**: Admin logs out → `revokePushRegistration("admin")` is called → device marked `isActive: false` → admin logs back in → device remains inactive → system alerts not received
- **Edge Case - Explicit Disable**: User clicks "Disable Push Notifications" button → device should be marked `isActive: false` and remain inactive even after login (this is correct behavior that must be preserved)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Explicit disable functionality via a "Disable Push Notifications" button must continue to mark devices as inactive
- FCM token error handling (e.g., "registration-token-not-registered") must continue to mark devices as inactive
- Backend query filtering by `isActive: true` and `preferences.enabled: { $ne: false }` must remain unchanged
- Device registration via POST `/push/register` must continue to set `isActive: true` and clear `lastError`
- Push notification delivery to active devices with valid FCM tokens must continue to work

**Scope:**
All inputs that do NOT involve user logout should be completely unaffected by this fix. This includes:
- Explicit disable actions via UI buttons
- FCM token invalidation due to errors
- Device registration and updates
- Push notification sending logic

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Incorrect Logout Implementation**: All four auth context files call `revokePushRegistration(role)` in their logout functions, treating logout as an explicit disable action when it should only clear authentication state

2. **Missing Reactivation Logic**: There is no logic to reactivate devices on login. The `ensurePushRegistration()` function exists but is not called during login flows

3. **Semantic Confusion**: The function name `revokePushRegistration()` suggests it should be called on logout, but the actual requirement is that it should only be called when the user explicitly disables push notifications

4. **No Distinction Between Logout and Disable**: The current implementation does not distinguish between "user logged out" (device should remain active) and "user disabled push" (device should be inactive)

## Correctness Properties

Property 1: Bug Condition - Logout Does Not Revoke Push Registration

_For any_ logout action by a user of any role (user, provider, vendor, admin), the logout function SHALL NOT call `revokePushRegistration()`, and the device SHALL remain marked as `isActive: true` in the database, allowing push notifications to continue being sent after the user logs back in.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Explicit Disable Functionality

_For any_ explicit disable action (user clicks "Disable Push Notifications" button), the system SHALL continue to mark the device as `isActive: false` and the device SHALL remain inactive even after subsequent logins, preserving the user's explicit preference to disable push notifications.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

Property 3: Reactivation on Login

_For any_ login action by a user who has an inactive device from a previous session (not explicitly disabled), the system SHALL reactivate the device by calling `ensurePushRegistration()` if push permissions are still granted, setting `isActive: true` and clearing the `lastError` field.

**Validates: Requirements 2.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `frontend/src/modules/user/contexts/AuthContext.jsx`

**Function**: `logout`

**Specific Changes**:
1. **Remove revokePushRegistration Call**: Remove the line `revokePushRegistration("user").catch(() => {});` from the logout function
2. **Add Reactivation on Login**: In the `loginWithOtp` function, after successful login, call `ensurePushRegistration("user").catch(() => {})` to reactivate the device if push permissions are granted

**File**: `frontend/src/modules/serviceprovider/contexts/ProviderAuthContext.jsx`

**Function**: `logout`, `verifyOtp`

**Specific Changes**:
1. **Remove revokePushRegistration Call**: Remove the line `revokePushRegistration("provider").catch(() => {});` from the logout function
2. **Add Reactivation on Login**: In the `verifyOtp` function, after successful login, call `ensurePushRegistration("provider").catch(() => {})` to reactivate the device

**File**: `frontend/src/modules/vender/contexts/VenderAuthContext.jsx`

**Function**: `logout`, `login`, `verifyOtp`

**Specific Changes**:
1. **Remove revokePushRegistration Call**: Remove the line `revokePushRegistration("vendor").catch(() => {});` from the logout function
2. **Add Reactivation on Login**: In both `login` and `verifyOtp` functions, after successful login, call `ensurePushRegistration("vendor").catch(() => {})` to reactivate the device

**File**: `frontend/src/modules/admin/contexts/AdminAuthContext.jsx`

**Function**: `logout`, `login`

**Specific Changes**:
1. **Remove revokePushRegistration Call**: Remove the line `revokePushRegistration("admin").catch(() => {});` from the logout function
2. **Add Reactivation on Login**: In the `login` function, after successful login, call `ensurePushRegistration("admin").catch(() => {})` to reactivate the device

**File**: `frontend/src/modules/user/lib/firebasePush.js`

**Function**: `revokePushRegistration` (optional refactoring)

**Specific Changes**:
1. **Rename Function**: Consider renaming `revokePushRegistration()` to `disablePushNotifications()` to clarify its purpose and prevent future misuse
2. **Add Documentation**: Add JSDoc comment explaining that this function should only be called when the user explicitly disables push notifications, NOT on logout

**Backend Changes**: No backend changes are required. The existing endpoints already support the correct behavior:
- POST `/push/register` sets `isActive: true` (used by `ensurePushRegistration`)
- DELETE `/push/register` sets `isActive: false` (used by explicit disable, not logout)
- PATCH `/push/preferences` updates `preferences.enabled` (for user preference toggles)

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate logout and login flows for each role, checking the device's `isActive` status in the database. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **User Logout Test**: Simulate user logout → verify `revokePushRegistration("user")` is called → verify device marked `isActive: false` in database (will fail on unfixed code - device should remain active)
2. **Provider Logout Test**: Simulate provider logout → verify `revokePushRegistration("provider")` is called → verify device marked `isActive: false` (will fail on unfixed code)
3. **Vendor Logout Test**: Simulate vendor logout → verify `revokePushRegistration("vendor")` is called → verify device marked `isActive: false` (will fail on unfixed code)
4. **Admin Logout Test**: Simulate admin logout → verify `revokePushRegistration("admin")` is called → verify device marked `isActive: false` (will fail on unfixed code)
5. **Login After Logout Test**: Simulate logout then login → verify device remains `isActive: false` → verify push notifications not sent (will fail on unfixed code - device should be reactivated)

**Expected Counterexamples**:
- Device is marked `isActive: false` after logout when it should remain active
- Device remains `isActive: false` after login when it should be reactivated
- Possible causes: incorrect logout implementation, missing reactivation logic

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (logout actions), the fixed function produces the expected behavior (device remains active).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := logout_fixed(input.role)
  ASSERT device_remains_active_in_database()
  ASSERT revokePushRegistration_not_called()
END FOR

FOR ALL input WHERE input.action === "login" DO
  result := login_fixed(input.role)
  ASSERT ensurePushRegistration_called()
  ASSERT device_reactivated_if_permissions_granted()
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (explicit disable actions, FCM errors), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT behavior_unchanged(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-logout inputs

**Test Plan**: Observe behavior on UNFIXED code first for explicit disable actions and FCM error handling, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Explicit Disable Preservation**: Observe that clicking "Disable Push" marks device as inactive on unfixed code, then write test to verify this continues after fix
2. **FCM Error Handling Preservation**: Observe that FCM token errors mark device as inactive on unfixed code, then write test to verify this continues after fix
3. **Device Registration Preservation**: Observe that POST `/push/register` sets `isActive: true` on unfixed code, then write test to verify this continues after fix
4. **Push Sending Preservation**: Observe that push notifications are sent to active devices on unfixed code, then write test to verify this continues after fix

### Unit Tests

- Test logout function for each role does not call `revokePushRegistration()`
- Test login function for each role calls `ensurePushRegistration()`
- Test device remains active in database after logout
- Test device is reactivated on login if permissions are granted
- Test explicit disable action marks device as inactive
- Test FCM error handling marks device as inactive

### Property-Based Tests

- Generate random logout/login sequences for each role and verify devices remain active across logout/login cycles
- Generate random explicit disable actions and verify devices remain inactive after login
- Generate random FCM error scenarios and verify devices are marked inactive correctly
- Test that all non-logout actions continue to work across many scenarios

### Integration Tests

- Test full user flow: register device → logout → login → verify push notifications received
- Test full provider flow: register device → logout → login → verify booking notifications received
- Test full vendor flow: register device → logout → login → verify SOS alerts received
- Test full admin flow: register device → logout → login → verify system alerts received
- Test explicit disable flow: register device → disable push → logout → login → verify device remains inactive
- Test FCM error flow: register device → simulate FCM error → verify device marked inactive → login → verify device reactivated
