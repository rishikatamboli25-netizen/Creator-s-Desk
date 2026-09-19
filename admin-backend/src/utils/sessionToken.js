import crypto from 'crypto';

export const createSessionToken = () => crypto.randomBytes(48).toString('base64url');

export const hashSessionToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');
