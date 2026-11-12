import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/minimalLogin.css';

// Design experiment (isolated, preview only): a refined split-screen login. Same rules and auth calls as the existing login page.
// Mirrors the server: login only needs both values present (authValidator.validateLogin).
export function validateLogin(email, password) {
  const fields = {};
  if (!email.trim()) fields.email = 'Email is required.';
  if (!password) fields.password = 'Password is required.';
  return fields;
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="ml-field-error">
      <span className="ml-sr">Error: </span>
      {message}
    </p>
  );
}

// Arch silhouette: rounded top, running off the bottom edge. `close` false gives an open path for outlines.
const archPath = (x, w, top, close = true) => `M${x} 940V${top + w / 2}A${w / 2} ${w / 2} 0 0 1 ${x + w} ${top + w / 2}V940${close ? 'Z' : ''}`;
const ARCHES = [
  { x: 30, w: 180, top: 650, fill: 'url(#mlg-sand)', line: 'rgba(20,22,60,0.2)' },
  { x: 150, w: 210, top: 560, fill: 'url(#mlg-indigo)', line: 'rgba(255,255,255,0.3)' },
  { x: 330, w: 170, top: 620, fill: 'url(#mlg-navy)', line: 'rgba(255,255,255,0.22)' },
  { x: 450, w: 220, top: 510, fill: 'url(#mlg-coral)', line: 'rgba(255,255,255,0.34)' },
  { x: 630, w: 150, top: 660, fill: 'url(#mlg-sand)', line: 'rgba(20,22,60,0.2)' },
];

