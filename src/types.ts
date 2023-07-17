export type CancelFN = () => void;

export interface Queue<T> {
  length: number;
  isEmpty: boolean;
  enqueue: (item: T, ...rest: any[]) => string;
  dequeue: () => T | undefined;
  peak: () => [string, T] | undefined;
  delete: (ID: string, ...rest: any[]) => boolean;
  clear: () => void;
}

export interface ITaskQueue {
  autoRun?: boolean;
  priorities?: number;
  taskSeparation?: number;
}

export type Task = () => void | Promise<void>;

export type DeferredTask = ReturnType<typeof setTimeout>;
