// Blocks private routes when there is no logged-in session (api-spec.md: 401 UNAUTHENTICATED).
// On success it sets req.userId from the session; later controllers must use it and never read a user id from the request body.
import AppError from '../utils/AppError.js';

export default function requireAuth(req, res, next) {
  const userId = req.session?.userId;
  if (!Number.isInteger(userId) || userId <= 0) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Please log in to continue.'));
  }
  req.userId = userId;
  next();
}
