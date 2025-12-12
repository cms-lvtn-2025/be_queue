/**
 * Notification Service - Đăng ký với serviceQueueManager.registerStaticQueue()
 *
 * Service này xử lý:
 * - notification: Lưu DB + gửi email nếu user bật
 * - email-only: Chỉ gửi email (OTP, Welcome, Custom, etc.)
 */

import nodemailer from 'nodemailer';
import { EmailSettingsModel, NotificationModel } from './notification.model';
import {
  SendNotificationInput,
  IEmailSettingsDocument,
  INotificationDocument,
  OTPMailOptions,
  WelcomeMailOptions,
  CustomMailOptions,
  PasswordResetMailOptions,
  NotificationMailOptions,
  ReportMailOptions,
  MailConfig,
  MailAttachment,
} from './notification.types';

// Mail configuration
const mailConfig: MailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.EMAIL_FROM || process.env.SMTP_USER || '',
  fromName: process.env.EMAIL_FROM_NAME || 'Plagiarism Checker Service',
};

// ============================================
// EMAIL TEMPLATES
// ============================================

const baseStyles = `
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  .container { background-color: #f9f9f9; border-radius: 10px; padding: 30px; border: 1px solid #ddd; }
  .header { text-align: center; margin-bottom: 20px; }
  .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
  .button { display: inline-block; padding: 12px 24px; background-color: #2c3e50; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 15px 0; }
  .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
  .otp-code { background-color: #2c3e50; color: #fff; font-size: 32px; font-weight: bold; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0; letter-spacing: 5px; }
`;

function getOTPTemplate(options: OTPMailOptions) {
  const expiresIn = options.expiresInMinutes || 10;
  return {
    subject: options.subject || 'Your OTP Code - Plagiarism Checker',
    html: `<!DOCTYPE html><html><head><style>${baseStyles}</style></head><body>
      <div class="container">
        <div class="header"><h2>Your OTP Code</h2></div>
        <p>You have requested to login to Plagiarism Checker Service.</p>
        <p>Your one-time password (OTP) is:</p>
        <div class="otp-code">${options.otp}</div>
        <div class="warning">
          <strong>⚠️ Important:</strong>
          <ul>
            <li>This code will expire in <strong>${expiresIn} minutes</strong></li>
            <li>Do not share this code with anyone</li>
            <li>If you didn't request this code, please ignore this email</li>
          </ul>
        </div>
        <p>For security reasons, this code can only be used once.</p>
        <div class="footer"><p>This is an automated email from Plagiarism Checker Service</p></div>
      </div>
    </body></html>`,
    text: `Your OTP Code: ${options.otp}\nThis code will expire in ${expiresIn} minutes.`,
  };
}

function getWelcomeTemplate(options: WelcomeMailOptions) {
  const name = options.name || 'User';
  return {
    subject: options.subject || 'Welcome to Plagiarism Checker Service',
    html: `<!DOCTYPE html><html><head><style>${baseStyles}</style></head><body>
      <div class="container">
        <div class="header"><h2>Welcome to Plagiarism Checker Service!</h2></div>
        <p>Hello ${name},</p>
        <p>Your account has been created successfully.</p>
        <p>You can now login using your email and password.</p>
        <p>For security, we recommend setting up 2-Factor Authentication (2FA) on your first login.</p>
        <br><p>Best regards,<br>Plagiarism Checker Team</p>
        <div class="footer"><p>This is an automated email from Plagiarism Checker Service</p></div>
      </div>
    </body></html>`,
    text: `Welcome ${name}! Your account has been created successfully.`,
  };
}

function getPasswordResetTemplate(options: PasswordResetMailOptions) {
  const expiresIn = options.expiresInMinutes || 30;
  return {
    subject: options.subject || 'Password Reset Request - Plagiarism Checker',
    html: `<!DOCTYPE html><html><head><style>${baseStyles}</style></head><body>
      <div class="container">
        <div class="header"><h2>Password Reset Request</h2></div>
        <p>We received a request to reset your password.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center;"><a href="${options.resetUrl}" class="button">Reset Password</a></div>
        <p>Or copy and paste this link: <span style="color: #2c3e50;">${options.resetUrl}</span></p>
        <div class="warning">
          <strong>⚠️ Important:</strong>
          <ul>
            <li>This link will expire in <strong>${expiresIn} minutes</strong></li>
            <li>If you didn't request this, please ignore this email</li>
          </ul>
        </div>
        <div class="footer"><p>This is an automated email from Plagiarism Checker Service</p></div>
      </div>
    </body></html>`,
    text: `Password Reset Link: ${options.resetUrl}\nExpires in ${expiresIn} minutes.`,
  };
}

