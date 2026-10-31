// The only place that calls fetch (architecture.md). URLs are relative: in development the Vite proxy forwards /api to Express (D-015).
export class ApiError extends Error {
  constructor(status, code, message, fields = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // 0 when the server could not be reached
    this.code = code;
    this.fields = fields; // per-field messages, present only for VALIDATION_ERROR
  }
}

let unauthorizedHandler = null;
// Called on a 401 from any request that has not opted out; AuthContext uses it to drop the local session state.
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

function withQuery(path, query) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

// Resolves with the parsed JSON body (null for 204) or throws ApiError.
// skipUnauthorizedHandler: for me, login and register, where a 401 is an expected answer and must reach the caller untouched.
export async function request(method, path, { body, query, skipUnauthorizedHandler = false } = {}) {
  const init = { method, credentials: 'same-origin', headers: {} };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'; // the server rejects non-JSON bodies (415)
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(withQuery(path, query), init);
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check that it is running and try again.');
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Not JSON (for example the dev proxy answering while Express is down).
  }

  if (res.ok) {
    if (data === null) throw new ApiError(res.status, 'BAD_RESPONSE', 'The server sent an unexpected response.');
    return data;
  }

  const apiError = data && data.error;
  const error = apiError && typeof apiError.code === 'string'
    ? new ApiError(res.status, apiError.code, apiError.message || 'Something went wrong.', apiError.fields || null)
    : new ApiError(res.status, 'SERVER_UNAVAILABLE', 'The server is not responding correctly. Please try again later.');

  if (res.status === 401 && !skipUnauthorizedHandler && unauthorizedHandler) unauthorizedHandler(error);
  throw error;
}