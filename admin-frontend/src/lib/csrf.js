let csrfToken = '';

const buildCsrfUrl = (baseUrl) => `${String(baseUrl).replace(/\/$/, '')}/auth/csrf`;

export const clearCsrfToken = () => {
  csrfToken = '';
};

export const getCsrfToken = () => csrfToken;

export const ensureCsrfToken = async (apiBase, { force = false } = {}) => {
  if (csrfToken && !force) return csrfToken;

  const response = await fetch(buildCsrfUrl(apiBase), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    // Fall through to the generic response error below.
  }

  if (!response.ok || !data.csrfToken) {
    const error = new Error(
      data?.error || 'Unable to initialize CSRF protection.'
    );
    error.status = response.status;
    throw error;
  }

  csrfToken = data.csrfToken;
  return csrfToken;
};

export const getCsrfHeaders = () => (
  csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
);
