// All SQL for the users table. Parameterized only (`?` placeholders with execute()); no string-built SQL (S-2).
import pool from '../config/db.js';

// Never selects the hash except in findByEmail, which exists for login.
export async function createUser({ name, email, passwordHash }) {
  const [result] = await pool.execute(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
    [name, email, passwordHash],
  );
  return { id: result.insertId, name, email };
}

export async function findByEmail(email) {
  const [rows] = await pool.execute(
    'SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1',
    [email],
  );
  return rows[0] || null;
}

export async function findById(id) {
  const [rows] = await pool.execute('SELECT id, name, email FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}
