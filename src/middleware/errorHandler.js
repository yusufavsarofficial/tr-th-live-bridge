function errorHandler(err, req, res, _next) {
  console.error("Unhandled error:", err.message || err);
  res.status(err.status || 500).json({
    ok: false,
    error: err.expose ? err.message : "Internal server error",
  });
}

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
}

module.exports = { errorHandler, createError };
