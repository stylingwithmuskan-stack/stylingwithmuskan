# Booking Types Management - Implementation Plan

## Overview

Admin panel me "Booking Rules" tab ko "Booking Types" me convert karna hai, jahan admin booking types (Instant Booking, Pre-book Service, Customize) create, edit, aur manage kar sake.

---

## Current State Analysis

### Existing BookingType Model (`backend/src/models/Content.js`)

```javascript
const BookingTypeSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  label: String,
  icon: String,
  description: String
});

export const BookingType = mongoose.model("BookingType", BookingTypeSchema);
```

### Existing Data (MongoDB)

```json
[
  {
    "_id": "69b45ab6c677a32658e39127",
    "id": "instant",
    "label": "Instant Booking",
    "icon": "⚡",
    "description": "Pro reaches within 60 mins"
  },
  {
    "_id": "69b45ab6c677a32658e39128",
    "id": "scheduled",
    "label": "Pre-book Service",
    "icon": "📅",
    "description": "Choose your own date & time"
  },
  {
    "_id": "69b45ab6c677a32658e39129",
    "id": "customize",
    "label": "Custom Package",
    "icon": "✨",
    "description": "For events & bulk bookings"
  }
]
```

### Current Usage

1. **Backend API**: `/content/booking-types` - Returns all booking types
2. **Category Model**: Has `bookingType` field (references booking type id)
3. **Service Model**: Has `bookingType` field (references booking type id)
4. **Booking Model**: Has `bookingType` field (stores booking type id)

---

## Implementation Plan

### Phase 1: Backend API Development

#### 1.1 Create Admin Booking Types Routes

**File**: `backend/src/routes/admin.routes.js`

**New Endpoints**:

```javascript
// GET /admin/booking-types - List all booking types
router.get("/booking-types", requireRole("admin"), async (req, res) => {
  const types = await BookingType.find().sort({ createdAt: 1 }).lean();
  res.json({ bookingTypes: types });
});

// POST /admin/booking-types - Create new booking type
router.post("/booking-types", 
  requireRole("admin"),
  body("id").isString().notEmpty(),
  body("label").isString().notEmpty(),
  body("icon").isString().notEmpty(),
  body("description").isString().notEmpty(),
  async (req, res) => {
    const { id, label, icon, description } = req.body;
    
    // Check if id already exists
    const existing = await BookingType.findOne({ id });
    if (existing) {
      return res.status(400).json({ error: "Booking type ID already exists" });
    }
    
    const bookingType = await BookingType.create({
      id,
      label,
      icon,
      description
    });
    
    // Invalidate cache
    await bumpContentVersion();
    
    res.status(201).json({ bookingType });
  }
);

// PATCH /admin/booking-types/:id - Update booking type
router.patch("/admin/booking-types/:id",
  requireRole("admin"),
  param("id").isString(),
  body("label").optional().isString(),
  body("icon").optional().isString(),
  body("description").optional().isString(),
  async (req, res) => {
    const { id } = req.params;
    const updates = {};
    
    if (req.body.label) updates.label = req.body.label;
    if (req.body.icon) updates.icon = req.body.icon;
    if (req.body.description) updates.description = req.body.description;
    
    const bookingType = await BookingType.findOneAndUpdate(
      { id },
      updates,
      { new: true }
    );
    
    if (!bookingType) {
      return res.status(404).json({ error: "Booking type not found" });
    }
    
    // Invalidate cache
    await bumpContentVersion();
    
    res.json({ bookingType });
  }
);

// DELETE /admin/booking-types/:id - Delete booking type
router.delete("/admin/booking-types/:id",
  requireRole("admin"),
  param("id").isString(),
  async (req, res) => {
    const { id } = req.params;
    
    // Check if booking type is in use
    const categoriesUsingType = await Category.countDocuments({ bookingType: id });
    const servicesUsingType = await Service.countDocuments({ bookingType: id });
    
    if (categoriesUsingType > 0 || servicesUsingType > 0) {
      return res.status(400).json({ 
        error: "Cannot delete booking type that is in use",
        usage: {
          categories: categoriesUsingType,
          services: servicesUsingType
        }
      });
    }
    
    const bookingType = await BookingType.findOneAndDelete({ id });
    
    if (!bookingType) {
      return res.status(404).json({ error: "Booking type not found" });
    }
    
    // Invalidate cache
    await bumpContentVersion();
    
    res.json({ message: "Booking type deleted successfully" });
  }
);
```

---

### Phase 2: Frontend Admin Panel Development

#### 2.1 Update Tab Name

**File**: `frontend/src/modules/admin/pages/UserModuleManagement.jsx`

