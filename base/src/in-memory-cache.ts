import { CacheStrategy, Cached, Closure, PersistInput } from '.';
import { log } from './logger';

export type Config<ReturnValue> = Partial<{
    ttlInMs: number;
    resetTTLOnRead: boolean;
    refreshIntervalInMs: number;
    refreshAfterRead: boolean;
    cooldownInMs: number;
    limit: number;
    cacheWhen: (value: ReturnValue) => Promise<boolean>;
}>;

type Entry<ReturnValue> = {
    value: () => ReturnValue;
    fetchFn: Closure<ReturnValue>;
    expirationTimeout?: NodeJS.Timeout;
    refreshInterval?: NodeJS.Timeout;
    modified: number;
};
type Cache<ReturnValue> = Map<string, Entry<ReturnValue>>;

class InMemoryCache<ReturnValue> implements CacheStrategy<ReturnValue> {
    private cache: Cache<ReturnValue>;
    private config: Config<ReturnValue>;
    private cachedValuesOrdered: Array<string>;
    private persistCounter: number;

    constructor(config: Config<ReturnValue>) {
        this.cache = new Map();
        this.config = config;
        this.cachedValuesOrdered = new Array(config.limit);
        this.persistCounter = 0;
    }

    public async retrieve(
        key: string
    ): Promise<Cached<ReturnValue> | undefined> {
        log('Retrieve cached value.');
        const entry = this.cache.get(key);

        if (entry) {
            log('Value found in cache.');
            return {
                value: entry.value(),
            };
        }

        log('Value not found in cache.');

        return undefined;
    }

    public async persist({
        key,
        fetchFn,
    }: PersistInput<ReturnValue>): Promise<ReturnValue> {
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

        await this.insertValueIntoCache(key, value, fetchFn);

        return value;
    }

    async insertValueIntoCache(
        key: string,
        value: ReturnValue,
        fetchFn: Closure<ReturnValue>
    ) {
        log('Insert value into cache.');
        this.cache.set(key, await this.toCacheEntry(key, value, fetchFn));

        if (this.config.limit) {
            log(`Evaluate configured \`limit\` of ${this.config.limit}`);
            const removeKey = this.cachedValuesOrdered[this.persistCounter];
            this.cachedValuesOrdered[this.persistCounter] = key;
            this.persistCounter = (this.persistCounter + 1) % this.config.limit;
            if (removeKey) {
                log('`limit` was hit.');
                this.removeValueFromCache(removeKey);
            }
        }
    }

    async updateValueInCache(key: string, cooldown: number = 0) {
        log('Update value in cache.');
        const entry = this.cache.get(key);
        if (entry) {
            log('Cached value was found.');
            const currentTime = new Date().getTime();
            const inCooldown = entry.modified + cooldown > currentTime;

            if (inCooldown) {
                log(
                    'Cached value is still in `cooldown` period -> do not update value.'
                );
                return;
            }

            const value = entry.fetchFn();

            if (this.config.cacheWhen) {
                log('Evaluate `cachedWhen` condition.');
                const executeUpdate = await this.config.cacheWhen(value);
                if (!executeUpdate) {
                    log(
                        '`cachedWhen` is not fullfilled -> do not update value.'
                    );
                    return;
                }
                log('`cachedWhen` is fullfilled -> update value.');
            }

            const get = await this.getValueGetter(
                value,
                key,
                entry.expirationTimeout
            );
            entry.value = get;
            entry.modified = new Date().getTime();
            this.cache.set(key, entry);
        }
    }

    async removeValueFromCache(key: string) {
        log('Remove value from cache');
        const entry = this.cache.get(key);
        if (entry) {
            // clean everything up so that it can be GC'd
            entry.expirationTimeout && clearTimeout(entry.expirationTimeout);
            entry.refreshInterval && clearInterval(entry.refreshInterval);

            this.cache.delete(key);
        }
    }

    async getRefreshInterval(key: string): Promise<NodeJS.Timeout | undefined> {
        if (this.config.refreshIntervalInMs) {
            const refreshInterval = setInterval(() => {
                this.updateValueInCache(key);
            }, this.config.refreshIntervalInMs);
            refreshInterval.unref();
            return refreshInterval;
        }

        return undefined;
    }

    async getExpirationTimeout(
        key: string,
        refreshInterval?: NodeJS.Timeout
    ): Promise<NodeJS.Timeout | undefined> {
        if (this.config.ttlInMs) {
            const expirationTimeout = setTimeout(() => {
                // clean everything up so that it can be GC'd
                if (refreshInterval) {
                    clearInterval(refreshInterval);
                }
                this.cache.delete(key);
            }, this.config.ttlInMs);

            expirationTimeout.unref();

            return expirationTimeout;
        }

        return undefined;
    }

    async getValueGetter<ReturnValue>(
        value: ReturnValue,
        key: string,
        expirationTimeout?: NodeJS.Timeout
    ): Promise<Closure<ReturnValue>> {
        const getValue = () => {
            // trigger an update in the background if configured
            if (this.config.refreshAfterRead) {
                this.updateValueInCache(key, this.config.cooldownInMs);
            }

            if (this.config.resetTTLOnRead) {
                expirationTimeout?.refresh();
            }

            return value;
        };

        return getValue;
    }

    async toCacheEntry(
        key: string,
        value: ReturnValue,
        fetchFn: Closure<ReturnValue>
    ): Promise<Entry<ReturnValue>> {
        const refreshInterval = await this.getRefreshInterval(key);
        const expirationTimeout = await this.getExpirationTimeout(
            key,
            refreshInterval
        );
        const get = await this.getValueGetter(value, key, expirationTimeout);

        return {
            value: get,
            fetchFn,
            expirationTimeout,
            refreshInterval: refreshInterval,
            modified: new Date().getTime(),
        };
    }
}

export function inMemory<ReturnValue>(
    config: Config<ReturnValue> = {}
): CacheStrategy<ReturnValue> {
    return new InMemoryCache<ReturnValue>(config);
}
