import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import FormField from '../components/FormField.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // same pattern as the server (authValidator.js)

// Mirrors authValidator.validateRegister. The server stays the authority; this only saves a round trip.
function validate({ name, email, password }) {
  const fields = {};
  const n = name.trim();
  if (!n) fields.name = 'Name is required.';
  else if (n.length > 100) fields.name = 'Name must be at most 100 characters.';

  const e = email.trim();
  if (!e) fields.email = 'Email is required.';
  else if (e.length > 255) fields.email = 'Email must be at most 255 characters.';
  else if (!EMAIL_RE.test(e)) fields.email = 'Enter a valid email address.';

  // Password is not trimmed. Characters (code points) 8 to 72, and at most 72 UTF-8 bytes (bcrypt limit).
  if (!password) fields.password = 'Password is required.';
  else {
    const characters = Array.from(password).length;
    const bytes = new TextEncoder().encode(password).length;
    if (characters < 8 || characters > 72 || bytes > 72) fields.password = 'Password must be 8 to 72 characters.';
  }
  return fields;
}

export default function RegisterPage() {
  const { status, register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;

  const onChange = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setFormError('');
    const fields = validate(values);
    setFieldErrors(fields);
    if (Object.keys(fields).length > 0) return;

    setSubmitting(true);
    try {
      await register(values.name.trim(), values.email.trim(), values.password);
      // No session exists yet (T-075): the account must be verified first. Only the email is passed on, never the password.
      navigate('/check-email', { replace: true, state: { email: values.email.trim().toLowerCase(), sent: true } });
    } catch (err) {
      if (err && err.fields) setFieldErrors(err.fields);
      else if (err && err.code === 'EMAIL_TAKEN') setFieldErrors({ email: err.message });
      else setFormError(err && err.message ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-card">
      <h1>Register</h1>
      {formError && (
        <p role="alert" className="form-error">
          {formError}
        </p>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <FormField id="name" label="Name" type="text" autoComplete="name" value={values.name} onChange={onChange} error={fieldErrors.name} />
        <FormField id="email" label="Email" type="email" autoComplete="email" value={values.email} onChange={onChange} error={fieldErrors.email} />
        <FormField
          id="password"
          label="Password (8 to 72 characters)"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={onChange}
          error={fieldErrors.password}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Register'}
        </button>
      </form>
      <p>
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </main>
  );
}
