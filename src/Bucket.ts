import { AutoIncrementingID } from "@figliolia/event-emitter";
import type { Queue } from "./types";

/**
 * Bucket
 *
 * A bucket is a wrapper around the native Map that
 * assigns an auto-incrementing ID to each value
 * added to the bucket. It provided a Queue-like
 * interface with the ability to access and remove
 * items in 0(1) time
 */
export class Bucket<T> implements Queue<T> {
  public bucket = new Map<string, T>();
  private IDs = new AutoIncrementingID();

  /**
   * Enqueue
   *
   * Adds an item to the bucket and returns it's
   * unique ID
   */
  public enqueue(item: T) {
    const ID = this.IDs.get();
    this.bucket.set(ID, item);
    return ID;
  }

  /**
   * Dequeue
   *
   * Removes the first item from the Bucket and
   * returns it
   */
  public dequeue() {
    for (const [ID, item] of this.bucket) {
      this.bucket.delete(ID);
      return item;
    }
  }

  /**
   * peek
   *
   * Returns the first item from the Bucket or undefined
   * if the bucket is empty
   */
  public peek() {
    for (const entry of this.bucket) {
      return entry;
    }
  }

  /**
   * Delete
   *
   * Removes an item from the bucket by ID
   */
  public delete(ID: string) {
    return this.bucket.delete(ID);
  }

  /**
   * Clear
   *
   * Removes all items from the bucket
   */
  public clear() {
    return this.bucket.clear();
  }

  /**
   * Is Empty
   *
   * Returns true if the bucket contains no items
   */
  public get isEmpty() {
    return this.bucket.size === 0;
  }

  /**
   * Length
   *
   * Returns the total number of items in the bucket
   */
  public get length() {
    return this.bucket.size;
  }
}
