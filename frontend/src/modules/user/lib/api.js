import { safeStorage } from "@/modules/user/lib/safeStorage";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

function getToken() {
  try {
    return safeStorage.getItem("swm_token") || "";
  } catch {
    return "";
  }
}

function getProviderToken() {
  try {
    return safeStorage.getItem("swm_provider_token") || "";
  } catch {
    return "";
  }
}

function getAdminToken() {
  try {
    return safeStorage.getItem("swm_admin_token") || "";
  } catch {
    return "";
  }
}

function getVendorToken() {
  try {
    return safeStorage.getItem("swm_vendor_token") || "";
  } catch {
    return "";
  }
}

function getTokenByRole(role) {
  if (role === "provider") return getProviderToken();
  if (role === "vendor") return getVendorToken();
  if (role === "admin") return getAdminToken();
  return getToken();
}

function clearTokenByRole(role) {
  try {
    if (role === "provider") safeStorage.removeItem("swm_provider_token");
    else if (role === "vendor") safeStorage.removeItem("swm_vendor_token");
    else if (role === "admin") safeStorage.removeItem("swm_admin_token");
    else setToken("");
  } catch {}
}

function setToken(token) {
  try {
    if (token) safeStorage.setItem("swm_token", token);
    else safeStorage.removeItem("swm_token");
  } catch {}
}

function isRoleScopedPath(path, scope) {
  return typeof path === "string" && (path === `/${scope}` || path.startsWith(`/${scope}/`));
}

export function classifyApiPath(path) {
  const isProviderPath = isRoleScopedPath(path, "provider");
  const isAdminPath = isRoleScopedPath(path, "admin");
  const isVendorPath =
    isRoleScopedPath(path, "vendor") ||
    isRoleScopedPath(path, "vender");
  const isNotificationPath = typeof path === "string" && path.startsWith("/notifications");

  return { isProviderPath, isAdminPath, isVendorPath, isNotificationPath };
}

async function requestWithToken(path, options = {}, token, role) {
  const isFormData = options.body instanceof FormData;
  
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: isFormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined),
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
    if (res.status === 401) {
      clearTokenByRole(role);
    }
    throw e;
  }
  return data;
}