function getNotificationEmailTemplate(options: NotificationMailOptions) {
  const actionButton = options.actionUrl
    ? `<div style="text-align: center;"><a href="${options.actionUrl}" class="button">${options.actionText || 'View Details'}</a></div>`
    : '';
  return {
    subject: options.subject || options.title,
    html: `<!DOCTYPE html><html><head><style>${baseStyles}</style></head><body>
      <div class="container">
        <div class="header"><h2>${options.title}</h2></div>
        <p>${options.message}</p>
        ${actionButton}
        <div class="footer"><p>This is an automated email from Plagiarism Checker Service</p></div>
      </div>
    </body></html>`,
    text: `${options.title}\n\n${options.message}${options.actionUrl ? `\n\nView: ${options.actionUrl}` : ''}`,
  };
}

function getReportTemplate(options: ReportMailOptions) {
  return {
    subject: options.subject || options.reportTitle,
    html: `<!DOCTYPE html><html><head><style>${baseStyles}</style></head><body>
      <div class="container">
        <div class="header"><h2>${options.reportTitle}</h2></div>
        <div style="background:#fff;border:1px solid #ddd;border-radius:5px;padding:20px;margin:20px 0;">
          ${options.reportContent}
        </div>
        ${options.attachments?.length ? '<p><strong>Attachments:</strong> ' + options.attachments.map(a => a.filename).join(', ') + '</p>' : ''}
        <div class="footer"><p>This is an automated email from Plagiarism Checker Service</p></div>
      </div>
    </body></html>`,
    text: `${options.reportTitle}\n\n${options.reportContent.replace(/<[^>]*>/g, '')}`,
  };
}

/**
 * Notification Service Class
 * Đăng ký với serviceQueueManager.registerStaticQueue('NOTIFICATION_SERVICE', notificationService)
 */
class NotificationService {
  private transporter: nodemailer.Transporter | null = null;

