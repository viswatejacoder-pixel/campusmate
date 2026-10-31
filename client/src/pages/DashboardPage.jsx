import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

// Minimal for T-070: greeting and logout. T-080 replaces the body. After logout the state becomes anonymous and ProtectedRoute redirects to /login.
export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>Dashboard</h1>
        <div className="page-header-user">
          <span>Hello, {user.name}</span>
          <button type="button" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Logging out...' : 'Log out'}
          </button>
        </div>
      </header>
    </main>
  );
}
