import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { verifyEmailRequest } from '../api/auth.js';

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes as base64url, same as the server (utils/tokens.js)

// The emailed link opens this page, but nothing is sent until the person clicks Confirm (mail scanners and previews that
// open links must not use the token up). The token is read once, removed from the address bar, and kept only in memory.
export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const tokenRef = useRef(null);
  if (tokenRef.current === null) {
    const raw = new URLSearchParams(window.location.search).get('token') || '';
    tokenRef.current = TOKEN_RE.test(raw) ? raw : '';
  }
  // 'ready' | 'verifying' | 'success' | 'invalid' (missing, malformed, expired, used) | 'error' (try again)
  const [phase, setPhase] = useState(tokenRef.current ? 'ready' : 'invalid');
  const [message, setMessage] = useState('');

  // Drop the token from the URL (history, bookmarks, screenshots) as soon as it has been read.
  useEffect(() => {
    if (window.location.search) navigate('/verify-email', { replace: true });
  }, [navigate]);

  async function handleConfirm() {
    if (phase === 'verifying' || !tokenRef.current) return;
    setPhase('verifying');
    setMessage('');
    try {
      await verifyEmailRequest(tokenRef.current);
      tokenRef.current = ''; // single use: nothing left to resend
      setPhase('success');
    } catch (err) {
      if (err && err.code === 'TOKEN_INVALID_OR_EXPIRED') {
        tokenRef.current = '';
        setPhase('invalid');
      } else if (err && err.code === 'RATE_LIMITED') {
        setMessage('Too many attempts. Please wait a few minutes and try again.');
        setPhase('error');
      } else {
        setMessage(err && err.message ? err.message : 'Something went wrong. Please try again.');
        setPhase('error');
      }
    }
  }

  return (
    <main className="auth-card">
      <h1>Verify your email</h1>

      {(phase === 'ready' || phase === 'verifying' || phase === 'error') && (
        <>
          {phase === 'error' && (
            <p role="alert" className="form-error">
              {message}
            </p>
          )}
          <p>Confirm that you want to verify your email address for CampusMate.</p>
          <button type="button" onClick={handleConfirm} disabled={phase === 'verifying'}>
            {phase === 'verifying' ? 'Verifying...' : phase === 'error' ? 'Try again' : 'Confirm email address'}
          </button>
        </>
      )}

      {phase === 'success' && (
        <>
          <p role="status" className="form-success">
            Your email address is verified. You can now log in.
          </p>
          <p>
            <Link to="/login" className="button-link">
              Go to log in
            </Link>
          </p>
        </>
      )}

      {phase === 'invalid' && (
        <>
          <p role="alert" className="form-error">
            This verification link is invalid, expired, or already used.
          </p>
          <p>
            If you already verified, <Link to="/login">log in</Link>. Otherwise <Link to="/check-email">request a new verification link</Link>.
          </p>
        </>
      )}
    </main>
  );
}
