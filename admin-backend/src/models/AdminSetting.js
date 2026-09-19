import mongoose from 'mongoose';

const adminSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    value: {
      type: Number,
      required: true,
    },
    updatedByAdminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model('AdminSetting', adminSettingSchema);
