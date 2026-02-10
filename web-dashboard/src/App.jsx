import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import useAuthStore from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import CheckInLogin from './pages/CheckInLogin';
import CheckIn from './pages/CheckIn';
import MissingProfile from './pages/MissingProfile';
import NoActiveEvents from './pages/NoActiveEvents';
import AdminFacialManager from './pages/AdminFacialManager';
import AdminNotifications from './pages/AdminNotifications';
import AdminLogs from './pages/AdminLogs';
import AdminDatabaseBackup from './pages/AdminDatabaseBackup';
import Dashboard from './pages/Dashboard';
import DashboardEnhanced from './pages/DashboardEnhanced';
import Users from './pages/Users';
import UsersEnhanced from './pages/UsersEnhanced';
import UsersResponsive from './pages/UsersResponsive';
import Events from './pages/Events';
import EventDetails from './pages/EventDetails';
import Attendance from './pages/Attendance';
import AttendanceVerification from './pages/AttendanceVerification';
import Assignments from './pages/Assignments';
import Rankings from './pages/Rankings';
import CheckInOut from './pages/CheckInOut';
import Planning from './pages/Planning';
import Incidents from './pages/Incidents';
import Badges from './pages/Badges';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import Permissions from './pages/Permissions';
import Zones from './pages/Zones';
import SupervisorAgents from './pages/SupervisorAgents';
import CreationHistory from './pages/CreationHistory';
import AgentTrackingMap from './pages/AgentTrackingMap';
import RealTimeTracking from './pages/RealTimeTracking';
import PrivacyPolicy from './pages/PrivacyPolicy';
import About from './pages/About';

// Smart redirect component based on user role
const SmartRedirect = () => {
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Redirect agents/supervisors to check-in page
  if (user?.role === 'agent' || user?.role === 'supervisor' || user?.role === 'responsable') {
    return <Navigate to="/checkin" replace />;
  }
  
  // Redirect admins and others to dashboard
  return <Navigate to="/dashboard" replace />;
};

// Protected Route Component
const ProtectedRoute = ({ children, roles, noLayout = false }) => {
  const { isAuthenticated, user, hasRole } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !hasRole(roles)) {
    // Rediriger les agents/responsables vers leur page de pointage
    if (user?.role === 'agent' || user?.role === 'supervisor' || user?.role === 'responsable') {
      return <Navigate to="/checkin" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  // Si noLayout=true, ne pas utiliser le Layout (pour agents/responsables)
  if (noLayout) {
    return children;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  const { isAuthenticated, fetchProfile } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated, fetchProfile]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={<CheckInLogin />}
        />

        {/* Page de pointage pour agents/superviseurs */}
        <Route
          path="/checkin"
          element={
            <ProtectedRoute noLayout={true}>
              <CheckIn />
            </ProtectedRoute>
          }
        />
        <Route path="/missing-profile" element={<MissingProfile />} />

        {/* 🔥 Page pour utilisateurs sans événements actifs */}
        <Route path="/no-active-events" element={<NoActiveEvents />} />

        <Route path="/admin/facial/:userId" element={<AdminFacialManager />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardEnhanced />
            </ProtectedRoute>
          }
        />
        <Route
          path="/planning"
          element={
            <ProtectedRoute>
              <Planning />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute roles={['admin', 'supervisor']}>
              <UsersResponsive />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events"
          element={
            <ProtectedRoute>
              <Events />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:id"
          element={
            <ProtectedRoute>
              <EventDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assignments"
          element={
            <ProtectedRoute>
              <Assignments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance"
          element={
            <ProtectedRoute roles={['admin', 'supervisor']}>
              <Attendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance-verification"
          element={
            <ProtectedRoute roles={['admin', 'supervisor']}>
              <AttendanceVerification />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkinout"
          element={
            <ProtectedRoute>
              <CheckInOut />
            </ProtectedRoute>
          }
        />
        <Route
          path="/incidents"
          element={
            <ProtectedRoute>
              <Incidents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tracking"
          element={
            <ProtectedRoute roles={['admin', 'supervisor', 'responsable']}>
              <RealTimeTracking />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tracking/map"
          element={
            <ProtectedRoute roles={['admin', 'supervisor', 'responsable']}>
              <AgentTrackingMap />
            </ProtectedRoute>
          }
        />
        <Route
          path="/badges"
          element={
            <ProtectedRoute>
              <Badges />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rankings"
          element={
            <ProtectedRoute>
              <Rankings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute roles={['admin', 'supervisor']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/permissions"
          element={
            <ProtectedRoute roles={['admin']}>
              <Permissions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/notifications"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminNotifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/database"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminDatabaseBackup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/zones"
          element={
            <ProtectedRoute roles={['admin', 'supervisor']}>
              <Zones />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor/agents"
          element={
            <ProtectedRoute roles={['responsable']}>
              <SupervisorAgents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/creation-history"
          element={
            <ProtectedRoute roles={['admin', 'responsable', 'supervisor']}>
              <CreationHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Smart redirect based on user role */}
        <Route 
          path="/" 
          element={
            <SmartRedirect />
          } 
        />

        {/* Public pages - Politique de confidentialité et À propos */}
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/about" element={<About />} />

        {/* 404 */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                <p className="text-gray-500 mb-4">Page non trouvée</p>
                <a href="/dashboard" className="btn-primary">
                  Retour au tableau de bord
                </a>
              </div>
            </div>
          }
        />
      </Routes>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </BrowserRouter>
  );
}

export default App;
