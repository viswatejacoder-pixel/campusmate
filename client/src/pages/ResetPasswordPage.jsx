import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PasswordField from '../components/PasswordField.jsx';
import { resetPasswordRequest } from '../api/auth.js';
import { readResetToken, validateResetForm } from '../utils/passwordReset.js';
import '../styles/passwordReset.css';

// Presentational part (also rendered directly by the automated tests).
// phase: 'form' | 'submitting' | 'success' | 'invalid' (missing, malformed, expired or used link)
export function ResetPasswordView({ phase, password, confirmPassword, onPasswordChange, onConfirmChange, onSubmit, fieldErrors = {}, formError = '' }) {
  if (phase === 'success') {
    return (
      <main className="auth-card">
        <h1>Password updated</h1>
        <p role="status" className="form-success">
          Your password has been changed. For your security you were signed out everywhere; log in with the new password.
        </p>
        <p>
          <Link to="/login" className="button-link">
            Go to log in
          </Link>
        </p>
      </main>
    );
  }

  if (phase === 'invalid') {
    return (
      <main className="auth-card">
        <h1>Reset your password</h1>
        <p role="alert" className="form-error">
          This password reset link is invalid, expired, or already used.
        </p>
        <p>
          <Link to="/forgot-password">Request a new reset link</Link>
        </p>
        <p>
          <Link to="/login">Back to log in</Link>
        </p>
      </main>
    );
  }

  const submitting = phase === 'submitting';
  return (
    <main className="auth-card">
      <h1>Choose a new password</h1>
      <p className="auth-help">Use 8 to 72 characters. You will be asked to log in again afterwards.</p>
      {formError && (
        <p role="alert" className="form-error">
          {formError}
        </p>
      )}
      <form onSubmit={onSubmit} noValidate>
        <PasswordField
          id="password"
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={onPasswordChange}
          error={fieldErrors.password}
        />
        <PasswordField
          id="confirmPassword"
          label="Confirm new password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={onConfirmChange}
          error={fieldErrors.confirmPassword}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Reset password'}
        </button>
      </form>
      <p>
        <Link to="/login">Back to log in</Link>
      </p>
    </main>
  );
}

// The emailed link opens this page. The token is read once, removed from the address bar (history, bookmarks, screenshots) and kept
// only in memory. Nothing is sent until the person submits the form, so link previews and mail scanners cannot use the token up.
export default function ResetPasswordPage() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const tokenRef = useRef(null);
  if (tokenRef.current === null) tokenRef.current = readResetToken(search);

  const [phase, setPhase] = useState(tokenRef.current ? 'form' : 'invalid');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (search) navigate('/reset-password', { replace: true });
  }, [search, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (phase === 'submitting' || !tokenRef.current) return;
    setFormError('');
    const { fields } = validateResetForm({ password, confirmPassword });
    setFieldErrors(fields);
    if (Object.keys(fields).length > 0) return;

    setPhase('submitting');
    try {
      await resetPasswordRequest(tokenRef.current, password, confirmPassword);
      tokenRef.current = ''; // single use: nothing left to resend
      setPassword('');
      setConfirmPassword('');
      setPhase('success');
    } catch (err) {
      if (err && err.code === 'TOKEN_INVALID_OR_EXPIRED') {
        tokenRef.current = '';
        setPhase('invalid');
        return;
      }
      if (err && err.fields) setFieldErrors(err.fields);
      else if (err && err.code === 'RATE_LIMITED') setFormError('Too many attempts. Please wait a few minutes and try again.');
      else setFormError(err && err.message ? err.message : 'Something went wrong. Please try again.');
      setPhase('form');
    }
  }

  return (
    <ResetPasswordView
      phase={phase}
      password={password}
      confirmPassword={confirmPassword}
      onPasswordChange={(e) => setPassword(e.target.value)}
      onConfirmChange={(e) => setConfirmPassword(e.target.value)}
      onSubmit={handleSubmit}
      fieldErrors={fieldErrors}
      formError={formError}
    />
  );
}
