// Email-verification tokens (T-075). The raw token only ever travels in the emailed link; the database stores its SHA-256 hash.
import crypto from 'node:crypto';

export const TOKEN_TTL_MINUTES = 30;
export const RESEND_COOLDOWN_SECONDS = 60;
export const RESET_TTL_MINUTES = 30; // password-reset links (same token format and hashing as verification links)
export const RESET_COOLDOWN_SECONDS = 60;
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes as base64url

export const generateToken = () => crypto.randomBytes(32).toString('base64url'); // 256 bits
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex'); // 64 hex characters
