# 🧪 Profile Photo Feature - Testing Guide

## 🎯 Quick Test Steps

### **1. Backend Test (Optional - Using Postman/curl)**

```bash
# Test the API endpoint directly
curl -X PATCH \
  http://localhost:5000/admin/providers/{PROVIDER_ID}/profile-photo \
  -H "Authorization: Bearer {ADMIN_TOKEN}" \
  -F "profilePhoto=@/path/to/image.jpg"

# Expected Response:
{
  "success": true,
  "profilePhoto": "https://res.cloudinary.com/...",
  "provider": {
    "id": "...",
    "name": "...",
    "profilePhoto": "..."
  }
}
```

### **2. Frontend Test (Recommended)**

#### **Step 1: Login to Admin Panel**
1. Open browser: `http://localhost:3000/admin/login`
2. Login with admin credentials
3. Navigate to "Service Providers" page

#### **Step 2: Open Provider Detail Modal**
1. Find any provider in the list
2. Click the **eye icon** (👁️) on the right
3. Provider detail modal should open

#### **Step 3: Verify UI Changes**
✅ Check that:
- Profile photo is displayed (not just avatar letter)
- "Edit Photo" button appears in **top right corner**
- Button has camera icon 📷

#### **Step 4: Test Photo Upload**
1. Click "Edit Photo" button
2. File picker should open
3. Select a valid image (JPG/PNG, <5MB)
4. Watch for:
   - Button changes to "Uploading..." with spinner
   - Button is disabled during upload
   - Upload completes in 2-3 seconds
   - Success toast appears: "Profile photo updated successfully"
   - Photo updates immediately in modal
   - Photo updates in provider list (close and check)

#### **Step 5: Test Error Cases**

**Test A: Invalid File Type**
1. Click "Edit Photo"
2. Select a PDF or TXT file
3. ✅ Should show error: "Please select a valid image file"
4. ✅ No upload should happen

**Test B: File Too Large**
1. Click "Edit Photo"
2. Select an image > 5MB
3. ✅ Should show error: "Image size must be less than 5MB"
4. ✅ No upload should happen

