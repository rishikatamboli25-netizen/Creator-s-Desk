import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const ISSUER = "Creator's Desk";

const requireEncryptionKey = () => {
  if (!config.mfaEncryptionKey || config.mfaEncryptionKey.length < 16) {
    const error = new Error('ADMIN_MFA_ENCRYPTION_KEY is not configured securely.');
    error.status = 503;
    throw error;
  }
};

const encryptionKey = () => {
  requireEncryptionKey();
  return crypto
    .createHash('sha256')
    .update(config.mfaEncryptionKey)
    .digest();
};

const encodeBase32 = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

const decodeBase32 = (input) => {
  const clean = String(input || '')
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '');

  let bits = 0;
  let value = 0;
  const bytes = [];

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) continue;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
};

const encryptSecret = (secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);

  return JSON.stringify({
    v: 1,
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: encrypted.toString('hex'),
  });
};

const decryptSecret = (payload) => {
  if (!payload) return null;
  requireEncryptionKey();

  let parsed;
  try {
    parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch {
    throw new Error('Stored MFA secret is invalid.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(parsed.iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'));

  return Buffer.concat([
    decipher.update(Buffer.from(parsed.data, 'hex')),
    decipher.final(),
  ]).toString('utf8');
};

const hotp = (secret, counter) => {
  const key = decodeBase32(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);

  const digest = crypto
    .createHmac('sha1', key)
    .update(buffer)
    .digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];

  return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
};

export const verifyTotp = (secret, code, window = 1) => {
  const normalized = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;

  const currentCounter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);

  for (let offset = -window; offset <= window; offset += 1) {
    if (hotp(secret, currentCounter + offset) === normalized) return true;
  }

  return false;
};

const generateBackupCodes = (count = 10) =>
  Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });

const hashBackupCodes = async (codes) =>
  Promise.all(codes.map((code) => bcrypt.hash(code.replace('-', ''), 12)));

const verifyBackupCode = async (code, hashes) => {
  const normalized = String(code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!normalized || !Array.isArray(hashes) || !hashes.length) return -1;

  for (let index = 0; index < hashes.length; index += 1) {
    if (await bcrypt.compare(normalized, hashes[index])) return index;
  }

  return -1;
};

export const verifyMfaCredential = async (adminUser, credential) => {
  const secret = decryptSecret(adminUser.mfaSecretEncrypted);
  if (secret && verifyTotp(secret, credential)) {
    return { valid: true, type: 'TOTP' };
  }

  const index = await verifyBackupCode(
    credential,
    adminUser.mfaBackupCodeHashes || []
  );

  if (index >= 0) {
    adminUser.mfaBackupCodeHashes.splice(index, 1);
    return { valid: true, type: 'RECOVERY_CODE' };
  }

  return { valid: false, type: null };
};

export const createMfaSetup = (email) => {
  requireEncryptionKey();

  const secret = encodeBase32(crypto.randomBytes(20));
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  const issuer = encodeURIComponent(ISSUER);
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

  return {
    secret,
    uri,
    encryptedSecret: encryptSecret(secret),
  };
};

export const decryptMfaSecret = decryptSecret;
export const generateMfaBackupCodes = generateBackupCodes;
export const hashMfaBackupCodes = hashBackupCodes;
