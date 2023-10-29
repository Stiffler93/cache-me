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
    });

    beforeEach(async () => {
        host = await redisServer.getHost();
        port = await redisServer.getPort();

        await redisServer.ensureInstance();
        redisClient = new Redis({ host, port });
    });

    afterEach(async () => {
        // disconnect and stop Redis server & client after every test
        // and start each test with a clean state
        if (redisClient) {
            redisClient.disconnect();
        }
        await redisServer.stop();
    });

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
