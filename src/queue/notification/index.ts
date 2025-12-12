/**
 * Notification Module
 *
 * Đăng ký với serviceQueueManager.registerStaticQueue('NOTIFICATION_SERVICE', notificationService)
 */

export * from './notification.types';
export * from './notification.model';
export * from './notification.service';

// Default export
export { notificationService } from './notification.service';
