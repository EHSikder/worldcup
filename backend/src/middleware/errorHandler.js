/**
 * Global error handler middleware
 * Returns consistent JSON error responses
 */
function errorHandler(err, req, res, _next) {
  console.error('🔴 Error:', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Handle known error types
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body.',
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request body too large.',
    });
  }

  // Default to 500
  const statusCode = err.statusCode || 500;
  const message =
    statusCode === 500
      ? 'Internal server error.'
      : err.message || 'Something went wrong.';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { detail: err.message }),
  });
}

module.exports = errorHandler;
