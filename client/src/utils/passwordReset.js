// Password-reset form helpers (UX only: the server validates again and has the last word; same rules as server/src/validators/authValidator.js).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // same pattern as the server

export const RESET_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes as base64url, same as the server (utils/tokens.js)

// Returns the token from a "?token=..." string, or '' when it is missing or malformed.
export function readResetToken(search) {
  const raw = new URLSearchParams(search || '').get('token') || '';
  return RESET_TOKEN_RE.test(raw) ? raw : '';
}

// Forgot-password form: { email } -> { fields, value }.
export function validateForgotForm(input) {
  const email = input && typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const fields = {};
  if (!email) fields.email = 'Email is required.';
  else if (email.length > 255 || !EMAIL_RE.test(email)) fields.email = 'Enter a valid email address.';
  return { fields, value: { email } };
}

// Reset form: { password, confirmPassword } -> { fields }. Length is counted in characters (8 to 72) and the UTF-8 size may not pass 72 bytes (bcrypt).
export function validateResetForm(input) {
  const password = input && typeof input.password === 'string' ? input.password : '';
  const confirmPassword = input && typeof input.confirmPassword === 'string' ? input.confirmPassword : '';
  const fields = {};
  const characters = Array.from(password).length;
  if (!password) fields.password = 'Password is required.';
  else if (characters < 8 || characters > 72 || new TextEncoder().encode(password).length > 72) fields.password = 'Password must be 8 to 72 characters.';
  if (!confirmPassword) fields.confirmPassword = 'Confirm your new password.';
  else if (confirmPassword !== password) fields.confirmPassword = 'Passwords do not match.';
  return { fields };
}