async function request(path, options = {}) {
  const token = getToken();
  const providerToken = getProviderToken();
  const adminToken = getAdminToken();
  const vendorToken = getVendorToken();

  const { isProviderPath, isAdminPath, isVendorPath, isNotificationPath } = classifyApiPath(path);

  let authToken = token;
  let role = "user";

  if (isAdminPath) {
    role = "admin";
    if (path === "/admin/login") authToken = "";
    else authToken = adminToken;
  }
  else if (isVendorPath) {
    role = "vendor";
    if (path === "/vendor/login" || path === "/vender/login") authToken = "";
    else authToken = vendorToken;
  }
  else if (isProviderPath) {
    role = "provider";
    if (path === "/provider/verify-otp" || path === "/provider/login" || path === "/provider/register") authToken = "";
    else authToken = providerToken;
  }
  else if (isNotificationPath) {
    authToken = providerToken || vendorToken || adminToken || token;
  }

  // Debug: Log token status for authenticated endpoints
  if (import.meta?.env?.DEV && !authToken && !path.includes("/auth/") && !path.includes("/content/")) {
    console.warn(`[API] ⚠️ No token for authenticated endpoint: ${path}`);
    console.warn(`[API] Token status:`, { 
      userToken: token ? '✓' : '✗', 
      providerToken: providerToken ? '✓' : '✗',
      adminToken: adminToken ? '✓' : '✗',
      vendorToken: vendorToken ? '✓' : '✗'
    });
  }

  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    credentials: "include",
    body: isFormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined),
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
    if (res.status === 401) {
      const isSessionCheck = path === "/auth/me" || path === "/provider/me" || path === "/vendor/me";
      if (import.meta?.env?.DEV && !isSessionCheck) {
        try {
          console.warn("[API AUTH]", options.method || "GET", path, { status: res.status, data });
        } catch {}
      }
    } else if (import.meta?.env?.DEV) {
      try {
        console.error("[API ERROR]", options.method || "GET", path, { status: res.status, data });
      } catch {}
    }
    if (res.status === 401) {
      clearTokenByRole(role);
      
      // Dispatch global 401 event
      window.dispatchEvent(new CustomEvent("swm-api-401", { 
        detail: { status: 401, role, isAdminPath, isVendorPath, isProviderPath } 
       }));
    }
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
  activity: () => request("/users/activity"),
  updateProfile: (payload) => request("/users/me", { method: "PATCH", body: payload }),
  uploadAvatar: async (file) => {
    const token = getToken();
    const form = new FormData();
    form.append("avatar", file);
    const res = await fetch(`${API_BASE_URL}/users/me/avatar`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Upload failed");
    return data;
  },
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
    init: () => request("/content/init"),
    serviceTypes: () => request("/content/service-types"),
    bookingTypes: () => request("/content/booking-types"),
    categories: (gender) => request(`/content/categories${gender ? `?gender=${gender}` : ""}`),
    services: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/content/services${q ? `?${q}` : ""}`);
    },
    search: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/content/search${q ? `?${q}` : ""}`);
    },
    banners: (gender) => request(`/content/banners${gender ? `?gender=${gender}` : ""}`),
    spotlights: (gender) => request(`/content/spotlights${gender ? `?gender=${gender}` : ""}`),
    toggleSpotlightLike: (spotlightId) => request(`/content/spotlights/${spotlightId}/like`, { method: "POST" }),
    gallery: () => request("/content/gallery"),
    testimonials: () => request("/content/testimonials"),
    providers: () => request("/content/providers"),
    officeSettings: () => request("/content/office-settings"),
    zones: () => request("/content/zones"),
    cities: () => request("/content/cities"),
    zones: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/content/zones${q ? `?${q}` : ""}`);
    },
    resolveLocation: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/content/resolve-location${q ? `?${q}` : ""}`);
    },
    getServiceReviews: (serviceName) => request(`/content/services/reviews/${encodeURIComponent(serviceName)}`),
  },

  // Customer bookings + enquiries
  bookings: {
    list: (page = 1, limit = 20) => request(`/bookings?page=${page}&limit=${limit}`),
    quote: (payload) => request("/bookings/quote", { method: "POST", body: payload }),
    create: (payload) => request("/bookings", { method: "POST", body: payload }),
    confirmCOD: (id) => request(`/bookings/${id}/confirm-cod`, { method: "PATCH" }),
    cancel: (id) => request(`/bookings/${id}/cancel`, { method: "PATCH" }),
    track: (id) => request(`/bookings/${id}/track`),
    custom: {
      create: (payload) => request("/bookings/custom-enquiry", { method: "POST", body: payload }),
      list: () => request("/bookings/custom-enquiry"),
      userAccept: (id) => request(`/bookings/custom-enquiry/${id}/user-accept`, { method: "PATCH" }),
      advancePaid: (id, amount) => request(`/bookings/custom-enquiry/${id}/advance-paid`, { method: "PATCH", body: { amount } }),
      userReject: (id) => request(`/bookings/custom-enquiry/${id}/user-reject`, { method: "PATCH" }),
    },
    getChatHistory: (id) => request(`/bookings/${id}/chat`),
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
    registerRequest: (phone) => request("/provider/register-request", { method: "POST", body: { phone } }),
    verifyRegistrationOtp: (phone, otp) => request("/provider/verify-registration-otp", { method: "POST", body: { phone, otp } }),
    register: (payload) => request("/provider/register", { method: "POST", body: payload }),
    logout: () => request("/provider/logout", { method: "POST" }),
    me: (phone) => request(`/provider/me/${phone}`),
    summary: (phone) => request(`/provider/summary/${phone}`),
    getPerformanceCriteria: () => request("/provider/performance-criteria"),
    requestZones: (body) => request("/provider/request-zones", { method: "POST", body }),
    requestCategory: (body) => request("/provider/request-category", { method: "POST", body }),
    rankings: (city) => request(`/provider/rankings/${city}`),
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
    getBookingChatHistory: (id) => {
      const token = getProviderToken();
      return requestWithToken(`/bookings/${id}/chat`, {}, token, "provider");
    },
    leaves: {
      list: () => request("/provider/leaves"),
      create: (payload) => request("/provider/leaves", { method: "POST", body: payload }),
    },
    wallet: {
      recharge: (amount) => request("/provider/wallet/recharge", { method: "POST", body: { amount } }),
      expense: (amount, title) => request("/provider/wallet/expense", { method: "POST", body: { amount, title } }),
      refund: (amount, title) => request("/provider/wallet/refund", { method: "POST", body: { amount, title } }),
      createOrder: (amount) => request("/provider/wallet/create-order", { method: "POST", body: { amount } }),
      verifyPayment: (payload) => request("/provider/wallet/verify-payment", { method: "POST", body: payload }),
    },
    uploadDocs: async (formData) => {
      const token = getProviderToken();
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
    uploadBookingImages: async (bookingId, type, files) => {
      const token = getProviderToken();
      const formData = new FormData();
      for (const file of files) formData.append("images", file);
      
      const res = await fetch(`${API_BASE_URL}/provider/bookings/${bookingId}/${type}`, {
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
          console.log("[API]", "POST", `/provider/bookings/${bookingId}/${type}`, { status: res.status, ok: res.ok, data });
        } catch {}
      }
      if (!res.ok) {
        const err = data?.error || "Failed to upload images";
        if (import.meta?.env?.DEV) {
          try {
            console.error("[API ERROR]", "POST", `/provider/bookings/${bookingId}/${type}`, { status: res.status, data });
          } catch {}
        }
        if (res.status === 401) setToken("");
        throw new Error(err);
      }
      return data;
    },
    support: {
      sendMessage: (message) => {
        const token = getProviderToken();
        return requestWithToken("/support/chat", { method: "POST", body: { message } }, token, "provider");
      },
      getMessages: () => {
        const token = getProviderToken();
        return requestWithToken("/support/chat", {}, token, "provider");
      },
    },
    training: {
      getVideos: () => {
        const token = getProviderToken();
        return requestWithToken("/training/provider", {}, token, "provider");
      }
    }
  },

  // Vendor
  vendor: {
    register: (payload) => request("/vendor/register", { method: "POST", body: payload }),
    registerRequest: (phone) => request("/vendor/register-request", { method: "POST", body: { phone } }),
    verifyRegistrationOtp: (payload) => request("/vendor/verify-registration-otp", { method: "POST", body: payload }),
    login: (email, password) => request("/vendor/login", { method: "POST", body: { email, password } }),
    requestOtp: (phone) => request("/vendor/request-otp", { method: "POST", body: { phone } }),
    verifyOtp: (phone, otp) => request("/vendor/verify-otp", { method: "POST", body: { phone, otp } }),
    logout: () => request("/vendor/logout", { method: "POST" }),
    me: () => request("/vendor/me"),
    providers: () => request("/vendor/providers"),
    vendors: () => request("/vendor/vendors"),
    listZoneRequests: () => request("/vendor/zone-requests"),
    updateSPStatus: (id, status) => request(`/vendor/providers/${id}/status`, { method: "PATCH", body: { status } }),
    approveSPZones: (id, body) => request(`/vendor/providers/${id}/approve-zones`, { method: "PATCH", body: body || {} }),
    rejectSPZones: (id, body) => request(`/vendor/providers/${id}/reject-zones`, { method: "PATCH", body: body || {} }),
    bookings: () => request("/vendor/bookings"),
    getAvailableProviders: (bookingId) => request(`/vendor/bookings/${bookingId}/available-providers`),
    assignBooking: (id, providerId) => request(`/vendor/bookings/${id}/assign`, { method: "PATCH", body: { providerId } }),
    reassignBooking: (id, providerId) => request(`/vendor/bookings/${id}/reassign`, { method: "PATCH", body: { providerId } }),
    expireBooking: (id) => request(`/vendor/bookings/${id}/expire`, { method: "PATCH" }),
    updatePayoutStatus: (id, status) => request(`/vendor/bookings/${id}/payout`, { method: "PATCH", body: { status } }),
    customEnquiries: () => request("/vendor/custom-enquiries"),
    customEnquiryPriceQuote: (id, body) => request(`/vendor/custom-enquiries/${id}/price-quote`, { method: "PATCH", body }),
    customEnquiryAssignTeam: (id, body) => request(`/vendor/custom-enquiries/${id}/team-assign`, { method: "PATCH", body }),
    sos: () => request("/vendor/sos"),
    resolveSos: (id) => request(`/vendor/sos/${id}/resolve`, { method: "PATCH" }),
    requestZones: (body) => request("/vendor/request-zones", { method: "POST", body }),
    getProviderRankings: (city) => request(`/provider/rankings/${city}`),
    subAccounts: () => request("/vendor/subaccounts"),
    createSubAccount: (body) => request("/vendor/subaccounts", { method: "POST", body }),
    deleteSubAccount: (id) => request(`/vendor/subaccounts/${id}`, { method: "DELETE" }),
    stats: () => request("/vendor/stats"),
    support: {
      sendMessage: (message) => {
        const token = getVendorToken();
        return requestWithToken("/support/chat", { method: "POST", body: { message } }, token, "vendor");
      },
      getMessages: () => {
        const token = getVendorToken();
        return requestWithToken("/support/chat", {}, token, "vendor");
      },
    },
  },

  // Admin
  admin: {
    login: (email, password) => request("/admin/login", { method: "POST", body: { email, password } }),
    logout: () => request("/admin/logout", { method: "POST" }),
    vendors: () => request("/admin/vendors"),
    updateVendorStatus: (id, status) => request(`/admin/vendors/${id}/status`, { method: "PATCH", body: { status } }),
    approveVendorZones: (id) => request(`/admin/vendors/${id}/approve-zones`, { method: "PATCH" }),
    rejectVendorZones: (id) => request(`/admin/vendors/${id}/reject-zones`, { method: "PATCH" }),
    approveProviderZones: (id) => request(`/admin/providers/${id}/approve-zones`, { method: "PATCH" }),
    rejectProviderZones: (id) => request(`/admin/providers/${id}/reject-zones`, { method: "PATCH" }),
    customers: () => request("/admin/customers"),
    providers: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/admin/providers${q ? `?${q}` : ""}`);
    },
    updateProviderStatus: (id, status) => request(`/admin/providers/${id}/status`, { method: "PATCH", body: { status } }),
    updateProviderProfile: (id, payload) => request(`/admin/providers/${id}/profile`, { method: "PATCH", body: payload }),
    adjustProviderWallet: (id, payload) => request(`/admin/providers/${id}/wallet/adjust`, { method: "PATCH", body: payload }),
    bookings: () => request("/admin/bookings"),
    getAvailableProviders: (bookingId) => request(`/admin/bookings/${bookingId}/available-providers`),
    approveBookingImages: (id, approved) => request(`/admin/bookings/${id}/approve-images`, { method: "PATCH", body: { approved } }),


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
    updateOfficeSettings: (payload) => request("/admin/settings", { method: "PUT", body: payload }),

    // Payouts
    getPayouts: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/admin/payouts${q ? `?${q}` : ""}`);
    },
    updatePayoutStatus: (id, status) => request(`/admin/payouts/${id}/status`, { method: "PATCH", body: { status } }),

    // System Settings
    getSystemSettings: () => request("/admin/system-settings"),
    updateSystemSettings: (payload) => request("/admin/system-settings", { method: "PUT", body: payload }),

    // Performance Criteria
    getPerformanceCriteria: () => request("/admin/performance-criteria"),
    updatePerformanceCriteria: (payload) => request("/admin/performance-criteria", { method: "PUT", body: payload }),

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

    // Cities & Zones
    listCities: () => request("/admin/cities"),
    createCity: (body) => request("/admin/cities", { method: "POST", body }),
    updateCity: (id, body) => request(`/admin/cities/${id}`, { method: "PUT", body }),
    deleteCity: (id) => request(`/admin/cities/${id}`, { method: "DELETE" }),
    listZones: (cityId) => request(`/admin/cities/${cityId}/zones`),
    createZone: (cityId, body) => request(`/admin/cities/${cityId}/zones`, { method: "POST", body }),
    updateZone: (id, body) => request(`/admin/zones/${id}`, { method: "PUT", body }),
    deleteZone: (id) => request(`/admin/zones/${id}`, { method: "DELETE" }),
    getZoneStats: (zoneId) => request(`/admin/zones/${zoneId}/stats`),
    
    // Zone Creation from Provider Requests (Phase 4)
    listPendingZoneCreations: () => request("/admin/pending-zone-creations"),
    createZoneFromRequest: (body) => request("/admin/zones/create-from-request", { method: "POST", body }),
    rejectZoneCreationRequest: (body) => request("/admin/zones/reject-request", { method: "POST", body }),
    
    getSubscriptionSettings: () => request("/admin/subscription-settings"),
    updateSubscriptionSettings: (body) => request("/admin/subscription-settings", { method: "PUT", body }),
    listSubscriptionPlans: () => request("/admin/subscription-plans"),
    createSubscriptionPlan: (body) => request("/admin/subscription-plans", { method: "POST", body }),
    updateSubscriptionPlan: (planId, body) => request(`/admin/subscription-plans/${planId}`, { method: "PUT", body }),
    deleteSubscriptionPlan: (planId) => request(`/admin/subscription-plans/${planId}`, { method: "DELETE" }),
    getSubscriptionReport: () => request("/admin/subscription-report"),
    pushBroadcast: (body) => request("/admin/push/broadcast", { method: "POST", body }),
    pushBroadcastHistory: () => request("/admin/push/broadcast/history"),
    pushTest: (body) => request("/admin/push/test", { method: "POST", body }),

    // Feedback Management
    listFeedback: (params) => request("/admin/feedback", { params }),
    getFeedbackStats: () => request("/admin/feedback/stats"),
    deleteFeedback: (id) => request(`/admin/feedback/${id}`, { method: "DELETE" }),
    updateFeedbackStatus: (id, status) => request(`/admin/feedback/${id}/status`, { method: "PATCH", body: { status } }),

    // Customer COD Management
    toggleCustomerCOD: (userId, codDisabled) => request(`/admin/customers/${userId}/toggle-cod`, { method: "PATCH", body: { codDisabled } }),
    updateCustomerStatus: (userId, status) => request(`/admin/customers/${userId}/status`, { method: "PATCH", body: { status } }),

    // Booking Types Management
    getBookingTypes: () => request("/admin/booking-types"),
    createBookingType: (body) => request("/admin/booking-types", { method: "POST", body }),
    updateBookingType: (id, body) => request(`/admin/booking-types/${id}`, { method: "PATCH", body }),
    deleteBookingType: (id) => request(`/admin/booking-types/${id}`, { method: "DELETE" }),

    // Support Chat
    supportConversations: () => requestWithToken("/support/admin/conversations", {}, getAdminToken(), "admin"),
    supportChat: (participantId) => requestWithToken(`/support/admin/chat/${participantId}`, {}, getAdminToken(), "admin"),
    supportReply: (participantId, message) => requestWithToken(`/support/admin/chat/${participantId}`, { method: "POST", body: { message } }, getAdminToken(), "admin"),

    // Training
    getTrainingVideos: () => requestWithToken("/training/admin", {}, getAdminToken(), "admin"),
    createTrainingVideo: (body) => requestWithToken("/training/admin", { method: "POST", body }, getAdminToken(), "admin"),
    updateTrainingVideo: (id, body) => requestWithToken(`/training/admin/${id}`, { method: "PUT", body }, getAdminToken(), "admin"),
    deleteTrainingVideo: (id) => requestWithToken(`/training/admin/${id}`, { method: "DELETE" }, getAdminToken(), "admin"),
    uploadTrainingThumbnail: (file) => {
      const formData = new FormData();
      formData.append("image", file);
      return requestWithToken("/training/upload-thumbnail", { method: "POST", body: formData }, getAdminToken(), "admin");
    },
  },

  subscriptions: {
    getPlans: (userType) => request(`/subscriptions/plans${userType ? `?userType=${encodeURIComponent(userType)}` : ""}`),
    getCurrent: (role = "user") => requestWithToken("/subscriptions/me", {}, getTokenByRole(role), role),
    createOrder: (payload, role = "user") => requestWithToken("/subscriptions/order", { method: "POST", body: payload }, getTokenByRole(role), role),
    verify: (payload, role = "user") => requestWithToken("/subscriptions/verify", { method: "POST", body: payload }, getTokenByRole(role), role),
  },

  // SOS (customer/provider)
  sos: {
    create: (payload) => request("/sos", { method: "POST", body: payload }),
  },

  // Feedback Submission
  feedback: {
    submit: (bookingId, data) => request(`/bookings/${bookingId}/feedback`, { method: "POST", body: data }),
  },

  // Notifications
  notifications: {
    list: (opts = {}) => {
      const options = typeof opts === "string" ? { role: opts } : (opts || {});
      const role = options.role;
      const token = options.token || (role ? getTokenByRole(role) : "");
      if (role || token) {
        return requestWithToken("/notifications", {}, token, role);
      }
      return request("/notifications");
    },
    markAllAsRead: (opts = {}) => {
      const options = typeof opts === "string" ? { role: opts } : (opts || {});
      const role = options.role;
      const token = options.token || (role ? getTokenByRole(role) : "");
      if (role || token) {
        return requestWithToken("/notifications/read-all", { method: "PUT" }, token, role);
      }
      return request("/notifications/read-all", { method: "PUT" });
    },
    markAsRead: (id, opts = {}) => {
      const options = typeof opts === "string" ? { role: opts } : (opts || {});
      const role = options.role;
      const token = options.token || (role ? getTokenByRole(role) : "");
      if (role || token) {
        return requestWithToken(`/notifications/${id}/read`, { method: "PATCH" }, token, role);
      }
      return request(`/notifications/${id}/read`, { method: "PATCH" });
    },
    delete: (id, opts = {}) => {
      const options = typeof opts === "string" ? { role: opts } : (opts || {});
      const role = options.role;
      const token = options.token || (role ? getTokenByRole(role) : "");
      if (role || token) {
        return requestWithToken(`/notifications/${id}`, { method: "DELETE" }, token, role);
      }
      return request(`/notifications/${id}`, { method: "DELETE" });
    },
    deleteAll: (opts = {}) => {
      const options = typeof opts === "string" ? { role: opts } : (opts || {});
      const role = options.role;
      const token = options.token || (role ? getTokenByRole(role) : "");
      if (role || token) {
        return requestWithToken("/notifications", { method: "DELETE" }, token, role);
      }
      return request("/notifications", { method: "DELETE" });
    },
    deleteMultiple: (ids, opts = {}) => {
      const options = typeof opts === "string" ? { role: opts } : (opts || {});
      const role = options.role;
      const token = options.token || (role ? getTokenByRole(role) : "");
      if (role || token) {
        return requestWithToken("/notifications/delete-multiple", { method: "POST", body: { ids } }, token, role);
      }
      return request("/notifications/delete-multiple", { method: "POST", body: { ids } });
    },
    push: {
      register: (body, opts = {}) => {
        const options = typeof opts === "string" ? { role: opts } : (opts || {});
        const role = options.role || "user";
        const token = options.token || getTokenByRole(role);
        return requestWithToken("/notifications/push/register", { method: "POST", body }, token, role);
      },
      unregister: (body, opts = {}) => {
        const options = typeof opts === "string" ? { role: opts } : (opts || {});
        const role = options.role || "user";
        const token = options.token || getTokenByRole(role);
        return requestWithToken("/notifications/push/register", { method: "DELETE", body }, token, role);
      },
      status: (deviceKey, opts = {}) => {
        const options = typeof opts === "string" ? { role: opts } : (opts || {});
        const role = options.role || "user";
        const token = options.token || getTokenByRole(role);
        return requestWithToken(`/notifications/push/status?deviceKey=${encodeURIComponent(deviceKey)}`, {}, token, role);
      },
      preferences: (body, opts = {}) => {
        const options = typeof opts === "string" ? { role: opts } : (opts || {});
        const role = options.role || "user";
        const token = options.token || getTokenByRole(role);
        return requestWithToken("/notifications/push/preferences", { method: "PATCH", body }, token, role);
      },
    },
  },

  fcmTokens: {
    save: (role, tokenValue, platform = "web") => {
      const token = getTokenByRole(role);
      
      console.log('[API] 🔐 FCM Token Save Request:', {
        role,
        hasAuthToken: !!token,
        authTokenPreview: token ? `${token.substring(0, 20)}...` : 'null',
        fcmTokenPreview: tokenValue ? `${tokenValue.substring(0, 30)}...` : 'null',
        platform: platform
      });
      const base =
        role === "provider"
          ? "/api/providers/fcm-tokens"
          : role === "vendor"
          ? "/api/vendors/fcm-tokens"
          : role === "admin"
          ? "/api/admins/fcm-tokens"
          : "/api/users/fcm-tokens";
      console.log('[API] Endpoint:', `${base}/save`);
      return requestWithToken(`${base}/save`, { method: "POST", body: { token: tokenValue, platform: platform } }, token, role);
    },
    remove: (role, tokenValue, platform = "web") => {
      const token = getTokenByRole(role);
      const base =
        role === "provider"
          ? "/api/providers/fcm-tokens"
          : role === "vendor"
          ? "/api/vendors/fcm-tokens"
          : role === "admin"
          ? "/api/admins/fcm-tokens"
          : "/api/users/fcm-tokens";
      return requestWithToken(`${base}/remove`, { method: "POST", body: { token: tokenValue, platform } }, token, role);
    },
  },
};

// Custom extensions
api.provider.uploadBookingImages = async (bookingId, type, files) => {
  const token = getTokenByRole("provider");
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
