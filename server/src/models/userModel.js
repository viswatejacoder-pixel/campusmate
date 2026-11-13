// All SQL for the users table. Parameterized only (`?` placeholders with execute()); no string-built SQL (S-2).
// Verification tokens are never stored: only their SHA-256 hash (T-075). Times use the database clock (NOW()), so there is no JS/DB timezone mismatch.
import pool from '../config/db.js';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { TOKEN_TTL_MINUTES, RESEND_COOLDOWN_SECONDS, RESET_TTL_MINUTES, RESET_COOLDOWN_SECONDS } from '../utils/tokens.js';

const TTL = String(TOKEN_TTL_MINUTES);
const COOLDOWN = String(RESEND_COOLDOWN_SECONDS);
const RESET_TTL = String(RESET_TTL_MINUTES);
const RESET_COOLDOWN = String(RESET_COOLDOWN_SECONDS);

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

export async function findByOAuthIdentity(provider, subject) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email FROM oauth_accounts oa
       JOIN users u ON u.id = oa.user_id
      WHERE oa.provider = ? AND oa.subject = ? LIMIT 1`,
    [provider, subject],
  );
  return rows[0] || null;
}

export async function createOAuthUser({ provider, subject, name, email }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [userResult] = await conn.execute(
      `INSERT INTO users (name, email, password_hash, email_verified_at) VALUES (?, ?, ?, NOW())`,
      [name, email, await bcrypt.hash(`oauth:${randomBytes(32).toString('hex')}`, 12)],
    );
    await conn.execute(
      `INSERT INTO oauth_accounts (provider, subject, user_id) VALUES (?, ?, ?)`,
      [provider, subject, userResult.insertId],
    );
    await conn.commit();
    return { id: userResult.insertId, name, email };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
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

// Password reset (requires migrations/002_password_reset.sql). Only VERIFIED accounts get a reset token: an unverified
// account has no confirmed mailbox and recovers through "resend verification" or by registering again.
// One atomic UPDATE; affectedRows is 1 only when the account exists, is verified, and the last reset email is outside the cooldown.
// A new request replaces any earlier token, so only the newest link works.
export async function claimPasswordReset({ email, tokenHash }) {
  const [result] = await pool.execute(
    `UPDATE users
        SET reset_token_hash = ?, reset_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE), reset_sent_at = NOW()
      WHERE email = ? AND email_verified_at IS NOT NULL
        AND (reset_sent_at IS NULL OR reset_sent_at <= DATE_SUB(NOW(), INTERVAL ? SECOND))`,
    [tokenHash, RESET_TTL, email, RESET_COOLDOWN],
  );
  return result.affectedRows === 1;
}

// Single transaction: lock the row for a matching, unexpired token; set the new password; consume the token (single use);
// delete every stored session of that user. Any failure rolls everything back. A concurrent second submission of the same token
// waits on the row lock, then finds the token gone and gets false. Returns true on success, false for any bad/used/expired token.
export async function resetPasswordByTokenHash({ tokenHash, passwordHash }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT id FROM users
        WHERE reset_token_hash = ? AND reset_expires_at > NOW() AND email_verified_at IS NOT NULL
        LIMIT 1 FOR UPDATE`,
      [tokenHash],
    );
    if (rows.length === 0) {
      await conn.rollback();
      return false;
    }
    const userId = rows[0].id;
    await conn.execute(
      `UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_expires_at = NULL, reset_sent_at = NULL WHERE id = ?`,
      [passwordHash, userId],
    );
    // express-mysql-session stores each session as JSON in sessions.data ({"cookie":{...},"userId":N}).
    await conn.execute(
      `DELETE FROM sessions WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.userId')) AS UNSIGNED) = ?`,
      [userId],
    );
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}
