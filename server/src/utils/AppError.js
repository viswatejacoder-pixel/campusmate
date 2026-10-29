// An expected (operational) error with an HTTP status and an API error code (api-spec.md "Error format").
// Throw it from controllers/models; errorHandler turns it into the JSON error response.
export default class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (fields) this.fields = fields; // only for VALIDATION_ERROR: { fieldName: 'message' }
  }
}