**Test C: Cancel File Selection**
1. Click "Edit Photo"
2. Cancel the file picker (don't select anything)
3. ✅ Nothing should happen (graceful)
4. ✅ No errors

**Test D: Upload Same Photo Twice**
1. Upload a photo successfully
2. Upload the same photo again
3. ✅ Should work without issues
4. ✅ Photo should update (even if same)

#### **Step 6: Verify Persistence**
1. Upload a photo successfully
2. Close the modal
3. Reopen the same provider's modal
4. ✅ New photo should still be there
5. Refresh the page
6. ✅ Photo should persist after refresh

#### **Step 7: Verify Provider Notification (Optional)**
1. Upload a photo for a provider
2. Login as that provider (if possible)
3. Check notifications
4. ✅ Should see: "Admin has updated your profile photo"

## 🐛 Bug Fix: Token Reference Error

## ❌ Original Error
```
Photo upload error: ReferenceError: token is not defined
    at updateProviderProfilePhoto (AdminAuthContext.jsx:90:42)
    at handleProfilePhotoUpload (SPOversight.jsx:186:32)
    at handlePhotoFileSelect (SPOversight.jsx:177:9)
```

## 🔍 Root Cause Analysis

### **Problem:**
In `AdminAuthContext.jsx`, the `updateProviderProfilePhoto` function was trying to use a variable `token` that was not defined in the function scope.

**Original Code (Line 90):**
```javascript
const updateProviderProfilePhoto = async (id, file) => {
    const formData = new FormData();
    formData.append("profilePhoto", file);
    
    const response = await fetch(`${api.API_BASE_URL}/admin/providers/${id}/profile-photo`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${token}`,  // ❌ token is not defined
        },
        body: formData,
    });
    // ...
};
```

### **Why This Happened:**
- The function was created as a standalone async function inside the context
- Unlike other API calls that use `api.admin.*` methods (which handle token internally), this function uses direct `fetch()`
- The `token` variable was never declared or retrieved from localStorage

### **How Other Functions Handle This:**
Looking at other admin pages:
- `PendingZoneCreations.jsx` (Line 38): `localStorage.getItem("swm_admin_token")`
- `CityZoneManagement.jsx` (Line 60): `localStorage.getItem("swm_admin_token")`

## ✅ Solution

### **Fixed Code:**
```javascript
const updateProviderProfilePhoto = async (id, file) => {
    const formData = new FormData();
    formData.append("profilePhoto", file);
    
    // Get admin token from localStorage
    const adminToken = localStorage.getItem("swm_admin_token") || "";  // ✅ Fixed
    
    const response = await fetch(`${api.API_BASE_URL}/admin/providers/${id}/profile-photo`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${adminToken}`,  // ✅ Now uses adminToken
        },
        body: formData,
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile photo");
    }
    
    return response.json();
};
```

### **Changes Made:**
1. Added line to retrieve token: `const adminToken = localStorage.getItem("swm_admin_token") || "";`
2. Changed `${token}` to `${adminToken}` in Authorization header
3. Added fallback to empty string if token not found

## 🔒 Why This Fix is Safe

1. **Consistent with Codebase:** Uses same pattern as other admin pages
2. **No Breaking Changes:** Only fixes the undefined variable
3. **Proper Fallback:** Returns empty string if token not found
4. **Error Handling:** Backend will return 401 if token is invalid/missing

## 🧪 Testing After Fix

### **Test 1: Normal Upload**
1. Login to admin panel
2. Open provider detail modal
3. Click "Edit Photo"
4. Select image
5. ✅ Should upload successfully without token error

### **Test 2: No Token (Edge Case)**
1. Clear localStorage: `localStorage.removeItem("swm_admin_token")`
2. Try to upload photo
3. ✅ Should get proper error from backend (401 Unauthorized)
4. ✅ No console error about undefined token

### **Test 3: Invalid Token**
1. Set invalid token: `localStorage.setItem("swm_admin_token", "invalid")`
2. Try to upload photo
3. ✅ Should get proper error from backend
4. ✅ No console error about undefined token

## 📊 Verification

### **Before Fix:**
```
❌ ReferenceError: token is not defined
❌ Upload fails immediately
❌ No network request sent
```

### **After Fix:**
```
✅ No reference error
✅ Network request sent with proper Authorization header
✅ Backend validates token
✅ Upload succeeds or fails with proper error message
```

## 🎯 Impact Analysis

### **What Changed:**
- Only 1 line added (token retrieval)
- Only 1 line modified (variable name in header)

### **What Didn't Change:**
- ✅ All other admin functions
- ✅ Login/logout flow
- ✅ Token storage mechanism
- ✅ Other API calls
- ✅ Provider list functionality
- ✅ Modal behavior

## 📝 Lessons Learned

1. **Always declare variables before use** - JavaScript doesn't auto-import from context
2. **Check similar implementations** - Other admin pages showed the correct pattern
3. **Test with actual data** - Error only appeared during runtime, not at compile time
4. **Use consistent patterns** - Follow existing codebase conventions

---

**Fix Applied:** 2026-04-28
**Status:** ✅ Resolved
**Risk Level:** 🟢 Very Low (Single line fix)

**Symptoms:** "Edit Photo" button not visible
**Check:**
- Browser console for errors
- Component re-rendered after code changes
- Modal is actually open (not just list view)

**Solution:** Hard refresh (Ctrl+Shift+R)

### **Issue 2: Upload Fails Silently**
**Symptoms:** No error, no success, nothing happens
**Check:**
- Browser console for network errors
- Backend server is running
- Admin token is valid

**Solution:** 
```bash
# Check backend logs
# Verify Cloudinary credentials in .env
```

### **Issue 3: Photo Not Updating**
**Symptoms:** Upload succeeds but photo doesn't change
**Check:**
- Response contains `profilePhoto` URL
- State is updating correctly
- Image URL is valid (open in new tab)

**Solution:** Check browser console for state update errors

### **Issue 4: "No image file provided" Error**
**Symptoms:** Error even when file is selected
**Check:**
- File input `name` attribute is "profilePhoto"
- FormData is created correctly
- File is actually selected (not cancelled)

**Solution:** Check network tab, verify FormData payload

## 📊 Test Results Template

```
Date: ___________
Tester: ___________

✅ Backend API Test
  [ ] Endpoint responds correctly
  [ ] File uploads to Cloudinary
  [ ] Database updates
  [ ] Response format correct

✅ Frontend UI Test
  [ ] Button appears in correct location
  [ ] File picker opens
  [ ] Valid image uploads successfully
  [ ] Photo updates in modal
  [ ] Photo updates in list
  [ ] Success toast appears

✅ Error Handling Test
  [ ] Invalid file type rejected
  [ ] Large file rejected
  [ ] Cancel file selection handled
  [ ] Network error handled

✅ Persistence Test
  [ ] Photo persists after modal close
  [ ] Photo persists after page refresh
  [ ] Photo visible in provider list

✅ UX Test
  [ ] Upload button shows progress
  [ ] Button disabled during upload
  [ ] Spinner animation visible
  [ ] File input resets after upload

Notes:
_________________________________
_________________________________
_________________________________
```

## 🎯 Success Criteria

Feature is working correctly if:
1. ✅ Admin can click "Edit Photo" button
2. ✅ File picker opens and accepts images
3. ✅ Valid images upload successfully
4. ✅ Photo updates immediately in UI
5. ✅ Photo persists after refresh
6. ✅ Invalid files show error messages
7. ✅ No console errors
8. ✅ No breaking of existing functionality

## 🚨 Red Flags

Stop and investigate if:
- ❌ Console shows errors
- ❌ Existing provider list breaks
- ❌ Modal doesn't open
- ❌ Other buttons stop working
- ❌ Page crashes or freezes
- ❌ Upload takes > 10 seconds

## 📝 Test Data

### **Valid Test Images:**
- Small JPG (< 1MB)
- Small PNG (< 1MB)
- Medium JPG (2-3MB)
- Large PNG (4-5MB)

### **Invalid Test Files:**
- PDF document
- Text file (.txt)
- Video file (.mp4)
- Very large image (> 5MB)

## 🔄 Regression Testing

After implementing this feature, verify:
- [ ] Provider list still loads
- [ ] Provider status update still works
- [ ] Provider profile edit (categories/services) still works
- [ ] Provider zones approval still works
- [ ] Provider wallet adjustment still works
- [ ] Other admin features unaffected

---

**Happy Testing! 🎉**
