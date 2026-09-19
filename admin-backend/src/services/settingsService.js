import { config } from '../config/index.js';
import AdminSetting from '../models/AdminSetting.js';

export const SETTING_KEYS = Object.freeze({
  ADMIN_SESSION_HOURS: 'ADMIN_SESSION_HOURS',
  INVITATION_EXPIRY_HOURS: 'INVITATION_EXPIRY_HOURS',
  PASSWORD_MIN_LENGTH: 'PASSWORD_MIN_LENGTH',
});

export const SETTING_DEFINITIONS = Object.freeze({
  [SETTING_KEYS.ADMIN_SESSION_HOURS]: {
    label: 'Admin session duration',
    description: 'How long a newly created admin session remains valid.',
    type: 'number',
    unit: 'hours',
    min: 1,
    max: 24,
    defaultValue: config.sessionHours,
    appliesTo: 'New admin sessions',
  },
  [SETTING_KEYS.INVITATION_EXPIRY_HOURS]: {
    label: 'Invitation expiry',
    description: 'How long a newly issued administrator invitation remains usable.',
    type: 'number',
    unit: 'hours',
    min: 1,
    max: 168,
    defaultValue: 48,
    appliesTo: 'New invitations',
  },
  [SETTING_KEYS.PASSWORD_MIN_LENGTH]: {
    label: 'Minimum admin password length',
    description: 'Minimum password length required when an administrator activates an account.',
    type: 'number',
    unit: 'characters',
    min: 12,
    max: 128,
    defaultValue: 12,
    appliesTo: 'New password activations',
  },
});

const assertKnownKey = (key) => {
  if (!SETTING_DEFINITIONS[key]) {
    const error = new Error(`Unknown admin setting: ${key}`);
    error.status = 400;
    throw error;
  }
};

export const getSettingNumber = async (key) => {
  assertKnownKey(key);

  const document = await AdminSetting.findOne({ key }).lean();
  if (!document) return SETTING_DEFINITIONS[key].defaultValue;

  const value = Number(document.value);
  return Number.isFinite(value)
    ? value
    : SETTING_DEFINITIONS[key].defaultValue;
};

export const getSettingsSnapshot = async () => {
  const documents = await AdminSetting.find({
    key: { $in: Object.keys(SETTING_DEFINITIONS) },
  }).lean();

  const stored = new Map(documents.map((item) => [item.key, item]));

  return Object.entries(SETTING_DEFINITIONS).map(([key, definition]) => {
    const item = stored.get(key);
    return {
      key,
      label: definition.label,
      description: definition.description,
      type: definition.type,
      unit: definition.unit,
      min: definition.min,
      max: definition.max,
      value: Number.isFinite(Number(item?.value))
        ? Number(item.value)
        : definition.defaultValue,
      defaultValue: definition.defaultValue,
      appliesTo: definition.appliesTo,
      updatedAt: item?.updatedAt || null,
      updatedByAdminUserId: item?.updatedByAdminUserId?.toString?.() || null,
    };
  });
};

export const validateSettingsPayload = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    const error = new Error('Settings payload must be an object.');
    error.status = 400;
    throw error;
  }

  const normalized = {};

  Object.entries(payload).forEach(([key, rawValue]) => {
    assertKnownKey(key);

    const value = Number(rawValue);
    const definition = SETTING_DEFINITIONS[key];

    if (!Number.isInteger(value)) {
      const error = new Error(`${definition.label} must be a whole number.`);
      error.status = 400;
      throw error;
    }

    if (value < definition.min || value > definition.max) {
      const error = new Error(
        `${definition.label} must be between ${definition.min} and ${definition.max} ${definition.unit}.`
      );
      error.status = 400;
      throw error;
    }

    normalized[key] = value;
  });

  if (!Object.keys(normalized).length) {
    const error = new Error('At least one setting must be provided.');
    error.status = 400;
    throw error;
  }

  return normalized;
};
