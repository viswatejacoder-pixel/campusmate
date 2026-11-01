// Auth endpoints (api-spec.md section 3). Passwords are never logged, returned, or stored in plain text.
import bcrypt from 'bcryptjs';
import AppError from '../utils/AppError.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../config/session.js';
import { validateRegister, validateLogin, validateVerify, validateResend } from '../validators/authValidator.js';
import { createUser, findByEmail, findById, overwritePendingUser, claimResend, verifyByTokenHash } from '../models/userModel.js';
import { generateToken, hashToken } from '../utils/tokens.js';
import { sendVerificationEmail } from '../services/mailer.js';

const BCRYPT_COST = 12;
const MAX_PASSWORD_BYTES = 72;
const INVALID_LOGIN = () => new AppError(401, 'UNAUTHENTICATED', 'Invalid email or password.');

// req.session methods use callbacks; these wrappers let the handlers use await.
const regenerateSession = (req) =>
  new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
const saveSession = (req) =>
  new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
const destroySession = (req) =>
  new Promise((resolve, reject) => req.session.destroy((err) => (err ? reject(err) : resolve())));

// A new session id on every login/register defeats session fixation (security.md S-4).
async function startSession(req, userId) {
  await regenerateSession(req);
  req.session.userId = userId;
  await saveSession(req); // written to MySQL before the response, so the cookie works immediately
}

// Compared against when the email is unknown, so "no such account" costs about the same time as "wrong password".
let dummyHashPromise;
const getDummyHash = () => (dummyHashPromise ??= bcrypt.hash('not-a-real-password', BCRYPT_COST));

function failValidation(fields) {
  if (Object.keys(fields).length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Please fix the highlighted fields.', fields);
  }
}

const REGISTERED_MESSAGE = 'Account created. Check your email for a link to verify your address.';
const RESEND_MESSAGE = 'If an unverified account exists for this email, a new verification link has been sent.';
const INVALID_TOKEN = () =>
  new AppError(400, 'TOKEN_INVALID_OR_EXPIRED', 'This verification link is invalid, expired, or already used.');

// A mail failure must not fail the request or leak details: log only a short code; the user can use "resend".
async function sendSafely(to, name, token) {
  try {
    await sendVerificationEmail({ to, name, token });
  } catch (err) {
    console.error(`Verification email failed (${err.code || err.name || 'UNKNOWN'})`);
  }
}

// Creates an UNVERIFIED account (no session). Re-registering a still-unverified email replaces its pending details.
export async function register(req, res) {
  const { fields, value } = validateRegister(req.body);
  failValidation(fields);

  const passwordHash = await bcrypt.hash(value.password, BCRYPT_COST);
  const token = generateToken();
  const tokenHash = hashToken(token);
  let sendMail = true;

  try {
    await createUser({ name: value.name, email: value.email, passwordHash, tokenHash });
  } catch (err) {
    // The unique key on users.email is the source of truth, so two simultaneous sign-ups cannot both succeed.
    if (err.code !== 'ER_DUP_ENTRY') throw err;
    const replaced = await overwritePendingUser({ name: value.name, email: value.email, passwordHash, tokenHash });
    if (!replaced) {
      const existing = await findByEmail(value.email);
      if (!existing || existing.email_verified_at) {
        throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
      }
      sendMail = false; // unverified but a link was sent moments ago: change nothing, answer the same as a fresh sign-up
    }
  }

  if (sendMail) await sendSafely(value.email, value.name, token);
  res.status(201).json({ message: REGISTERED_MESSAGE });
}

export async function login(req, res) {
  const { fields, value } = validateLogin(req.body);
  failValidation(fields);

  const account = await findByEmail(value.email);
  const tooLong = Buffer.byteLength(value.password, 'utf8') > MAX_PASSWORD_BYTES; // bcrypt would ignore the extra bytes

  // One bcrypt comparison always runs, so unknown email, over-long password, and wrong password all take about
  // the same time. An over-long password is compared as 'x' (never matches) and is rejected by the !tooLong check.
  const hashToCheck = account ? account.password_hash : await getDummyHash();
  const matches = await bcrypt.compare(tooLong ? 'x' : value.password, hashToCheck);
  const passwordOk = Boolean(account) && !tooLong && matches;
  if (!passwordOk) throw INVALID_LOGIN(); // same message for unknown email and wrong password
  // Only after a correct password, so this message cannot be used to discover which emails are registered.
  if (!account.email_verified_at) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email address before logging in.');
  }

  await startSession(req, account.id);
  res.json({ user: { id: account.id, name: account.name, email: account.email } });
}

// Idempotent: always 204, even with no session.
export async function logout(req, res) {
  if (req.session) await destroySession(req);
  res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions);
  res.status(204).end();
}

export async function me(req, res) {
  const user = await findById(req.userId);
  if (!user) {
    // The account no longer exists: end the stale session.
    await destroySession(req);
    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions);
    throw new AppError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
  }
  res.json({ user });
}

// Consumes a single-use token. POST (not GET) so link scanners cannot use it up; one generic error for every failure; no auto-login.
export async function verifyEmail(req, res) {
  const { token } = validateVerify(req.body);
  if (!token || !(await verifyByTokenHash(hashToken(token)))) throw INVALID_TOKEN();
  res.json({ message: 'Email verified. You can now log in.' });
}

// Always the same 202, whether the email is unknown, already verified, in cooldown, or sent. The mail is not awaited so
// response time does not reveal whether an account exists.
export async function resendVerification(req, res) {
  const { fields, value } = validateResend(req.body);
  failValidation(fields);

  const account = await findByEmail(value.email);
  if (account && !account.email_verified_at) {
    const token = generateToken();
    if (await claimResend({ email: value.email, tokenHash: hashToken(token) })) {
      void sendSafely(value.email, account.name, token);
    }
  }
  res.status(202).json({ message: RESEND_MESSAGE });
}
