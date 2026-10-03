const TECHNICAL_PATTERNS = [
  /https?:\/\//i,
  /lookaside\.instagram\.com/i,
  /html response/i,
  /cloudinary/i,
  /serpapi/i,
  /gemini/i,
  /groq/i,
  /public[_ -]?id/i,
  /econn(refused|reset|aborted)/i,
  /fetch failed/i,
  /failed to fetch/i,
  /typeerror/i,
  /syntaxerror/i,
  /mongodb/i,
  /mongoose/i,
  /stack trace/i,
];

const containsTechnicalDetail = (message) =>
  typeof message === 'string' && TECHNICAL_PATTERNS.some((pattern) => pattern.test(message));

const messageForRoute = (pathname = '', status) => {
  if (pathname.includes('/catalog/research/prepare')) {
    if ([502, 503, 504].includes(status)) return 'We couldn’t prepare one or more product images right now. Try again or choose another image source.';
  }
  if (pathname.includes('/catalog/research')) {
    if ([502, 503, 504].includes(status)) return 'Product research is temporarily unavailable. Please try again in a moment.';
  }
  if (pathname.includes('/payments/refunds')) {
    if ([502, 503, 504].includes(status)) return 'We couldn’t confirm the refund service response. Check refund history before trying the action again.';
  }
  if (pathname.includes('/admin-users')) {
    if ([500, 502, 503, 504].includes(status)) return 'We couldn’t update administrator access right now. Please try again.';
  }
  if (pathname.includes('/settings')) {
    if ([500, 502, 503, 504].includes(status)) return 'We couldn’t update administrator settings right now. Please try again.';
  }
  if (pathname.includes('/pricing')) {
    if ([500, 502, 503, 504].includes(status)) return 'We couldn’t update the product price right now. Please try again.';
  }
  if (pathname.includes('/orders')) {
    if ([500, 502, 503, 504].includes(status)) return 'We couldn’t complete that order operation right now. Please try again.';
  }
  if (pathname.includes('/catalog')) {
    if ([500, 502, 503, 504].includes(status)) return 'We couldn’t complete that catalog operation right now. Please try again.';
  }
  return '';
};

export function toUserFacingMessage(source, options = {}) {
  const { status, code, url = '', fallback = 'We couldn’t complete this action right now. Please try again.' } = options;
  const raw = typeof source === 'string'
    ? source
    : source?.userMessage || source?.message || '';
  const message = String(raw || '').trim();

  if (code === 'CSRF_INVALID') return 'Your security session has expired. Refresh the page and try again.';
  if (status === 401) {
    if (String(url).includes('/auth/login')) return 'The email or password is incorrect. Check your credentials and try again.';
    return 'Your admin session has expired. Please sign in again.';
  }
  if (status === 403) return 'You don’t have permission to perform this action.';
  if (status === 404) return 'The requested record could not be found. It may have changed or been removed.';
  if (status === 409) return message && !containsTechnicalDetail(message) ? message : 'This action conflicts with the current record state. Refresh the page and try again.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';

  const routeMessage = messageForRoute(url, status);
  if (routeMessage) return routeMessage;

  if (status >= 500) return fallback;
  if (!status && (!message || containsTechnicalDetail(message))) {
    return 'We couldn’t reach the service. Please check your connection and try again.';
  }

  if (containsTechnicalDetail(message)) return fallback;
  return message || fallback;
}

export function createSafeError({ message, status, code, data, url, requestId, fallback }) {
  const technicalMessage = String(message || '').trim();
  const userMessage = toUserFacingMessage(technicalMessage, {
    status,
    code,
    url,
    fallback,
  });
  const error = new Error(userMessage);
  error.userMessage = userMessage;
  error.technicalMessage = technicalMessage;
  error.status = status;
  error.code = code;
  error.data = data;
  error.requestId = requestId;
  return error;
}
