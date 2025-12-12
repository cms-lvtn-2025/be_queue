/**
 * Notification Models - Mongoose schemas
 */

import mongoose, { Schema, Model } from 'mongoose';
import {
  IEmailSettingsDocument,
  INotificationDocument,
} from './notification.types';

/**
 * Email Settings Schema
 * Lưu cấu hình nhận email theo email address
 */
const EmailSettingsSchema = new Schema<IEmailSettingsDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    receiveEmail: {
      type: Boolean,
      default: false, // Mặc định KHÔNG gửi email
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Notification Schema
 * Lưu thông báo để hiển thị trên web
 */
const NotificationSchema = new Schema<INotificationDocument>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying notifications by email and read status
NotificationSchema.index({ email: 1, isRead: 1, createdAt: -1 });

/**
 * Export models
 */
export const EmailSettingsModel: Model<IEmailSettingsDocument> =
  mongoose.models.EmailSettings ||
  mongoose.model<IEmailSettingsDocument>('EmailSettings', EmailSettingsSchema);

export const NotificationModel: Model<INotificationDocument> =
  mongoose.models.Notification ||
  mongoose.model<INotificationDocument>('Notification', NotificationSchema);
