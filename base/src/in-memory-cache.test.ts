import { cacheMe } from '.';
import { inMemory } from './in-memory-cache';

jest.useFakeTimers();

test('Cached function returns correct result', async () => {
    const cachedFunction = cacheMe(() => 1);

    expect(await cachedFunction()).toBe(1);
    expect(await cachedFunction()).toBe(1);
    expect(await cachedFunction()).toBe(1);
});

test('Cached function with parameter returns correct result', async () => {
    const cachedFunction = cacheMe((value: number) => value);

    expect(await cachedFunction(1)).toBe(1);
    expect(await cachedFunction(1)).toBe(1);
    expect(await cachedFunction(2)).toBe(2);
    expect(await cachedFunction(3)).toBe(3);
});

test('Cached async function returns correct result', async () => {
    const cachedFunction = cacheMe(async () => 1);

    expect(await cachedFunction()).toBe(1);
    expect(await cachedFunction()).toBe(1);
    expect(await cachedFunction()).toBe(1);
});

test('Cached async function with parameter returns correct result', async () => {
    const cachedFunction = cacheMe(async (str: string) => `${str}_yes`);

    expect(await cachedFunction('haha')).toBe('haha_yes');
    expect(await cachedFunction('bt2')).toBe('bt2_yes');
    expect(await cachedFunction('')).toBe('_yes');
});

test('Cached function returns correct result for complex async function', async () => {
    async function complexAsyncFunction(): Promise<number> {
        await Promise.resolve();
        const _ = 7 + 3;

        return await new Promise<number>(async (resolve) => {
            await Promise.resolve();
            resolve(7);
        });
    }

    const cachedFunction = cacheMe(complexAsyncFunction);

    expect(await cachedFunction()).toBe(7);
});

test('Cached function is actually only called once', async () => {
    const func = jest.fn();
    const cachedFunction = cacheMe(func);

    expect(func).toBeCalledTimes(0);
    await cachedFunction();
    expect(func).toBeCalledTimes(1);
    await cachedFunction();
    expect(func).toBeCalledTimes(1);
});

test('Cached function is called once for every unique parameter', async () => {
    const func = jest.fn((_: number) => {});
    const cachedFunction = cacheMe(func);

    expect(func).toBeCalledTimes(0);
    await cachedFunction(1);
    expect(func).toBeCalledTimes(1);
    await cachedFunction(2);
    expect(func).toBeCalledTimes(2);
    await cachedFunction(3);
    expect(func).toBeCalledTimes(3);
    await cachedFunction(1);
    expect(func).toBeCalledTimes(3);
});

test('Cache is warmed-up correctly', async () => {
    const func = jest.fn((_: number) => {});
    cacheMe(func, inMemory<void>(), [1], [2], [3]);

    // cache is warmed up asynchronously as tasks further down in event queue
    expect(func).toBeCalledTimes(0);

    // awaiting in this function defers the execution of the subsequent statements
    // so that the assertion is being scheduled in the event queue after the async
    // tasks to warm the cache
    await Promise.resolve();

    expect(func).toBeCalledTimes(3);
});

test('Cached values do not expire when not configured', async () => {
    const func = jest.fn();
    const cachedFunction = cacheMe(func);

    expect(func).toBeCalledTimes(0);
    await cachedFunction();
    expect(func).toBeCalledTimes(1);
    await cachedFunction();
    expect(func).toBeCalledTimes(1);

    jest.advanceTimersByTime(1_000_000);

    await cachedFunction();
    expect(func).toBeCalledTimes(1);
});

test('Cache expires data correctly', async () => {
    const func = jest.fn();
    const cachedFunction = cacheMe(func, inMemory({ type: 'EXPIRE_AFTER', ttl: 10_000, resetTTLOnRead: false }));

    expect(func).toBeCalledTimes(0);
    await cachedFunction();
    expect(func).toBeCalledTimes(1);
    await cachedFunction();
    expect(func).toBeCalledTimes(1);

    // advance timers to expire cache
    jest.advanceTimersByTime(10_000);

    await cachedFunction();
    expect(func).toBeCalledTimes(2);
});

test('Cached values TTL is reset on read', async () => {
    const func = jest.fn();
    const cachedFunction = cacheMe(func, inMemory({ type: 'EXPIRE_AFTER', ttl: 2000, resetTTLOnRead: true }));

    expect(func).toBeCalledTimes(0);
    await cachedFunction();
    expect(func).toBeCalledTimes(1);
    jest.advanceTimersByTime(1000);

    await cachedFunction();
    expect(func).toBeCalledTimes(1);
    jest.advanceTimersByTime(1000);

    await cachedFunction();
    expect(func).toBeCalledTimes(1);
    jest.advanceTimersByTime(1000);

    await cachedFunction();
    expect(func).toBeCalledTimes(1);
    jest.advanceTimersByTime(1000);

    await cachedFunction();
    expect(func).toBeCalledTimes(1);
});

