import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';

const logger = new Logger('LegalEventHelper');

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
    logger.error(`[Event Error] Failed to emit legal.queue.updated: ${eventErr?.message || eventErr}`);
  }
}
