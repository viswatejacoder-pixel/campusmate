// All SQL for the tasks table. Parameterized only (`?` placeholders with execute()); user input is never placed in SQL text (S-2).
// Every query filters on tasks.user_id taken from the session (database.md: "every task/subject query must include user_id = ?").
// Overdue and due-soon are derived from CURDATE() on each query, never stored (database.md section 3; OQ-6, OQ-10: server clock).
import pool from '../config/db.js';

// Fixed SQL fragments built from code constants only (DUE_SOON_DAYS is OQ-6), never from request data.
const DUE_SOON_DAYS = 3;
const OVERDUE_SQL = 't.is_completed = 0 AND t.due_date < CURDATE()';
const DUE_SOON_SQL = `t.is_completed = 0 AND t.due_date BETWEEN CURDATE() AND CURDATE() + INTERVAL ${DUE_SOON_DAYS} DAY`;

// The join on (subject id, user id) mirrors the composite foreign key, so a task can only ever be shown with its own subject.
// UNIX_TIMESTAMP() returns the instant independent of the MySQL session time zone; toTask() turns it into ISO-8601 UTC.
const SELECT_TASK = `SELECT t.id, t.title, t.description, t.subject_id, s.name AS subject_name, t.due_date, t.priority,
  t.is_completed, UNIX_TIMESTAMP(t.completed_at) AS completed_epoch,
  (${OVERDUE_SQL}) AS is_overdue, (${DUE_SOON_SQL}) AS is_due_soon,
  UNIX_TIMESTAMP(t.created_at) AS created_epoch, UNIX_TIMESTAMP(t.updated_at) AS updated_epoch
  FROM tasks t JOIN subjects s ON s.id = t.subject_id AND s.user_id = t.user_id`;

const iso = (epoch) => (epoch === null ? null : new Date(Number(epoch) * 1000).toISOString().replace('.000Z', 'Z'));

const toTask = (r) => ({
  id: r.id,
  title: r.title,
  description: r.description,
  subjectId: r.subject_id,
  subjectName: r.subject_name,
  dueDate: r.due_date, // "YYYY-MM-DD" (the pool uses dateStrings)
  priority: r.priority,
  isCompleted: Boolean(r.is_completed),
  completedAt: iso(r.completed_epoch),
  isOverdue: Boolean(r.is_overdue),
  isDueSoon: Boolean(r.is_due_soon),
  createdAt: iso(r.created_epoch),
  updatedAt: iso(r.updated_epoch),
});

// Sort columns and directions come from these whitelists only; the request value is a lookup key, never SQL text.
// ENUM columns sort by their declared order, so priority ASC is low, medium, high. Ties fall back to a fixed order.
const ORDER_SQL = { asc: 'ASC', desc: 'DESC' };
const SORT_SQL = {
  dueDate: (d) => `t.due_date ${d}, t.id ${d}`,
  priority: (d) => `t.priority ${d}, t.due_date ASC, t.id ASC`,
  createdAt: (d) => `t.created_at ${d}, t.id ${d}`,
};
const STATUS_SQL = { pending: 't.is_completed = 0', completed: 't.is_completed = 1', overdue: OVERDUE_SQL };

// Makes %, _ and the escape character match literally inside LIKE (the query is sent with ESCAPE '!').
const likeEscape = (s) => s.replace(/[!%_]/g, (c) => `!${c}`);

export async function findOwned(id, userId) {
  const [rows] = await pool.execute(`${SELECT_TASK} WHERE t.id = ? AND t.user_id = ? LIMIT 1`, [id, userId]);
  return rows[0] ? toTask(rows[0]) : null;
}

// `filters` is the validated object from validateListQuery; unknown sort/order values fall back to the defaults.
export async function listByUser(userId, filters) {
  const where = ['t.user_id = ?'];
  const params = [userId];
  if (filters.subjectId !== null) { where.push('t.subject_id = ?'); params.push(filters.subjectId); }
  if (filters.priority !== null) { where.push('t.priority = ?'); params.push(filters.priority); }
  if (STATUS_SQL[filters.status]) where.push(`(${STATUS_SQL[filters.status]})`);
  if (filters.dueFrom !== null) { where.push('t.due_date >= ?'); params.push(filters.dueFrom); }
  if (filters.dueTo !== null) { where.push('t.due_date <= ?'); params.push(filters.dueTo); }
  if (filters.q !== null) {
    where.push("(t.title LIKE ? ESCAPE '!' OR t.description LIKE ? ESCAPE '!')");
    const pattern = `%${likeEscape(filters.q)}%`;
    params.push(pattern, pattern);
  }
  const direction = ORDER_SQL[filters.order] || ORDER_SQL.asc;
  const orderBy = (SORT_SQL[filters.sort] || SORT_SQL.dueDate)(direction);
  const [rows] = await pool.execute(`${SELECT_TASK} WHERE ${where.join(' AND ')} ORDER BY ${orderBy}`, params);
  return rows.map(toTask);
}

// One statement, so the four numbers always agree with each other. pending = not completed (it includes the overdue and
// due-soon tasks); overdue and dueSoon never overlap each other; completed tasks are never overdue or due soon.
export async function summaryByUser(userId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(CASE WHEN t.is_completed = 0 THEN 1 END) AS pending,
            COUNT(CASE WHEN t.is_completed = 1 THEN 1 END) AS completed,
            COUNT(CASE WHEN ${OVERDUE_SQL} THEN 1 END) AS overdue,
            COUNT(CASE WHEN ${DUE_SOON_SQL} THEN 1 END) AS due_soon
     FROM tasks t WHERE t.user_id = ?`,
    [userId],
  );
  const r = rows[0];
  return { pending: Number(r.pending), completed: Number(r.completed), overdue: Number(r.overdue), dueSoon: Number(r.due_soon) };
}

// Throws ER_NO_REFERENCED_ROW_2 when the (subject_id, user_id) pair does not exist: the composite foreign key is the backstop
// behind the controller's ownership check, including when the subject is deleted between that check and this insert.
export async function createTask(userId, t) {
  const [result] = await pool.execute(
    'INSERT INTO tasks (user_id, subject_id, title, description, due_date, priority) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, t.subjectId, t.title, t.description, t.dueDate, t.priority],
  );
  return result.insertId;
}

// Edits the five editable fields only; completion is changed by setCompleted. Matches nothing when the task is not the user's.
export async function updateTask(id, userId, t) {
  await pool.execute(
    'UPDATE tasks SET subject_id = ?, title = ?, description = ?, due_date = ?, priority = ? WHERE id = ? AND user_id = ?',
    [t.subjectId, t.title, t.description, t.dueDate, t.priority, id, userId],
  );
}

// Completing an already completed task keeps its original completed_at; un-completing clears it.
export async function setCompleted(id, userId, isCompleted) {
  const sql = isCompleted
    ? 'UPDATE tasks SET is_completed = 1, completed_at = COALESCE(completed_at, NOW()) WHERE id = ? AND user_id = ?'
    : 'UPDATE tasks SET is_completed = 0, completed_at = NULL WHERE id = ? AND user_id = ?';
  await pool.execute(sql, [id, userId]);
}

// Returns true when a row was deleted.
export async function deleteTask(id, userId) {
  const [result] = await pool.execute('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}
