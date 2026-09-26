import crypto from 'node:crypto';

const CSRF_COOKIE = 'cd_admin_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_PATHS = new Set([
  '/auth/login',
  '/auth/invitations',
]);

const issueToken = (res, secure, sameSite) => {
  const token = crypto.randomBytes(32).toString('hex');

  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure,
    sameSite,
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  });

  return token;
};

export const csrfMiddleware = ({
  secure = false,
  sameSite = 'lax',
} = {}) => (req, res, next) => {
  let cookieToken = req.cookies?.[CSRF_COOKIE] || '';

  if (!cookieToken) {
    cookieToken = issueToken(res, secure, sameSite);
  }

  if (
    SAFE_METHODS.has(req.method) ||
    [...EXEMPT_PATHS].some((path) => req.path.startsWith(path))
  ) {
    return next();
  }

  const headerToken = req.get('x-csrf-token') || '';

  if (!headerToken || headerToken.length !== cookieToken.length) {
    return res.status(403).json({
      error: 'CSRF validation failed.',
      code: 'CSRF_INVALID',
    });
  }

  const valid = crypto.timingSafeEqual(
    Buffer.from(headerToken),
    Buffer.from(cookieToken)
  );

  if (!valid) {
    return res.status(403).json({
      error: 'CSRF validation failed.',
      code: 'CSRF_INVALID',
    });
  }

  return next();
};

export { CSRF_COOKIE };
