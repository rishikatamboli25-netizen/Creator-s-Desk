import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import AdminUser from '../models/AdminUser.js';
import Role from '../models/Role.js';
import { config } from '../config/index.js';
import { ROLE_DEFINITIONS } from '../utils/permissions.js';

const bootstrap = async () => {
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      'BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required.'
    );
  }

  if (password.length < 12) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.');
  }

  await mongoose.connect(config.mongoUri);

  const roleDefinition = ROLE_DEFINITIONS.SUPER_ADMIN;
  await Role.updateOne(
    { key: 'SUPER_ADMIN' },
    {
      $set: {
        key: 'SUPER_ADMIN',
        name: roleDefinition.name,
        description: roleDefinition.description,
        permissions: roleDefinition.permissions,
        isSystem: true,
      },
    },
    { upsert: true }
  );

  const existing = await AdminUser.findOne({ email }).select('_id');
  if (existing) {
    throw new Error('An admin with this email already exists. Refusing to overwrite it.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await AdminUser.create({
    name,
    email,
    passwordHash,
    roleKey: 'SUPER_ADMIN',
    status: 'ACTIVE',
  });

  console.log(`[CD_ADMIN] SUPER_ADMIN created: ${admin.email}`);
};

try {
  await bootstrap();
} catch (error) {
  console.error('[CD_ADMIN] Super-admin bootstrap failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
