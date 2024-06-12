# Task Queue
Task prioritization and scheduling made easy!

# Getting Started

## Installation
```bash
npm install --save @figliolia/task-queue
# or
yarn add @figliolia/task-queue
```

## Basic Usage

### Scheduling Tasks using Prioritized Execution
```typescript
import { TaskQueue } from "@figliolia/task-queue";

const TQ = new TaskQueue({ priorities: 4 });
// This TaskQueue will have 4 priority levels for
// registering tasks

const task1 = () => {};
const task2 = () => {};
const task3 = () => {};
const task4 = () => {};

TQ.registerTask(task1, 4); // Priority 4
TQ.registerTask(task2, 3); // Priority 3
TQ.registerTask(task3, 2); // Priority 2
TQ.registerTask(task4, 1); // Priority 1

const cancelFN = TQ.executeAll();
// The execution order => task4, task3, task2, task1

// Calling cancelFN() will cancel task execution at any point
```


### Scheduling Tasks using deferrals
```typescript
import { TaskQueue } from "@figliolia/task-queue";

const TQ = new TaskQueue();

const cancelFN = TQ.deferTask(() => {
  // This task will execute after 1000ms
  // and won't leak memory if canceled
}, 1000);

// Optionally calling `cancelFN()` will prevent the
// task from being executed
```
## API
### Task Queue

#### `constructor(options): TaskQueue`
The constructor can accept an `options` argument with the following keys and default values
```typescript
const TQ = new TaskQueue({
  // The number of priority-levels your queue will have
  priorities: 1,
  // Whether or not your queue will auto-run tasks as they're added
  // to the queue
  autoRun: false,
  // The number of milliseconds to elapse between tasks. For all 
  // TaskQueue methods that accept a taskSeparation argument its 
  // value defaults to the one provided by this parameter
  taskSeparation: 0,
  // When using this module in the browser and user-interaction 
  // is detected, this argument represents the number of 
  // milliseconds to pause the tasks queue and yield to the main 
  // thread
  mainThreadYieldTime: 5,
})
```

#### `registerTask(task: Task, priority: number): CancelFN`
Registers a function to execute at a certain priority level. Returns a cancel function that, if called, will remove the task from the queue
```typescript
import { TaskQueue } from "@figliolia/task-queue";

const N = 3;

const TQ = TaskQueue({ priorities: N });

const cancelFN = TQ.registerTask(() => {}, 1)
```
#### `deferTask(task: Task, delay: number): CancelFN`
Registers a task to execute after a specified delay. Returns a cancel function that, if called, will remove the task from the queue
```typescript
import { TaskQueue } from "@figliolia/task-queue";

const TQ = TaskQueue();

const cancelFN = TQ.deferTask(() => {}, 1000);
```
#### `executeAll(onComplete?: Task, taskSeparation?: number): CancelFN`
Executes all prioritized tasks registered using `registerTask()`. Tasks are executed based on the priority levels that they were registered with and dispersed along the call stack using the `taskSeparation`. 
```typescript
import { TaskQueue } from "@figliolia/task-queue";

const TQ = TaskQueue({ priorities: 3 });

// Register any number of tasks
TQ.registerTask(() => {}, 1);
TQ.registerTask(() => {}, 2);
TQ.registerTask(() => {}, 3);

const cancelFN = TQ.executeAll(() => {
  console.log('Complete!');
}, 35 /* task separation */);
```
The `taskSeparation` parameter can be used to disperse registered tasks along the call stack. `taskSeparation` = the number of milliseconds to elapse between tasks. It's set to 0 by default. This is designed to prevent the creation of long blocking tasks when the Task Queue has several entries.

Invoking the returned cancel function will pause the execution of the remaining tasks in the queue until `executeAll()` is called again.

##### `executeTasksWithPriority(): CancelFN`
Executes all tasks registered at a specified priority level. Returns a cancel function
```typescript
import { TaskQueue } from "@figliolia/task-queue";

const TQ = TaskQueue({ priorities: 3 });
// Register any number of tasks

const cancelFN = TQ.executeTasksWithPriority(
  1, // Priority 
  0, // Task Separation MS
  () => { // On complete function
  console.log("Complete!");
});
// Executes all tasks registered with priority level 1
```
Calling the returned cancel function will pause the execution of tasks. 

