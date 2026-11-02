// Tasks API wrappers (api-spec.md "Tasks"). All HTTP goes through request() in client.js, never fetch directly.
// Each wrapper resolves with the unwrapped object (or array) and throws ApiError on failure.
import { request } from './client.js';

// The only query parameters GET /api/tasks understands, in the order they are sent. Other keys in `filters` are never sent.
export const TASK_QUERY_KEYS = ['q', 'subjectId', 'priority', 'status', 'dueFrom', 'dueTo', 'sort', 'order'];
// The only fields POST and PUT read. userId, id, isCompleted and completedAt are ignored by the server, so they are not sent.
export const TASK_BODY_KEYS = ['title', 'description', 'subjectId', 'dueDate', 'priority'];

// Copies the listed keys that are not undefined (null is kept: description null clears it).
function pick(source, keys) {
  const out = {};
  if (source !== null && typeof source === 'object') {
    for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

const taskPath = (id) => `/api/tasks/${encodeURIComponent(id)}`;

// Empty, null and undefined filter values are left out of the URL by request(), so "All subjects" ('') sends nothing.
export const listTasks = async (filters) => (await request('GET', '/api/tasks', { query: pick(filters, TASK_QUERY_KEYS) })).tasks;
// Resolves { pending, completed, overdue, dueSoon }. `pending` includes the overdue and due-soon tasks (api-spec.md).
export const getTaskSummary = () => request('GET', '/api/tasks/summary');
export const getTask = async (id) => (await request('GET', taskPath(id))).task;
export const createTask = async (input) => (await request('POST', '/api/tasks', { body: pick(input, TASK_BODY_KEYS) })).task;
// PUT replaces all five editable fields (an omitted description is cleared, an omitted priority becomes medium).
export const updateTask = async (id, input) => (await request('PUT', taskPath(id), { body: pick(input, TASK_BODY_KEYS) })).task;
export const setTaskCompleted = async (id, isCompleted) => (await request('PATCH', `${taskPath(id)}/complete`, { body: { isCompleted } })).task;
// Resolves null (204).
export const deleteTask = (id) => request('DELETE', taskPath(id));
