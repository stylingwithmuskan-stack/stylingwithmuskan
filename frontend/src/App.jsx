import { useEffect, useContext } from "react";
import { Toaster } from "@/modules/user/components/ui/toaster";
import { Toaster as Sonner } from "@/modules/user/components/ui/sonner";
import { TooltipProvider } from "@/modules/user/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { initPushNotifications, unregisterPush } from "@/services/pushNotificationService";
import { GenderThemeProvider } from "@/modules/user/contexts/GenderThemeContext";
import { CartProvider } from "@/modules/user/contexts/CartContext";
import { AuthProvider, AuthContext } from "@/modules/user/contexts/AuthContext";
import { BookingProvider } from "@/modules/user/contexts/BookingContext";
import { WishlistProvider } from "@/modules/user/contexts/WishlistContext";
import { UserModuleDataProvider } from "@/modules/user/contexts/UserModuleDataContext";
import { NotificationProvider } from "@/modules/user/contexts/NotificationContext";
import LoginModal from "@/modules/user/components/salon/LoginModal";

// User Pages
import SplashScreen from "@/modules/user/pages/SplashScreen";
import GenderSelect from "@/modules/user/pages/GenderSelect";
import HomePage from "@/modules/user/pages/HomePage";
import ReelsPage from "@/modules/user/pages/ReelsPage";
import ExplorePage from "@/modules/user/pages/ExplorePage";
import BookingsPage from "@/modules/user/pages/BookingsPage";
import ServiceDetail from "@/modules/user/pages/ServiceDetail";
import BookingSummary from "@/modules/user/pages/BookingSummary";
import PaymentPage from "@/modules/user/pages/PaymentPage";
import ProfilePage from "@/modules/user/pages/ProfilePage";
import EditProfilePage from "@/modules/user/pages/EditProfilePage";
import WalletPage from "@/modules/user/pages/WalletPage";
import AddressesPage from "@/modules/user/pages/AddressesPage";
import ReferralPage from "@/modules/user/pages/ReferralPage";
import CouponsPage from "@/modules/user/pages/CouponsPage";
import SupportPage from "@/modules/user/pages/SupportPage";
import NotFound from "@/modules/user/pages/NotFound";
import UserRegisterPage from "@/modules/user/pages/UserRegisterPage";
import WishlistPage from "@/modules/user/pages/WishlistPage";
import UserLoginPage from "@/modules/user/pages/UserLoginPage";
import SubscriptionPage from "@/modules/user/pages/SubscriptionPage";
import SubscriptionPlans from "@/modules/user/pages/SubscriptionPlans";
import NotificationsPage from "@/modules/user/pages/NotificationsPage";
import ActivityPage from "@/modules/user/pages/ActivityPage";
import PrivacyPolicyPage from "@/modules/user/pages/PrivacyPolicyPage";
import ContactUsPage from "@/modules/user/pages/ContactUsPage";
import AboutUsPage from "@/modules/user/pages/AboutUsPage";
import TermsConditionsPage from "@/modules/user/pages/TermsConditionsPage";
import FloatingCart from "@/modules/user/components/salon/FloatingCart";
import BottomNav from "@/modules/user/components/salon/BottomNav";
import ExpressCheckout from "@/modules/user/components/salon/ExpressCheckout";

