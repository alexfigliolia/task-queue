import { Bucket } from "./Bucket";
import { PriorityQueue } from "./PriorityQueue";
import type { CancelFN, DeferredTask, ITaskQueue, Queue, Task } from "./types";

/**
 * Task Queue
 *
 * A Task Manager for handing varying priority tasks and scheduling.
 * `TaskQueue` instances provide two means for task scheduling.
 *
 * The first is a priority queue that indexes tasks based on a
 * priority specified by you:
 * ```
 * const TQ = new TaskQueue({
 *  priorities: 4,
 *  autoRun: false,
 *  taskSeparation: 5,
 *  mainThreadYieldTime: 5.
 * });
 *
 * const task1 = () => {};
 * const task2 = () => {};
 * const task3 = () => {};
 * const task4 = () => {};
 *
 * TQ.registerTask(task1, 4);
 * TQ.registerTask(task2, 3);
 * TQ.registerTask(task3, 2);
 * TQ.registerTask(task4, 1);
 *
 * const cancelFN = TQ.executeAll();
 * // The execution order => task4, task3, task2, task1
 * // 5ms will elapse between each task
 * ```
 *
 * `TaskQueue.registerTask()` returns a cancel function for easily
 * removing a task from the Queue
 *
 * The second means is the management and clean up of deferred tasks.
 * Deferring tasks through `setTimeout` is notorious for causing
 * memory leaks and unwanted side effects. This `TaskQueue` provides
 * management for scheduled tasks:
 * ```typescript
 * const TQ = new TaskQueue();
 *
 * const cancel = TQ.deferTask(() => {}, 1000); // Execute the task after 1000ms
 *
 * // cancel(); // cancel the task optionally
 * ```
 * `TaskQueue.deferTask()` also returns a cancel function for easily
 * removing a task from the Queue
 */
export class TaskQueue {
  public autoRun = false;
  public taskSeparation = 0;
  public mainThreadYieldTime = 5;
  public tasks: PriorityQueue<Task>;
  public subscriptions = new Bucket<Task>();
  public internals = new Bucket<CancelFN>();
  public deferredTasks = new Bucket<DeferredTask>();
  constructor(config: ITaskQueue = TaskQueue.defaultConfig) {
    const {
      priorities = 1,
      autoRun = false,
      taskSeparation = 0,
      mainThreadYieldTime = 5,
    } = config;
    this.autoRun = autoRun;
    this.taskSeparation = taskSeparation;
    this.mainThreadYieldTime = mainThreadYieldTime;
    this.tasks = new PriorityQueue<Task>(priorities);
  }

  public static defaultConfig: ITaskQueue = {
    priorities: 1,
    autoRun: false,
    taskSeparation: 0,
    mainThreadYieldTime: 5,
  };

  /**
   * Register Task
   *
   * Registers a non-deferred task on the TaskQueue at
   * a specified priority level. Returns a cancel
   * function that removes the task from the queue
   */
  public registerTask(task: Task, priority = 1): CancelFN {
    const ID = this.tasks.enqueue(task, priority - 1);
    if (this.autoRun && !this.internals.peek()) {
      this.executeAll();
    }
    return () => {
      this.tasks.delete(ID, priority - 1);
    };
  }

  /**
   * Defer Task
   *
   * Schedules the specified task after a delay. Returns
   * a cancel function that removes the task from the
   * queue
   */
  public deferTask(task: Task, delay: number): CancelFN {
    const timer = setTimeout(() => {
      void task();
      this.deferredTasks.delete(ID);
    }, delay);
    const ID = this.deferredTasks.enqueue(timer);
    return () => {
      clearTimeout(timer);
      this.deferredTasks.delete(ID);
    };
  }

  /**
   * Execute All
   *
   * Executes all tasks registered using `TaskQueue.registerTask()`.
   * The task execution order will be based on the priority each task
   * was registered with. Returns a cancel function
   */
  public executeAll(
    onComplete?: Task,
    taskSeparation = this.taskSeparation
  ): CancelFN {
    if (onComplete) {
      this.subscriptions.enqueue(onComplete);
    }
    if (this.internals.peek()) {
      return this.getCancelFN()!;
    }
    const cancelFN = this.cancellableExecution(this.tasks, taskSeparation);
    const jobID = this.internals.enqueue(cancelFN);
    const removeJob = () => {
      this.internals.delete(jobID);
    };
    this.subscriptions.enqueue(removeJob);
    return () => {
      cancelFN();
      removeJob();
    };
  }

  /**
   * Execute Tasks With Priority
   *
   * Executes all tasks registered using `TaskQueue.registerTask(task, N)`
   * with the provided priority. Returns a cancel function
   */
  public executeTasksWithPriority(
    priority = 1,
    taskSeparation = 0,
    onComplete?: Task
  ): CancelFN {
    if (onComplete) {
      this.subscriptions.enqueue(onComplete);
    }
    if (this.internals.peek()) {
      return this.getCancelFN()!;
    }
    return this.cancellableExecution(
      this.tasks.getBucket(priority - 1),
      taskSeparation
    );
  }

  /**
   * Clear Pending Tasks
   *
   * Clears all pending tasks
   */
  public clearPendingTasks() {
    this.tasks.clear();
    this.clearDeferredTasks();
  }

  /**
   * Clear Deferred Tasks
   *
   * Clears all pending tasks registered using `TaskQueue.deferTask()`
   */
  public clearDeferredTasks() {
    while (this.deferredTasks.length) {
      const item = this.deferredTasks.dequeue();
      if (item !== undefined) {
        clearTimeout(item);
      }
    }
  }

  /**
   * Get Cancel Function
   *
   * Returns the cancel function for currently executing tasks
   * (if it exists). Returns undefined if no tasks are being
   * executed;
   */
  public getCancelFN(): undefined | CancelFN {
    const activeTask = this.internals.peek();
    if (activeTask) {
      return activeTask[1];
    }
  }

  /**
   * Cancellable Execution
   *
   * Given Queue and a task separation time, schedules the
   * execution of each task present. Returns a cancel
   * function that pauses the execution of tasks
   */
  private cancellableExecution(
    queue: Queue<Task>,
    taskSeparation = this.taskSeparation
  ): CancelFN {
    let cancelToken = false;
    const iterable = this.generator(queue, taskSeparation);
    const iterate = async () => {
      for await (const proceed of iterable) {
        if (cancelToken || !proceed) {
          break;
        }
        if (this.isInputPending()) {
          await this.yieldMainThread();
          continue;
        }
        const task = queue.dequeue();
        task && void task();
      }
      if (this.subscriptions.length) {
        return this.cancellableExecution(this.subscriptions, 0);
      }
    };
    void iterate();
    return () => {
      cancelToken = true;
    };
  }

  /**
   * Generator
   *
   * Returns an async iterable yielding a promise that resolves
   * after a specified duration. The duration specified is
   * used for dispersing prioritized along the call stack
   */
  private *generator(queue: Queue<Task>, taskSeparation = 0) {
    while (!queue.isEmpty) {
      if (!taskSeparation) {
        yield true;
      } else {
        yield new Promise<boolean>((resolve) => {
          this.deferTask(() => {
            resolve(true);
          }, taskSeparation);
        });
      }
    }
  }

  private isInputPending() {
    if (typeof window !== "undefined" && typeof navigator !== "undefined") {
      // @ts-ignore
      return navigator?.scheduling?.isInputPending() ?? false;
    }
    return false;
  }

  private yieldMainThread() {
    return new Promise((resolve) => {
      setTimeout(resolve, this.mainThreadYieldTime);
    });
  }
}
