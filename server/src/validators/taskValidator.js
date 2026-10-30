// Input validation for the tasks endpoints (api-spec.md section 4 and "Tasks"). Pure functions: no I/O, nothing is logged.
// Ids in URLs use the same parser as subjects (plain positive integers that fit INT UNSIGNED), so the rules cannot drift.
import { parseId } from './subjectValidator.js';

export { parseId };

const MAX_ID = 4294967295; // largest value of subjects.id (INT UNSIGNED)
export const PRIORITIES = ['low', 'medium', 'high'];
export const STATUSES = ['all', 'pending', 'completed', 'overdue'];
export const SORTS = ['dueDate', 'priority', 'createdAt'];
export const ORDERS = ['asc', 'desc'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const chars = (s) => Array.from(s).length; // length in characters (code points), like VARCHAR in utf8mb4

// A real calendar date written exactly as YYYY-MM-DD. Rejects 2026-02-30, 2026-13-01, 2026-2-3, date-times and padded text.
// Years 1000-9999 are what a MySQL DATE column reliably holds.
export function isRealDate(value) {
  if (typeof value !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1000) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

// Create and edit share one rule set (PUT takes the same body as POST). Returns { fields, value }; `fields` is empty when valid.
// Only title, description, subjectId, dueDate and priority are read: userId, id, isCompleted, completedAt and anything else is ignored.
// subjectId must be a JSON number: the string "3" is rejected. Whether the subject belongs to the user is checked by the controller.
export function validateTaskInput(body) {
  const b = isObject(body) ? body : {};
  const fields = {};

  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title) fields.title = 'Title is required.';
  else if (chars(title) > 150) fields.title = 'Title must be at most 150 characters.';

  let description = null; // absent, null, "" and spaces-only all mean "no description"
  if (b.description !== undefined && b.description !== null) {
    if (typeof b.description !== 'string') fields.description = 'Description must be text.';
    else {
      const d = b.description.trim();
      if (chars(d) > 1000) fields.description = 'Description must be at most 1000 characters.';
      else description = d === '' ? null : d;
    }
  }

  const { subjectId } = b;
  if (subjectId === undefined || subjectId === null) fields.subjectId = 'Subject is required.';
  else if (!Number.isInteger(subjectId) || subjectId < 1 || subjectId > MAX_ID) {
    fields.subjectId = 'Subject must be a valid subject id.';
  }

  const { dueDate } = b;
  if (dueDate === undefined || dueDate === null || dueDate === '') fields.dueDate = 'Due date is required.';
  else if (!isRealDate(dueDate)) fields.dueDate = 'Due date must be a real date in YYYY-MM-DD format.';

  let priority = 'medium'; // default when the field is absent
  if (b.priority !== undefined) {
    if (!PRIORITIES.includes(b.priority)) fields.priority = 'Priority must be low, medium or high.';
    else priority = b.priority;
  }

  return { fields, value: { title, description, subjectId, dueDate, priority } };
}

// PATCH /api/tasks/:id/complete takes exactly { isCompleted: true | false }.
export function validateCompletion(body) {
  const fields = {};
  const isCompleted = isObject(body) ? body.isCompleted : undefined;
  if (typeof isCompleted !== 'boolean') fields.isCompleted = 'isCompleted must be true or false.';
  return { fields, value: { isCompleted } };
}

// GET /api/tasks query string. Every parameter is optional; a parameter that is present must be valid (an empty
// subjectId, priority, status, sort, order, dueFrom or dueTo is a 400), except q, where blank means "no text filter".
// A repeated parameter (?status=a&status=b) arrives as an array and is rejected. Unknown parameters are ignored.
export function validateListQuery(query) {
  const q = isObject(query) ? query : {};
  const fields = {};
  const value = { q: null, subjectId: null, priority: null, status: 'all', dueFrom: null, dueTo: null, sort: 'dueDate', order: 'asc' };

  const text = (name) => {
    if (q[name] === undefined) return undefined;
    if (typeof q[name] !== 'string') {
      fields[name] = `${name} must be given once.`;
      return undefined;
    }
    return q[name];
  };
  const oneOf = (name, allowed) => {
    const v = text(name);
    if (v === undefined) return;
    if (!allowed.includes(v)) fields[name] = `${name} must be one of: ${allowed.join(', ')}.`;
    else value[name] = v;
  };
  const date = (name) => {
    const v = text(name);
    if (v === undefined) return;
    if (!isRealDate(v)) fields[name] = `${name} must be a real date in YYYY-MM-DD format.`;
    else value[name] = v;
  };

  const search = text('q');
  if (search !== undefined) {
    const trimmed = search.trim();
    if (chars(trimmed) > 100) fields.q = 'q must be at most 100 characters.';
    else value.q = trimmed === '' ? null : trimmed;
  }

  const subjectId = text('subjectId');
  if (subjectId !== undefined) {
    const id = parseId(subjectId);
    if (id === null) fields.subjectId = 'subjectId must be a positive whole number.';
    else value.subjectId = id;
  }

  oneOf('priority', PRIORITIES);
  oneOf('status', STATUSES);
  oneOf('sort', SORTS);
  oneOf('order', ORDERS);
  date('dueFrom');
  date('dueTo');

  // YYYY-MM-DD strings compare correctly as text.
  if (value.dueFrom && value.dueTo && value.dueFrom > value.dueTo) fields.dueTo = 'dueTo must not be before dueFrom.';

  return { fields, value };
}
