// Rejects any request that has a body but is not JSON (415). Requests without a body (GET, logout) pass.
// An empty body is "no body": browsers and fetch send `Content-Length: 0` on a body-less POST, and that must not be a 415.
// (req.is() alone would treat Content-Length: 0 as a body, so the length is checked here first.)
import AppError from '../utils/AppError.js';

export default function requireJson(req, res, next) {
  // Sign in with Apple uses an application/x-www-form-urlencoded form_post callback.
  if (req.method === 'POST' && req.path === '/auth/apple/callback') return next();
  const length = req.headers['content-length'];
  const hasBody = req.headers['transfer-encoding'] !== undefined || (length !== undefined && Number(length) > 0);
  if (hasBody && !req.is('application/json')) {
    return next(
      new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Request body must be JSON (Content-Type: application/json).'),
    );
  }
  next();
}