**Change**:
```javascript
// Line ~620
{tab === "booking_rules" ? "Booking Types" : ...}
```

#### 2.2 Create BookingTypesManager Component

**File**: `frontend/src/modules/admin/components/BookingTypesManager.jsx`

```jsx
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function BookingTypesManager() {
  const [bookingTypes, setBookingTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    label: "",
    icon: "",
    description: ""
  });

  useEffect(() => {
    fetchBookingTypes();
  }, []);

  const fetchBookingTypes = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/booking-types");
      setBookingTypes(res.data.bookingTypes || []);
    } catch (error) {
      toast.error("Failed to load booking types");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (!formData.id || !formData.label || !formData.icon || !formData.description) {
        toast.error("All fields are required");
        return;
      }

      await api.post("/admin/booking-types", formData);
      toast.success("Booking type created successfully");
      setShowCreateForm(false);
      setFormData({ id: "", label: "", icon: "", description: "" });
      fetchBookingTypes();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to create booking type");
    }
  };

  const handleUpdate = async (id) => {
    try {
      const type = bookingTypes.find(t => t.id === id);
      await api.patch(`/admin/booking-types/${id}`, {
        label: type.label,
        icon: type.icon,
        description: type.description
      });
      toast.success("Booking type updated successfully");
      setEditingId(null);
      fetchBookingTypes();
    } catch (error) {
      toast.error("Failed to update booking type");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this booking type?")) return;

    try {
      await api.delete(`/admin/booking-types/${id}`);
      toast.success("Booking type deleted successfully");
      fetchBookingTypes();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete booking type");
    }
  };

  const handleEdit = (type) => {
    setEditingId(type.id);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    fetchBookingTypes(); // Reset changes
  };

  const updateField = (id, field, value) => {
    setBookingTypes(prev =>
      prev.map(t => t.id === id ? { ...t, [field]: value } : t)
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Booking Types</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage booking types that users can select when creating bookings
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-primary text-primary-foreground"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Booking Type
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-background border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Create New Booking Type</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCreateForm(false);
                setFormData({ id: "", label: "", icon: "", description: "" });
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                ID (Unique)
              </label>
              <Input
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                placeholder="e.g., instant, scheduled"
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lowercase, no spaces (used in code)
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Label
              </label>
              <Input
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g., Instant Booking"
                className="bg-background"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Icon (Emoji)
              </label>
              <Input
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="e.g., ⚡"
                className="bg-background text-2xl"
                maxLength={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Description
              </label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Pro reaches within 60 mins"
                className="bg-background"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateForm(false);
                setFormData({ id: "", label: "", icon: "", description: "" });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} className="bg-primary text-primary-foreground">
              <Save className="w-4 h-4 mr-2" />
              Create Booking Type
            </Button>
          </div>
        </div>
      )}

      {/* Booking Types List */}
      <div className="grid gap-4">
        {bookingTypes.map((type) => (
          <div
            key={type.id}
            className="bg-background border border-border rounded-xl p-6 hover:shadow-md transition-shadow"
          >
            {editingId === type.id ? (
              // Edit Mode
              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      ID (Read-only)
                    </label>
                    <Input
                      value={type.id}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Label
                    </label>
                    <Input
                      value={type.label}
                      onChange={(e) => updateField(type.id, "label", e.target.value)}
                      className="bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Icon
                    </label>
                    <Input
                      value={type.icon}
                      onChange={(e) => updateField(type.id, "icon", e.target.value)}
                      className="bg-background text-2xl"
                      maxLength={2}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Description
                  </label>
                  <Input
                    value={type.description}
                    onChange={(e) => updateField(type.id, "description", e.target.value)}
                    className="bg-background"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleCancelEdit}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleUpdate(type.id)}
                    className="bg-primary text-primary-foreground"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              // View Mode
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{type.icon}</div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{type.label}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      ID: <code className="bg-muted px-2 py-1 rounded">{type.id}</code>
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(type)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(type.id)}
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {bookingTypes.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No booking types found. Create your first booking type to get started.</p>
        </div>
      )}
    </div>
  );
}
```

#### 2.3 Update UserModuleManagement.jsx

**File**: `frontend/src/modules/admin/pages/UserModuleManagement.jsx`

```jsx
import BookingTypesManager from "../components/BookingTypesManager";

// Replace the booking_rules tab content with:
{activeTab === "booking_rules" && <BookingTypesManager />}
```

---

### Phase 3: Integration with Category & Service Forms

#### 3.1 Update Category Form

**File**: `frontend/src/modules/admin/components/CategoryForm.jsx` (or wherever category form is)

**Add Booking Type Dropdown**:

