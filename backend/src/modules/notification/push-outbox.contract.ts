import { PushOutboxStatus, PushErrorCategory, PushOutbox } from '../../entities/push-outbox.entity';

export interface PushSubscriptionItem {
  id: number;
  userId: number;
  endpoint: string;
  p256dh?: string;
  auth?: string;
  isActive: boolean;
}

export interface IPushSubscriptionProvider {
  getSubscriptionsForUser(userId: number): Promise<PushSubscriptionItem[]>;
  removeInvalidSubscriptions(subscriptionIds: number[]): Promise<void>;
}

export type SubscriptionDeliveryStatus =
  | 'ACCEPTED_BY_GATEWAY'
  | 'FAILED_RETRYABLE'
  | 'INVALID_410'
  | 'PERMANENT_FAILURE';

export interface SubscriptionDeliveryResult {
  subscriptionId: number;
  endpointHash: string;
  status: SubscriptionDeliveryStatus;
  httpCode?: number;
  error?: string;
}

export interface PushDispatchOutcome {
  results: SubscriptionDeliveryResult[];
}

export interface IPushDispatcher {
  dispatch(job: PushOutbox, subscriptions: PushSubscriptionItem[]): Promise<PushDispatchOutcome>;
}

export interface ClaimedPushJob {
  job: PushOutbox;
  leaseToken: string;
}

export interface SettleJobParams {
  jobId: number;
  leaseToken: string;
  status: PushOutboxStatus;
  attempts?: number;
  nextRetryAt?: Date | null;
  errorCategory?: PushErrorCategory;
  lastErrorMessage?: string | null;
  dispatchedAt?: Date | null;
  deliveryDetails?: Record<string, any> | null;
}