Using `executeTasksWithPriority()` can allow developers to organize tasks based on arbitrary means and identify them using their priority. This can be useful if managing the execution of registered tasks based on arbitrary categorization. Let's look at an example using application routing:
```typescript
import { TaskQueue } from "@figliolia/task-queue";

const TQ = new TaskQueue({ priorities: 3 });

// Let's map our application routes to a priority level
enum RouteMap {
  "home" = 1,
  "about" = 2,
  "profile" = 3
}

// Next lets register a data loading task for
// each route
TQ.registerTask(() => {
  // Tasks to execute when navigating to home
  void fetchGreeting();
}, RouteMap.home);

TQ.registerTask(() => {
  // Tasks to execute when navigating to about
  void fetchUserData();
}, RouteMap.about);

TQ.registerTask(() => {
  // Tasks to execute when navigating to profile
  void fetchProfile();
}, RouteMap.profile);

// Listen for routing changes using hashchange or pushstate
window.addEventListener("hashchange", () => {
  const nextRoute = window.location.hash.slice(1);
  if(nextRoute in RouteMap) {
    // Execute data loader for matched routes!
    TQ.executeTasksWithPriority(routeMap[nextRoute]);
  }
});
```
In the above example, the `TaskQueue's` priority levels are used for categorizing data preloading tasks based on the route they correspond with. When the browser routes to a supported route found in the `routeMap`, the tasks corresponding with the route are executed as early as possible.

#### `clearPendingTasks(): void`
Removes all pending tasks from the task `TaskQueue`. This includes both prioritized tasks registered using `TaskQueue.registerTask()` and deferred tasks registered using `TaskQueue.deferTask()`
```typescript
import { TaskQueue } from "@figliolia/task-queue";

const TQ = TaskQueue({ priorities: 3 });

TQ.registerTask(() => {}, 1);
TQ.registerTask(() => {}, 2);
TQ.registerTask(() => {}, 3);
TQ.deferTask(() => {}, 1000);

TQ.clearPendingTasks(); 
// Resets the Queue removing all registered tasks
```

#### `clearDeferredTasks(): void`
Removes all pending tasks registered using `TaskQueue.deferTask()`. These tasks are released, cancelled and forgotten by the `TaskQueue`
```typescript
import { TaskQueue } from "@figliolia/task-queue";

const TQ = TaskQueue();

TQ.deferTask(() => {}, 1000);
TQ.deferTask(() => {}, 2000);
TQ.deferTask(() => {}, 3000);

TQ.clearDeferredTasks(); 
// Cancels all currently pending deferred tasks
```

#### `getCancelFN(): CancelFN | void`
Returns the current cancel token if the `TaskQueue` is executing or undefined if the `TaskQueue` is idol.
```typescript
import { TaskQueue } from "@figliolia/task-queue";

const TQ = TaskQueue({ priorities: 3 });

// Register any number of tasks
TQ.registerTask(() => {}, 1);
TQ.registerTask(() => {}, 2);
TQ.registerTask(() => {}, 3);

TQ.executeAll();

const cancel = TQ.getCancelFN(); 
// Returns a CancelFN during execution
cancel && cancel()
```

## Advanced Usage

### Using `autoRun`
The `autoRun` option is designed to make your `TaskQueues` run at all times. This option will cause registered tasks to `auto-execute` as soon as they're enqueued. Tasks will continue to execute at their appropriate priority levels, but allow lower priority tasks to execute immediately if the Queue is empty!
```typescript
const TQ = new TaskQueue({ 
  priorities: 3, 
  autoRun: true,
  taskSeparation: 10,
  mainThreadYieldTime: 5,
});

const task1 = () => {};
const task2 = () => {};
const task3 = () => {}

TQ.registerTask(task3, 3);
TQ.registerTask(task2, 2);
TQ.registerTask(task1, 1);

// The above tasks will execute without calling `TQ.executeAll()`

// The execution order will be task1 => task2 => task3 with 10ms 
// elapsing between each task

// To cancel task execution at any point
const cancel = TQ.getCancelFN();
cancel && cancel();

// To begin execution again
TQ.executeAll()
```
Using the `autoRun` option is great prioritizing the execution of startup tasks in complex frontend apps or responsibly managing request handling on the server