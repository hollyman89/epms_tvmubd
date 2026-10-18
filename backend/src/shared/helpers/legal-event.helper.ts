import { EventEmitter2 } from '@nestjs/event-emitter';

export function emitLegalQueueUpdated(
  eventEmitter: EventEmitter2,
  payload: { type?: string; action?: string; tenderId?: number; contractId?: number; title?: string }
) {
  try {
    eventEmitter.emit('legal.queue.updated', {
      ...payload,
      timestamp: new Date().toISOString()
    });
  } catch (eventErr) {
    console.error(`[Event Error] Failed to emit legal.queue.updated:`, eventErr);
  }
}