// Service Provider Module
import ProviderLayout from "@/modules/serviceprovider/components/ProviderLayout";
import ProviderDashboard from "@/modules/serviceprovider/pages/ProviderDashboard";
import LeadCreditManager from "@/modules/serviceprovider/pages/LeadCreditManager";
import AvailabilityCalendar from "@/modules/serviceprovider/pages/AvailabilityCalendar";
import PerformanceDashboard from "@/modules/serviceprovider/pages/PerformanceDashboard";
import ProviderProfile from "@/modules/serviceprovider/pages/ProviderProfile";
import ProviderSubscriptionPage from "@/modules/serviceprovider/pages/ProviderSubscriptionPage";
import AdminFinanceSuite from "@/modules/serviceprovider/pages/AdminFinanceSuite";
import JobHistory from "@/modules/serviceprovider/pages/JobHistory";
import TrainingHub from "@/modules/serviceprovider/pages/TrainingHub";
import ProviderBookingsPage from "@/modules/serviceprovider/pages/ProviderBookingsPage";
import ProviderBookingDetailPage from "@/modules/serviceprovider/pages/ProviderBookingDetailPage";
import SWMSupport from "@/modules/serviceprovider/pages/SWMSupport";
import SOSPage from "@/modules/serviceprovider/pages/SOSPage";
import TicketRaise from "@/modules/serviceprovider/pages/TicketRaise";
import MyHub from "@/modules/serviceprovider/pages/MyHub";
import AllZonesMapPage from "@/modules/serviceprovider/pages/AllZonesMapPage";
import SWMShop from "@/modules/serviceprovider/pages/SWMShop";
import { ProviderBookingProvider } from "@/modules/serviceprovider/contexts/ProviderBookingContext";
import { ProviderAuthProvider, ProviderAuthContext } from "@/modules/serviceprovider/contexts/ProviderAuthContext";

// Service Provider Auth
import ProviderLoginPage from "@/modules/serviceprovider/pages/auth/ProviderLoginPage";
import ProviderRegisterPage from "@/modules/serviceprovider/pages/auth/ProviderRegisterPage";
import ProviderStatusPage from "@/modules/serviceprovider/pages/auth/ProviderStatusPage";

// Service Provider Info Pages
import ProviderActivityPage from "@/modules/serviceprovider/pages/ProviderActivityPage";
import ProviderPrivacyPolicyPage from "@/modules/serviceprovider/pages/ProviderPrivacyPolicyPage";
import ProviderContactUsPage from "@/modules/serviceprovider/pages/ProviderContactUsPage";
import ProviderAboutUsPage from "@/modules/serviceprovider/pages/ProviderAboutUsPage";
import ProviderTermsConditionsPage from "@/modules/serviceprovider/pages/ProviderTermsConditionsPage";

// Vendor Module
import { VenderAuthProvider, VenderAuthContext } from "@/modules/vender/contexts/VenderAuthContext";
import VenderLayout from "@/modules/vender/components/VenderLayout";
import VenderLoginPage from "@/modules/vender/pages/auth/VenderLoginPage";
import VenderRegisterPage from "@/modules/vender/pages/auth/VenderRegisterPage";
import VenderStatusPage from "@/modules/vender/pages/auth/VenderStatusPage";
import VenderDashboard from "@/modules/vender/pages/VenderDashboard";
import SPManagement from "@/modules/vender/pages/SPManagement";
import VenderCityVendors from "@/modules/vender/pages/VenderCityVendors";
import ZoneRequests from "@/modules/vender/pages/ZoneRequests";
import VenderBookings from "@/modules/vender/pages/VenderBookings";
import VenderPayouts from "@/modules/vender/pages/VenderPayouts";
import VenderSOSMonitor from "@/modules/vender/pages/VenderSOSMonitor";
import VenderFeedback from "@/modules/vender/pages/VenderFeedback";
import VenderProfile from "@/modules/vender/pages/VenderProfile";
import VendorSubscriptionPage from "@/modules/vender/pages/VendorSubscriptionPage";

// Vendor Info Pages
import VenderActivityPage from "@/modules/vender/pages/VenderActivityPage";
import VenderPrivacyPolicyPage from "@/modules/vender/pages/VenderPrivacyPolicyPage";
import VenderContactUsPage from "@/modules/vender/pages/VenderContactUsPage";
import VenderAboutUsPage from "@/modules/vender/pages/VenderAboutUsPage";
import VenderTermsConditionsPage from "@/modules/vender/pages/VenderTermsConditionsPage";
import VendorSupport from "@/modules/vender/pages/VendorSupport";

