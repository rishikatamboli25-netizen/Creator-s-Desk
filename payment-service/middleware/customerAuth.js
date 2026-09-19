import 'dotenv/config';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';

export const requireCustomerAuth = (req, res, next) => {
  if (!JWT_SECRET) {
    return res.status(503).json({
      error: 'Customer authentication is not configured.'
    });
  }

  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      error: 'Customer authentication required.'
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (!payload?.userId) {
      return res.status(401).json({
        error: 'Invalid customer session.'
      });
    }

    req.customer = {
      userId: String(payload.userId),
      role: payload.role || 'customer'
    };

    next();
  } catch {
    return res.status(401).json({
      error: 'Invalid or expired customer session.'
    });
  }
};
