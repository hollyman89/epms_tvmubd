import { EventEmitter2 } from '@nestjs/event-emitter';
export declare function emitLegalQueueUpdated(eventEmitter: EventEmitter2, payload: {
    type?: string;
    action?: string;
    tenderId?: number;
    contractId?: number;
    title?: string;
}): void;
