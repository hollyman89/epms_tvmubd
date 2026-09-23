/**
 * Bounded session-level event deduplication.
 * AT-LEAST-ONCE socket transport delivery means duplicate deliveries are valid.
 * This class tracks seen eventIds in an in-memory Set bounded by a FIFO eviction queue.
 *
 * Requirements:
 * - Deduplicate strictly by eventId
 * - No 60s TTL (relay retry may occur outside that window)
 * - Bounded capacity (default 500)
 * - Session-level only, no persistent storage
 */
export class BoundedEventDedup {
  private readonly capacity: number;
  private readonly seenIds: Set<string>;
  private readonly queue: string[];

  constructor(capacity = 500) {
    this.capacity = capacity > 0 ? capacity : 500;
    this.seenIds = new Set<string>();
    this.queue = [];
  }

  /**
   * Check if eventId has already been seen in this session.
   * If seen, returns true (caller must ignore duplicate).
   * If new, adds eventId to seen set and returns false.
   */
  public isDuplicate(eventId: string): boolean {
    if (!eventId || typeof eventId !== 'string') {
      return false;
    }

    if (this.seenIds.has(eventId)) {
      return true;
    }

    this.seenIds.add(eventId);
    this.queue.push(eventId);

    if (this.queue.length > this.capacity) {
      const evicted = this.queue.shift();
      if (evicted) {
        this.seenIds.delete(evicted);
      }
    }

    return false;
  }

  public size(): number {
    return this.seenIds.size;
  }

  public clear(): void {
    this.seenIds.clear();
    this.queue.length = 0;
  }
}
