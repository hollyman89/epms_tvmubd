import { NotificationGateway } from './notification.gateway';
export declare class NotificationListener {
    private readonly notificationGateway;
    private readonly logger;
    constructor(notificationGateway: NotificationGateway);
    handleTenderWonEvent(payload: {
        contractId?: number;
        tenderId: number;
        customerId?: number;
        title?: string;
    }): void;
    handleContractApprovedEvent(payload: any): void;
    handleQueueUpdatedEvent(payload: any): void;
}
