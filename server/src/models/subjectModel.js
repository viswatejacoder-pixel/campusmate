// All SQL for the subjects table. Parameterized only (`?` placeholders with execute()); no string-built SQL (S-2).
// Every query filters on user_id taken from the session (database.md: "every task/subject query must include user_id = ?").
// Each write is one atomic statement; the unique keys and the tasks foreign key (ON DELETE RESTRICT) are the source of
// truth, so no transaction is needed and concurrent requests cannot create duplicates or delete a subject in use.
import pool from '../config/db.js';

const toSubject = (row) => ({ id: row.id, name: row.name });

export async function listByUser(userId) {
  const [rows] = await pool.execute(
    'SELECT id, name FROM subjects WHERE user_id = ? ORDER BY name ASC, id ASC',
    [userId],
  );
  return rows.map(toSubject);
}

// Throws the driver's ER_DUP_ENTRY when this user already has the name (unique key uq_subjects_user_name).
export async function createSubject(userId, name) {
  const [result] = await pool.execute('INSERT INTO subjects (user_id, name) VALUES (?, ?)', [userId, name]);
  return { id: result.insertId, name };
}

export async function findOwned(id, userId) {
  const [rows] = await pool.execute('SELECT id, name FROM subjects WHERE id = ? AND user_id = ? LIMIT 1', [id, userId]);
  return rows[0] ? toSubject(rows[0]) : null;
}

// Matches nothing (and so cannot hit the unique key) when the subject belongs to someone else.
export async function renameSubject(id, userId, name) {
  await pool.execute('UPDATE subjects SET name = ? WHERE id = ? AND user_id = ?', [name, id, userId]);
}

// Returns true when a row was deleted. Throws ER_ROW_IS_REFERENCED_2 when tasks still reference the subject.
export async function deleteSubject(id, userId) {
  const [result] = await pool.execute('DELETE FROM subjects WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}
