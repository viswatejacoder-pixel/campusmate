import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/registerPreview.css';

// Design experiment (isolated, preview only) at /register-preview. Same fields, labels, rules and auth call as RegisterPage.
// RegisterPage does not export its validator, so this mirrors it (and authValidator.validateRegister). The server stays the authority.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegister({ name, email, password }) {
  const fields = {};
  const n = name.trim();
  if (!n) fields.name = 'Name is required.';
  else if (n.length > 100) fields.name = 'Name must be at most 100 characters.';

  const e = email.trim();
  if (!e) fields.email = 'Email is required.';
  else if (e.length > 255) fields.email = 'Email must be at most 255 characters.';
  else if (!EMAIL_RE.test(e)) fields.email = 'Enter a valid email address.';

  // Password is not trimmed. 8 to 72 characters (code points) and at most 72 UTF-8 bytes (bcrypt limit).
  if (!password) fields.password = 'Password is required.';
  else {
    const characters = Array.from(password).length;
    const bytes = new TextEncoder().encode(password).length;
    if (characters < 8 || characters > 72 || bytes > 72) fields.password = 'Password must be 8 to 72 characters.';
  }
  return fields;
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="rg-field-error">
      <span className="rg-sr">Error: </span>
      {message}
    </p>
  );
}

const INK = '#0b0b0b';
const LIGHT = '#ececec';
const DIAMONDS = [
  [45, 45, INK],
  [135, 45, '#6a6a6a'],
  [45, 135, '#6a6a6a'],
  [135, 135, INK],
];
const diamond = (x, y, r) => `M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`;

// 4 x 5 grid of 180px tiles: [column, row, background, shapes]. Shapes are drawn in tile-local 0..180 coordinates.
const TILES = [
  [0, 0, '#151515', <><circle cx="90" cy="90" r="70" fill={LIGHT} /><circle cx="90" cy="90" r="34" fill="#151515" /><circle cx="90" cy="90" r="10" fill="#8a8a8a" /></>],
  [1, 0, '#e4e4e4', <><path d="M0 180A90 90 0 0 1 180 180Z" fill={INK} /><path d="M45 180A45 45 0 0 1 135 180Z" fill="#e4e4e4" /></>],
  [2, 0, INK, <><path d={diamond(90, 90, 76)} fill="#303030" /><path d={diamond(90, 90, 44)} fill="none" stroke="#c4c4c4" strokeWidth="2" /><path d={diamond(90, 90, 16)} fill="#f2f2f2" /></>],
  [3, 0, '#2a2a2a', <><path d="M0 180L180 0V180Z" fill="#9b9b9b" /><path d="M0 180L90 90V180Z" fill={INK} /></>],
  [0, 1, '#b9b9b9', <><circle cx="0" cy="180" r="150" fill={INK} /><circle cx="0" cy="180" r="100" fill="none" stroke="#b9b9b9" strokeWidth="2" /><circle cx="0" cy="180" r="50" fill="#b9b9b9" /></>],
  [1, 1, INK, <><circle cx="90" cy="90" r="24" fill={LIGHT} /><circle cx="90" cy="90" r="46" fill="none" stroke={LIGHT} strokeWidth="2" /><circle cx="90" cy="90" r="68" fill="none" stroke="#7a7a7a" strokeWidth="2" /><circle cx="90" cy="90" r="90" fill="none" stroke="#7a7a7a" strokeWidth="2" /></>],
  [2, 1, '#efefef', <g transform="rotate(-45 90 90)"><rect x="-40" y="30" width="260" height="30" fill={INK} /><rect x="-40" y="75" width="260" height="30" fill="#8a8a8a" /><rect x="-40" y="120" width="260" height="30" fill={INK} /></g>],
  [3, 1, '#444444', <><circle cx="65" cy="90" r="52" fill={INK} /><circle cx="115" cy="90" r="52" fill="#dcdcdc" fillOpacity="0.92" /><circle cx="115" cy="90" r="30" fill="none" stroke={INK} strokeWidth="2" /></>],
  [0, 2, INK, <><path d="M0 0H180L0 180Z" fill="#e3e3e3" /><circle cx="60" cy="60" r="22" fill={INK} /></>],
  [1, 2, '#8c8c8c', <><circle cx="90" cy="90" r="70" fill="#161616" /><circle cx="128" cy="52" r="26" fill={LIGHT} /></>],
  [2, 2, '#1c1c1c', <><path d="M30 90A60 60 0 0 1 150 90Z" fill="#f0f0f0" /><path d="M30 90A60 60 0 0 0 150 90Z" fill="#7d7d7d" /></>],
  [3, 2, '#d8d8d8', <>{DIAMONDS.map(([x, y, fill]) => <path key={`${x}-${y}`} d={diamond(x, y, 38)} fill={fill} />)}</>],
  [0, 3, '#333333', <><circle cx="90" cy="90" r="62" fill="none" stroke="#f0f0f0" strokeWidth="16" /><circle cx="90" cy="90" r="14" fill="#f0f0f0" /></>],
  [1, 3, INK, <g stroke="#bdbdbd" strokeWidth="5" strokeOpacity="0.8">{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <path key={i} d={`M${i * 30 - 60} 180L${i * 30 + 120} 0`} />)}</g>],
  [2, 3, '#f1f1f1', <><circle cx="90" cy="90" r="78" fill={INK} /><path d="M90 30L150 130H30Z" fill="#f1f1f1" /></>],
  [3, 3, '#5a5a5a', <><path d="M0 0H100A100 100 0 0 1 0 100Z" fill={INK} /><path d="M180 180H80A100 100 0 0 1 180 80Z" fill="#e6e6e6" /></>],
  [0, 4, '#cdcdcd', <><path d="M90 0A90 90 0 0 0 90 180Z" fill={INK} /><circle cx="134" cy="90" r="22" fill={INK} /></>],
  [1, 4, '#151515', <><path d="M30 20H150L30 160H150Z" fill={LIGHT} /><path d="M90 90L150 160H30Z" fill="#7a7a7a" /></>],
  [2, 4, INK, <><circle cx="90" cy="90" r="64" fill="none" stroke="#8a8a8a" strokeWidth="2" /><circle cx="90" cy="90" r="40" fill={LIGHT} /><path d="M50 90A40 40 0 0 1 130 90Z" fill={INK} /></>],
  [3, 4, '#e8e8e8', <><path d="M0 180L90 20L180 180Z" fill={INK} /><circle cx="90" cy="130" r="26" fill="none" stroke="#e8e8e8" strokeWidth="3" /></>],
];