test('Cached values TTL is not reset on read when not configured', async () => {
    const func = jest.fn();
    const cachedFunction = cacheMe(func, inMemory({ type: 'EXPIRE_AFTER', ttl: 2000, resetTTLOnRead: false }));

    expect(func).toBeCalledTimes(0);
    await cachedFunction();
    expect(func).toBeCalledTimes(1);
    jest.advanceTimersByTime(1000);

    await cachedFunction();
    expect(func).toBeCalledTimes(1);
    jest.advanceTimersByTime(1000);

    await cachedFunction();
    expect(func).toBeCalledTimes(2);
});

test('Cached values are refreshed periodically', async () => {
    const func = jest.fn();
    const cachedFunction = cacheMe(func, inMemory({ type: 'REFRESH_PERIODICALLY', interval: 1000 }));

    expect(func).toBeCalledTimes(0);
    await cachedFunction();
    expect(func).toBeCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(func).toBeCalledTimes(2);

    jest.advanceTimersByTime(1000);
    expect(func).toBeCalledTimes(3);
});

test('Periodically refreshed values in cache keep referential integrity', async () => {
    const func = jest.fn();
    const cachedFunction = cacheMe(func, inMemory({ type: 'REFRESH_PERIODICALLY', interval: 1000 }));

    expect(func).toBeCalledTimes(0);
    const response1 = await cachedFunction();
    expect(func).toBeCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(func).toBeCalledTimes(2);

    const response2 = await cachedFunction();
    expect(func).toBeCalledTimes(2);

    expect(response1 === response2).toBe(true);
});

test('Cached values update after read', async () => {
    const func = jest.fn();
    const cachedFunction = cacheMe(func, inMemory({ type: 'REFRESH_AFTER_READ', cooldown: 0 }));

    expect(func).toBeCalledTimes(0);
    await cachedFunction();
    expect(func).toBeCalledTimes(1);

    await cachedFunction();
    expect(func).toBeCalledTimes(2);

    await cachedFunction();
    expect(func).toBeCalledTimes(3);
});

test('Updated values after read are correct', async () => {
    let value = 0;
    const func = jest.fn(async () => value++);

    const cachedFunction = cacheMe(func, inMemory<Promise<number>>({ type: 'REFRESH_AFTER_READ', cooldown: 0 }));

    expect(func).toBeCalledTimes(0);

    const res1 = await cachedFunction();
    expect(func).toBeCalledTimes(1);
    expect(res1).toBe(0);

    const res2 = await cachedFunction();
    expect(func).toBeCalledTimes(2);
    expect(res2).toBe(0);

    const res3 = await cachedFunction();
    expect(func).toBeCalledTimes(3);
    expect(res3).toBe(1);
});

test('Cached value\'s update is asynchronous', async () => {
    const delay = 10_000;

    const artificialDelay = () => new Promise(resolve => {
        const timeout = setTimeout(resolve, delay);
        timeout.unref();
    });

    const func = jest.fn(async () => {
        const timeout = artificialDelay();
        await timeout;
        return 1;
    });

    const cachedFunction = cacheMe(func, inMemory<Promise<number>>({ type: 'REFRESH_AFTER_READ', cooldown: 0 }));

    expect(func).toBeCalledTimes(0);
    const firstPromise = cachedFunction();
    const secondPromise = cachedFunction();

    await Promise.resolve();
    jest.advanceTimersByTime(delay);

    expect(func).toBeCalledTimes(2);

    expect(firstPromise).toEqual(secondPromise);

    const firstValue = await firstPromise;
    const secondValue = await secondPromise;
    expect(firstValue).toEqual(secondValue);
});

test('Cached values are not updated after read in cooldown period', async () => {
    const func = jest.fn(async () => "result");

    const cachedFunction = cacheMe(func, inMemory<Promise<string>>({ type: 'REFRESH_AFTER_READ', cooldown: 5_000 }));

    expect(func).toBeCalledTimes(0);
    await cachedFunction();
    expect(func).toBeCalledTimes(1);
    await cachedFunction();
    expect(func).toBeCalledTimes(1);
});

test('Cached values are updated after read after cooldown period', async () => {
    const cooldown = 5_000;
    const func = jest.fn(async () => "result");

    const cachedFunction = cacheMe(func, inMemory<Promise<string>>({ type: 'REFRESH_AFTER_READ', cooldown }));

    expect(func).toBeCalledTimes(0);
    await cachedFunction();
    expect(func).toBeCalledTimes(1);
    await cachedFunction();
    expect(func).toBeCalledTimes(1);

    jest.advanceTimersByTime(cooldown);

    await cachedFunction();
    expect(func).toBeCalledTimes(2);
});

test('Cached values are updated when updateIf condition is fulfilled', async () => {
    let value = 0;
    const func = jest.fn(async () => value++);

    const cachedFunction = cacheMe(func, inMemory<Promise<number>>({ type: 'REFRESH_AFTER_READ', cooldown: 0, updateIf: async () => true}));

    expect(func).toBeCalledTimes(0);
    expect(await cachedFunction()).toBe(0);
    expect(func).toBeCalledTimes(1);
    expect(await cachedFunction()).toBe(0); // value only gets updated asynchronously after read, hence still 0
    expect(func).toBeCalledTimes(2);
    expect(await cachedFunction()).toBe(1);
    expect(func).toBeCalledTimes(3);
});

