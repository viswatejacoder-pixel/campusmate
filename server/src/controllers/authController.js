// Auth endpoints (api-spec.md section 3). Passwords are never logged, returned, or stored in plain text.
import bcrypt from 'bcryptjs';
import AppError from '../utils/AppError.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../config/session.js';
import { validateRegister, validateLogin } from '../validators/authValidator.js';
import { createUser, findByEmail, findById } from '../models/userModel.js';

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

export async function register(req, res) {
  const { fields, value } = validateRegister(req.body);
  failValidation(fields);

  const passwordHash = await bcrypt.hash(value.password, BCRYPT_COST);

  let user;
  try {
    user = await createUser({ name: value.name, email: value.email, passwordHash });
  } catch (err) {
    // The unique key on users.email is the source of truth, so two simultaneous sign-ups cannot both succeed.
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
    }
    throw err;
  }

  await startSession(req, user.id);
  res.status(201).json({ user });
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
