export enum NotificationPolicy {
  SYNC_ONLY = 'SYNC_ONLY',
  NOTIFICATION_AND_SYNC = 'NOTIFICATION_AND_SYNC',
  NOTIFICATION_ONLY = 'NOTIFICATION_ONLY',
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
