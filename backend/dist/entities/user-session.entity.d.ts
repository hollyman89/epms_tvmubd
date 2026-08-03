import { User } from './user.entity';
export declare class UserSession {
    id: number;
    user_id: number;
    device_fingerprint: string;
    device_id: string;
    ip_address: string;
    user_agent: string;
    last_activity: Date;
    is_active: boolean;
    user: User;
    created_at: Date;
    updated_at: Date;
}
