// Central error handling (api-spec.md "Error format"). Never sends stack traces, SQL, or request content to the client.
import AppError from '../utils/AppError.js';

// Any /api path that matched no route: JSON 404, never the client's index.html.
export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found.' } });
}

// Must be registered last. Express recognises it by its four parameters.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let code = 'SERVER_ERROR';
  let message = 'Something went wrong. Please try again.';
  let fields;

  if (err instanceof AppError) {
    status = err.status;
    code = err.code;
    message = err.message;
    fields = err.fields;
  } else if (err.type === 'entity.parse.failed') {
    // Malformed JSON. The parser's own message can echo part of the body (e.g. a password), so it is never used.
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request body is not valid JSON.';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large.';
  } else if (err.type === 'charset.unsupported' || err.type === 'encoding.unsupported') {
    status = 415;
    code = 'UNSUPPORTED_MEDIA_TYPE';
    message = 'Unsupported request encoding.';
  }

  if (status === 500) {
    // Log only a short identifier, never err.message or the stack (they can contain SQL or user input).
    console.error(`Unhandled error (${err.code || err.name || 'UNKNOWN'})`);
  }

  res.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) } });
}