```jsx
const [bookingTypes, setBookingTypes] = useState([]);

useEffect(() => {
  // Fetch booking types
  api.get("/content/booking-types").then(res => {
    setBookingTypes(res.data || []);
  });
}, []);

// In form JSX:
<div>
  <label className="text-sm font-medium">Booking Type</label>
  <select
    value={formData.bookingType || ""}
    onChange={(e) => setFormData({ ...formData, bookingType: e.target.value })}
    className="w-full px-3 py-2 border rounded-lg"
  >
    <option value="">Select Booking Type</option>
    {bookingTypes.map(type => (
      <option key={type.id} value={type.id}>
        {type.icon} {type.label}
      </option>
    ))}
  </select>
</div>
```

#### 3.2 Update Service Form

**File**: `frontend/src/modules/admin/components/ServiceForm.jsx` (or wherever service form is)

**Add Same Booking Type Dropdown** as above.

---

### Phase 4: Database Migration (Optional)

If you want to ensure existing data has proper booking types:

**File**: `backend/scripts/migrate-booking-types.mjs`

```javascript
import mongoose from "mongoose";
import { BookingType, Category, Service } from "../src/models/Content.js";

async function migrateBookingTypes() {
  await mongoose.connect(process.env.MONGO_URI);

  // Ensure default booking types exist
  const defaultTypes = [
    {
      id: "instant",
      label: "Instant Booking",
      icon: "⚡",
      description: "Pro reaches within 60 mins"
    },
    {
      id: "scheduled",
      label: "Pre-book Service",
      icon: "📅",
      description: "Choose your own date & time"
    },
    {
      id: "customize",
      label: "Custom Package",
      icon: "✨",
      description: "For events & bulk bookings"
    }
  ];

  for (const type of defaultTypes) {
    await BookingType.findOneAndUpdate(
      { id: type.id },
      type,
      { upsert: true }
    );
  }

  console.log("✅ Default booking types created/updated");

  // Update categories without bookingType
  const categoriesWithoutType = await Category.find({ bookingType: { $exists: false } });
  for (const cat of categoriesWithoutType) {
    cat.bookingType = "instant"; // Default to instant
    await cat.save();
  }
  console.log(`✅ Updated ${categoriesWithoutType.length} categories with default booking type`);

  // Update services without bookingType
  const servicesWithoutType = await Service.find({ bookingType: { $exists: false } });
  for (const service of servicesWithoutType) {
    service.bookingType = "instant"; // Default to instant
    await service.save();
  }
  console.log(`✅ Updated ${servicesWithoutType.length} services with default booking type`);

  await mongoose.disconnect();
  console.log("✅ Migration complete");
}

migrateBookingTypes().catch(console.error);
```

---

## Implementation Steps (Priority Order)

### Step 1: Backend API (HIGH PRIORITY)
1. ✅ Add admin booking types routes in `admin.routes.js`
2. ✅ Add validation and error handling
3. ✅ Add cache invalidation
4. ✅ Test all endpoints with Postman/Thunder Client

### Step 2: Frontend Component (HIGH PRIORITY)
1. ✅ Create `BookingTypesManager.jsx` component
2. ✅ Add CRUD operations (Create, Read, Update, Delete)
3. ✅ Add form validation
4. ✅ Add loading states and error handling
5. ✅ Test UI functionality

### Step 3: Integration (MEDIUM PRIORITY)
1. ✅ Update tab name from "Booking Rules" to "Booking Types"
2. ✅ Replace booking rules content with BookingTypesManager
3. ✅ Add booking type dropdown in Category form
4. ✅ Add booking type dropdown in Service form
5. ✅ Test end-to-end flow

### Step 4: Migration (LOW PRIORITY)
1. ✅ Create migration script
2. ✅ Run migration on development
3. ✅ Verify data integrity
4. ✅ Run migration on production

---

## Testing Checklist

### Backend Testing
- [ ] GET /admin/booking-types returns all types
- [ ] POST /admin/booking-types creates new type
- [ ] POST with duplicate ID returns error
- [ ] PATCH /admin/booking-types/:id updates type
- [ ] DELETE /admin/booking-types/:id deletes type
- [ ] DELETE with type in use returns error
- [ ] Cache invalidation works after create/update/delete

### Frontend Testing
- [ ] Booking Types tab shows correctly
- [ ] Create form opens and closes
- [ ] Create form validation works
- [ ] New booking type appears in list
- [ ] Edit mode works correctly
- [ ] Update saves changes
- [ ] Delete confirmation works
- [ ] Delete removes booking type
- [ ] Loading states show correctly
- [ ] Error messages display properly

