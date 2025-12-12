/**
 * Notification Types - Gộp cả notification và email
 */

import { Document } from 'mongoose';

/**
 * Email Settings - Cấu hình nhận email theo email address
 */
export interface IEmailSettings {
  email: string;
  receiveEmail: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmailSettingsDocument extends IEmailSettings, Document {}

/**
 * Notification - Thông báo lưu trong DB
 */
export interface INotification {
  email: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  emailSent: boolean;
  emailSentAt?: Date;
  createdAt: Date;
}

export interface INotificationDocument extends INotification, Document {}

/**
 * Input để gửi notification
 */
export interface SendNotificationInput {
  email: string;
  title: string;
  message: string;
  data?: Record<string, any>;

  // Optional - Chỉ dành cho email (override nếu cần)
  emailSubject?: string;  // Nếu không có thì dùng title
  emailHtml?: string;     // Nếu không có thì tự wrap message vào template đẹp
}

/**
 * Kết quả sau khi gửi notification
 */
export interface SendNotificationResult {
  notification: INotificationDocument;
  emailSent: boolean;
  jobId?: string;
}

// ============================================
// EMAIL ONLY TYPES
// ============================================

/**
 * Base mail options
 */
export interface BaseMailOptions {
  to: string | string[];
  subject?: string;
}

/**
 * OTP Email
 */
export interface OTPMailOptions extends BaseMailOptions {
  otp: string;
  expiresInMinutes?: number;
}

/**
 * Welcome Email
 */
export interface WelcomeMailOptions extends BaseMailOptions {
  name?: string;
}

/**
 * Custom Email
 */
export interface CustomMailOptions extends BaseMailOptions {
  subject: string;
  html?: string;
  text?: string;
}

/**
 * Password Reset Email
 */
export interface PasswordResetMailOptions extends BaseMailOptions {
  resetToken: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

/**
 * Notification Email (cho sendEmailOnly)
 */
export interface NotificationMailOptions extends BaseMailOptions {
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}

/**
 * Report Email
 */
export interface ReportMailOptions extends BaseMailOptions {
  reportTitle: string;
  reportContent: string;
  attachments?: MailAttachment[];
}

/**
 * Mail Attachment
 */
export interface MailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
}

/**
 * Email Types
 */
export type EmailType =
  | 'otp'
  | 'welcome'
  | 'custom'
  | 'password-reset'
  | 'notification-email'
  | 'report';

/**
 * Union type cho email options
 */
export type EmailOnlyOptions =
  | { type: 'otp'; options: OTPMailOptions }
  | { type: 'welcome'; options: WelcomeMailOptions }
  | { type: 'custom'; options: CustomMailOptions }
  | { type: 'password-reset'; options: PasswordResetMailOptions }
  | { type: 'notification-email'; options: NotificationMailOptions }
  | { type: 'report'; options: ReportMailOptions };

// ============================================
// QUEUE JOB TYPES
// ============================================

/**
 * Job type cho queue
 */
export type NotificationJobType = 'notification' | 'email-only';

/**
 * Notification Job Data
 */
export interface NotificationJobData {
  jobType: 'notification';
  input: SendNotificationInput;
}

/**
 * Email Only Job Data
 */
export interface EmailOnlyJobData {
  jobType: 'email-only';
  emailType: EmailType;
  options: any;
}

/**
 * Union type cho tất cả job data
 */
export type QueueJobData = NotificationJobData | EmailOnlyJobData;

/**
 * Mail Config
 */
export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName: string;
}
