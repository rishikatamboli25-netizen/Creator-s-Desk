import mongoose from 'mongoose';

const adminUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required() {
        return this.status !== 'INVITED';
      },
      select: false,
    },
    roleKey: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'INVITED'],
      default: 'ACTIVE',
      index: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    mfaSecretEncrypted: {
      type: String,
      default: null,
      select: false,
    },
    mfaPendingSecretEncrypted: {
      type: String,
      default: null,
      select: false,
    },
    mfaBackupCodeHashes: {
      type: [String],
      default: [],
      select: false,
    },
    mfaBackupCodesGeneratedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model('AdminUser', adminUserSchema);
