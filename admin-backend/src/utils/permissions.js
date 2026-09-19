export const PERMISSIONS = Object.freeze({
  DASHBOARD_READ: 'dashboard.read',

  PRODUCTS_READ: 'products.read',
  PRODUCTS_PRICE_READ: 'products.price.read',
  PRODUCTS_PRICE_WRITE: 'products.price.write',

  ORDERS_READ: 'orders.read',
  ORDERS_WRITE: 'orders.write',

  REFUNDS_READ: 'refunds.read',
  REFUNDS_CREATE: 'refunds.create',

  CUSTOMERS_READ: 'customers.read',
  CUSTOMERS_WRITE: 'customers.write',

  SETTINGS_READ: 'settings.read',
  SETTINGS_WRITE: 'settings.write',

  ADMIN_USERS_READ: 'admin_users.read',
  ADMIN_USERS_WRITE: 'admin_users.write',

  AUDIT_READ: 'audit.read',
});

export const ROLE_DEFINITIONS = Object.freeze({
  SUPER_ADMIN: {
    name: 'Super Admin',
    description: 'Unrestricted administrative access.',
    permissions: Object.values(PERMISSIONS),
  },
  ADMIN: {
    name: 'Admin',
    description: 'Operational administration with limited system settings.',
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_PRICE_READ,
      PERMISSIONS.PRODUCTS_PRICE_WRITE,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ORDERS_WRITE,
      PERMISSIONS.REFUNDS_READ,
      PERMISSIONS.REFUNDS_CREATE,
      PERMISSIONS.CUSTOMERS_READ,
      PERMISSIONS.CUSTOMERS_WRITE,
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.ADMIN_USERS_READ,
      PERMISSIONS.AUDIT_READ,
    ],
  },
  CATALOG_MANAGER: {
    name: 'Catalog Manager',
    description: 'Catalog and product pricing management.',
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_PRICE_READ,
      PERMISSIONS.PRODUCTS_PRICE_WRITE,
      PERMISSIONS.ORDERS_READ,
    ],
  },
  FINANCE: {
    name: 'Finance',
    description: 'Orders, payments and refund operations.',
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_PRICE_READ,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ORDERS_WRITE,
      PERMISSIONS.REFUNDS_READ,
      PERMISSIONS.REFUNDS_CREATE,
    ],
  },
  SUPPORT: {
    name: 'Support',
    description: 'Customer support access with limited financial authority.',
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_PRICE_READ,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ORDERS_WRITE,
      PERMISSIONS.REFUNDS_READ,
      PERMISSIONS.CUSTOMERS_READ,
    ],
  },
});

export const hasPermission = (userPermissions = [], requiredPermission) =>
  userPermissions.includes(requiredPermission);
