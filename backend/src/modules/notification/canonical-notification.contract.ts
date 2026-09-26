import { Notification } from '../../entities/notification.entity';

export class CanonicalNotificationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'CanonicalNotificationError';
  }
}

export type CanonicalNotificationType = 'ALERT' | 'SYSTEM' | 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';

export interface CanonicalNotificationInput {
  eventId: string;
  recipientId: number;
  purpose: string;
  title: string;
  message: string;
  type?: CanonicalNotificationType | string;
  actionTarget?: string;
  metaData?: Record<string, any>;
  sendEmail?: boolean;
}

export interface CanonicalNotificationResult {
  status: 'PERSISTED' | 'DUPLICATE_SUPPRESSED';
  notification?: Notification;
  notificationId?: number;
  dedupeKey: string;
  eventId: string;
  recipientId: number;
  purpose: string;
}

export interface CanonicalProjectionConfig {
  purpose: string;
  title: string | ((event: any) => string);
  message: string | ((event: any) => string);
  type?: CanonicalNotificationType | string;
  actionTarget?: string | ((event: any) => string);
  recipientIds?: number[];
  sendEmail?: boolean;
  metaData?: Record<string, any> | ((event: any) => Record<string, any>);
}
