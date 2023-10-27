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

type Cache<ReturnValue> = Map<string, Entry<ReturnValue>>;

class Entry<ReturnValue> {
    private key: string;
    private value: ReturnValue;
    private fetchFn: Closure<ReturnValue>;
    private cache: Cache<ReturnValue>;
    private config: Config<ReturnValue>;
    private expirationTimeout?: NodeJS.Timeout;
    private refreshInterval?: NodeJS.Timeout;
    private modified: number;

    constructor(
        key: string,
        value: ReturnValue,
        fetchFn: Closure<ReturnValue>,
        cache: Cache<ReturnValue>,
        config: Config<ReturnValue>
    ) {
        this.key = key;
        this.value = value;
        this.fetchFn = fetchFn;
        this.cache = cache;
        this.config = config;

        this.setupExpirationTimeout();
        this.setupRefreshInterval();

        this.modified = new Date().getTime();
    }

    public delete() {
        log('Delete value from cache');
        this.refreshInterval && clearInterval(this.refreshInterval);
        this.expirationTimeout && clearTimeout(this.expirationTimeout);
        this.cache.delete(this.key);
    }

    async refresh() {
        const currentTime = new Date().getTime();
        const inCooldown =
            this.modified + (this.config.cooldownInMs || 0) > currentTime;

        if (inCooldown) {
            log(
                'Cached value is still in `cooldown` period -> do not update value.'
            );
            return;
        }

        const value = await this.fetchFn();

        if (this.config.cacheWhen) {
            log('Evaluate `cachedWhen` condition.');
            const executeUpdate = await this.config.cacheWhen(value);
            if (!executeUpdate) {
                log('`cachedWhen` is not fullfilled -> do not update value.');
                return;
            }
            log('`cachedWhen` is fullfilled -> update value.');
        }

        this.value = value;
        this.modified = new Date().getTime();
    }

    setupRefreshInterval() {
        if (this.config.refreshIntervalInMs) {
            this.refreshInterval = setInterval(() => {
                this.refresh();
            }, this.config.refreshIntervalInMs);
            this.refreshInterval.unref();
        }
    }

    setupExpirationTimeout() {
        if (this.config.ttlInMs) {
            this.expirationTimeout = setTimeout(
                () => this.delete(),
                this.config.ttlInMs
            );
        }
    }

    getValue(): ReturnValue {
        if (this.config.refreshAfterRead) {
            this.refresh();
        }
        if (this.config.resetTTLOnRead) {
            this.expirationTimeout?.refresh();
        }

        return this.value;
    }
}

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
    ): Promise<Cached<Awaited<ReturnValue>> | undefined> {
        log('Retrieve cached value.');
        const entry = this.cache.get(key);

        if (entry) {
            log('Value found in cache.');
            const value = await entry.getValue();
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
        this.cache.set(
            key,
            new Entry(key, value, fetchFn, this.cache, this.config)
        );

        if (this.config.limit) {
            log(`Evaluate configured \`limit\` of ${this.config.limit}`);
            const removeKey = this.cachedValuesOrdered[this.persistCounter];
            this.cachedValuesOrdered[this.persistCounter] = key;
            this.persistCounter = (this.persistCounter + 1) % this.config.limit;
            if (removeKey) {
                log('`limit` was hit.');
                const entry = this.cache.get(removeKey);
                entry && entry.delete();
            }
        }

        return value;
    }
}

export function inMemory<ReturnValue>(
    config: Config<ReturnValue> = {}
): CacheStrategy<ReturnValue> {
    return new InMemoryCache<ReturnValue>(config);
}
