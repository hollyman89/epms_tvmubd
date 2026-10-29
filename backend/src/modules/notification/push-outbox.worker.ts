import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional, Inject } from '@nestjs/common';
import { PushOutboxService } from './push-outbox.service';
import {
  IPushSubscriptionProvider,
  IPushDispatcher,
  PushSubscriptionItem,
  PushDispatchOutcome,
  SubscriptionDeliveryResult,
} from './push-outbox.contract';
import {
  PushOutbox,
  PushOutboxStatus,
  PushErrorCategory,
} from '../../entities/push-outbox.entity';

@Injectable()
export class PushOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushOutboxWorker.name);
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;

  private subscriptionProvider: IPushSubscriptionProvider;
  private dispatcher: IPushDispatcher;

  constructor(
    private readonly outboxService: PushOutboxService,
    @Optional()
    @Inject('PUSH_SUBSCRIPTION_PROVIDER')
    injectedSubscriptionProvider?: IPushSubscriptionProvider,
    @Optional()
    @Inject('PUSH_DISPATCHER')
    injectedDispatcher?: IPushDispatcher,
  ) {
    // Default subscription provider for Stage 3A: returns empty subscriptions
    this.subscriptionProvider = injectedSubscriptionProvider || {
      getSubscriptionsForUser: async () => [],
      removeInvalidSubscriptions: async () => {},
    };

    // Default dispatcher for Stage 3A (Stub, RFC 8291 network dispatch is in Stage 3B)
    this.dispatcher = injectedDispatcher || {
      dispatch: async (_job: PushOutbox, subscriptions: PushSubscriptionItem[]) => ({
        results: subscriptions.map((sub) => ({
          subscriptionId: sub.id,
          endpointHash: 'stage3a-stub',
          status: 'ACCEPTED_BY_GATEWAY',
          httpCode: 201,
        })),
      }),
    };
  }

  public setSubscriptionProvider(provider: IPushSubscriptionProvider): void {
    this.subscriptionProvider = provider;
  }

  public setDispatcher(dispatcher: IPushDispatcher): void {
    this.dispatcher = dispatcher;
  }

  public onModuleInit(): void {
    const isWorkerEnabled = process.env.PUSH_WORKER_ENABLED === 'true';
    if (isWorkerEnabled) {
      const pollIntervalMs = parseInt(process.env.PUSH_POLL_INTERVAL_MS || '5000', 10);
      this.timer = setInterval(() => {
        this.pollAndProcess().catch((err) => {
          this.logger.error(`[PushOutboxWorker] Error during polling tick: ${err.message}`, err.stack);
        });
      }, pollIntervalMs);
      this.logger.log(`[PushOutboxWorker] Started polling worker with interval ${pollIntervalMs}ms`);
    }
  }

  public onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Main polling execution loop:
   * 1. Fase A: Claim batch with FOR UPDATE SKIP LOCKED
   * 2. For each job: Fase B, C, D
   */
  public async pollAndProcess(batchSize = 20): Promise<number> {
    if (this.isProcessing) {
      this.logger.debug('[PushOutboxWorker] Previous poll still in progress, skipping tick.');
      return 0;
    }

    this.isProcessing = true;
    let processedCount = 0;

    try {
      // Fase A: Claim batch
      const claimedJobs = await this.outboxService.claimBatch(batchSize);
      if (!claimedJobs || claimedJobs.length === 0) {
        return 0;
      }

      for (const { job, leaseToken } of claimedJobs) {
        try {
          await this.processSingleJob(job, leaseToken);
          processedCount++;
        } catch (jobErr: any) {
          this.logger.error(
            `[PushOutboxWorker] Unexpected error processing job id=${job.id}: ${jobErr.message}`,
            jobErr.stack,
          );
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return processedCount;
  }

  /**
   * Process a single claimed job through Fase B, C, D.
   */
  public async processSingleJob(job: PushOutbox, leaseToken: string): Promise<boolean> {
    // Fase B: Subscription Lookup (Read Connection Singkat)
    const allSubscriptions = await this.subscriptionProvider.getSubscriptionsForUser(job.recipientId);

    // If recipient has zero active registered subscriptions:
    if (!allSubscriptions || allSubscriptions.length === 0) {
      return this.outboxService.settleJob({
        jobId: job.id,
        leaseToken,
        status: PushOutboxStatus.NO_SUBSCRIPTION,
        dispatchedAt: new Date(),
        deliveryDetails: {
          total_subscriptions: 0,
          dispatched_count: 0,
          pending_retry_count: 0,
          results: [],
        },
        errorCategory: PushErrorCategory.NONE,
      });
    }

    // Identify already successful subscriptions from prior delivery_details
    const priorResults: SubscriptionDeliveryResult[] =
      job.deliveryDetails && Array.isArray(job.deliveryDetails.results)
        ? job.deliveryDetails.results
        : [];

    const successfulSubIds = new Set(
      priorResults
        .filter((r) => r.status === 'ACCEPTED_BY_GATEWAY')
        .map((r) => r.subscriptionId),
    );

    // Partial retry filter: Only dispatch to subscriptions that haven't succeeded yet
    const pendingSubscriptions = allSubscriptions.filter(
      (sub) => !successfulSubIds.has(sub.id),
    );

    if (pendingSubscriptions.length === 0) {
      // All subscriptions already succeeded
      return this.outboxService.settleJob({
        jobId: job.id,
        leaseToken,
        status: PushOutboxStatus.ACCEPTED_BY_GATEWAY,
        dispatchedAt: new Date(),
        deliveryDetails: {
          total_subscriptions: allSubscriptions.length,
          dispatched_count: allSubscriptions.length,
          pending_retry_count: 0,
          results: priorResults,
        },
        errorCategory: PushErrorCategory.NONE,
      });
    }

    // Fase C: Network Dispatch Boundary (Zero Open DB Transaction)
    let dispatchOutcome: PushDispatchOutcome;
    try {
      dispatchOutcome = await this.dispatcher.dispatch(job, pendingSubscriptions);
    } catch (dispatchErr: any) {
      // Network/dispatch exception occurred before receiving individual responses
      dispatchOutcome = {
        results: pendingSubscriptions.map((sub) => ({
          subscriptionId: sub.id,
          endpointHash: `sub-${sub.id}`,
          status: 'FAILED_RETRYABLE',
          error: dispatchErr.message || 'DISPATCH_EXCEPTION',
        })),
      };
    }

    // Fase D: Settle Outcome (Transaksi DB Baru Singkat)
    const newAttempts = job.attempts + 1;

    // Merge prior successful results with new dispatch results
    const combinedResults: SubscriptionDeliveryResult[] = [
      ...priorResults.filter((r) => r.status === 'ACCEPTED_BY_GATEWAY'),
      ...dispatchOutcome.results,
    ];

    const invalidSubIds = dispatchOutcome.results
      .filter((r) => r.status === 'INVALID_410')
      .map((r) => r.subscriptionId);

    // Clean up invalid subscriptions if any (strictly on confirmed 404/410 from push provider)
    if (invalidSubIds.length > 0) {
      try {
        await this.subscriptionProvider.removeInvalidSubscriptions(invalidSubIds);
      } catch (cleanupErr: any) {
        this.logger.warn(
          `[PushOutboxWorker] Failed to remove invalid subscriptions: ${cleanupErr.message}`,
        );
      }
    }

    const hasRetryableFailure = combinedResults.some(
      (r) => r.status === 'FAILED_RETRYABLE',
    );
    const hasSuccessful = combinedResults.some(
      (r) => r.status === 'ACCEPTED_BY_GATEWAY',
    );
    const allInvalid =
      combinedResults.length > 0 &&
      combinedResults.every((r) => r.status === 'INVALID_410');

    let finalStatus: PushOutboxStatus;
    let nextRetryAt: Date | null = null;
    let errorCategory: PushErrorCategory = PushErrorCategory.NONE;
    let lastErrorMessage: string | null = null;
    let dispatchedAt: Date | null = null;

    if (!hasRetryableFailure && !allInvalid && hasSuccessful) {
      // 1. All subscriptions succeeded
      finalStatus = PushOutboxStatus.ACCEPTED_BY_GATEWAY;
      dispatchedAt = new Date();
      errorCategory = PushErrorCategory.NONE;
    } else if (allInvalid) {
      // 2. All subscriptions invalid
      finalStatus = PushOutboxStatus.PERMANENT_FAILURE;
      errorCategory = PushErrorCategory.INVALID_SUBSCRIPTION_410;
      lastErrorMessage = 'All subscriptions invalid (410 Gone)';
    } else if (hasRetryableFailure) {
      if (newAttempts < job.maxAttempts) {
        // 3. Retryable failure within retry limit
        finalStatus = PushOutboxStatus.FAILED_RETRYABLE;
        const backoffSeconds = this.outboxService.calculateBackoffSeconds(newAttempts);
        nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);

        // Classify representative error category
        const firstFailed = combinedResults.find((r) => r.status === 'FAILED_RETRYABLE');
        errorCategory = this.classifyError(firstFailed);
        lastErrorMessage = firstFailed?.error || 'Transient gateway error';
      } else {
        // 4. Exceeded maximum attempts
        finalStatus = PushOutboxStatus.PERMANENT_FAILURE;
        errorCategory = PushErrorCategory.EXCEEDED_MAX_ATTEMPTS;
        lastErrorMessage = 'Exceeded maximum retry attempts';
      }
    } else {
      // 5. Permanent failure (e.g., VAPID_ERROR or SSRF_REJECTED)
      finalStatus = PushOutboxStatus.PERMANENT_FAILURE;
      const firstPermFailed = combinedResults.find(
        (r) => r.status === 'PERMANENT_FAILURE',
      );
      errorCategory = this.classifyError(firstPermFailed);
      lastErrorMessage = firstPermFailed?.error || 'Unknown delivery outcome';
    }

    const pendingRetryCount = finalStatus === PushOutboxStatus.FAILED_RETRYABLE
      ? combinedResults.filter((r) => r.status === 'FAILED_RETRYABLE').length
      : 0;
    const dispatchedCount = combinedResults.filter(
      (r) => r.status === 'ACCEPTED_BY_GATEWAY',
    ).length;

    return this.outboxService.settleJob({
      jobId: job.id,
      leaseToken,
      status: finalStatus,
      attempts: newAttempts,
      nextRetryAt,
      errorCategory,
      lastErrorMessage,
      dispatchedAt,
      deliveryDetails: {
        total_subscriptions: allSubscriptions.length,
        dispatched_count: dispatchedCount,
        pending_retry_count: pendingRetryCount,
        results: combinedResults,
      },
    });
  }

  private classifyError(result?: SubscriptionDeliveryResult): PushErrorCategory {
    if (!result) return PushErrorCategory.UNKNOWN_ERROR;

    if (result.httpCode === 429) {
      return PushErrorCategory.RATE_LIMIT_429;
    }
    if (result.httpCode && result.httpCode >= 500 && result.httpCode <= 599) {
      return PushErrorCategory.GATEWAY_5XX;
    }
    if (result.error?.includes('ETIMEDOUT') || result.error?.includes('timeout')) {
      return PushErrorCategory.NETWORK_TIMEOUT;
    }
    if (result.error?.includes('ECONNRESET')) {
      return PushErrorCategory.CONNECTION_RESET;
    }
    if (result.error?.includes('VAPID')) {
      return PushErrorCategory.VAPID_ERROR;
    }
    if (result.error?.includes('SSRF')) {
      return PushErrorCategory.SSRF_REJECTED;
    }

    return PushErrorCategory.UNKNOWN_ERROR;
  }
}

