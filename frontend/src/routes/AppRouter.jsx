import { Routes, Route } from "react-router-dom";
import PublicEventsPage from "../pages/PublicEventsPage.jsx";
import HowItWorksPage from "../pages/HowItWorksPage.jsx";
import ContactPage from "../pages/ContactPage.jsx";
import EventsPage from "../pages/EventsPage.jsx";
import EventDetailsPage from "../pages/EventDetailsPage.jsx";
import LoginPage from "../pages/LoginPage.jsx";
import RegisterPage from "../pages/RegisterPage.jsx";
import GalleryPage from "../pages/GalleryPage.jsx";
import ProtectedRoute from "../components/ProtectedRoute.jsx";
import RegistrationStatusPage from "../pages/RegistrationStatusPage.jsx";
import DashboardOverviewPage from "../pages/DashboardOverviewPage.jsx";
import DashboardEventsPage from "../pages/DashboardEventsPage.jsx";
import DashboardProfilePage from "../pages/DashboardProfilePage.jsx";

import MaamulLoginPage from "../pages/MaamulLoginPage.jsx";
import MaamulSignupPage from "../pages/MaamulSignupPage.jsx";
import PhotographerLoginPage from "../pages/PhotographerLoginPage.jsx";
import RealmProtectedRoute from "../components/RealmProtectedRoute.jsx";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { usePhotographerAuth } from "../context/PhotographerAuthContext.jsx";

import AdminOverviewPage from "../pages/admin/AdminOverviewPage.jsx";
import AdminUsersPage from "../pages/admin/AdminUsersPage.jsx";
import AdminEventsConsolePage from "../pages/admin/AdminEventsConsolePage.jsx";
import AdminCheckInConsolePage from "../pages/admin/AdminCheckInConsolePage.jsx";
import AdminMediaManagePage from "../pages/admin/AdminMediaManagePage.jsx";
import AdminProfilePage from "../pages/admin/AdminProfilePage.jsx";
import AdminMessagesPage from "../pages/admin/AdminMessagesPage.jsx";
import AdminReportsPage from "../pages/admin/AdminReportsPage.jsx";

import PhotographerEventsPage from "../pages/photographer/PhotographerEventsPage.jsx";
import PhotographerMediaManagePage from "../pages/photographer/PhotographerMediaManagePage.jsx";
import PhotographerProfilePage from "../pages/photographer/PhotographerProfilePage.jsx";

const AdminGuard = ({ children }) => (
  <RealmProtectedRoute useAuth={useAdminAuth} loginPath="/maamul/login">{children}</RealmProtectedRoute>
);
const PhotographerGuard = ({ children }) => (
  <RealmProtectedRoute useAuth={usePhotographerAuth} loginPath="/photographer/login">{children}</RealmProtectedRoute>
);

export default function AppRouter() {
  return (
    <Routes>
      {/* ---- Public site (attendees only) ---- */}
      <Route path="/" element={<PublicEventsPage />} />
      <Route path="/home" element={<PublicEventsPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/events/:eventId" element={<EventDetailsPage />} />
      <Route path="/events/:eventId/registration" element={<ProtectedRoute><RegistrationStatusPage /></ProtectedRoute>} />
      <Route path="/events/:eventId/gallery" element={<ProtectedRoute><GalleryPage /></ProtectedRoute>} />

      <Route path="/dashboard" element={<ProtectedRoute><DashboardOverviewPage /></ProtectedRoute>} />
      <Route path="/dashboard/events" element={<ProtectedRoute><DashboardEventsPage /></ProtectedRoute>} />
      <Route path="/dashboard/profile" element={<ProtectedRoute><DashboardProfilePage /></ProtectedRoute>} />
      {/* Same pages, kept inside the dashboard shell so opening an event from
          the dashboard does not throw the user back out to the public site. */}
      <Route path="/dashboard/events/:eventId" element={<ProtectedRoute><EventDetailsPage /></ProtectedRoute>} />
      <Route path="/dashboard/events/:eventId/registration" element={<ProtectedRoute><RegistrationStatusPage /></ProtectedRoute>} />
      <Route path="/dashboard/events/:eventId/gallery" element={<ProtectedRoute><GalleryPage /></ProtectedRoute>} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* ---- Admin realm: unguessable path, its own login, no self sign-up
          after the first admin exists ---- */}
      <Route path="/maamul/login" element={<MaamulLoginPage />} />
      <Route path="/maamul/signup" element={<MaamulSignupPage />} />
      <Route path="/maamul/dashboard" element={<AdminGuard><AdminOverviewPage /></AdminGuard>} />
      <Route path="/maamul/users/:group" element={<AdminGuard><AdminUsersPage /></AdminGuard>} />
      <Route path="/maamul/events" element={<AdminGuard><AdminEventsConsolePage /></AdminGuard>} />
      <Route path="/maamul/events/:eventId/media" element={<AdminGuard><AdminMediaManagePage /></AdminGuard>} />
      <Route path="/maamul/checkin" element={<AdminGuard><AdminCheckInConsolePage /></AdminGuard>} />
      <Route path="/maamul/profile" element={<AdminGuard><AdminProfilePage /></AdminGuard>} />
      <Route path="/maamul/messages" element={<AdminGuard><AdminMessagesPage /></AdminGuard>} />
      <Route path="/maamul/reports" element={<AdminGuard><AdminReportsPage /></AdminGuard>} />

      {/* ---- Photographer realm: sign-in only, accounts made by an admin ---- */}
      <Route path="/photographer/login" element={<PhotographerLoginPage />} />
      <Route path="/photographer/events" element={<PhotographerGuard><PhotographerEventsPage /></PhotographerGuard>} />
      <Route path="/photographer/events/:eventId/media" element={<PhotographerGuard><PhotographerMediaManagePage /></PhotographerGuard>} />
      <Route path="/photographer/profile" element={<PhotographerGuard><PhotographerProfilePage /></PhotographerGuard>} />
    </Routes>
  );
}