// Admin Module
import { AdminAuthProvider, AdminAuthContext } from "@/modules/admin/contexts/AdminAuthContext";
import AdminLayout from "@/modules/admin/components/AdminLayout";
import AdminLoginPage from "@/modules/admin/pages/AdminLoginPage";
import AdminDashboard from "@/modules/admin/pages/AdminDashboard";
import VendorManagement from "@/modules/admin/pages/VendorManagement";
import SPOversight from "@/modules/admin/pages/SPOversight";
import CustomerOversight from "@/modules/admin/pages/CustomerOversight";
import BookingManagement from "@/modules/admin/pages/BookingManagement";
import FinanceManagement from "@/modules/admin/pages/FinanceManagement";
import MarketingControl from "@/modules/admin/pages/MarketingControl";
import ReelsManagement from "@/modules/admin/pages/ReelsManagement";
import CouponSystem from "@/modules/admin/pages/CouponSystem";
import ReferralSystem from "@/modules/admin/pages/ReferralSystem";
import SOSMonitor from "@/modules/admin/pages/SOSMonitor";
import UserModuleManagement from "@/modules/admin/pages/UserModuleManagement";
import CityZoneManagement from "@/modules/admin/pages/CityZoneManagement";
import FeedbackManagement from "@/modules/admin/pages/FeedbackManagement";
import CustomEnquiries from "@/modules/admin/pages/CustomEnquiries";
import TrainingManagement from "@/modules/admin/pages/TrainingManagement";
import GalleryManagement from "@/modules/admin/pages/GalleryManagement";
import SubscriptionManagement from "@/modules/admin/pages/SubscriptionManagement";
import SupportChat from "@/modules/admin/pages/SupportChat";

// Common Pages
import RoleSelectionPage from "@/modules/common/pages/RoleSelectionPage";

const queryClient = new QueryClient();

