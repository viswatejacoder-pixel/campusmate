// Helpers for the task form and task actions (T-080 M3). Pure functions: no I/O, no React.
import { ApiError } from '../api/client.js';
import { validateTaskInput } from './validation.js';

// The editable task fields. These are also the keys of the server's per-field errors (api-spec.md).
export const FORM_FIELDS = ['title', 'description', 'subjectId', 'dueDate', 'priority'];

// Starting values for the form. Every value is text, because that is what form controls hold.
export function initialTaskFormValues(task = null) {
  if (!task) return { title: '', description: '', subjectId: '', dueDate: '', priority: 'medium' };
  return {
    title: task.title,
    description: task.description ?? '', // the API sends null when there is no description
    subjectId: String(task.subjectId),
    dueDate: task.dueDate,
    priority: task.priority,
  };
}

// A <select> hands back text, but the server only accepts a JSON number for subjectId ("3" gets a 400).
// Plain digits become a Number; anything else stays text and then fails validation. Empty means "not chosen".
export function toSubjectId(text) {
  const value = typeof text === 'string' ? text.trim() : text;
  if (value === '' || value === undefined || value === null) return undefined;
  return typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : value;
}

// Form values -> { fields, value } using the same rules as the server. `value` is ready for createTask() and updateTask().
export function prepareTaskSubmission(values) {
  return validateTaskInput({ ...values, subjectId: toSubjectId(values.subjectId) });
}

// Turns a failed save into what the form shows: per-field messages plus one general message.
// Only the API's own messages are shown; an unexpected error's text is never put on screen.
export function describeSaveError(error) {
  if (!(error instanceof ApiError)) return { fields: {}, message: 'Something went wrong. Your changes were not saved.' };
  const fields = {};
  const other = []; // messages for fields this form does not have
  for (const [key, text] of Object.entries(error.fields ?? {})) {
    if (FORM_FIELDS.includes(key)) fields[key] = String(text);
    else other.push(String(text));
  }
  const lead = Object.keys(fields).length > 0 ? 'Please fix the errors below.' : error.message;
  return { fields, message: [lead, ...other].join(' ') };
}

// One message for a failed action (toggle, delete, load). The API's message when there is one, otherwise the fallback.
export const actionErrorMessage = (error, fallback) => (error instanceof ApiError && error.message ? error.message : fallback);
