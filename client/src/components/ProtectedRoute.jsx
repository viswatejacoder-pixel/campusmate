import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Redirects to /login when there is no session. UX only: the server checks the session on every API call.
export default function ProtectedRoute() {
  const { status } = useAuth();
  if (status === 'loading') return <p>Loading...</p>;
  if (status !== 'authenticated') return <Navigate to="/login" replace />;
  return <Outlet />;
}