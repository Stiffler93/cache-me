import { cacheMe } from '.';
import { inMemory } from './in-memory-cache';

jest.useFakeTimers();

test('Cached function returns correct result', async () => {
    const cachedFunction = cacheMe(() => 1);

    expect(await cachedFunction()).toBe(1);
    expect(await cachedFunction()).toBe(1);
    expect(await cachedFunction()).toBe(1);
});

test('Cached function returns correct result for async function', async () => {
    const cachedFunction = cacheMe(async () => 1);

    expect(await cachedFunction()).toBe(1);
    expect(await cachedFunction()).toBe(1);
    expect(await cachedFunction()).toBe(1);
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
    const cachedFunction = cacheMe(func, inMemory({ expiration: { ttl: 10_000, resetTTLOnRead: false } }));

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
    const cachedFunction = cacheMe(func, inMemory({ expiration: { ttl: 2000, resetTTLOnRead: true } }));

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
    const cachedFunction = cacheMe(func, inMemory({ expiration: { ttl: 2000, resetTTLOnRead: false } }));

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
    const cachedFunction = cacheMe(func, inMemory({ autoRefresh: { type: 'PERIODICALLY', interval: 1000 } }));

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
    const cachedFunction = cacheMe(func, inMemory({ autoRefresh: { type: 'PERIODICALLY', interval: 1000 } }));

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
    const cachedFunction = cacheMe(func, inMemory({ autoRefresh: { type: 'AFTER_READ' } }));

    expect(func).toBeCalledTimes(0);
    await cachedFunction();
    expect(func).toBeCalledTimes(1);

    await cachedFunction();
    expect(func).toBeCalledTimes(2);

    await cachedFunction();
    expect(func).toBeCalledTimes(3);
});
