export declare enum OutboxStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    PUBLISHED = "PUBLISHED",
    FAILED = "FAILED"
}
export declare class OutboxEvent {
    id: number;
    event_id: string;
    event_name: string;
    event_version: string;
    aggregate_type: string;
    aggregate_id: number;
    correlation_id: string;
    transaction_id: string;
    payload: any;
    status: OutboxStatus;
    retry_count: number;
    error_message: string;
    created_at: Date;
    published_at: Date;
}
