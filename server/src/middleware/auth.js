import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Verifies the Bearer token and attaches { sub, school_id, role, name } to req.user.
export const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
};

// Restricts a route to specific roles, e.g. authorize('admin').
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (roles.length && !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission for this action.' });
  }
  next();
};
