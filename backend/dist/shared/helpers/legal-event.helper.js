"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitLegalQueueUpdated = emitLegalQueueUpdated;
function emitLegalQueueUpdated(eventEmitter, payload) {
    try {
        eventEmitter.emit('legal.queue.updated', {
            ...payload,
            timestamp: new Date().toISOString()
        });
    }
    catch (eventErr) {
        console.error(`[Event Error] Failed to emit legal.queue.updated:`, eventErr);
    }
}
//# sourceMappingURL=legal-event.helper.js.map