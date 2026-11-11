import { useState } from 'react';
import { Link } from 'react-router-dom';
import FormField from '../components/FormField.jsx';
import { forgotPasswordRequest } from '../api/auth.js';
import { validateForgotForm } from '../utils/passwordReset.js';
import '../styles/passwordReset.css';

// Presentational part (also rendered directly by the automated tests).
// phase: 'idle' | 'submitting' | 'sent' | 'error'. The 'sent' text is the same whether or not an account exists.
export function ForgotPasswordView({ phase, email, onEmailChange, onSubmit, fieldErrors = {}, message = '' }) {
  if (phase === 'sent') {
    return (
      <main className="auth-card">
        <h1>Check your email</h1>
        <p role="status" className="form-success">
          If a verified account exists for {email}, we have sent a link to reset the password. It expires in 30 minutes and works once.
        </p>
        <p className="muted">Nothing arrived? Check your spam folder, or wait a minute and request a new link.</p>
        <p>
          <Link to="/login">Back to log in</Link>
        </p>
      </main>
    );
  }

  const submitting = phase === 'submitting';
  return (
    <main className="auth-card">
      <h1>Forgot your password?</h1>
      <p className="auth-help">Enter the email address you registered with and we will send you a link to choose a new password.</p>
      {phase === 'error' && message && (
        <p role="alert" className="form-error">
          {message}
        </p>
      )}
      <form onSubmit={onSubmit} noValidate>
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={onEmailChange}
          error={fieldErrors.email}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
      <p>
        <Link to="/login">Back to log in</Link>
      </p>
    </main>
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState('idle');
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (phase === 'submitting') return;
    setMessage('');
    const { fields, value } = validateForgotForm({ email });
    setFieldErrors(fields);
    if (Object.keys(fields).length > 0) return;

    setPhase('submitting');
    try {
      await forgotPasswordRequest(value.email);
      setPhase('sent');
    } catch (err) {
      if (err && err.fields) {
        setFieldErrors(err.fields);
        setPhase('idle');
        return;
      }
      setMessage(
        err && err.code === 'RATE_LIMITED'
          ? 'Too many requests. Please wait a few minutes and try again.'
          : err && err.message
            ? err.message
            : 'Something went wrong. Please try again.',
      );
      setPhase('error');
    }
  }

  return (
    <ForgotPasswordView
      phase={phase}
      email={email}
      onEmailChange={(e) => setEmail(e.target.value)}
      onSubmit={handleSubmit}
      fieldErrors={fieldErrors}
      message={message}
    />
  );
}
