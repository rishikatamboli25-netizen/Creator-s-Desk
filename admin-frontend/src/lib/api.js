const GATEWAY_URL =
  import.meta.env.VITE_GATEWAY_URL ||
  'http://localhost:5000';

const ADMIN_API_URL =
  import.meta.env.VITE_ADMIN_API_URL ||
  `${GATEWAY_URL}/api/admin`;

async function parseResponse(response) {
  const contentType =
    response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return {
    message: await response.text(),
  };
}

async function request(
  url,
  options = {},
  includeCredentials = false
) {
  const response = await fetch(url, {
    ...options,
    ...(includeCredentials
      ? { credentials: 'include' }
      : {}),
    headers: {
      Accept: 'application/json',
      ...(options.body
        ? {
            'Content-Type':
              'application/json',
          }
        : {}),
      ...(options.headers || {}),
    },
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    const error = new Error(
      data?.error ||
        data?.message ||
        `Request failed (${response.status})`
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        query.set(key, String(value));
      }
    }
  );

  const suffix = query.toString()
    ? `?${query.toString()}`
    : '';

  return suffix;
};

export const adminApi = {
  me: () =>
    request(
      `${ADMIN_API_URL}/auth/me`,
      {},
      true
    ),

  roles: () =>
    request(
      `${ADMIN_API_URL}/system/roles`,
      {},
      true
    ),

  permissions: () =>
    request(
      `${ADMIN_API_URL}/system/permissions`,
      {},
      true
    ),

  updatePrice: (
    productId,
    payload
  ) =>
    request(
      `${ADMIN_API_URL}/pricing/products/${encodeURIComponent(
        productId
      )}/price`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      true
    ),

  priceHistory: (productId) =>
    request(
      `${ADMIN_API_URL}/pricing/products/${encodeURIComponent(
        productId
      )}/history`,
      {},
      true
    ),

  orders: (params = {}) =>
    request(
      `${ADMIN_API_URL}/orders${buildQuery(
        params
      )}`,
      {},
      true
    ),

  order: (orderId) =>
    request(
      `${ADMIN_API_URL}/orders/${encodeURIComponent(
        orderId
      )}`,
      {},
      true
    ),

  updateOrderStatus: (
    orderId,
    status
  ) =>
    request(
      `${ADMIN_API_URL}/orders/${encodeURIComponent(
        orderId
      )}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
      true
    ),

  customers: (params = {}) =>
    request(
      `${ADMIN_API_URL}/customers${buildQuery(
        params
      )}`,
      {},
      true
    ),

  customer: (customerId) =>
    request(
      `${ADMIN_API_URL}/customers/${encodeURIComponent(
        customerId
      )}`,
      {},
      true
    ),

  refundHistory: (paymentId) =>
    request(
      `${ADMIN_API_URL}/payments/refunds/${encodeURIComponent(
        paymentId
      )}`,
      {},
      true
    ),

  createRefund: (payload) =>
    request(
      `${ADMIN_API_URL}/payments/refunds`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      true
    ),

  adminUsers: () =>
    request(
      `${ADMIN_API_URL}/admin-users`,
      {},
      true
    ),

  inviteAdminUser: (payload) =>
    request(
      `${ADMIN_API_URL}/admin-users/invitations`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      true
    ),

  updateAdminUserRole: (adminUserId, roleKey) =>
    request(
      `${ADMIN_API_URL}/admin-users/${encodeURIComponent(
        adminUserId
      )}/role`,
      {
        method: 'PATCH',
        body: JSON.stringify({ roleKey }),
      },
      true
    ),

  updateAdminUserStatus: (adminUserId, status) =>
    request(
      `${ADMIN_API_URL}/admin-users/${encodeURIComponent(
        adminUserId
      )}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
      true
    ),

  revokeAdminUserSessions: (adminUserId) =>
    request(
      `${ADMIN_API_URL}/admin-users/${encodeURIComponent(
        adminUserId
      )}/revoke-sessions`,
      { method: 'POST' },
      true
    ),

  auditLogs: (params = {}) =>
    request(
      `${ADMIN_API_URL}/audit-logs${buildQuery(params)}`,
      {},
      true
    ),

  auditActors: () =>
    request(
      `${ADMIN_API_URL}/audit-logs/actors`,
      {},
      true
    ),

  updateMyAccount: (payload) =>
    request(
      `${ADMIN_API_URL}/auth/me`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      true
    ),

  changeMyPassword: (payload) =>
    request(
      `${ADMIN_API_URL}/auth/change-password`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      true
    ),

  settings: () =>
    request(
      `${ADMIN_API_URL}/settings`,
      {},
      true
    ),

  updateSettings: (settings, reason) =>
    request(
      `${ADMIN_API_URL}/settings`,
      {
        method: 'PATCH',
        body: JSON.stringify({ settings, reason }),
      },
      true
    ),

  invitation: (token) =>
    request(
      `${ADMIN_API_URL}/auth/invitations/${encodeURIComponent(token)}`
    ),

  activateInvitation: (token, payload) =>
    request(
      `${ADMIN_API_URL}/auth/invitations/${encodeURIComponent(
        token
      )}/activate`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  invoices: (params = {}) =>
    request(
      `${ADMIN_API_URL}/invoices${buildQuery(
        params
      )}`,
      {},
      true
    ),

  invoice: (orderId) =>
    request(
      `${ADMIN_API_URL}/invoices/${encodeURIComponent(
        orderId
      )}`,
      {},
      true
    ),

  invoiceDownloadUrl: (orderId) =>
    `${ADMIN_API_URL}/invoices/${encodeURIComponent(
      orderId
    )}/download`,
};

export const gatewayApi = {
  products: (params = '') =>
    request(
      `${GATEWAY_URL}/api/products${params}`
    ),
};

export {
  GATEWAY_URL,
  ADMIN_API_URL,
};
