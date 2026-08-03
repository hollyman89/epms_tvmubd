export declare class AuditLog {
    id: number;
    table_name: string;
    record_id: number;
    action: string;
    old_value: any;
    new_value: any;
    ip_address: string;
    user_agent: string;
    created_by: number;
    created_at: Date;
}
