// All SQL for the users table. Parameterized only (`?` placeholders with execute()); no string-built SQL (S-2).
// Verification tokens are never stored: only their SHA-256 hash (T-075). Times use the database clock (NOW()), so there is no JS/DB timezone mismatch.
import pool from '../config/db.js';
import { TOKEN_TTL_MINUTES, RESEND_COOLDOWN_SECONDS } from '../utils/tokens.js';

const TTL = String(TOKEN_TTL_MINUTES);
const COOLDOWN = String(RESEND_COOLDOWN_SECONDS);

// Creates an UNVERIFIED user with a pending token hash.
export async function createUser({ name, email, passwordHash, tokenHash }) {
  const [result] = await pool.execute(
    `INSERT INTO users (name, email, password_hash, verification_token_hash, verification_expires_at, verification_sent_at)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW())`,
    [name, email, passwordHash, tokenHash, TTL],
  );
  return { id: result.insertId, name, email };
}

// Never selects the hash except in findByEmail, which exists for login.
export async function findByEmail(email) {
  const [rows] = await pool.execute(
    'SELECT id, name, email, password_hash, email_verified_at FROM users WHERE email = ? LIMIT 1',
    [email],
  );
  return rows[0] || null;
}

export async function findById(id) {
  const [rows] = await pool.execute('SELECT id, name, email FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// Re-registration of a still-unverified email: replaces name, password and token. Atomic, and skipped (returns false) when the
// account is already verified or the last email was sent within the cooldown, so an unseen token never replaces a valid one.
export async function overwritePendingUser({ name, email, passwordHash, tokenHash }) {
  const [result] = await pool.execute(
    `UPDATE users
        SET name = ?, password_hash = ?, verification_token_hash = ?,
            verification_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE), verification_sent_at = NOW()
      WHERE email = ? AND email_verified_at IS NULL
        AND (verification_sent_at IS NULL OR verification_sent_at <= DATE_SUB(NOW(), INTERVAL ? SECOND))`,
    [name, passwordHash, tokenHash, TTL, email, COOLDOWN],
  );
  return result.affectedRows === 1;
}

// Resend: new token for an unverified account outside the cooldown. Atomic; returns true when a token was issued.
export async function claimResend({ email, tokenHash }) {
  const [result] = await pool.execute(
    `UPDATE users
        SET verification_token_hash = ?, verification_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE), verification_sent_at = NOW()
      WHERE email = ? AND email_verified_at IS NULL
        AND (verification_sent_at IS NULL OR verification_sent_at <= DATE_SUB(NOW(), INTERVAL ? SECOND))`,
    [tokenHash, TTL, email, COOLDOWN],
  );
  return result.affectedRows === 1;
}

// Single-use: one conditional UPDATE. affectedRows is 1 only for a matching, unexpired, not-yet-used token.
export async function verifyByTokenHash(tokenHash) {
  const [result] = await pool.execute(
    `UPDATE users
        SET email_verified_at = NOW(), verification_token_hash = NULL, verification_expires_at = NULL
      WHERE verification_token_hash = ? AND verification_expires_at > NOW() AND email_verified_at IS NULL`,
    [tokenHash],
  );
  return result.affectedRows === 1;
}
