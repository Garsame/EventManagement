const formatError = (code, message) => ({ error: { code, message } });

export default function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  const code = err.code || "SERVER_ERROR";
  const message = err.message || "Internal Server Error";
  res.status(status).json(formatError(code, message));
}
