// backend/src/middleware/errorHandler.js
module.exports = function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message);
  if (err.message?.includes('Access denied'))  return res.status(403).json({ error: err.message });
  if (err.message?.includes('not found'))      return res.status(404).json({ error: err.message });
  if (err.message?.includes('already exists')) return res.status(409).json({ error: err.message });
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
};
