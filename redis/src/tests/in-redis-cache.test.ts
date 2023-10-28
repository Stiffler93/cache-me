import { cacheMe } from '@cache-me/base';
import { inRedis } from '../in-redis-cache';

import { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';

let redis: Redis;

beforeAll(() => {
    redis = new RedisMock();
});

beforeEach(async () => {
    // remove all data
    redis.flushall();
});

test('Strings are correctly cached', async () => {
    const value = 'value';
    const func = jest.fn(async () => value);
    const cachedFunction = cacheMe(func, inRedis({ redis }));
    expect(func).toBeCalledTimes(0);

    expect(await cachedFunction()).toBe(value);
    expect(func).toBeCalledTimes(1);

    expect(await cachedFunction()).toBe(value);
    expect(func).toBeCalledTimes(1);
});

test('Numbers are correctly cached', async () => {
    const value = 7239;
    const func = jest.fn(async () => value);
    const cachedFunction = cacheMe(func, inRedis({ redis }));
    expect(func).toBeCalledTimes(0);

    expect(await cachedFunction()).toBe(value);
    expect(func).toBeCalledTimes(1);

    expect(await cachedFunction()).toBe(value);
    expect(func).toBeCalledTimes(1);
});

test('Booleans are correctly cached', async () => {
    const value = false;
    const func = jest.fn(async () => value);
    const cachedFunction = cacheMe(func, inRedis({ redis }));
    expect(func).toBeCalledTimes(0);

    expect(await cachedFunction()).toBe(value);
    expect(func).toBeCalledTimes(1);

    expect(await cachedFunction()).toBe(value);
    expect(func).toBeCalledTimes(1);
});

test('Objects are correctly cached', async () => {
    const value = { a: 7, c: 'true', f: false };
    const func = jest.fn(async () => value);
    const cachedFunction = cacheMe(func, inRedis({ redis }));
    expect(func).toBeCalledTimes(0);

    expect(await cachedFunction()).toStrictEqual(value);
    expect(func).toBeCalledTimes(1);

    expect(await cachedFunction()).toStrictEqual(value);
    expect(func).toBeCalledTimes(1);
});

test('Complex objects are correctly cached', async () => {
    const value = {
        a: 7,
        c: 'true',
        f: false,
        p: { b: undefined, k: null },
    };
    const func = jest.fn(async () => value);
    const cachedFunction = cacheMe(func, inRedis({ redis }));
    expect(func).toBeCalledTimes(0);

    expect(await cachedFunction()).toEqual(value);
    expect(func).toBeCalledTimes(1);

    expect(await cachedFunction()).toEqual(value);
    expect(func).toBeCalledTimes(1);
});

test('Values are not cached when cacheWhen condition is not fulfilled', async () => {
    const func = jest.fn(async () => 7);
    const cachedFunction = cacheMe(
        func,
        inRedis({ redis, cacheWhen: async () => false })
    );
    expect(func).toBeCalledTimes(0);
    expect(await cachedFunction()).toBe(7);
    expect(func).toBeCalledTimes(1);

    expect(await cachedFunction()).toBe(7);
    expect(func).toBeCalledTimes(2);
});

test('Values are correctly cached when cacheWhen condition is fulfilled', async () => {
    const func = jest.fn(async () => ({}));
    const cachedFunction = cacheMe(
        func,
        inRedis({ redis, cacheWhen: async () => true })
    );
    expect(func).toBeCalledTimes(0);
    expect(await cachedFunction()).toEqual({});
    expect(func).toBeCalledTimes(1);

    expect(await cachedFunction()).toEqual({});
    expect(func).toBeCalledTimes(1);
});

test('Values are not cached when cacheWhen condition is not fulfilled', async () => {
    let value = 0;
    const func = jest.fn(async () => value++);

    const cachedFunction = cacheMe(
        func,
        inRedis({
            redis,
            cacheWhen: async (value) => {
                const v = await value;
                return v >= 2;
            },
        })
    );

    // does not get cached
    expect(func).toBeCalledTimes(0);
    expect(await cachedFunction()).toBe(0);
    expect(func).toBeCalledTimes(1);
    expect(await cachedFunction()).toBe(1);
    expect(func).toBeCalledTimes(2);

    // gets cached here
    expect(await cachedFunction()).toBe(2);
    expect(func).toBeCalledTimes(3);

    // from now it stays the same because it's cached
    expect(await cachedFunction()).toBe(2);
    expect(func).toBeCalledTimes(3);
    expect(await cachedFunction()).toBe(2);
    expect(func).toBeCalledTimes(3);
});

test('Values are correctly expired when ttlInMs is set', async () => {
    const value = false;
    const func = jest.fn(async () => value);
    const cachedFunction = cacheMe(func, inRedis({ redis, ttlInMs: 5 }));
    expect(func).toBeCalledTimes(0);

    expect(await cachedFunction()).toBe(value);
    expect(func).toBeCalledTimes(1);

    expect(await cachedFunction()).toBe(value);
    expect(func).toBeCalledTimes(1);

    // it seems ioredis-mock does not support jest timer advancement
    function sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    await sleep(5);

    expect(await cachedFunction()).toBe(value);
    expect(func).toBeCalledTimes(2);
});