// Structured monochrome tile grid with a few shapes that overlap the seams. Decorative only.
function Artwork() {
  return (
    <svg className="rg-art-svg" viewBox="0 0 720 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="rg-tile">
          <rect width="180" height="180" />
        </clipPath>
      </defs>
      <rect width="720" height="900" fill={INK} />
      {TILES.map(([c, r, bg, shapes]) => (
        <g key={`${c}-${r}`} transform={`translate(${c * 180} ${r * 180})`} clipPath="url(#rg-tile)">
          <rect width="180" height="180" fill={bg} />
          {shapes}
        </g>
      ))}
      <path d="M0 900H720M0 720H720M0 540H720M0 360H720M0 180H720M180 0V900M360 0V900M540 0V900" stroke={INK} strokeWidth="2" />
      <g style={{ mixBlendMode: 'difference' }} fill="none" stroke="#fff">
        <circle cx="360" cy="450" r="130" strokeWidth="2" />
        <circle cx="360" cy="450" r="190" strokeWidth="1" strokeDasharray="3 8" />
        <path d="M0 640L720 330V420L0 730Z" fill="#fff" fillOpacity="0.16" stroke="none" />
      </g>
      <circle cx="360" cy="360" r="44" fill="#f2f2f2" stroke={INK} strokeWidth="4" />
      <path d="M520 540A40 40 0 0 1 600 540Z" fill={INK} stroke="#f2f2f2" strokeWidth="3" />
      <circle cx="180" cy="720" r="16" fill="#f2f2f2" stroke={INK} strokeWidth="4" />
    </svg>
  );
}

export default function RegisterPreviewPage() {
  const { status, register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;

  const onChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setFormError('');
    const fields = validateRegister(values);
    setFieldErrors(fields);
    if (Object.keys(fields).length > 0) return;

    setSubmitting(true);
    try {
      await register(values.name.trim(), values.email.trim(), values.password);
      // No session exists yet: the account must be verified first. Only the email is passed on, never the password.
      navigate('/check-email', { replace: true, state: { email: values.email.trim().toLowerCase(), sent: true } });
    } catch (err) {
      if (err && err.fields) setFieldErrors(err.fields);
      else if (err && err.code === 'EMAIL_TAKEN') setFieldErrors({ email: err.message });
      else setFormError(err && err.message ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="rg-root">
      <div className="rg-shell">
        <main className="rg-main">
          <div className="rg-brand">
            <span className="rg-mark" aria-hidden="true" />
            <span>CampusMate</span>
          </div>
          <div className="rg-panel">
            <h1 className="rg-title">Register</h1>
            <p className="rg-lede">Create your CampusMate account.</p>

            {formError && (
              <p role="alert" className="rg-alert">
                {formError}
              </p>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="rg-field">
                <label htmlFor="rg-name">Name</label>
                <input id="rg-name" name="name" type="text" className="rg-input" autoComplete="name" value={values.name} onChange={onChange} aria-invalid={fieldErrors.name ? 'true' : undefined} aria-describedby={fieldErrors.name ? 'rg-name-error' : undefined} />
                <FieldError id="rg-name-error" message={fieldErrors.name} />
              </div>
              <div className="rg-field">
                <label htmlFor="rg-email">Email</label>
                <input id="rg-email" name="email" type="email" className="rg-input" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@university.edu" value={values.email} onChange={onChange} aria-invalid={fieldErrors.email ? 'true' : undefined} aria-describedby={fieldErrors.email ? 'rg-email-error' : undefined} />
                <FieldError id="rg-email-error" message={fieldErrors.email} />
              </div>
              <div className="rg-field">
                <label htmlFor="rg-password">Password (8 to 72 characters)</label>
                <div className="rg-password">
                  <input id="rg-password" name="password" type={showPassword ? 'text' : 'password'} className="rg-input" autoComplete="new-password" value={values.password} onChange={onChange} aria-invalid={fieldErrors.password ? 'true' : undefined} aria-describedby={fieldErrors.password ? 'rg-password-error' : undefined} />
                  <button type="button" className="rg-toggle" aria-pressed={showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <FieldError id="rg-password-error" message={fieldErrors.password} />
              </div>

              <button type="submit" className="rg-btn" disabled={submitting} aria-busy={submitting}>
                {submitting ? 'Creating account...' : 'Register'}
              </button>
            </form>

            <p className="rg-foot">
              Already registered?{' '}
              <Link className="rg-link" to="/login">
                Log in
              </Link>
            </p>
          </div>
        </main>

        <aside className="rg-aside" aria-hidden="true">
          <Artwork />
          <p className="rg-caption">Subjects {'\u00b7'} Tasks {'\u00b7'} Deadlines</p>
        </aside>
      </div>
    </div>
  );
}
