export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

function getToken() {
  try {
    return localStorage.getItem("swm_token") || "";
  } catch {
    return "";
  }
}

function getProviderToken() {
  try {
    return localStorage.getItem("swm_provider_token") || "";
  } catch {
    return "";
  }
}

function getAdminToken() {
  try {
    return localStorage.getItem("swm_admin_token") || "";
  } catch {
    return "";
  }
}

function getVendorToken() {
  try {
    return localStorage.getItem("swm_vendor_token") || "";
  } catch {
    return "";
  }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem("swm_token", token);
    else localStorage.removeItem("swm_token");
  } catch {}
}

async function request(path, options = {}) {
  const token = getToken();
  const providerToken = getProviderToken();
  const adminToken = getAdminToken();
  const vendorToken = getVendorToken();

  const isProviderPath = typeof path === "string" && path.startsWith("/provider");
  const isAdminPath = typeof path === "string" && path.startsWith("/admin");
  const isVendorPath = typeof path === "string" && path.startsWith("/vendor");

  let authToken = token;
  if (isAdminPath) authToken = adminToken;
  else if (isVendorPath) authToken = vendorToken;
  else if (isProviderPath) authToken = providerToken;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (import.meta?.env?.DEV) {
    try {
      console.log("[API]", options.method || "GET", path, { status: res.status, ok: res.ok, data });
    } catch {}
  }
  if (!res.ok) {
    const err = data?.error || "Request failed";
    const e = new Error(err);
    e.status = res.status;
    e.data = data;
    if (import.meta?.env?.DEV) {
      try {
        console.error("[API ERROR]", options.method || "GET", path, { status: res.status, data });
      } catch {}
    }
    if (res.status === 401) setToken("");
    throw e;
  }
  return data;
}

async function uploadAdminFile(path, fieldName, file) {
  const token = getAdminToken();
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error || "Request failed";
    const e = new Error(err);
    e.status = res.status;
    e.code = data?.code; // Include error code from server
    e.data = data;
    if (res.status === 401) setToken("");
    throw e;
  }
  return data;
}