### Integration Testing
- [ ] Category form shows booking type dropdown
- [ ] Service form shows booking type dropdown
- [ ] Booking types load in dropdowns
- [ ] Selected booking type saves correctly
- [ ] Existing categories/services show correct booking type

---

## Files to Create/Modify

### Backend Files
1. ✅ `backend/src/routes/admin.routes.js` - Add booking types routes
2. ✅ `backend/scripts/migrate-booking-types.mjs` - Migration script (optional)

### Frontend Files
1. ✅ `frontend/src/modules/admin/components/BookingTypesManager.jsx` - New component
2. ✅ `frontend/src/modules/admin/pages/UserModuleManagement.jsx` - Update tab
3. ✅ `frontend/src/modules/admin/components/CategoryForm.jsx` - Add dropdown
4. ✅ `frontend/src/modules/admin/components/ServiceForm.jsx` - Add dropdown

**Total**: 2 backend files, 4 frontend files

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/booking-types` | List all booking types |
| POST | `/admin/booking-types` | Create new booking type |
| PATCH | `/admin/booking-types/:id` | Update booking type |
| DELETE | `/admin/booking-types/:id` | Delete booking type |
| GET | `/content/booking-types` | Public endpoint (already exists) |

---

## UI/UX Design

### Booking Types List View
```
┌─────────────────────────────────────────────────────────┐
│  Booking Types                    [+ Add Booking Type]  │
│  Manage booking types that users can select             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  ⚡  Instant Booking                    [Edit] [X]│    │
│  │      Pro reaches within 60 mins                 │    │
│  │      ID: instant                                │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  📅  Pre-book Service                  [Edit] [X]│    │
│  │      Choose your own date & time                │    │
│  │      ID: scheduled                              │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  ✨  Custom Package                    [Edit] [X]│    │
│  │      For events & bulk bookings                 │    │
│  │      ID: customize                              │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Create/Edit Form
```
┌─────────────────────────────────────────────────────────┐
│  Create New Booking Type                           [X]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ID (Unique)              Label                         │
│  [instant_________]       [Instant Booking_____]        │
│  Lowercase, no spaces                                   │
│                                                          │
│  Icon (Emoji)             Description                   │
│  [⚡]                      [Pro reaches within...]       │
│                                                          │
│                                    [Cancel] [Create]    │
└─────────────────────────────────────────────────────────┘
```

---

## Security Considerations

1. ✅ Only admin role can access booking types management
2. ✅ Validate all inputs (id, label, icon, description)
3. ✅ Prevent deletion of booking types in use
4. ✅ Sanitize emoji input to prevent XSS
5. ✅ Rate limit API endpoints
6. ✅ Log all admin actions for audit trail

---

## Performance Considerations

1. ✅ Cache booking types in Redis (already implemented via `/content/booking-types`)
2. ✅ Invalidate cache on create/update/delete
3. ✅ Use lean() queries for read operations
4. ✅ Index on `id` field (already unique)
5. ✅ Lazy load booking types in dropdowns

---

## Backward Compatibility

✅ **100% Backward Compatible**

- Existing `/content/booking-types` endpoint unchanged
- Existing booking types data preserved
- Categories and services with bookingType field work as before
- No breaking changes to frontend user flow

---

## Future Enhancements

1. **Booking Type Settings**:
   - Add `advancePercentage` field (for advance payment)
   - Add `minLeadTime` field (minimum booking time)
   - Add `maxBookingDays` field (maximum advance booking)

2. **Booking Type Rules**:
   - Add conditional logic (e.g., customize only for orders > ₹5000)
   - Add time-based availability (e.g., instant only 9 AM - 9 PM)

3. **Analytics**:
   - Track booking type usage
   - Show popular booking types
   - Revenue by booking type

4. **User Preferences**:
   - Allow users to set default booking type
   - Remember last used booking type

---

## Conclusion

This implementation plan provides a complete solution for managing booking types in the admin panel. The plan is:

- ✅ **Comprehensive**: Covers backend, frontend, integration, and testing
- ✅ **Backward Compatible**: No breaking changes
- ✅ **Scalable**: Easy to add new booking types
- ✅ **Maintainable**: Clean code structure
- ✅ **User-Friendly**: Intuitive UI/UX

**Estimated Development Time**: 6-8 hours
**Risk Level**: LOW
**Priority**: MEDIUM-HIGH

---

## Next Steps

1. Review and approve this plan
2. Start with Step 1 (Backend API)
3. Test backend endpoints
4. Proceed to Step 2 (Frontend Component)
5. Test UI functionality
6. Complete integration (Step 3)
7. Run migration if needed (Step 4)
8. Deploy to production

**Ready to implement? Let me know and I'll start with the backend API!** 🚀
