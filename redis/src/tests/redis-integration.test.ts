import { cacheMe } from '@cache-me/base';
import { inRedis } from '../in-redis-cache';

import { RedisMemoryServer } from 'redis-memory-server';
import { Redis } from 'ioredis';

// Redis memory server version can be overwritten by setting REDISMS_VERSION env variable

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Works with Redis stable version', () => {
    let redisServer: RedisMemoryServer;
    let redisClient: Redis;
    let host: string;
    let port: number;

    beforeAll(() => {
        redisServer = new RedisMemoryServer();
    }, 60_000);

    beforeEach(async () => {
        console.log('beforeEach');
        host = await redisServer.getHost();
        port = await redisServer.getPort();

        console.log({ host, port });

        await redisServer.ensureInstance();

        console.log('create Redis client:');
        redisClient = new Redis({ host, port });
        console.log('Redis client created');
    }, 60_000);

    afterEach(async () => {
        console.log('afterEach');

        // disconnect and stop Redis server & client after every test
        // and start each test with a clean state
        if (redisClient) {
            console.log('disconnect redis client');
            redisClient.disconnect();
            console.log('redis client disconnected');
        }

        console.log('stop Redis server:');
        await redisServer.stop();
        console.log('Redis server stopped');
    }, 60_000);

    test('Caching works correctly', async () => {
        const func = jest.fn(async () => 'value');
        const cachedFunction = cacheMe(
            func,
            inRedis({
                redis: redisClient,
            })
        );
        expect(func).toBeCalledTimes(0);
        expect(await cachedFunction()).toBe('value');
        expect(func).toBeCalledTimes(1);
        expect(await cachedFunction()).toBe('value');
        expect(func).toBeCalledTimes(1);
    });

    test('Cached value is expired correctly when ttlInMs is set', async () => {
        const ttlInMs = 97;
        const value = { works: true };
        const func = jest.fn(async () => value);
        const cachedFunction = cacheMe(
            func,
            inRedis({
                redis: redisClient,
                ttlInMs,
            })
        );

        expect(func).toBeCalledTimes(0);
        expect(await cachedFunction()).toStrictEqual(value);
        expect(func).toBeCalledTimes(1);
        expect(await cachedFunction()).toStrictEqual(value);
        expect(func).toBeCalledTimes(1);
        expect(await cachedFunction()).toStrictEqual(value);
        expect(func).toBeCalledTimes(1);

        await sleep(ttlInMs);

        expect(await cachedFunction()).toStrictEqual(value);
        expect(func).toBeCalledTimes(2);
    });
});
