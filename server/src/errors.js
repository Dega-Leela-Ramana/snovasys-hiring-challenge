// HttpError is how code says "stop and answer with this status".
// The error handler turns it into JSON: { error: { code, message, details? } }
export class HttpError extends Error {
  constructor(status, message, code = 'ERROR', details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Express 4 does not catch errors thrown in async handlers. This wrapper does.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
