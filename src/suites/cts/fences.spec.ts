export const description = ``;

import { attemptGarbageCollection } from '../../framework/collect_garbage.js';
import { TestGroup } from '../../framework/index.js';

import { GPUTest } from './gpu_test.js';

export const g = new TestGroup(GPUTest);

g.test('initial/no descriptor', t => {
  const fence = t.queue.createFence();
  t.expect(fence.getCompletedValue() === 0);
});

g.test('initial/empty descriptor', t => {
  const fence = t.queue.createFence({});
  t.expect(fence.getCompletedValue() === 0);
});

g.test('initial/descriptor with initialValue', t => {
  const fence = t.queue.createFence({ initialValue: 2 });
  t.expect(fence.getCompletedValue() === 2);
});

// Promise resolves when onCompletion value is less than signal value.
g.test('wait/less than signaled', async t => {
  const fence = t.queue.createFence();
  t.queue.signal(fence, 2);
  await fence.onCompletion(1);
  t.expect(fence.getCompletedValue() === 2);
});

// Promise resolves when onCompletion value is equal to signal value.
g.test('wait/equal to signaled', async t => {
  const fence = t.queue.createFence();
  t.queue.signal(fence, 2);
  await fence.onCompletion(2);
  t.expect(fence.getCompletedValue() === 2);
});

// All promises resolve when signal is called once.
g.test('wait/signaled once', async t => {
  const fence = t.queue.createFence();
  t.queue.signal(fence, 20);
  const promises = [];
  for (let i = 0; i <= 20; ++i) {
    promises.push(
      fence.onCompletion(i).then(() => {
        t.expect(fence.getCompletedValue() >= i);
      })
    );
  }
  await Promise.all(promises);
});

// Promise resolves when signal is called multiple times.
g.test('wait/signaled multiple times', async t => {
  const fence = t.queue.createFence();
  t.queue.signal(fence, 1);
  t.queue.signal(fence, 2);
  await fence.onCompletion(2);
  t.expect(fence.getCompletedValue() === 2);
});

// Promise resolves if fence has already completed.
g.test('wait/already completed', async t => {
  const fence = t.queue.createFence();
  t.queue.signal(fence, 2);

  // Wait for value to update.
  while (fence.getCompletedValue() < 2) {
    await new Promise(resolve => {
      requestAnimationFrame(resolve);
    });
  }

  t.expect(fence.getCompletedValue() === 2);

  await fence.onCompletion(2);
  t.expect(fence.getCompletedValue() === 2);
});

// Test many calls to signal and wait on fence values one at a time.
g.test('wait/many/serially', async t => {
  const fence = t.queue.createFence();
  for (let i = 1; i <= 20; ++i) {
    t.queue.signal(fence, i);
    await fence.onCompletion(i);
    t.expect(fence.getCompletedValue() === i);
  }
});

// Test many calls to signal and wait on all fence values.
g.test('wait/many/parallel', async t => {
  const fence = t.queue.createFence();
  const promises = [];
  for (let i = 1; i <= 20; ++i) {
    t.queue.signal(fence, i);
    promises.push(
      fence.onCompletion(i).then(() => {
        t.expect(fence.getCompletedValue() >= i);
      })
    );
  }
  await Promise.all(promises);
  t.expect(fence.getCompletedValue() === 20);
});

// Test promise resolving with a time limit
g.test('wait/timed promise', async t => {
  return new Promise<void>((resolve, reject) => {
    const fence = t.queue.createFence();
    setTimeout(() => t.queue.signal(fence, 2), 100)
    fence.onCompletion(2).then(() => {
      t.expect(fence.getCompletedValue() == 2);
      resolve()
    })
    setTimeout(() => reject(), 1000)
  })
});

// Test dropping references to the fence and onCompletion promise does not crash.
g.test('drop/fence and promise', t => {
  {
    const fence = t.queue.createFence();
    t.queue.signal(fence, 2);
    fence.onCompletion(2);
  }
  attemptGarbageCollection();
});

// Test dropping references to the fence and holding the promise does not crash.
g.test('drop/promise', async t => {
  let promise;
  {
    const fence = t.queue.createFence();
    t.queue.signal(fence, 2);
    promise = fence.onCompletion(2);
  }
  attemptGarbageCollection();
  await promise;
});
