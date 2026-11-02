// Helper for the subject manager (T-080 M4). Pure function: no I/O, no React.
import { ApiError } from '../api/client.js';

// One message for a failed subject request. The API's own message is shown for expected failures (a field error, SUBJECT_EXISTS,
// SUBJECT_IN_USE, 404, network); an unexpected error's text is never put on screen.
export function describeSubjectError(error, fallback) {
  if (!(error instanceof ApiError)) return fallback;
  if (typeof error.fields?.name === 'string' && error.fields.name) return error.fields.name;
  return error.message || fallback;
}
