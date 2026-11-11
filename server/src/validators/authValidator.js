// Input validation for the auth endpoints (api-spec.md section 4). Pure functions: no I/O, nothing is logged.
// Each returns { fields, value }. `fields` is empty when the input is valid.
import { TOKEN_RE } from '../utils/tokens.js';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_BYTES = 72; // bcrypt silently ignores everything after 72 bytes, so longer passwords are refused

// The JSON parser may give undefined (no body), an array, or a primitive; treat all of those as "no fields".
function asObject(body) {
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

export function isPasswordLengthOk(password) {
  const characters = Array.from(password).length;
  return characters >= 8 && characters <= 72 && Buffer.byteLength(password, 'utf8') <= MAX_PASSWORD_BYTES;
}

export function validateRegister(body) {
  const b = asObject(body);
  const fields = {};

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) fields.name = 'Name is required.';
  else if (name.length > 100) fields.name = 'Name must be at most 100 characters.';

  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!email) fields.email = 'Email is required.';
  else if (email.length > 255) fields.email = 'Email must be at most 255 characters.';
  else if (!EMAIL_RE.test(email)) fields.email = 'Enter a valid email address.';

  // The password is never trimmed or changed.
  const password = typeof b.password === 'string' ? b.password : '';
  if (!password) fields.password = 'Password is required.';
  else if (!isPasswordLengthOk(password)) fields.password = 'Password must be 8 to 72 characters.';

  return { fields, value: { name, email, password } };
}

// Login only checks that both values are present text. Anything else (bad format, wrong length, wrong
// value) is answered with the same generic 401 by the controller, so it reveals nothing about accounts.
export function validateLogin(body) {
  const b = asObject(body);
  const fields = {};

  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!email) fields.email = 'Email is required.';

  const password = typeof b.password === 'string' ? b.password : '';
  if (!password) fields.password = 'Password is required.';

  return { fields, value: { email, password } };
}

// Verification link token: anything that is not a well-formed token is treated exactly like a wrong one (generic 400 in the controller).
export function validateVerify(body) {
  const b = asObject(body);
  return { token: typeof b.token === 'string' && TOKEN_RE.test(b.token) ? b.token : null };
}

// Resend only needs a well-formed email; the controller answers identically for unknown and known accounts.
export function validateResend(body) {
  const b = asObject(body);
  const fields = {};
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!email) fields.email = 'Email is required.';
  else if (email.length > 255 || !EMAIL_RE.test(email)) fields.email = 'Enter a valid email address.';
  return { fields, value: { email } };
}

// Forgot password: same rule as resend (a well-formed email; the controller answers identically for every address).
export const validateForgot = validateResend;

// Reset password: { token, password, confirmPassword }. A malformed token is not a field error (the controller answers it with
// the same generic 400 as a wrong token). The password policy is the registration policy (8 to 72 characters, not trimmed).
export function validateReset(body) {
  const b = asObject(body);
  const fields = {};

  const token = typeof b.token === 'string' && TOKEN_RE.test(b.token) ? b.token : null;

  const password = typeof b.password === 'string' ? b.password : '';
  if (!password) fields.password = 'Password is required.';
  else if (!isPasswordLengthOk(password)) fields.password = 'Password must be 8 to 72 characters.';

  const confirmPassword = typeof b.confirmPassword === 'string' ? b.confirmPassword : '';
  if (!confirmPassword) fields.confirmPassword = 'Confirm your new password.';
  else if (confirmPassword !== password) fields.confirmPassword = 'Passwords do not match.';

  return { token, fields, value: { password } };
}
