import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AuthShell from './pages/AuthShell.jsx';
import LoginPreviewPage from './pages/LoginPreviewPage.jsx';
import RegisterPreviewPage from './pages/RegisterPreviewPage.jsx';
import CheckEmailPage from './pages/CheckEmailPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import DashboardPreviewPage from './pages/DashboardPreviewPage.jsx';
import DashboardRichPreviewPage from './pages/DashboardRichPreviewPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

// "/" goes to the dashboard when a session exists, otherwise to the login page. Convenience only: the server enforces access.
function RootRedirect() {
  const { status } = useAuth();
  if (status === 'loading') return <p>Loading...</p>;
  return <Navigate to={status === 'authenticated' ? '/dashboard' : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login-preview" element={<LoginPreviewPage />} />
      <Route element={<AuthShell />}>
        <Route path="/login" element={null} />
        <Route path="/register" element={null} />
      </Route>
      <Route path="/register-preview" element={<RegisterPreviewPage />} />
      <Route path="/dashboard-preview" element={<DashboardPreviewPage />} />
      <Route path="/dashboard-rich-preview" element={<DashboardRichPreviewPage />} />
      <Route path="/check-email" element={<CheckEmailPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}