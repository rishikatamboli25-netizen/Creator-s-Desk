import { createSafeError } from './userFacingError.js';

let csrfToken = '';

const buildCsrfUrl = (baseUrl) => `${String(baseUrl).replace(/\/$/, '')}/auth/csrf`;

export const clearCsrfToken = () => {
  csrfToken = '';
};

export const getCsrfToken = () => csrfToken;

export const ensureCsrfToken = async (apiBase, { force = false } = {}) => {
  if (csrfToken && !force) return csrfToken;

  let response;
  let data = {};
  const url = buildCsrfUrl(apiBase);

  try {
    response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    try {
      data = await response.json();
    } catch {
      data = {};
    }
  } catch (error) {
    throw createSafeError({
      message: error?.message,
      url,
      fallback: 'We couldn’t initialize the security check. Refresh the page and try again.',
    });
  }

  if (!response.ok || !data.csrfToken) {
    throw createSafeError({
      message: data?.error || data?.message || 'Unable to initialize CSRF protection.',
      status: response.status,
      code: data?.code,
      data,
      url,
      requestId: response.headers.get('x-request-id') || null,
      fallback: 'We couldn’t initialize the security check. Refresh the page and try again.',
    });
  }

  csrfToken = data.csrfToken;
  return csrfToken;
};

export const getCsrfHeaders = () => (
  csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
);
