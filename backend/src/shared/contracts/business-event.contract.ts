export enum NotificationPolicy {
  SYNC_ONLY = 'SYNC_ONLY',
  NOTIFICATION_AND_SYNC = 'NOTIFICATION_AND_SYNC',
  NOTIFICATION_ONLY = 'NOTIFICATION_ONLY',
}

export enum OutboxDeliveryOutcome {
  DELIVERED = 'DELIVERED',
  INTENTIONALLY_IGNORED = 'INTENTIONALLY_IGNORED',
  NO_SUBSCRIBER = 'NO_SUBSCRIBER',
  RETRYABLE_FAILURE = 'RETRYABLE_FAILURE',
  PERMANENT_FAILURE = 'PERMANENT_FAILURE',
}

export type OutboxConsumerChannel =
  | 'CANONICAL_NOTIFICATION'
  | 'BUSINESS_SYNC'
  | 'DOMAIN_LISTENER';

export interface OutboxConsumerDeliveryReceipt {
  __outboxContract: true;
  channel: OutboxConsumerChannel;
  outcome: OutboxDeliveryOutcome;
  reason?: string;
  deliveredCount?: number;
}

export class OutboxPermanentFailureError extends Error {
  readonly outcome = OutboxDeliveryOutcome.PERMANENT_FAILURE;
  readonly permanent = true;

  constructor(message: string) {
    super(message);
    this.name = 'OutboxPermanentFailureError';
  }
}

export function attachOutboxReceipt<T extends object>(
  target: T,
  receipt: OutboxConsumerDeliveryReceipt,
): T {
  Object.defineProperty(target, '__outboxReceipt', {
    value: receipt,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return target;
}

export function extractOutboxReceipt(
  value: unknown,
): OutboxConsumerDeliveryReceipt | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const direct = value as Partial<OutboxConsumerDeliveryReceipt>;
  if (
    direct.__outboxContract === true &&
    typeof direct.outcome === 'string' &&
    typeof direct.channel === 'string'
  ) {
    return direct as OutboxConsumerDeliveryReceipt;
  }
  const attached = (value as { __outboxReceipt?: unknown }).__outboxReceipt;
  if (attached && typeof attached === 'object') {
    const receipt = attached as Partial<OutboxConsumerDeliveryReceipt>;
    if (
      receipt.__outboxContract === true &&
      typeof receipt.outcome === 'string' &&
      typeof receipt.channel === 'string'
    ) {
      return receipt as OutboxConsumerDeliveryReceipt;
    }
  }
  return null;
}

export interface RoutingMetadata {
  userIds?: number[];
  roles?: string[];
  projectId?: number;
}

export interface BusinessEventActor {
  userId: number;
  roles?: string[];
}

export interface BusinessEvent<TPayload = unknown> {
  eventId: string;
  eventName: string;
  eventVersion: number;

  occurredAt: string;

  aggregateType: string;
  aggregateId: string | number;

  projectId?: number;

  actor?: BusinessEventActor;

  correlationId?: string;

  routing?: RoutingMetadata;
  notificationPolicy?: NotificationPolicy;

  payload: TPayload;
}
