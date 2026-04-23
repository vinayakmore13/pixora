import { lazy, Suspense } from "react";
import {
  Route,
  BrowserRouter as Router,
  Routes,
  useLocation,
} from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { Footer, Header } from "./components/Navigation";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { LayoutProvider } from "./contexts/LayoutContext";

// Eager load auth components
import { ForgotPassword } from "./components/ForgotPassword";
import { PasswordReset } from "./components/PasswordReset";
import { PublicEventPage } from "./components/PublicEventPage";
import { SelectionPortal } from "./components/SelectionPortal";
import { SignIn } from "./components/SignIn";
import { SignUp } from "./components/SignUp";

// Lazy load main app routes
const LandingPage = lazy(() =>
  import("./components/AnimatedLandingPage").then((m) => ({ default: m.AnimatedLandingPage })),
);
const Dashboard = lazy(() =>
  import("./components/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const CreateEvent = lazy(() =>
  import("./components/CreateEvent").then((m) => ({ default: m.CreateEvent })),
);
const EventManagement = lazy(() =>
  import("./components/EventManagement").then((m) => ({
    default: m.EventManagement,
  })),
);
const EditEvent = lazy(() =>
  import("./components/EditEvent").then((m) => ({ default: m.EditEvent })),
);
const Gallery = lazy(() =>
  import("./components/Gallery").then((m) => ({ default: m.Gallery })),
);
const Marketplace = lazy(() =>
  import("./components/Marketplace").then((m) => ({ default: m.Marketplace })),
);
const MessagesList = lazy(() =>
  import("./components/MessagesList").then((m) => ({
    default: m.MessagesList,
  })),
);
const ChatRoom = lazy(() =>
  import("./components/ChatRoom").then((m) => ({ default: m.ChatRoom })),
);
const PhotographerProfile = lazy(() =>
  import("./components/PhotographerProfile").then((m) => ({
    default: m.PhotographerProfile,
  })),
);
const EditPhotographerProfile = lazy(() =>
  import("./components/EditPhotographerProfile").then((m) => ({
    default: m.EditPhotographerProfile,
  })),
);
const BookingFlow = lazy(() =>
  import("./components/BookingFlow").then((m) => ({ default: m.BookingFlow })),
);
const UploadPhotos = lazy(() =>
  import("./components/UploadPhotos").then((m) => ({
    default: m.UploadPhotos,
  })),
);
const Pricing = lazy(() =>
  import("./components/Pricing").then((m) => ({ default: m.Pricing })),
);
const FeaturesPage = lazy(() =>
  import("./components/FeaturesPage").then((m) => ({
    default: m.FeaturesPage,
  })),
);

const SmartSharePage = lazy(() =>
  import("./components/SmartSharePage").then((m) => ({ default: m.SmartSharePage })),
);
const HelpSupport = lazy(() =>
  import("./components/HelpSupport").then((m) => ({ default: m.HelpSupport })),
);
const FastSelectionSection = lazy(() =>
  import("./components/FastSelectionSection").then((m) => ({ default: m.FastSelectionSection })),
);
const NotFound = lazy(() =>
  import("./components/NotFound").then((m) => ({ default: m.NotFound })),
);

// Lazy load admin routes
const PartnerLogin = lazy(() =>
  import("./components/admin/PartnerLogin").then((m) => ({
    default: m.PartnerLogin,
  })),
);
const AdminDashboard = lazy(() =>
  import("./components/admin/AdminDashboard").then((m) => ({
    default: m.AdminDashboard,
  })),
);
const AdminUsers = lazy(() =>
  import("./components/admin/AdminUsers").then((m) => ({
    default: m.AdminUsers,
  })),
);
const AdminEvents = lazy(() =>
  import("./components/admin/AdminEvents").then((m) => ({
    default: m.AdminEvents,
  })),
);
const AdminPhotographers = lazy(() =>
  import("./components/admin/AdminPhotographers").then((m) => ({
    default: m.AdminPhotographers,
  })),
);
const AdminSupport = lazy(() => import("./components/admin/AdminSupport"));
const AdminChatRoom = lazy(() => import("./components/admin/AdminChatRoom"));
const AdminRevenue = lazy(() =>
  import("./components/admin/AdminRevenue").then((m) => ({
    default: m.AdminRevenue,
  })),
);

// Route loading fallback
function RouteLoadingFallback() {
  return <LoadingSpinner size="large" text="Loading..." />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LayoutProvider>
          <Router>
          <div className="min-h-screen flex flex-col">
            <Routes>
              {/* Auth routes without common header/footer */}
              <Route path="/signup" element={<SignUp />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/password-reset" element={<PasswordReset />} />

              {/* Public event page (no header/footer) */}
              <Route path="/e/:qrCode" element={<PublicEventPage />} />
              <Route path="/select/:code" element={<SelectionPortal />} />
              <Route path="/share/:token" element={<SmartSharePage />} />

              {/* App routes with common header/footer */}
              <Route path="*" element={<AppLayout />} />
            </Routes>
          </div>
        </Router>
      </LayoutProvider>
    </AuthProvider>
  </ErrorBoundary>
);
}

function AppLayout() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/partner");

  return (
    <>
      {!isAdminRoute && <Header />}
      <main className="flex-grow">
        <Routes>
          <Route
            path="/"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <LandingPage />
              </Suspense>
            }
          />
          <Route
            path="/pricing"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <Pricing />
              </Suspense>
            }
          />
          <Route
            path="/features"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <FeaturesPage />
              </Suspense>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <Dashboard />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <MessagesList />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/support"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <HelpSupport />
              </Suspense>
            }
          />
          <Route
            path="/messages/:conversationId"
            element={
              <ProtectedRoute>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <ChatRoom />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-event"
            element={
              <ProtectedRoute allowedUserTypes={["photographer"]}>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <CreateEvent />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event/:id"
            element={
              <ProtectedRoute>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <EventManagement />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/event/:id/edit"
            element={
              <ProtectedRoute>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <EditEvent />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/gallery/:id"
            element={
              <ProtectedRoute>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <Gallery />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/marketplace"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <Marketplace />
              </Suspense>
            }
          />
          <Route
            path="/photographer/:id"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <PhotographerProfile />
              </Suspense>
            }
          />

          <Route
            path="/photographer/edit"
            element={
              <ProtectedRoute allowedUserTypes={["photographer"]}>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <EditPhotographerProfile />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload"
            element={
              <ProtectedRoute allowedUserTypes={["photographer"]}>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <UploadPhotos />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/fast-selection"
            element={
              <ProtectedRoute allowedUserTypes={["photographer"]}>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <FastSelectionSection />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/book/:packageId"
            element={
              <ProtectedRoute>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <BookingFlow />
                </Suspense>
              </ProtectedRoute>
            }
          />

          {/* Partner Portal Routes */}
          <Route
            path="/partner/login"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <PartnerLogin />
              </Suspense>
            }
          />
          <Route
            path="/partner/dashboard"
            element={
              <ProtectedRoute requireAdmin>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <AdminDashboard />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/partner/users"
            element={
              <ProtectedRoute requireAdmin>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <AdminUsers />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/partner/events"
            element={
              <ProtectedRoute requireAdmin>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <AdminEvents />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/partner/photographers"
            element={
              <ProtectedRoute requireAdmin>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <AdminPhotographers />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/partner/revenue"
            element={
              <ProtectedRoute requireAdmin>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <AdminRevenue />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/partner/support"
            element={
              <ProtectedRoute requireAdmin>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <AdminSupport />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/partner/support/:conversationId"
            element={
              <ProtectedRoute requireAdmin>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <AdminChatRoom />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="*"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <NotFound />
              </Suspense>
            }
          />
        </Routes>
      </main>
      {!isAdminRoute && <Footer />}
    </>
  );
}
