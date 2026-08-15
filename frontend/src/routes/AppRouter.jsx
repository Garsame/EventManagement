import { Routes, Route } from "react-router-dom";
import PublicEventsPage from "../pages/PublicEventsPage.jsx";
import HowItWorksPage from "../pages/HowItWorksPage.jsx";
import EventsPage from "../pages/EventsPage.jsx";
import EventDetailsPage from "../pages/EventDetailsPage.jsx";
import LoginPage from "../pages/LoginPage.jsx";
import RegisterPage from "../pages/RegisterPage.jsx";
import GalleryPage from "../pages/GalleryPage.jsx";
import AdminDashboardPage from "../pages/AdminDashboardPage.jsx";
import AdminCheckInPage from "../pages/AdminCheckInPage.jsx";
import PhotographerUploadPage from "../pages/PhotographerUploadPage.jsx";
import ProtectedRoute from "../components/ProtectedRoute.jsx";
import RegistrationStatusPage from "../pages/RegistrationStatusPage.jsx";
import DashboardOverviewPage from "../pages/DashboardOverviewPage.jsx";
import DashboardEventsPage from "../pages/DashboardEventsPage.jsx";
import DashboardProfilePage from "../pages/DashboardProfilePage.jsx";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<PublicEventsPage />} />
      <Route path="/home" element={<PublicEventsPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/events/:eventId" element={<EventDetailsPage />} />
      <Route
        path="/events/:eventId/registration"
        element={
          <ProtectedRoute>
            <RegistrationStatusPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:eventId/gallery"
        element={
          <ProtectedRoute>
            <GalleryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:eventId/media/manage"
        element={
          <ProtectedRoute roles={["admin", "photographer"]}>
            <PhotographerUploadPage />
          </ProtectedRoute>
        }
      />
      {/* Attendee dashboard — any signed-in user, no role restriction */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardOverviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/events"
        element={
          <ProtectedRoute>
            <DashboardEventsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/profile"
        element={
          <ProtectedRoute>
            <DashboardProfilePage />
          </ProtectedRoute>
        }
      />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/checkin"
        element={
          <ProtectedRoute roles={["admin", "photographer"]}>
            <AdminCheckInPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
