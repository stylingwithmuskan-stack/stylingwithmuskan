import React, { useState, useEffect } from "react";
import { Button } from "@/modules/user/components/ui/button";
import { Input } from "@/modules/user/components/ui/input";
import { Plus, Edit2, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/modules/user/lib/api";

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
      const res = await api.admin.getBookingTypes();
      setBookingTypes(res.bookingTypes || []);
    } catch (error) {
      toast.error("Failed to load booking types");
      console.error("Error fetching booking types:", error);
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

      // Validate ID format
      if (formData.id.includes(' ')) {
        toast.error("ID cannot contain spaces. Use hyphens or underscores instead (e.g., 'fast-return')");
        return;
      }

      if (!/^[a-z0-9_-]+$/.test(formData.id)) {
        toast.error("ID must contain only lowercase letters, numbers, hyphens, and underscores");
        return;
      }

      await api.admin.createBookingType(formData);
      toast.success("Booking type created successfully");
      setShowCreateForm(false);
      setFormData({ id: "", label: "", icon: "", description: "" });
      fetchBookingTypes();
    } catch (error) {
      const errorMsg = error.data?.error || error.message || "Failed to create booking type";
      toast.error(errorMsg);
      console.error("Error creating booking type:", error);
    }
  };

  const handleUpdate = async (id) => {
    try {
      const type = bookingTypes.find(t => t.id === id);
      await api.admin.updateBookingType(id, {
        label: type.label,
        icon: type.icon,
        description: type.description
      });
      toast.success("Booking type updated successfully");
      setEditingId(null);
      fetchBookingTypes();
    } catch (error) {
      toast.error("Failed to update booking type");
      console.error("Error updating booking type:", error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this booking type?")) return;

    try {
      console.log(`[BookingTypes] Attempting to delete booking type: ${id}`);
      const result = await api.admin.deleteBookingType(id);
      console.log(`[BookingTypes] Delete successful:`, result);
      toast.success("Booking type deleted successfully");
      fetchBookingTypes();
    } catch (error) {
      console.error("[BookingTypes] Error deleting booking type:", {
        id,
        error,
        message: error.message,
        status: error.status,
        data: error.data,
        response: error.response
      });
      
      // Handle different error structures
      const errorData = error.data || error.response?.data || {};
      const errorMsg = error.message || errorData.error || "Failed to delete booking type";
      const usage = errorData.usage;
      
      if (error.status === 404) {
        toast.error(`Booking type "${id}" not found in database. It may have been already deleted.`);
        // Refresh the list to sync with database
        fetchBookingTypes();
      } else if (usage) {
        toast.error(`${errorMsg}: ${usage.categories} categories and ${usage.services} services are using this type`);
      } else {
        toast.error(errorMsg);
      }
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
    return <div className="text-center py-8 text-muted-foreground">Loading booking types...</div>;
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
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Booking Type
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-background border border-border rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">Create New Booking Type</h3>
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
                onChange={(e) => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                placeholder="e.g., instant, scheduled, fast-return"
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lowercase, no spaces (use hyphens or underscores)
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
            <Button onClick={handleCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
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
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
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
