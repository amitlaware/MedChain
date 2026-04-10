// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

/**
 * authenticate — Verify JWT from Authorization header.
 * Attaches req.user = { userId, email, role, orgMsp, fabricId }
 */
function authenticate(req, res, next) {
  let token;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * requireRole(...roles) — Role-based access control middleware factory.
 * Usage: router.post('/upload', authenticate, requireRole('hospital', 'doctor'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Role '${req.user.role}' is not allowed. Required: ${roles.join(' or ')}`
      });
    }
    next();
  };
}

// backend/src/middleware/errorHandler.js
function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message);

  // Fabric endorsement / access errors
  if (err.message && err.message.includes('Access denied')) {
    return res.status(403).json({ error: err.message });
  }
  if (err.message && err.message.includes('not found')) {
    return res.status(404).json({ error: err.message });
  }
  if (err.message && err.message.includes('already exists')) {
    return res.status(409).json({ error: err.message });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}

module.exports = { authenticate, requireRole };
module.exports.errorHandler = errorHandler;