export const api = {
  // Customer auth
  requestOtp: (phone, intent = "login") =>
    request("/auth/request-otp", { method: "POST", body: { phone, intent } }),
  verifyOtp: async (phone, otp, intent = "login") => {
    const res = await request("/auth/verify-otp", {
      method: "POST",
      body: { phone, otp, intent },
    });
    if (res?.token) setToken(res.token);
    return res;
  },
  me: () => request("/auth/me"),
  logout: () => {
    setToken("");
    return request("/auth/logout", { method: "POST" });
  },

  // Customer profile
  updateProfile: (payload) => request("/users/me", { method: "PATCH", body: payload }),
  getAddresses: () => request("/users/me/addresses"),
  addAddress: (payload) => request("/users/me/addresses", { method: "POST", body: payload }),
  updateAddress: (id, payload) => request(`/users/me/addresses/${id}`, { method: "PATCH", body: payload }),
  deleteAddress: (id) => request(`/users/me/addresses/${id}`, { method: "DELETE" }),
  wallet: () => request("/users/me/wallet"),
  userCoupons: () => request("/users/me/coupons"),
  referralInfo: () => request("/users/me/referral"),
  users: {
    providerSuggestions: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/users/me/provider-suggestions${q ? `?${q}` : ""}`);
    },
  },

  providers: {
    availableSlots: (providerId, params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/providers/${providerId}/available-slots${q ? `?${q}` : ""}`);
    },
    availableSlotsByDate: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/providers/available-slots-by-date${q ? `?${q}` : ""}`);
    },
  },

  // Public content
  content: {
    serviceTypes: () => request("/content/service-types"),
    bookingTypes: () => request("/content/booking-types"),
    categories: (gender) => request(`/content/categories${gender ? `?gender=${gender}` : ""}`),
    services: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/content/services${q ? `?${q}` : ""}`);
    },
    banners: (gender) => request(`/content/banners${gender ? `?gender=${gender}` : ""}`),
    spotlights: (gender) => request(`/content/spotlights${gender ? `?gender=${gender}` : ""}`),
    gallery: () => request("/content/gallery"),
    testimonials: () => request("/content/testimonials"),
    providers: () => request("/content/providers"),
    officeSettings: () => request("/content/office-settings"),
  },

  // Customer bookings + enquiries
  bookings: {
    list: (page = 1, limit = 20) => request(`/bookings?page=${page}&limit=${limit}`),
    quote: (payload) => request("/bookings/quote", { method: "POST", body: payload }),
    create: (payload) => request("/bookings", { method: "POST", body: payload }),
    cancel: (id) => request(`/bookings/${id}/cancel`, { method: "PATCH" }),
    track: (id) => request(`/bookings/${id}/track`),
    custom: {
      create: (payload) => request("/bookings/custom-enquiry", { method: "POST", body: payload }),
      list: () => request("/bookings/custom-enquiry"),
      userAccept: (id) => request(`/bookings/custom-enquiry/${id}/user-accept`, { method: "PATCH" }),
      advancePaid: (id, amount) => request(`/bookings/custom-enquiry/${id}/advance-paid`, { method: "PATCH", body: { amount } }),
      userReject: (id) => request(`/bookings/custom-enquiry/${id}/user-reject`, { method: "PATCH" }),
    },
  },

  // Payments
  payments: {
    createOrder: (payload) => request("/payments/razorpay/order", { method: "POST", body: payload }),
    verify: (payload) => request("/payments/razorpay/verify", { method: "POST", body: payload }),
  },

  // Provider (beautician)
  provider: {
    requestOtp: (phone) => request("/provider/request-otp", { method: "POST", body: { phone } }),
    verifyOtp: (phone, otp) => request("/provider/verify-otp", { method: "POST", body: { phone, otp } }),
    register: (payload) => request("/provider/register", { method: "POST", body: payload }),
    logout: () => request("/provider/logout", { method: "POST" }),
    me: (phone) => request(`/provider/me/${phone}`),
    summary: (phone) => request(`/provider/summary/${phone}`),
    credits: (phone) => request(`/provider/credits/${phone}`),
    bookings: (providerId) => request(`/provider/bookings/${providerId}`),
    updateBookingStatus: (id, status) => request(`/provider/bookings/${id}/status`, { method: "PATCH", body: { status } }),
    verifyBookingOtp: (id, otp) => request(`/provider/bookings/${id}/verify-otp`, { method: "POST", body: { otp } }),
    requestPayment: (id) => request(`/provider/bookings/${id}/request-payment`, { method: "POST" }),
    updateBookingLocation: (id, lat, lng) => request(`/provider/bookings/${id}/location`, { method: "PATCH", body: { lat, lng } }),
    updateLocation: (lat, lng) => request("/provider/me/location", { method: "PATCH", body: { lat, lng } }),
    availability: {
      get: (date) => request(`/provider/availability/${date}`),
      set: (date, slots) => request(`/provider/availability/${date}`, { method: "PUT", body: { slots } }),
    },
    leaves: {
      list: () => request("/provider/leaves"),
      create: (payload) => request("/provider/leaves", { method: "POST", body: payload }),
    },
    wallet: {
      recharge: (amount) => request("/provider/wallet/recharge", { method: "POST", body: { amount } }),
      expense: (amount, title) => request("/provider/wallet/expense", { method: "POST", body: { amount, title } }),
      refund: (amount, title) => request("/provider/wallet/refund", { method: "POST", body: { amount, title } }),
    },
    uploadDocs: async (formData) => {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/provider/upload-docs`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (import.meta?.env?.DEV) {
        try {
          console.log("[API]", "POST", "/provider/upload-docs", { status: res.status, ok: res.ok, data });
        } catch {}
      }
      if (!res.ok) {
        const err = data?.error || "Request failed";
        if (import.meta?.env?.DEV) {
          try {
            console.error("[API ERROR]", "POST", "/provider/upload-docs", { status: res.status, data });
          } catch {}
        }
        if (res.status === 401) setToken("");
        throw new Error(err);
      }
      return data;
    },
  },

  // Vendor
  vendor: {
    register: (payload) => request("/vendor/register", { method: "POST", body: payload }),
    login: (email, password) => request("/vendor/login", { method: "POST", body: { email, password } }),
    requestOtp: (phone) => request("/vendor/request-otp", { method: "POST", body: { phone } }),
    verifyOtp: (phone, otp) => request("/vendor/verify-otp", { method: "POST", body: { phone, otp } }),
    logout: () => request("/vendor/logout", { method: "POST" }),
    providers: () => request("/vendor/providers"),
    updateProviderStatus: (id, status) => request(`/vendor/providers/${id}/status`, { method: "PATCH", body: { status } }),
    bookings: () => request("/vendor/bookings"),
    assignBooking: (id, providerId) => request(`/vendor/bookings/${id}/assign`, { method: "PATCH", body: { providerId } }),
    reassignBooking: (id, providerId) => request(`/vendor/bookings/${id}/reassign`, { method: "PATCH", body: { providerId } }),
    expireBooking: (id) => request(`/vendor/bookings/${id}/expire`, { method: "PATCH" }),
    updatePayoutStatus: (id, status) => request(`/vendor/bookings/${id}/payout`, { method: "PATCH", body: { status } }),
    customEnquiries: () => request("/vendor/custom-enquiries"),
    customEnquiryPriceQuote: (id, body) => request(`/vendor/custom-enquiries/${id}/price-quote`, { method: "PATCH", body }),
    customEnquiryAssignTeam: (id, body) => request(`/vendor/custom-enquiries/${id}/team-assign`, { method: "PATCH", body }),
    sos: () => request("/vendor/sos"),
    resolveSos: (id) => request(`/vendor/sos/${id}/resolve`, { method: "PATCH" }),
  },

  // Admin
  admin: {
    login: (email, password) => request("/admin/login", { method: "POST", body: { email, password } }),
    logout: () => request("/admin/logout", { method: "POST" }),
    vendors: () => request("/admin/vendors"),
    updateVendorStatus: (id, status) => request(`/admin/vendors/${id}/status`, { method: "PATCH", body: { status } }),
    customers: () => request("/admin/customers"),
    providers: () => request("/admin/providers"),
    updateProviderStatus: (id, status) => request(`/admin/providers/${id}/status`, { method: "PATCH", body: { status } }),
    bookings: () => request("/admin/bookings"),
    assignBooking: (id, providerId) => request(`/admin/bookings/${id}/assign`, { method: "PATCH", body: { providerId } }),
    customEnquiries: () => request("/admin/custom-enquiries"),
    customEnquiryPriceQuote: (id, body) => request(`/admin/custom-enquiries/${id}/price-quote`, { method: "PATCH", body }),
    customEnquiryFinalApprove: (id) => request(`/admin/custom-enquiries/${id}/final-approve`, { method: "PATCH" }),
    coupons: () => request("/admin/coupons"),
    addCoupon: (payload) => request("/admin/coupons", { method: "POST", body: payload }),
    deleteCoupon: (id) => request(`/admin/coupons/${id}`, { method: "DELETE" }),
    addBanner: (payload) => request("/admin/banners", { method: "POST", body: payload }),
    bannersList: () => request("/admin/banners"),
    updateBanner: (id, gender, payload) => request(`/admin/banners/${id}/${gender}`, { method: "PUT", body: payload }),
    deleteBanner: (id, gender) => request(`/admin/banners/${id}/${gender}`, { method: "DELETE" }),
    getReferral: () => request("/admin/referral"),
    updateReferral: (payload) => request("/admin/referral", { method: "PUT", body: payload }),
    getCommission: () => request("/admin/commission"),
    updateCommission: (payload) => request("/admin/commission", { method: "PUT", body: payload }),
    metricsOverview: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/admin/metrics/overview${q ? `?${q}` : ""}`);
    },
    metricsRevenueByMonth: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/admin/metrics/revenue-by-month${q ? `?${q}` : ""}`);
    },
    metricsCustomersByMonth: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/admin/metrics/customers-by-month${q ? `?${q}` : ""}`);
    },
    metricsProvidersByMonth: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/admin/metrics/providers-by-month${q ? `?${q}` : ""}`);
    },
    metricsBookingTrend: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/admin/metrics/booking-trend${q ? `?${q}` : ""}`);
    },
    metricsCities: () => request("/admin/metrics/cities"),
    sos: () => request("/admin/sos"),
    resolveSos: (id) => request(`/admin/sos/${id}/resolve`, { method: "PATCH" }),
    leaves: () => request("/admin/leaves"),
    approveLeave: (id) => request(`/admin/leaves/${id}/approve`, { method: "PATCH" }),
    rejectLeave: (id) => request(`/admin/leaves/${id}/reject`, { method: "PATCH" }),
    getParents: () => request("/admin/parents"),
    addParent: (body) => request("/admin/parents", { method: "POST", body }),
    updateParent: (id, body) => request(`/admin/parents/${id}`, { method: "PUT", body }),
    deleteParent: (id) => request(`/admin/parents/${id}`, { method: "DELETE" }),
    getCategories: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/admin/categories${query ? `?${query}` : ""}`);
    },
    addCategory: (body) => request("/admin/categories", { method: "POST", body }),
    updateCategory: (id, body) => request(`/admin/categories/${id}`, { method: "PUT", body }),
    deleteCategory: (id) => request(`/admin/categories/${id}`, { method: "DELETE" }),
    getServices: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/admin/services${query ? `?${query}` : ""}`);
    },
    addService: (body) => request("/admin/services", { method: "POST", body }),
    updateService: (id, body) => request(`/admin/services/${id}`, { method: "PUT", body }),
    deleteService: (id) => request(`/admin/services/${id}`, { method: "DELETE" }),
    customEnquiries: () => request("/admin/custom-enquiries"),
    customEnquiryPriceQuote: (id, body) => request(`/admin/custom-enquiries/${id}/price-quote`, { method: "PATCH", body }),
    customEnquiryFinalApprove: (id) => request(`/admin/custom-enquiries/${id}/final-approve`, { method: "PATCH" }),
    updateOfficeSettings: (payload) => request("/admin/settings", { method: "PUT", body: payload }),

    // Home content (reels/gallery/testimonials)
    listSpotlights: () => request("/admin/spotlights"),
    uploadSpotlightVideo: (file) => uploadAdminFile("/admin/spotlights/upload-video", "video", file),
    addSpotlight: (payload) => request("/admin/spotlights", { method: "POST", body: payload }),
    updateSpotlight: (id, payload) => request(`/admin/spotlights/${id}`, { method: "PUT", body: payload }),
    deleteSpotlight: (id) => request(`/admin/spotlights/${id}`, { method: "DELETE" }),

    listGalleryItems: () => request("/admin/gallery"),
    uploadGalleryImage: (file) => uploadAdminFile("/admin/gallery/upload-image", "image", file),
    addGalleryItem: (payload) => request("/admin/gallery", { method: "POST", body: payload }),
    updateGalleryItem: (id, payload) => request(`/admin/gallery/${id}`, { method: "PUT", body: payload }),
    deleteGalleryItem: (id) => request(`/admin/gallery/${id}`, { method: "DELETE" }),

    addTestimonial: (payload) => request("/admin/testimonials", { method: "POST", body: payload }),
    updateTestimonial: (id, payload) => request(`/admin/testimonials/${id}`, { method: "PUT", body: payload }),
    deleteTestimonial: (id) => request(`/admin/testimonials/${id}`, { method: "DELETE" }),
  },

  subscriptions: {
    getPlans: () => request("/subscriptions/plans"),
    subscribe: (payload) => request("/subscriptions/subscribe", { method: "POST", body: payload }),
  },

  // SOS (customer/provider)
  sos: {
    create: (payload) => request("/sos", { method: "POST", body: payload }),
  },
};

// Provider booking images upload (multipart)
api.provider.uploadBookingImages = async (bookingId, type, files) => {
  const token = getToken();
  const form = new FormData();
  for (const f of files) form.append("images", f);

  const res = await fetch(`${API_BASE_URL}/provider/bookings/${bookingId}/${type}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: "include",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error || "Request failed";
    if (res.status === 401) setToken("");
    throw new Error(err);
  }
  return data;
};
