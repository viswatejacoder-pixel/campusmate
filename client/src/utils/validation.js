// Client-side validation (T-080 M1). UX only: it gives early, readable messages and mirrors the server rules in
// server/src/validators/taskValidator.js and subjectValidator.js (api-spec.md section 4). The server validates again and has the last word.
// Pure functions: no I/O. Each returns { fields, value }; `fields` is empty when the input is valid (same shape as the server's).
import { isRealDate } from './dates.js';

export const PRIORITIES = ['low', 'medium', 'high'];
export const STATUSES = ['all', 'pending', 'completed', 'overdue'];
export const SORTS = ['dueDate', 'priority', 'createdAt'];
export const ORDERS = ['asc', 'desc'];
// Lengths are counted in characters (code points), like VARCHAR in utf8mb4 on the server.
export const LIMITS = { name: 100, title: 150, description: 1000, search: 100 };
const MAX_ID = 4294967295; // largest value of an INT UNSIGNED id

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const chars = (s) => Array.from(s).length;
const isId = (v) => Number.isInteger(v) && v >= 1 && v <= MAX_ID;

// Subject create and rename: { name }.
export function validateSubjectName(input) {
  const b = isObject(input) ? input : {};
  const fields = {};
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) fields.name = 'Name is required.';
  else if (chars(name) > LIMITS.name) fields.name = `Name must be at most ${LIMITS.name} characters.`;
  return { fields, value: { name } };
}

// Task create and edit (one rule set, like the server). Only the five editable fields are read.
// subjectId must already be a number: convert a form's select value with Number() before calling (the server rejects "3").
export function validateTaskInput(input) {
  const b = isObject(input) ? input : {};
  const fields = {};

  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title) fields.title = 'Title is required.';
  else if (chars(title) > LIMITS.title) fields.title = `Title must be at most ${LIMITS.title} characters.`;

  let description = null; // absent, null, "" and spaces-only all mean "no description"
  if (b.description !== undefined && b.description !== null) {
    if (typeof b.description !== 'string') fields.description = 'Description must be text.';
    else {
      const d = b.description.trim();
      if (chars(d) > LIMITS.description) fields.description = `Description must be at most ${LIMITS.description} characters.`;
      else description = d === '' ? null : d;
    }
  }

  const { subjectId } = b;
  if (subjectId === undefined || subjectId === null) fields.subjectId = 'Subject is required.';
  else if (!isId(subjectId)) fields.subjectId = 'Subject must be a valid subject id.';

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

// Filter bar values for GET /api/tasks. Unlike the server, an empty value (undefined, null, "") means "no filter", because an
// untouched filter control holds ''. `value` holds only the filters that are set, so it can go straight to listTasks().
// subjectId may be a number or digit text (a select's value); it comes back as a number.
export function validateTaskFilters(filters) {
  const f = isObject(filters) ? filters : {};
  const fields = {};
  const value = {};
  const present = (v) => v !== undefined && v !== null && v !== '';

  if (present(f.q)) {
    if (typeof f.q !== 'string') fields.q = 'Search must be text.';
    else {
      const q = f.q.trim();
      if (chars(q) > LIMITS.search) fields.q = `Search must be at most ${LIMITS.search} characters.`;
      else if (q !== '') value.q = q; // blank search = no text filter
    }
  }

  if (present(f.subjectId)) {
    const id = typeof f.subjectId === 'string' && /^[1-9]\d{0,9}$/.test(f.subjectId) ? Number(f.subjectId) : f.subjectId;
    if (isId(id)) value.subjectId = id;
    else fields.subjectId = 'Subject must be a valid subject id.';
  }

  const oneOf = (name, label, allowed) => {
    if (!present(f[name])) return;
    if (allowed.includes(f[name])) value[name] = f[name];
    else fields[name] = `${label} must be one of: ${allowed.join(', ')}.`;
  };
  oneOf('priority', 'Priority', PRIORITIES);
  oneOf('status', 'Status', STATUSES);
  oneOf('sort', 'Sort', SORTS);
  oneOf('order', 'Order', ORDERS);

  const date = (name, label) => {
    if (!present(f[name])) return;
    if (isRealDate(f[name])) value[name] = f[name];
    else fields[name] = `${label} must be a real date in YYYY-MM-DD format.`;
  };
  date('dueFrom', 'Start date');
  date('dueTo', 'End date');

  // YYYY-MM-DD strings compare correctly as text. Both ends are inclusive.
  if (value.dueFrom && value.dueTo && value.dueFrom > value.dueTo) fields.dueTo = 'End date must not be before start date.';

  return { fields, value };
}
