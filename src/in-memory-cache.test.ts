import { cacheMe } from '.';
import { inMemory } from './in-memory-cache';

jest.useFakeTimers();

test('Cached function returns correct result', () => {
    const cachedFunction = cacheMe(() => 1);

    expect(cachedFunction()).toBe(1);
    expect(cachedFunction()).toBe(1);
    expect(cachedFunction()).toBe(1);
});

test('Cached function is actually only called once', () => {
    const func = jest.fn();
    const cachedFunction = cacheMe(func);

    expect(func).toBeCalledTimes(0);
    cachedFunction();
    expect(func).toBeCalledTimes(1);
    cachedFunction();
    expect(func).toBeCalledTimes(1);
});

test('Cached function is called once for every unique parameter', () => {
    const func = jest.fn((_: number) => {});
    const cachedFunction = cacheMe(func);

    expect(func).toBeCalledTimes(0);
    cachedFunction(1);
    expect(func).toBeCalledTimes(1);
    cachedFunction(2);
    expect(func).toBeCalledTimes(2);
    cachedFunction(3);
    expect(func).toBeCalledTimes(3);
    cachedFunction(1);
    expect(func).toBeCalledTimes(3);
});

test('Cache is warmed-up correctly', () => {
    const func = jest.fn((_: number) => {});
    cacheMe(func, inMemory<void>(), [1], [2], [3]);

    expect(func).toBeCalledTimes(3);
});

test('Cached values do not expire when not configured', () => {
    const func = jest.fn();
    const cachedFunction = cacheMe(func);

    expect(func).toBeCalledTimes(0);
    cachedFunction();
    expect(func).toBeCalledTimes(1);
    cachedFunction();
    expect(func).toBeCalledTimes(1);

    jest.advanceTimersByTime(1_000_000);

    cachedFunction();
    expect(func).toBeCalledTimes(1);
});

test('Cache expires data correctly', () => {
    const func = jest.fn();
    const cachedFunction = cacheMe(func, inMemory({ expiration: { ttl: 10_000, resetTTLOnRead: false } }));

    expect(func).toBeCalledTimes(0);
    cachedFunction();
    expect(func).toBeCalledTimes(1);
    cachedFunction();
    expect(func).toBeCalledTimes(1);

    // advance timers to expire cache
    jest.advanceTimersByTime(10_000);

    cachedFunction();
    expect(func).toBeCalledTimes(2);
});

test('Cached values TTL is reset on read', () => {
    const func = jest.fn();
    const cachedFunction = cacheMe(func, inMemory({ expiration: { ttl: 2000, resetTTLOnRead: true } }));

    expect(func).toBeCalledTimes(0);
    cachedFunction();
    expect(func).toBeCalledTimes(1);
    jest.advanceTimersByTime(1000);

    cachedFunction();
    expect(func).toBeCalledTimes(1);
    jest.advanceTimersByTime(1000);

    cachedFunction();
    expect(func).toBeCalledTimes(1);
    jest.advanceTimersByTime(1000);

    cachedFunction();
    expect(func).toBeCalledTimes(1);
    jest.advanceTimersByTime(1000);

    cachedFunction();
    expect(func).toBeCalledTimes(1);
});

test('Cached values TTL is not reset on read when not configured', () => {
    const func = jest.fn();
    const cachedFunction = cacheMe(func, inMemory({ expiration: { ttl: 2000, resetTTLOnRead: false } }));

    expect(func).toBeCalledTimes(0);
    cachedFunction();
    expect(func).toBeCalledTimes(1);
    jest.advanceTimersByTime(1000);

    cachedFunction();
    expect(func).toBeCalledTimes(1);
    jest.advanceTimersByTime(1000);

    cachedFunction();
    expect(func).toBeCalledTimes(2);
});

test('Cached values are refreshed periodically', () => {
    const func = jest.fn();
    const cachedFunction = cacheMe(func, inMemory({ autoRefresh: { type: 'PERIODICALLY', interval: 1000 } }));

    expect(func).toBeCalledTimes(0);
    cachedFunction();
    expect(func).toBeCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(func).toBeCalledTimes(2);

    jest.advanceTimersByTime(1000);
    expect(func).toBeCalledTimes(3);
});

test('Periodically refreshed values in cache keep referential integrity', () => {
    const func = jest.fn();
    const cachedFunction = cacheMe(func, inMemory({ autoRefresh: { type: 'PERIODICALLY', interval: 1000 } }));

    expect(func).toBeCalledTimes(0);
    const response1 = cachedFunction();
    expect(func).toBeCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(func).toBeCalledTimes(2);

    const response2 = cachedFunction();
    expect(func).toBeCalledTimes(2);

    expect(response1 === response2).toBe(true);
});

test('Cached values update after read', () => {
    const func = jest.fn();
    const cachedFunction = cacheMe(func, inMemory({ autoRefresh: { type: 'AFTER_READ' } }));

    expect(func).toBeCalledTimes(0);
    cachedFunction();
    expect(func).toBeCalledTimes(1);

    cachedFunction();
    expect(func).toBeCalledTimes(2);

    cachedFunction();
    expect(func).toBeCalledTimes(3);
});
