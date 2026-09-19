import { randomUUID } from 'node:crypto';

export const requestIdMiddleware = (req, res, next) => {
  const incomingRequestId = String(req.get('x-request-id') || '').trim();
  const requestId = incomingRequestId || randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
};