test('Cached values are updated when updateIf condition is fulfilled', async () => {
    let value = 0;
    const func = jest.fn(async () => value++);

    const cachedFunction = cacheMe(func, inMemory<Promise<number>>({ type: 'REFRESH_AFTER_READ', cooldown: 0, updateIf: async () => false}));

    expect(func).toBeCalledTimes(0);
    expect(await cachedFunction()).toBe(0);
    expect(func).toBeCalledTimes(1);
    expect(await cachedFunction()).toBe(0);
    expect(func).toBeCalledTimes(2);
    expect(await cachedFunction()).toBe(0); // value never gets updated
    expect(func).toBeCalledTimes(3);
});

test('Cached values are not updated when updateIf condition is not fulfilled', async () => {
    let value = 0;
    const func = jest.fn(async () => {
        return value++;
    });

    async function updateIf(value: Promise<number>) {
        return await value !== 2;
    }

    const cachedFunction = cacheMe(func, inMemory<Promise<number>>({ type: 'REFRESH_AFTER_READ', cooldown: 0, updateIf}));

    // the `await Promise.resolve();` calls are required because the background updates are not awaited and the await
    // inside the test defers further execution of the test and allows the background task to run.

    expect(func).toBeCalledTimes(0);

    expect(await cachedFunction()).toBe(0);
    expect(func).toBeCalledTimes(1);
    await Promise.resolve();

    expect(await cachedFunction()).toBe(0);
    expect(func).toBeCalledTimes(2);
    await Promise.resolve();

    expect(await cachedFunction()).toBe(1);
    expect(func).toBeCalledTimes(3);
    await Promise.resolve();

    expect(await cachedFunction()).toBe(1); // value was not set to 2 because of the updateIf condition
    expect(func).toBeCalledTimes(4);
    await Promise.resolve();

    expect(await cachedFunction()).toBe(3);
    expect(func).toBeCalledTimes(5);
    await Promise.resolve();
});

test('Cached values are removed FIFO when limit is reached', async () => {
    const func = jest.fn((value: number) => value);
    const cachedFunction = cacheMe(func, inMemory<number>({ type: 'DEFAULT_CONFIG', limit: 3 }));

    expect(func).toBeCalledTimes(0);
    expect(await cachedFunction(1)).toBe(1);
    expect(func).toBeCalledTimes(1);
    expect(await cachedFunction(2)).toBe(2);
    expect(func).toBeCalledTimes(2);
    expect(await cachedFunction(3)).toBe(3);
    expect(func).toBeCalledTimes(3);

    expect(await cachedFunction(1)).toBe(1);
    expect(func).toBeCalledTimes(3); // not called again because it's still cached

    expect(await cachedFunction(4)).toBe(4);
    expect(func).toBeCalledTimes(4); // first cached value (1) should be removed here

    expect(await cachedFunction(1)).toBe(1);
    expect(func).toBeCalledTimes(5); // second cached value (2) should be removed here, now in cache 3, 4, 1

    expect(await cachedFunction(3)).toBe(3);
    expect(func).toBeCalledTimes(5); // still in cache, so not called
});

test('Cached values are removed in correct order (round-robin) when limit is reached', async () => {
    const func = jest.fn((value: number) => value);
    const cachedFunction = cacheMe(func, inMemory<number>({ type: 'DEFAULT_CONFIG', limit: 2 }));

    expect(func).toBeCalledTimes(0);
    expect(await cachedFunction(1)).toBe(1);
    expect(func).toBeCalledTimes(1);
    expect(await cachedFunction(1)).toBe(1);
    expect(func).toBeCalledTimes(1);

    expect(await cachedFunction(2)).toBe(2);
    expect(func).toBeCalledTimes(2);
    expect(await cachedFunction(2)).toBe(2);
    expect(func).toBeCalledTimes(2);

    expect(await cachedFunction(1)).toBe(1);
    expect(func).toBeCalledTimes(2);

    expect(await cachedFunction(3)).toBe(3);
    expect(func).toBeCalledTimes(3);

    // (2) still in cache
    expect(await cachedFunction(2)).toBe(2);
    expect(func).toBeCalledTimes(3);

    // (3) also in cache
    expect(await cachedFunction(3)).toBe(3);
    expect(func).toBeCalledTimes(3);

    expect(await cachedFunction(4)).toBe(4);
    expect(func).toBeCalledTimes(4);

    // (3) still in cache
    expect(await cachedFunction(3)).toBe(3);
    expect(func).toBeCalledTimes(4);

    // (4) also in cache
    expect(await cachedFunction(4)).toBe(4);
    expect(func).toBeCalledTimes(4);

    expect(await cachedFunction(5)).toBe(5);
    expect(func).toBeCalledTimes(5);

    // (4) still in cache
    expect(await cachedFunction(4)).toBe(4);
    expect(func).toBeCalledTimes(5);

    // (5) also in cache
    expect(await cachedFunction(5)).toBe(5);
    expect(func).toBeCalledTimes(5);
});