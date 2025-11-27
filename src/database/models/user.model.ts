import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * User document interface
 */
export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
  enabled: boolean;

  // 2FA Google Authenticator
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;

  // Email OTP
  emailOtp?: string;
  emailOtpExpires?: Date;

  // Session management
  lastLogin?: Date;
  currentTokenExpires?: Date;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Model interface for static methods
 */
export interface IUserModel extends Model<IUser> {
}

/**
 * User Schema
 */
const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // Email validation
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'user'],
      default: 'user',
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Google Authenticator 2FA
    twoFactorSecret: {
      type: String,
      required: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    // Email OTP
    emailOtp: {
      type: String,
      required: false,
    },
    emailOtpExpires: {
      type: Date,
      required: false,
    },
    // Session tracking
    lastLogin: {
      type: Date,
      required: false,
    },
    currentTokenExpires: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

/**
 * Indexes for performance
 */
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ enabled: 1 });

/**
 * User Model
 */
export const UserModel = mongoose.model<IUser, IUserModel>('User', UserSchema);

export default UserModel;
