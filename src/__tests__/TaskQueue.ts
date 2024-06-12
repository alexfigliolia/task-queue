import { Bucket } from "../Bucket";
import { PriorityQueue } from "../PriorityQueue";
import { TaskQueue } from "../TaskQueue";

describe("Task Queue", () => {
  describe("Initialization", () => {
    it("It initializes a bucket for each priority level", () => {
      const TQ = new TaskQueue({
        priorities: 3,
      });
      expect(TQ.tasks).toBeInstanceOf(PriorityQueue);
      expect(TQ.tasks.max).toEqual(2);
      expect(TQ.tasks.buckets.length).toEqual(3);
      expect(
        TQ.tasks.buckets.every((bucket) => bucket instanceof Bucket)
      ).toEqual(true);
      expect(TQ.tasks.buckets.every((bucket) => bucket.length === 0)).toEqual(
        true
      );
    });

    it("It initializes with a default autoRun and taskSeparation", () => {
      const TQ = new TaskQueue({
        priorities: 3,
      });
      expect(TQ.autoRun).toEqual(false);
      expect(TQ.taskSeparation).toEqual(0);
    });

    it("It initializes a queue for subscriptions, timers, and internal calls", () => {
      const TQ = new TaskQueue({
        priorities: 3,
      });
      expect(TQ.internals).toBeInstanceOf(Bucket);
      expect(TQ.deferredTasks).toBeInstanceOf(Bucket);
      expect(TQ.subscriptions).toBeInstanceOf(Bucket);
    });
  });

  describe("Basic Usage - Prioritized Tasks", () => {
    it("It allows tasks to be registered at all available priority levels", async () => {
      const TQ = new TaskQueue({ priorities: 3 });
      const task1 = jest.fn();
      const task2 = jest.fn();
      const task3 = jest.fn();
      TQ.registerTask(task1, 1);
      TQ.registerTask(task2, 2);
      TQ.registerTask(task3, 3);
      expect(TQ.tasks.buckets.every((bucket) => bucket.length === 1)).toEqual(
        true
      );
      await new Promise<void>((resolve) => {
        TQ.executeAll(resolve);
      });
      expect(TQ.tasks.length).toEqual(0);
      expect(TQ.tasks.isEmpty).toEqual(true);
      expect(task1).toHaveBeenCalledBefore(task2);
      expect(task2).toHaveBeenCalledBefore(task3);
      expect(task3).toHaveBeenCalledAfter(task2);
    });

    it("Tasks can be cancelled ahead of execution", async () => {
      const TQ = new TaskQueue({ priorities: 3 });
      const noop = jest.fn();
      const noCall = jest.fn();
      TQ.registerTask(noop, 1);
      TQ.registerTask(noop, 2);
      TQ.registerTask(noCall, 3)();
      await new Promise<void>((resolve) => {
        TQ.executeAll(resolve);
      });
      expect(TQ.tasks.length).toEqual(0);
      expect(TQ.tasks.isEmpty).toEqual(true);
      expect(noop).toHaveBeenCalledTimes(2);
      expect(noCall).toHaveBeenCalledTimes(0);
    });

    it("It provides subscriptions for task completion", async () => {
      const TQ = new TaskQueue({ priorities: 3 });
      const onComplete = jest.fn();
      TQ.registerTask(() => {}, 1);
      await new Promise<void>((resolve) => {
        TQ.executeAll(() => {
          onComplete();
          setTimeout(resolve, 10);
        });
        expect(TQ.subscriptions.length).toEqual(2);
      });
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(TQ.subscriptions.length).toEqual(0);
    });

    it("Executions can be cancelled before they complete", async () => {
      const TQ = new TaskQueue({ priorities: 3, taskSeparation: 5 });
      const onComplete = jest.fn();
      const task1 = jest.fn();
      const task2 = jest.fn();
      const task3 = jest.fn();
      TQ.registerTask(task1, 1);
      TQ.registerTask(task2, 2);
      TQ.registerTask(task3, 3);
      await new Promise<void>((resolve) => {
        const cancel = TQ.executeAll(() => {
          onComplete();
          setTimeout(resolve, 50);
        });
        setTimeout(cancel, 10);
      });
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(TQ.subscriptions.length).toEqual(0);
      expect(task1).toHaveBeenCalled();
      expect(task2).toHaveBeenCalledTimes(0);
      expect(task3).toHaveBeenCalledTimes(0);
      expect(TQ.tasks.length).toEqual(2);
    });
  });

  describe("Basic Usage - Deferred Tasks", () => {
    it("It defers tasks using a timeout", async () => {
      const TQ = new TaskQueue({});
      const noop = jest.fn();
      TQ.deferTask(noop, 0);
      expect(TQ.deferredTasks.length).toEqual(1);
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      expect(noop).toHaveBeenCalled();
      expect(TQ.deferredTasks.length).toEqual(0);
    });

    it("Deferred tasks can be cancelled prior to executing", async () => {
      const TQ = new TaskQueue({});
      const noop = jest.fn();
      const cancel = TQ.deferTask(noop, 2);
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          cancel();
          resolve();
        }, 1);
      });
      expect(noop).toHaveBeenCalledTimes(0);
      expect(TQ.deferredTasks.length).toEqual(0);
    });
  });

  describe("Advanced Usage - Prioritized Tasks", () => {
    it("It can auto-execute prioritized tasks as they're added to the queue", async () => {
      const TQ = new TaskQueue({ priorities: 3, autoRun: true });
      const executeAll = jest.spyOn(TQ, "executeAll");
      const task1 = jest.fn();
      const task2 = jest.fn();
      const task3 = jest.fn();
      TQ.registerTask(task3, 3);
      TQ.registerTask(task2, 2);
      TQ.registerTask(task1, 1);
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
      expect(task1).toHaveBeenCalledBefore(task2);
      expect(task2).toHaveBeenCalledBefore(task3);
      expect(task3).toHaveBeenCalled();
      expect(executeAll).toHaveBeenCalledTimes(1);
    });

    it("When auto-executing tasks, a cancel function can be obtained from the instance", () => {
      const TQ = new TaskQueue({ priorities: 3, autoRun: true });
      const task = jest.fn();
      expect(TQ.getCancelFN()).toEqual(undefined);
      TQ.registerTask(task, 3);
      TQ.registerTask(task, 2);
      TQ.registerTask(task, 1);
      const cancel = TQ.getCancelFN();
      expect(cancel).toEqual(expect.any(Function));
      cancel && cancel();
    });

    it("Task separation can be specified via the constructor", () => {
      const TQ = new TaskQueue({
        priorities: 3,
        autoRun: true,
        taskSeparation: 5,
      });
      const deferTask = jest.spyOn(TQ, "deferTask");
      TQ.registerTask(jest.fn(), 3);
      expect(deferTask).toHaveBeenCalledWith(expect.any(Function), 5);
    });

    it("It can execute tasks belonging to a specific priority level", async () => {
      const TQ = new TaskQueue({ priorities: 3 });
      const noop = jest.fn();
      TQ.registerTask(noop, 1);
      TQ.registerTask(() => {}, 2);
      TQ.registerTask(noop, 3);
      await new Promise<void>((resolve) => {
        TQ.executeTasksWithPriority(2, TQ.taskSeparation, () => {
          resolve();
        });
      });
      expect(noop).toHaveBeenCalledTimes(0);
      await new Promise<void>((resolve) => {
        TQ.executeTasksWithPriority(1, TQ.taskSeparation, () => {
          resolve();
        });
      });
      expect(noop).toHaveBeenCalledTimes(1);
    });

    it("Calls to executeTasksWithPriority are muffled while executeAll is running", async () => {
      const TQ = new TaskQueue({ priorities: 3 });
      const noop = jest.fn();
      TQ.registerTask(noop, 1);
      TQ.registerTask(() => {}, 2);
      TQ.registerTask(() => {}, 3);
      await new Promise<void>((resolve) => {
        TQ.executeAll(() => {
          resolve();
        });
        TQ.executeTasksWithPriority(1);
      });
      expect(noop).toHaveBeenCalledTimes(1);
    });

    it("Duplicate calls to executeAll are muffled", async () => {
      const TQ = new TaskQueue({ priorities: 3 });
      const getCancelFN = jest.spyOn(TQ, "getCancelFN");
      const task = jest.fn();
      const subscription = jest.fn();
      TQ.registerTask(task, 1);
      TQ.registerTask(() => {}, 2);
      TQ.registerTask(() => {}, 3);
      TQ.executeAll(subscription);
      TQ.executeAll(subscription);
      TQ.executeAll(subscription);
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
      expect(task).toHaveBeenCalledTimes(1);
      expect(getCancelFN).toHaveBeenCalledTimes(2);
      expect(subscription).toHaveBeenCalledTimes(3);
    });

    it("It can yield to the main thread", async () => {
      const TQ = new TaskQueue({ priorities: 3, mainThreadYieldTime: 5 });
      // @ts-ignore private-method
      const checkSpy = jest.spyOn(TQ, "isInputPending").mockReturnValue(true);
      // @ts-ignore private-method
      const yeildSpy = jest.spyOn(TQ, "yieldMainThread");
      const task = jest.fn();
      TQ.registerTask(task, 1);
      TQ.executeAll();
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
      expect(checkSpy).toHaveBeenCalled();
      expect(yeildSpy).toHaveBeenCalled();
      expect(task).toHaveBeenCalledTimes(0);
      // @ts-ignore private-method
      checkSpy.mockReturnValue(false);
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
      expect(task).toHaveBeenCalled();
    });
  });

  describe("Clean Up", () => {
    it("It can clear and cancel all pending deferred tasks", () => {
      const TQ = new TaskQueue({ priorities: 1 });
      const noop = jest.fn();
      TQ.deferTask(noop, 1000);
      TQ.deferTask(noop, 1000);
      TQ.deferTask(noop, 1000);
      expect(TQ.deferredTasks.length).toEqual(3);
      TQ.clearDeferredTasks();
      expect(TQ.deferredTasks.length).toEqual(0);
      expect(noop).toHaveBeenCalledTimes(0);
    });

    it("It can clear and cancel all pending prioritized and deferred tasks", () => {
      const TQ = new TaskQueue({ priorities: 2 });
      const noop = jest.fn();
      TQ.deferTask(noop, 1000);
      TQ.deferTask(noop, 1000);
      TQ.registerTask(noop, 1);
      TQ.registerTask(noop, 2);
      expect(TQ.tasks.length).toEqual(2);
      expect(TQ.deferredTasks.length).toEqual(2);
      TQ.clearPendingTasks();
      expect(TQ.tasks.length).toEqual(0);
      expect(TQ.deferredTasks.length).toEqual(0);
      expect(noop).toHaveBeenCalledTimes(0);
    });
  });

  describe("Error Handling", () => {
    it("It guards from out-of-range errors", () => {
      const TQ = new TaskQueue({ priorities: 1 });
      expect(() => {
        TQ.registerTask(() => {}, 2);
      }).toThrow(
        new Error(
          `Out of Range Error: Attempted to access a bucket index that does not exist`
        )
      );
    });
  });
});

export {};
