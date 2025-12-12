/**
 * Email Service - Wrapper cho backward compatibility
 *
 * Sử dụng serviceQueueManager để add job vào NOTIFICATION_SERVICE queue
 */

import { serviceQueueManager } from '../queue/queue';
import { notificationService } from '../queue/notification';

const NOTIFICATION_SERVICE_NAME = 'NOTIFICATION_SERVICE';

/**
 * Email Service Class - Helper để add jobs vào NOTIFICATION_SERVICE queue
 */
class EmailService {
  /**
   * Send OTP email qua queue
   */
  async sendOTPEmail(to: string, otp: string): Promise<void> {
    await serviceQueueManager.addJob(NOTIFICATION_SERVICE_NAME, {
      method: 'sendOTPEmail',
      params: { to, otp, expiresInMinutes: 10 },
    });
    console.log(`[EmailService] OTP email job added for ${to}`);
  }

  /**
   * Send welcome email qua queue
   */
  async sendWelcomeEmail(to: string, name?: string): Promise<void> {
    try {
      await serviceQueueManager.addJob(NOTIFICATION_SERVICE_NAME, {
        method: 'sendWelcomeEmail',
        params: { to, name },
      });
      console.log(`[EmailService] Welcome email job added for ${to}`);
    } catch (error) {
      console.error('[EmailService] Failed to add welcome email job:', error);
    }
  }

  /**
   * Send custom email qua queue
   */
  async sendCustomEmail(options: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
  }): Promise<void> {
    await serviceQueueManager.addJob(NOTIFICATION_SERVICE_NAME, {
      method: 'sendCustomEmail',
      params: options,
    });
    console.log(`[EmailService] Custom email job added for ${options.to}`);
  }

  /**
   * Send password reset email qua queue
   */
  async sendPasswordResetEmail(options: {
    to: string;
    resetToken: string;
    resetUrl: string;
    expiresInMinutes?: number;
  }): Promise<void> {
    await serviceQueueManager.addJob(NOTIFICATION_SERVICE_NAME, {
      method: 'sendPasswordResetEmail',
      params: {
        to: options.to,
        resetToken: options.resetToken,
        resetUrl: options.resetUrl,
        expiresInMinutes: options.expiresInMinutes || 30,
      },
    });
    console.log(`[EmailService] Password reset email job added for ${options.to}`);
  }

  /**
   * Send notification (lưu DB + email nếu user bật) qua queue
   */
  async sendNotification(options: {
    email: string;
    title: string;
    message: string;
    data?: Record<string, any>;
    emailSubject?: string;
    emailHtml?: string;
  }): Promise<void> {
    await serviceQueueManager.addJob(NOTIFICATION_SERVICE_NAME, {
      method: 'processNotification',
      params: options,
    });
    console.log(`[EmailService] Notification job added for ${options.email}`);
  }

  /**
   * Send notification email only (không lưu DB) qua queue
   */
  async sendNotificationEmail(options: {
    to: string;
    title: string;
    message: string;
    actionUrl?: string;
    actionText?: string;
  }): Promise<void> {
    await serviceQueueManager.addJob(NOTIFICATION_SERVICE_NAME, {
      method: 'sendNotificationEmail',
      params: options,
    });
    console.log(`[EmailService] Notification email job added for ${options.to}`);
  }

  /**
   * Send report email qua queue
   */
  async sendReportEmail(options: {
    to: string | string[];
    reportTitle: string;
    reportContent: string;
    attachments?: Array<{
      filename: string;
      content?: Buffer | string;
      path?: string;
      contentType?: string;
    }>;
  }): Promise<void> {
    await serviceQueueManager.addJob(NOTIFICATION_SERVICE_NAME, {
      method: 'sendReportEmail',
      params: options,
    });
    console.log(`[EmailService] Report email job added for ${options.to}`);
  }

  /**
   * Send bulk notification qua queue
   */
  async sendBulkNotification(
    emails: string[],
    notification: {
      title: string;
      message: string;
      data?: Record<string, any>;
      emailSubject?: string;
      emailHtml?: string;
    }
  ): Promise<void> {
    await Promise.all(
      emails.map((email) =>
        serviceQueueManager.addJob(NOTIFICATION_SERVICE_NAME, {
          method: 'processNotification',
          params: { ...notification, email },
        })
      )
    );
    console.log(`[EmailService] Bulk notification jobs added for ${emails.length} emails`);
  }

  // ============================================
  // Direct methods (không qua queue)
  // ============================================

  async enableEmail(email: string) {
    return notificationService.enableEmail(email);
  }

  async disableEmail(email: string) {
    return notificationService.disableEmail(email);
  }

  async getEmailSettings(email: string) {
    return notificationService.getEmailSettings(email);
  }

  async getNotifications(email: string, options?: { limit?: number; skip?: number; unreadOnly?: boolean }) {
    return notificationService.getNotifications(email, options);
  }

  async countUnread(email: string) {
    return notificationService.countUnread(email);
  }

  async markAsRead(notificationId: string) {
    return notificationService.markAsRead(notificationId);
  }

  async markAllAsRead(email: string) {
    return notificationService.markAllAsRead(email);
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;

// Re-export notificationService for direct access
export { notificationService } from '../queue/notification';
