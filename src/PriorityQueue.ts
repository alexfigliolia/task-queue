import { Bucket } from "./Bucket";
import type { Queue } from "./types";

/**
 * Priority Queue
 *
 * A bucket queue supporting a dynamic number of buckets
 * ```typescript
 * const queue = new PriorityQueue(3);
 * // queue = [[],[],[]]
 * queue.enqueue(() => {}, 1);
 * // queue = [[() => {}],[],[]]
 * queue.enqueue(() => {}, 2);
 * // queue = [[() => {}],[],[() => {}]]
 * queue.dequeue();
 * // queue = [[],[],[() => {}]]
 * queue.dequeue();
 * // queue = [[],[],[]]
 * ```
 */
export class PriorityQueue<T> implements Queue<T> {
  public max: number;
  public buckets: Bucket<T>[] = [];
  constructor(buckets: number) {
    this.max = buckets - 1;
    for (let i = 0; i < buckets; i++) {
      this.buckets.push(new Bucket());
    }
  }

  /**
   * Enqueue
   *
   * Adds an item to the queue at the specified priority.
   * If no priority is provided, the item will be indexed
   * into the *highest* priority bucket
   */
  public enqueue(item: T, priority = 0) {
    this.guard(priority);
    return this.buckets[priority].enqueue(item);
  }

  /**
   * Dequeue
   *
   * Removes the first item in the priority queue and
   * returns it. Items are dequeued from higher priorities
   * before lower priorities
   */
  public dequeue() {
    for (const bucket of this) {
      if (bucket.length) {
        return bucket.dequeue();
      }
    }
  }

  /**
   * Get Bucket
   *
   * Returns the Nth bucket in the Queue
   */
  public getBucket(priority = 0) {
    this.guard(priority);
    return this.buckets[priority];
  }

  /**
   * peek
   *
   * Returns the highest priority item in the Queue
   */
  public peek() {
    for (const bucket of this) {
      if (bucket.length) {
        return bucket.peek();
      }
    }
  }

  /**
   * IsEmpty
   *
   * Returns true if the Queue has no items in any of
   * its buckets
   */
  public get isEmpty() {
    for (const bucket of this) {
      if (bucket.length) {
        return false;
      }
    }
    return true;
  }

  /**
   * Length
   *
   * Returns the total number of items in the Queue
   */
  public get length() {
    let length = 0;
    for (const bucket of this) {
      length += bucket.length;
    }
    return length;
  }

  /**
   * Delete By ID
   *
   * Removes an item from the Queue using its ID and
   * priority
   */
  public delete(ID: string, priority: number) {
    this.guard(priority);
    return this.getBucket(priority).delete(ID);
  }

  /**
   * Clear
   *
   * Resets the priority queue and removes all items
   */
  public clear() {
    for (const bucket of this) {
      bucket.clear();
    }
  }

  /**
   * Guard
   *
   * Throws a range error if the priority specified is out of range
   */
  private guard(priority: number) {
    if (priority > this.max) {
      throw new Error(
        `Out of Range Error: Attempted to access a bucket index that does not exist`
      );
    }
  }

  *[Symbol.iterator]() {
    for (const bucket of this.buckets) {
      yield bucket;
    }
  }
}
