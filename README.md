CD_ADMIN enterprise hardening package

Scope:
1. Operational dashboard expansion
2. Product detail/operational surface
3. Audit event normalization for legacy producer shapes
4. CSRF protection for authenticated state-changing requests
5. TOTP MFA with encrypted secrets and one-time recovery codes

Required environment addition for admin-backend:
ADMIN_MFA_ENCRYPTION_KEY=<long random secret, keep private>

Apply only the files in this package. No consumer service, Payment Service, Order Service,
Invoice Service, or API Gateway files are modified by this package.

After applying:
- restart admin-backend
- restart admin-frontend
- ensure ADMIN_MFA_ENCRYPTION_KEY is configured before enabling MFA