  /**
   * Initialize email transporter
   */
  private async initTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) return this.transporter;

    this.transporter = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.secure,
      auth: { user: mailConfig.user, pass: mailConfig.pass },
    });

    try {
      await this.transporter.verify();
      console.log('[NotificationService] Email transporter initialized');
    } catch (error) {
      console.error('[NotificationService] Failed to initialize transporter:', error);
      throw error;
    }

    return this.transporter;
  }

  // ============================================
  // METHODS ĐƯỢC GỌI TỪ QUEUE (qua job.data.method)
  // ============================================

  /**
   * Xử lý notification job - được gọi từ queue worker
   * Lưu DB + gửi email nếu user bật receiveEmail
   */
  async processNotification(params: SendNotificationInput): Promise<any> {
    const { email, title, message, data, emailSubject, emailHtml } = params;
    const normalizedEmail = email.toLowerCase();

    console.log(`[NotificationService] Processing notification for ${normalizedEmail}`);

    // 1. Lưu notification vào DB (luôn luôn)
    const notification = await NotificationModel.create({
      email: normalizedEmail,
      title,
      message,
      data,
      isRead: false,
      emailSent: false,
    });

    console.log(`[NotificationService] Saved to DB: ${notification._id}`);

    // 2. Check email settings
    let settings = await EmailSettingsModel.findOne({ email: normalizedEmail });
    if (!settings) {
      settings = await EmailSettingsModel.create({ email: normalizedEmail, receiveEmail: false });
      console.log(`[NotificationService] Created default settings (receiveEmail=false)`);
    }

    // 3. Gửi email nếu receiveEmail = true
    if (settings.receiveEmail) {
      const transporter = await this.initTransporter();

      const subject = emailSubject || title;
      let html: string;
      let text: string;

      if (emailHtml) {
        html = emailHtml;
        text = message;
      } else {
        const template = getNotificationEmailTemplate({
          to: normalizedEmail,
          title,
          message,
          actionUrl: data?.url || data?.actionUrl,
          actionText: data?.actionText || 'Xem chi tiết',
        });
        html = template.html;
        text = template.text;
      }

      const info = await transporter.sendMail({
        from: `"${mailConfig.fromName}" <${mailConfig.from}>`,
        to: normalizedEmail,
        subject,
        html,
        text,
      });

      await NotificationModel.findByIdAndUpdate(notification._id, {
        emailSent: true,
        emailSentAt: new Date(),
      });

      console.log(`[NotificationService] Email sent: ${info.messageId}`);
      return { notificationId: notification._id, emailSent: true, messageId: info.messageId };
    }

    console.log(`[NotificationService] Email disabled, skipped`);
    return { notificationId: notification._id, emailSent: false };
  }

  /**
   * Gửi OTP email - được gọi từ queue worker
   */
  async sendOTPEmail(params: OTPMailOptions): Promise<any> {
    const transporter = await this.initTransporter();
    const template = getOTPTemplate(params);
    const to = Array.isArray(params.to) ? params.to.join(', ') : params.to;

    const info = await transporter.sendMail({
      from: `"${mailConfig.fromName}" <${mailConfig.from}>`,
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    console.log(`[NotificationService] OTP email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  }

  /**
   * Gửi Welcome email - được gọi từ queue worker
   */
  async sendWelcomeEmail(params: WelcomeMailOptions): Promise<any> {
    const transporter = await this.initTransporter();
    const template = getWelcomeTemplate(params);
    const to = Array.isArray(params.to) ? params.to.join(', ') : params.to;

    const info = await transporter.sendMail({
      from: `"${mailConfig.fromName}" <${mailConfig.from}>`,
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    console.log(`[NotificationService] Welcome email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  }

  /**
   * Gửi Custom email - được gọi từ queue worker
   */
  async sendCustomEmail(params: CustomMailOptions): Promise<any> {
    const transporter = await this.initTransporter();
    const to = Array.isArray(params.to) ? params.to.join(', ') : params.to;

    const info = await transporter.sendMail({
      from: `"${mailConfig.fromName}" <${mailConfig.from}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    console.log(`[NotificationService] Custom email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  }

  /**
   * Gửi Password Reset email - được gọi từ queue worker
   */
  async sendPasswordResetEmail(params: PasswordResetMailOptions): Promise<any> {
    const transporter = await this.initTransporter();
    const template = getPasswordResetTemplate(params);
    const to = Array.isArray(params.to) ? params.to.join(', ') : params.to;

    const info = await transporter.sendMail({
      from: `"${mailConfig.fromName}" <${mailConfig.from}>`,
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    console.log(`[NotificationService] Password reset email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  }

  /**
   * Gửi Notification email (chỉ email, không lưu DB) - được gọi từ queue worker
   */
  async sendNotificationEmail(params: NotificationMailOptions): Promise<any> {
    const transporter = await this.initTransporter();
    const template = getNotificationEmailTemplate(params);
    const to = Array.isArray(params.to) ? params.to.join(', ') : params.to;

    const info = await transporter.sendMail({
      from: `"${mailConfig.fromName}" <${mailConfig.from}>`,
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    console.log(`[NotificationService] Notification email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  }

  /**
   * Gửi Report email - được gọi từ queue worker
   */
  async sendReportEmail(params: ReportMailOptions): Promise<any> {
    const transporter = await this.initTransporter();
    const template = getReportTemplate(params);
    const to = Array.isArray(params.to) ? params.to.join(', ') : params.to;

    const info = await transporter.sendMail({
      from: `"${mailConfig.fromName}" <${mailConfig.from}>`,
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      attachments: params.attachments?.map((att: MailAttachment) => ({
        filename: att.filename,
        content: att.content,
        path: att.path,
        contentType: att.contentType,
      })),
    });

    console.log(`[NotificationService] Report email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  }

  // ============================================
  // EMAIL SETTINGS METHODS (gọi trực tiếp, không qua queue)
  // ============================================

  async getEmailSettings(email: string): Promise<IEmailSettingsDocument> {
    const normalizedEmail = email.toLowerCase();
    let settings = await EmailSettingsModel.findOne({ email: normalizedEmail });

    if (!settings) {
      settings = await EmailSettingsModel.create({
        email: normalizedEmail,
        receiveEmail: false,
      });
    }

    return settings;
  }

  async updateEmailSettings(email: string, receiveEmail: boolean): Promise<IEmailSettingsDocument> {
    const normalizedEmail = email.toLowerCase();
    const settings = await EmailSettingsModel.findOneAndUpdate(
      { email: normalizedEmail },
      { receiveEmail },
      { new: true, upsert: true }
    );

    console.log(`[NotificationService] Updated ${email}: receiveEmail=${receiveEmail}`);
    return settings;
  }

  async enableEmail(email: string): Promise<IEmailSettingsDocument> {
    return this.updateEmailSettings(email, true);
  }

  async disableEmail(email: string): Promise<IEmailSettingsDocument> {
    return this.updateEmailSettings(email, false);
  }

  // ============================================
  // NOTIFICATION HELPERS (gọi trực tiếp, không qua queue)
  // ============================================

  async getNotifications(
    email: string,
    options?: { limit?: number; skip?: number; unreadOnly?: boolean }
  ): Promise<INotificationDocument[]> {
    const query: any = { email: email.toLowerCase() };
    if (options?.unreadOnly) query.isRead = false;

    return NotificationModel.find(query)
      .sort({ createdAt: -1 })
      .skip(options?.skip || 0)
      .limit(options?.limit || 50);
  }

  async countUnread(email: string): Promise<number> {
    return NotificationModel.countDocuments({
      email: email.toLowerCase(),
      isRead: false,
    });
  }

  async markAsRead(notificationId: string): Promise<INotificationDocument | null> {
    return NotificationModel.findByIdAndUpdate(
      notificationId,
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  }

  async markAllAsRead(email: string): Promise<number> {
    const result = await NotificationModel.updateMany(
      { email: email.toLowerCase(), isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return result.modifiedCount;
  }
}

// Singleton instance - sẽ được đăng ký với serviceQueueManager
export const notificationService = new NotificationService();