// PushNotificationManager: handles push init/unregister for all roles
function PushNotificationManager() {
  const userCtx = useContext(AuthContext);
  const providerCtx = useContext(ProviderAuthContext);
  const vendorCtx = useContext(VenderAuthContext);
  const adminCtx = useContext(AdminAuthContext);

  // User push
  useEffect(() => {
    const token = localStorage.getItem("swm_token");
    if (userCtx?.isLoggedIn && token) {
      initPushNotifications(token, "user");
    } else if (!userCtx?.isLoggedIn) {
      const token = localStorage.getItem("swm_token");
      unregisterPush(token, "user");
    }
  }, [userCtx?.isLoggedIn]);

  // Provider push
  useEffect(() => {
    const token = localStorage.getItem("swm_provider_token");
    if (providerCtx?.isLoggedIn && token) {
      initPushNotifications(token, "provider");
    } else if (!providerCtx?.isLoggedIn) {
      unregisterPush(token, "provider");
    }
  }, [providerCtx?.isLoggedIn]);

  // Vendor push
  useEffect(() => {
    const token = localStorage.getItem("swm_vendor_token");
    if (vendorCtx?.isLoggedIn && token) {
      initPushNotifications(token, "vendor");
    } else if (!vendorCtx?.isLoggedIn) {
      unregisterPush(token, "vendor");
    }
  }, [vendorCtx?.isLoggedIn]);

  // Admin push
  useEffect(() => {
    const token = localStorage.getItem("swm_admin_token");
    if (adminCtx?.isLoggedIn && token) {
      initPushNotifications(token, "admin");
    } else if (!adminCtx?.isLoggedIn) {
      unregisterPush(token, "admin");
    }
  }, [adminCtx?.isLoggedIn]);

  return null;
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <UserModuleDataProvider>
              <GenderThemeProvider>
                <CartProvider>
                  <WishlistProvider>
                    <BookingProvider>
                      <ProviderAuthProvider>
                        <ProviderBookingProvider>
                          <VenderAuthProvider>
                            <AdminAuthProvider>
                              <NotificationProvider role="any">
                                <PushNotificationManager />
                                <ErrorBoundary>
                                  <Toaster />
                                  <Sonner />
                                  <Routes>
                                {/* User Routes */}
                                <Route path="/" element={<SplashScreen />} />
                                <Route path="/select-gender" element={<GenderSelect />} />
                                <Route path="/home" element={<HomePage />} />
                                <Route path="/reels" element={<ReelsPage />} />
                                <Route path="/register" element={<UserRegisterPage />} />
                                <Route path="/login" element={<UserLoginPage />} />
                                <Route path="/explore" element={<ExplorePage />} />
                                <Route path="/explore/:categoryId" element={<ExplorePage />} />
                                <Route path="/bookings" element={<BookingsPage />} />
                                <Route path="/service/:id" element={<ServiceDetail />} />
                                <Route path="/booking/:id" element={<BookingSummary />} />
                                <Route path="/payment" element={<PaymentPage />} />
                                <Route path="/profile" element={<ProfilePage />} />
                                <Route path="/edit-profile" element={<EditProfilePage />} />
                                <Route path="/wallet" element={<WalletPage />} />
                                <Route path="/addresses" element={<AddressesPage />} />
                                <Route path="/referral" element={<ReferralPage />} />
                                <Route path="/coupons" element={<CouponsPage />} />
                                <Route path="/support" element={<SupportPage />} />
                                <Route path="/wishlist" element={<WishlistPage />} />
                                <Route path="/notifications" element={<NotificationsPage />} />
                                <Route path="/activity" element={<ActivityPage />} />
                                <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                                <Route path="/contact-us" element={<ContactUsPage />} />
                                <Route path="/about-us" element={<AboutUsPage />} />
                                <Route path="/terms-conditions" element={<TermsConditionsPage />} />
                                <Route path="/subscription" element={<SubscriptionPage />} />
                                <Route path="/plus-subscription" element={<SubscriptionPlans />} />

                                {/* Role Selection for Vendor/Provider */}
                                <Route path="/role-selection" element={<RoleSelectionPage />} />

                                {/* Service Provider Module */}
                                <Route path="/provider/login" element={<ProviderLoginPage />} />
                                <Route path="/provider/register" element={<ProviderRegisterPage />} />
                                <Route path="/provider/status" element={<ProviderStatusPage />} />
                                
                                {/* Public Provider Info Pages (Accessible without login) */}
                                <Route path="/provider/privacy-policy" element={<ProviderPrivacyPolicyPage />} />
                                <Route path="/provider/contact-us" element={<ProviderContactUsPage />} />
                                <Route path="/provider/about-us" element={<ProviderAboutUsPage />} />
                                <Route path="/provider/terms-conditions" element={<ProviderTermsConditionsPage />} />
                                <Route path="/provider/support" element={<SWMSupport />} />

                                <Route path="/provider" element={<ProviderLayout />}>
                                  <Route index element={<Navigate to="/provider/dashboard" replace />} />
                                  <Route path="dashboard" element={<ProviderDashboard />} />
                                  <Route path="bookings" element={<ProviderBookingsPage />} />
                                  <Route path="booking/:id" element={<ProviderBookingDetailPage />} />
                                  <Route path="credits" element={<LeadCreditManager />} />
                                  <Route path="availability" element={<AvailabilityCalendar />} />
                                  <Route path="performance" element={<PerformanceDashboard />} />
                                  <Route path="profile" element={<ProviderProfile />} />
                                  <Route path="subscription" element={<ProviderSubscriptionPage />} />
                                  <Route path="admin" element={<AdminFinanceSuite />} />
                                  <Route path="history" element={<JobHistory />} />
                                  <Route path="training" element={<TrainingHub />} />
                                  <Route path="support" element={<SWMSupport />} />
                                  <Route path="sos" element={<SOSPage />} />
                                  <Route path="tickets" element={<TicketRaise />} />
                                  <Route path="hub" element={<MyHub />} />
                                  <Route path="all-zones" element={<AllZonesMapPage />} />
                                  <Route path="shop" element={<SWMShop />} />
                                  <Route path="notifications" element={<NotificationsPage />} />
                                  <Route path="activity" element={<ProviderActivityPage />} />
                                </Route>

                                {/* Vendor Module */}
                                <Route path="/vender/login" element={<VenderLoginPage />} />
                                <Route path="/vender/register" element={<VenderRegisterPage />} />
                                <Route path="/vender/status" element={<VenderStatusPage />} />

                                {/* Public Vendor Info Pages (Accessible without login) */}
                                <Route path="/vender/privacy-policy" element={<VenderPrivacyPolicyPage />} />
                                <Route path="/vender/contact-us" element={<VenderContactUsPage />} />
                                <Route path="/vendor/contact-us" element={<VenderContactUsPage />} />
                                <Route path="/vender/about-us" element={<VenderAboutUsPage />} />
                                <Route path="/vender/terms-conditions" element={<VenderTermsConditionsPage />} />

                                <Route path="/vender" element={<VenderLayout />}>
                                  <Route index element={<Navigate to="/vender/dashboard" replace />} />
                                  <Route path="dashboard" element={<VenderDashboard />} />
                                  <Route path="service-providers" element={<SPManagement />} />
                                  <Route path="vendors" element={<VenderCityVendors />} />
                                  <Route path="zone-requests" element={<ZoneRequests />} />
                                  <Route path="bookings" element={<VenderBookings />} />
                                  <Route path="payouts" element={<VenderPayouts />} />
                                  <Route path="subscription" element={<VendorSubscriptionPage />} />
                                  <Route path="sos" element={<VenderSOSMonitor />} />
                                  <Route path="feedback" element={<VenderFeedback />} />
                                  <Route path="profile" element={<VenderProfile />} />
                                  <Route path="notifications" element={<NotificationsPage />} />
                                  <Route path="activity" element={<VenderActivityPage />} />
                                  <Route path="support" element={<VendorSupport />} />
                                </Route>

                                {/* Admin Module */}
                                <Route path="/admin/login" element={<AdminLoginPage />} />
                                <Route path="/admin" element={<AdminLayout />}>
                                  <Route index element={<Navigate to="/admin/dashboard" replace />} />
                                  <Route path="dashboard" element={<AdminDashboard />} />
                                  <Route path="cities" element={<CityZoneManagement />} />
                                  <Route path="vendors" element={<VendorManagement />} />
                                  <Route path="service-providers" element={<SPOversight />} />
                                  <Route path="customers" element={<CustomerOversight />} />
                                  <Route path="bookings" element={<BookingManagement />} />
                                  <Route path="finance" element={<FinanceManagement />} />
                                  <Route path="banners" element={<MarketingControl />} />
                                  <Route path="reels" element={<ReelsManagement />} />
                                  <Route path="coupons" element={<CouponSystem />} />
                                  <Route path="referrals" element={<ReferralSystem />} />
                                  <Route path="sos" element={<SOSMonitor />} />
                                  <Route path="user-data" element={<UserModuleManagement />} />
                                  <Route path="training" element={<TrainingManagement />} />
                                  <Route path="feedback" element={<FeedbackManagement />} />
                                  <Route path="custom-enquiries" element={<CustomEnquiries />} />
                                  <Route path="gallery" element={<GalleryManagement />} />
                                  <Route path="subscriptions" element={<SubscriptionManagement />} />
                                  <Route path="support-chat" element={<SupportChat />} />
                                  <Route path="notifications" element={<NotificationsPage />} />
                                </Route>

                                {/* Common Typos / Legacy Redirects */}
                                <Route path="/home/beautician/*" element={<Navigate to="/beautician" replace />} />
                                <Route path="/home/provider/*" element={<Navigate to="/provider" replace />} />

                                {/* Fallback */}
                                <Route path="*" element={<NotFound />} />
                                </Routes>
                                <LoginModal />
                                <FloatingCart />
                                <ExpressCheckout />
                                <BottomNav />
                              </ErrorBoundary>
                            </NotificationProvider>
                            </AdminAuthProvider>
                          </VenderAuthProvider>
                        </ProviderBookingProvider>
                      </ProviderAuthProvider>
                    </BookingProvider>
                  </WishlistProvider>
                </CartProvider>
              </GenderThemeProvider>
            </UserModuleDataProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
