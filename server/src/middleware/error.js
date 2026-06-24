// Typed application error: throw new ApiError(404, 'Not found')
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Wrap async route handlers so thrown/rejected errors reach the error handler.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Central error handler — keeps responses consistent.
export const errorHandler = (err, req, res, _next) => {
  // Postgres unique-violation -> friendly 409
  if (err.code === '23505') {
    return res.status(409).json({ error: 'This record already exists.' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Internal server error' });
};
