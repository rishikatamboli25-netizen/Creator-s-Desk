import 'dotenv/config';
import mongoose from 'mongoose';
import Role from '../models/Role.js';
import { config } from '../config/index.js';
import { ROLE_DEFINITIONS } from '../utils/permissions.js';

const seedRoles = async () => {
  await mongoose.connect(config.mongoUri);

  for (const [key, definition] of Object.entries(ROLE_DEFINITIONS)) {
    await Role.updateOne(
      { key },
      {
        $set: {
          key,
          name: definition.name,
          description: definition.description,
          permissions: definition.permissions,
          isSystem: true,
        },
      },
      { upsert: true }
    );
  }

  console.log('[CD_ADMIN] System roles seeded successfully.');
};

try {
  await seedRoles();
} catch (error) {
  console.error('[CD_ADMIN] Role seeding failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
