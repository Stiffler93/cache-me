import { CacheStrategy, Cached, PersistInput } from '@cache-me/base';
import { RedisCommander } from 'ioredis';
import { log } from './logger';

export type Config<ReturnValue> = {
    redis: RedisCommander;
    ttlInMs?: number;
    cacheWhen?: (value: ReturnValue) => Promise<boolean>;
};
class InRedisCache<ReturnValue> implements CacheStrategy<ReturnValue> {
    private redis: RedisCommander;
    private config: Config<ReturnValue>;

    constructor(config: Config<ReturnValue>) {
        this.config = config;
        this.redis = config.redis;
    }

    public async retrieve(
        key: string
    ): Promise<Cached<Awaited<ReturnValue>> | undefined> {
        log('Retrieve cached value.');
        const entry = await this.redis.get(key);

        if (entry) {
            log('Value found in cache.');
            const value: Awaited<ReturnValue> = JSON.parse(entry);
            return { value };
        }

        log('Value not found in cache.');

        return undefined;
    }

    public async persist({
        key,
        fetchFn,
    }: PersistInput<ReturnValue>): Promise<Awaited<ReturnValue>> {
        log('Persist value in cache.');
        const value = await fetchFn();

        if (this.config.cacheWhen) {
            log('Evaluate `cachedWhen` condition.');
            const executeInsert = await this.config.cacheWhen(value);
            if (!executeInsert) {
                log('`cachedWhen` is not fullfilled -> do not cache value.');
                return value;
            }
            log('`cachedWhen` is fullfilled -> cache value.');
        }

        log('Insert value into cache.');
        if (this.config.ttlInMs) {
            this.redis.set(
                key,
                JSON.stringify(value),
                'PX',
                this.config.ttlInMs
            );
        } else {
            this.redis.set(key, JSON.stringify(value));
        }

        return value;
    }
}

export function inRedis<ReturnValue>(
    config: Config<ReturnValue>
): CacheStrategy<ReturnValue> {
    return new InRedisCache(config);
}