// Campus arches in front of a low sun, with orbit lines for deadlines. Decorative only.
function Artwork() {
  return (
    <svg className="ml-art-svg" width="720" height="900" viewBox="0 0 720 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="mlg-bg" x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#0d1030" />
          <stop offset="1" stopColor="#1b1d52" />
        </linearGradient>
        <radialGradient id="mlg-glow-a" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f2a66b" stopOpacity="0.38" />
          <stop offset="1" stopColor="#f2a66b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mlg-glow-b" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#7a6bff" stopOpacity="0.42" />
          <stop offset="1" stopColor="#7a6bff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mlg-sun" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#ffe0a8" />
          <stop offset="0.55" stopColor="#f4a96e" />
          <stop offset="1" stopColor="#e8745a" />
        </linearGradient>
        <linearGradient id="mlg-sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3ece0" />
          <stop offset="1" stopColor="#d6cab5" />
        </linearGradient>
        <linearGradient id="mlg-indigo" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#6672ff" />
          <stop offset="1" stopColor="#2b31a0" />
        </linearGradient>
        <linearGradient id="mlg-navy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#232866" />
          <stop offset="1" stopColor="#121538" />
        </linearGradient>
        <linearGradient id="mlg-coral" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#f69a7c" />
          <stop offset="1" stopColor="#d9553f" />
        </linearGradient>
        <linearGradient id="mlg-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.75" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="mlg-dot-mask">
          <rect width="720" height="640" fill="url(#mlg-fade)" />
        </mask>
        <pattern id="mlg-dots" width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.1" fill="#fff" fillOpacity="0.26" />
        </pattern>
        <filter id="mlg-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="-6" dy="-8" stdDeviation="14" floodColor="#04051a" floodOpacity="0.5" />
        </filter>
        <filter id="mlg-noise" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>

      <rect width="720" height="900" fill="url(#mlg-bg)" />
      <circle cx="90" cy="60" r="430" fill="url(#mlg-glow-b)" />
      <rect width="720" height="640" fill="url(#mlg-dots)" mask="url(#mlg-dot-mask)" />
      <circle cx="490" cy="360" r="360" fill="url(#mlg-glow-a)" />

      <g fill="none" stroke="#fff">
        <circle cx="490" cy="360" r="200" strokeOpacity="0.16" />
        <circle cx="490" cy="360" r="270" strokeOpacity="0.14" strokeDasharray="2 7" />
        <circle cx="490" cy="360" r="340" strokeOpacity="0.08" />
      </g>
      <circle cx="490" cy="360" r="135" fill="url(#mlg-sun)" />
      <circle cx="619" cy="207" r="5" fill="#f3ece0" />
      <circle cx="256" cy="495" r="4" fill="#f4a96e" />
      <circle cx="696" cy="405" r="3" fill="#fff" fillOpacity="0.7" />

      {ARCHES.map((a) => (
        <g key={a.x}>
          <path d={archPath(a.x, a.w, a.top)} fill={a.fill} filter="url(#mlg-shadow)" />
          <path d={archPath(a.x, a.w, a.top, false)} fill="none" stroke="#fff" strokeOpacity="0.28" />
          {[14, 28].map((i) => (
            <path key={i} d={archPath(a.x + i, a.w - 2 * i, a.top + i, false)} fill="none" stroke={a.line} />
          ))}
        </g>
      ))}

      <rect width="720" height="900" filter="url(#mlg-noise)" opacity="0.13" style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

export default function MinimalLoginPage() {
  const { status, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [unverified, setUnverified] = useState(false); // correct password but email not verified yet
  const [submitting, setSubmitting] = useState(false);
  const [providerNote, setProviderNote] = useState('');

  // Already logged in (or just logged in): the redirect is the success behaviour.
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;

  const clearFieldError = (name) => setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  // Google/Apple sign-in has no backend yet (no OAuth routes or credentials), so these never sign anyone in.
  const providerUnavailable = (name) => setProviderNote(`${name} sign-in isn't available yet. Please use your email and password.`);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setFormError('');
    setUnverified(false);
    setProviderNote('');
    const fields = validateLogin(email, password);
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
    <div className="ml-root">
      <div className="ml-shell">
        <aside className="ml-aside">
          <Artwork />
          <div className="ml-brand">
            <span className="ml-mark" aria-hidden="true" />
            <span>CampusMate</span>
          </div>
          <div className="ml-copy">
            <p className="ml-statement">Your semester, beautifully in order.</p>
            <p className="ml-caption">Subjects · Tasks · Deadlines</p>
          </div>
        </aside>

        <main className="ml-main">
          <div className="ml-panel">
            <h1 className="ml-title">Welcome back</h1>
            <p className="ml-lede">Log in to your CampusMate workspace.</p>

            {formError && (
              <p role="alert" className="ml-alert">
                {formError}
                {unverified && (
                  <>
                    {' '}
                    <Link className="ml-link ml-link-strong" to="/check-email" state={{ email: email.trim().toLowerCase() }}>
                      Resend the verification email
                    </Link>
                  </>
                )}
              </p>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="ml-field">
                <label htmlFor="ml-email">Email</label>
                <input
                  id="ml-email"
                  name="email"
                  type="email"
                  className="ml-input"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@university.edu"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) clearFieldError('email');
                  }}
                  aria-invalid={fieldErrors.email ? 'true' : undefined}
                  aria-describedby={fieldErrors.email ? 'ml-email-error' : undefined}
                />
                <FieldError id="ml-email-error" message={fieldErrors.email} />
              </div>

              <div className="ml-field">
                <div className="ml-label-row">
                  <label htmlFor="ml-password">Password</label>
                  <Link className="ml-link" to="/forgot-password">
                    Forgot password?
                  </Link>
                </div>
                <div className="ml-password">
                  <input
                    id="ml-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="ml-input"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) clearFieldError('password');
                    }}
                    aria-invalid={fieldErrors.password ? 'true' : undefined}
                    aria-describedby={fieldErrors.password ? 'ml-password-error' : undefined}
                  />
                  <button
                    type="button"
                    className="ml-toggle"
                    aria-pressed={showPassword}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <FieldError id="ml-password-error" message={fieldErrors.password} />
              </div>

              <button type="submit" className="ml-btn" disabled={submitting} aria-busy={submitting}>
                {submitting ? 'Logging in...' : 'Log in'}
              </button>
            </form>

            <div className="ml-or" role="separator" aria-label="or">
              <span>or</span>
            </div>

            <div className="ml-social">
              <button type="button" className="ml-provider" onClick={() => providerUnavailable('Google')}>
                <GoogleIcon />
                <span>Continue with Google</span>
                <span className="ml-soon">Soon</span>
              </button>
              <button type="button" className="ml-provider" onClick={() => providerUnavailable('Apple')}>
                <AppleIcon />
                <span>Continue with Apple</span>
                <span className="ml-soon">Soon</span>
              </button>
            </div>
            <div role="status" className="ml-notice-wrap">
              {providerNote && <p className="ml-notice">{providerNote}</p>}
            </div>

            <p className="ml-foot">
              No account?{' '}
              <Link className="ml-link ml-link-strong" to="/register">
                Register
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
