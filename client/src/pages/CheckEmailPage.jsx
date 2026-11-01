import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { resendVerificationRequest } from '../api/auth.js';
import FormField from '../components/FormField.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // same pattern as the server (authValidator.js)
const COOLDOWN_SECONDS = 60; // matches the server's resend cooldown; the server stays the authority
// Identical wording for every account state: the server answers 202 whether or not the account exists or is verified.
const GENERIC_SENT = 'If an unverified account exists for this email, a new verification link has been sent. Check your inbox and spam folder.';

// Counts down from `start()`; `left` is whole seconds remaining (0 = ready). Based on a deadline, so tab throttling does not drift it.
function useCountdown() {
  const [until, setUntil] = useState(0);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!until) return undefined;
    const tick = () => {
      const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) setUntil(0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);
  const start = useCallback(() => setUntil(Date.now() + COOLDOWN_SECONDS * 1000), []);
  return [left, start];
}

export default function CheckEmailPage() {
  const { state } = useLocation();
  // Router state can be missing (page opened directly, or reloaded in a new tab): then the person types the address.
  const knownEmail = state && typeof state.email === 'string' && EMAIL_RE.test(state.email) ? state.email : '';
  const justRegistered = Boolean(state && state.sent === true && knownEmail);

  const [typedEmail, setTypedEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [left, startCooldown] = useCountdown();

  // The email was sent a moment ago by registration, so the server would refuse another one for 60 seconds anyway.
  useEffect(() => {
    if (justRegistered) startCooldown();
  }, [justRegistered, startCooldown]);

  async function handleResend(event) {
    event.preventDefault();
    if (pending || left > 0) return;
    setFormError('');
    setNotice('');
    setFieldError('');

    const target = knownEmail || typedEmail.trim().toLowerCase();
    if (!target) return setFieldError('Email is required.');
    if (target.length > 255 || !EMAIL_RE.test(target)) return setFieldError('Enter a valid email address.');

    setPending(true);
    try {
      await resendVerificationRequest(target);
      setNotice(GENERIC_SENT);
      startCooldown();
    } catch (err) {
      if (err && err.fields && err.fields.email) setFieldError(err.fields.email);
      else if (err && err.code === 'RATE_LIMITED') {
        setFormError('Too many requests. Please wait a few minutes before asking for another email.');
        startCooldown();
      } else setFormError(err && err.message ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-card">
      <h1>Check your email</h1>
      {knownEmail ? (
        <p>
          {justRegistered ? 'We sent a verification link to ' : 'Verification links are sent to '}
          <strong className="break-anywhere">{knownEmail}</strong>. Open the link in that email to confirm your address, then log in. The link expires in 30
          minutes and works once.
        </p>
      ) : (
        <p>Open the verification link we emailed you, then log in. If you need a new link, enter your email address below.</p>
      )}

      {notice && (
        <p role="status" className="form-success">
          {notice}
        </p>
      )}
      {formError && (
        <p role="alert" className="form-error">
          {formError}
        </p>
      )}

      <form onSubmit={handleResend} noValidate>
        {!knownEmail && (
          <FormField
            id="resend-email"
            label="Email"
            type="email"
            autoComplete="email"
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
            error={fieldError}
          />
        )}
        {knownEmail && fieldError && <p className="field-error">Error: {fieldError}</p>}
        <button type="submit" className="button-secondary" disabled={pending || left > 0}>
          {pending ? 'Sending...' : left > 0 ? `Resend email (available in ${left}s)` : 'Resend verification email'}
        </button>
      </form>

      <p className="muted">Nothing arrived? Check your spam folder, wait a minute, then resend.</p>
      <p>
        <Link to="/login">Back to log in</Link>
      </p>
    </main>
  );
}
