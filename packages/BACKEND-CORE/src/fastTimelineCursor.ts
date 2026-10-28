/**
 * Fast Timeline Cursor ($O(1)$ Linear Monotonic Playback + $O(\log N)$ Seek)
 * Eliminates linear array scans (.find) on 5,000+ transcript tokens or EDL cut intervals.
 */

export interface TimeInterval {
  start: number;
  end: number;
}

export class FastTimelineCursor<T extends TimeInterval> {
  private items: T[] = [];
  private lastIdx = 0;

  constructor(items: T[] = []) {
    this.setItems(items);
  }

  /**
   * Updates the underlying items array and resets cursor pointer.
   * Expects items to be sorted by start time ascending.
   */
  public setItems(items: T[]) {
    this.items = items;
    this.lastIdx = 0;
  }

  public getItems(): readonly T[] {
    return this.items;
  }

  /**
   * Finds the single active item at the given timestamp.
   * - $O(1)$ when time is inside the current item.
   * - $O(1)$ when time advances monotonically to the next item.
   * - $O(\log N)$ binary search on manual scrubber seeks or reverse jumps.
   */
  public findCurrent(time: number): T | null {
    const idx = this.findCurrentIndex(time);
    return idx >= 0 ? (this.items[idx] ?? null) : null;
  }

  /**
   * Returns the index of the active item at the given timestamp, or -1 if none.
   */
  public findCurrentIndex(time: number): number {
    const len = this.items.length;
    if (len === 0) return -1;

    // 1. O(1) Check current index
    const current = this.items[this.lastIdx];
    if (current && time >= current.start && time <= current.end) {
      return this.lastIdx;
    }

    // 2. O(1) Check next immediate index (forward linear playback tick)
    const nextIdx = this.lastIdx + 1;
    if (nextIdx < len) {
      const next = this.items[nextIdx]!;
      if (time >= next.start && time <= next.end) {
        this.lastIdx = nextIdx;
        return nextIdx;
      }
    }

    // 3. O(log N) Binary search for manual scrub seeks or out-of-order jumps
    let low = 0;
    let high = len - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const midItem = this.items[mid]!;

      if (time < midItem.start) {
        high = mid - 1;
      } else if (time > midItem.end) {
        low = mid + 1;
      } else {
        this.lastIdx = mid;
        return mid;
      }
    }

    return -1;
  }

  /**
   * Finds all items active at the given timestamp (useful for multi-track overlays).
   */
  public findAllActive(time: number): T[] {
    const result: T[] = [];
    const idx = this.findCurrentIndex(time);
    if (idx === -1) return result;

    result.push(this.items[idx]!);

    // Scan backwards for overlapping intervals
    let i = idx - 1;
    while (i >= 0) {
      const it = this.items[i]!;
      if (time >= it.start && time <= it.end) {
        result.push(it);
      }
      i--;
    }

    // Scan forwards for overlapping intervals
    let j = idx + 1;
    while (j < this.items.length) {
      const it = this.items[j]!;
      if (time >= it.start && time <= it.end) {
        result.push(it);
      } else if (it.start > time) {
        break;
      }
      j++;
    }

    return result;
  }

  /**
   * Returns the next upcoming boundary (start or end) after the given time,
   * enabling lookahead pre-seeking for dual-decoder pools.
   */
  public getNextBoundary(time: number): number | null {
    const len = this.items.length;
    for (let i = Math.max(0, this.lastIdx); i < len; i++) {
      const item = this.items[i]!;
      if (item.start > time) return item.start;
      if (item.end > time) return item.end;
    }
    return null;
  }
}
