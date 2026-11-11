import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import FormField from '../components/FormField.jsx';
import '../styles/passwordReset.css';

// Mirrors the server: login only needs both values present (authValidator.validateLogin).
function validate(email, password) {
  const fields = {};
  if (!email.trim()) fields.email = 'Email is required.';
  if (!password) fields.password = 'Password is required.';
  return fields;
}

export default function LoginPage() {
  const { status, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [unverified, setUnverified] = useState(false); // T-075: correct password but email not verified yet
  const [submitting, setSubmitting] = useState(false);

  // Already logged in (or just logged in): the redirect is the success behaviour.
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setFormError('');
    setUnverified(false);
    const fields = validate(email, password);
    setFieldErrors(fields);
    if (Object.keys(fields).length > 0) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      if (err && err.fields) setFieldErrors(err.fields);
      else if (err && err.code === 'EMAIL_NOT_VERIFIED') {
        setUnverified(true);
        setFormError('Please verify your email address before logging in.');
      } else if (err && err.code === 'RATE_LIMITED') setFormError('Too many login attempts. Please wait a few minutes and try again.');
      else setFormError(err && err.message ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-card">
      <h1>Log in</h1>
      {formError && (
        <p role="alert" className="form-error">
          {formError}
          {unverified && (
            <>
              {' '}
              <Link to="/check-email" state={{ email: email.trim().toLowerCase() }}>
                Resend the verification email
              </Link>
            </>
          )}
        </p>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <p className="auth-forgot">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>
      <p>
        No account? <Link to="/register">Register</Link>
      </p>
    </main>
  );
}
