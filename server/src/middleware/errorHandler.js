// Every error leaves the API in ONE shape:  { error: { code, message, details? } }
// Unknown errors become a generic 500: no stack traces, SQL or file paths reach the client.
import { ZodError } from 'zod';
import { HttpError } from '../errors.js';

export function notFound(req, res, next) {
  next(new HttpError(404, 'Not found', 'NOT_FOUND'));
}

function send(res, status, code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  res.status(status).json({ error });
}

export function makeErrorHandler(config) {
  // Express recognises an error handler by its 4 parameters. Do not remove "next".
  // eslint-disable-next-line no-unused-vars
  return function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);

    if (err instanceof HttpError) return send(res, err.status, err.code, err.message, err.details);

    if (err instanceof ZodError) {
      const details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return send(res, 400, 'VALIDATION_ERROR', 'Invalid request', details);
    }
    if (err?.type === 'entity.parse.failed') {
      return send(res, 400, 'BAD_JSON', 'Request body is not valid JSON');
    }
    if (err?.type === 'entity.too.large') {
      return send(res, 413, 'TOO_LARGE', 'Request body is too large');
    }

    // Unexpected. Log WITHOUT the request body (it may contain a password).
    // Production logs only the error name/code, because database error messages can
    // contain query values.
    if (config.isProd) console.error('Unhandled error:', err?.name, err?.code);
    else if (!config.isTest) console.error(err);
    return send(res, 500, 'INTERNAL', 'Something went wrong');
  };
}
