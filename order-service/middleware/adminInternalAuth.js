import crypto from 'crypto';

const timingSafeSecretEqual = (provided, expected) => {
  const providedBuffer = Buffer.from(String(provided || ''), 'utf8');
  const expectedBuffer = Buffer.from(String(expected || ''), 'utf8');

  if (
    providedBuffer.length === 0 ||
    expectedBuffer.length === 0 ||
    providedBuffer.length !== expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    providedBuffer,
    expectedBuffer
  );
};

export const requireAdminInternalAuth = (req, res, next) => {
  const expectedSecret =
    process.env.ADMIN_INTERNAL_SECRET || '';

  if (!expectedSecret) {
    return res.status(503).json({
      error:
        'ADMIN_INTERNAL_SECRET is not configured on Order Service.',
    });
  }

  const providedSecret =
    req.get('x-admin-internal-secret') || '';

  if (
    !timingSafeSecretEqual(
      providedSecret,
      expectedSecret
    )
  ) {
    return res.status(401).json({
      error: 'Invalid admin service credentials.',
    });
  }

  next();
};
