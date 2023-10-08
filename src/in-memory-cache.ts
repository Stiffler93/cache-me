import { CacheStrategy, Cached, Closure, PersistInput } from '.';

type ExpirationConfig = {
    ttl: number;
    resetTTLOnRead: boolean;
};
type RefreshConfig = {
    type: 'PERIODICALLY';
    interval: number; // ms
} | {
    type: 'AFTER_READ';
};

export type Config = {
    expiration?: ExpirationConfig;
    autoRefresh?: RefreshConfig;
}

type Entry<ReturnValue> = {
    value: () => ReturnValue;
    fetchFn: Closure<ReturnValue>,
    key: string;
    expirationTimeout?: NodeJS.Timeout;
    refreshInterval?: NodeJS.Timeout;
}
type Cache<ReturnValue> = Map<string, Entry<ReturnValue>>;

class InMemoryCache<ReturnValue> implements CacheStrategy<ReturnValue> {
    private cache: Cache<ReturnValue>;
    private config: Config;

    constructor(config: Config) {
        this.cache = new Map();
        this.config = config;
    }
    
    public async retrieve(key: string): Promise<Cached<ReturnValue> | undefined> {
        const entry = this.cache.get(key);

        if (entry) {
            return {
                value: entry.value(),
            };
        }

        return undefined;
    };
    
    public async persist({key, fetchFn}: PersistInput<ReturnValue>): Promise<ReturnValue> {
        const value = fetchFn();
        this.cache.set(key, await this.toCacheEntry(key, value, fetchFn));
        return value;
    };

    async updateValueInCache(key: string) {
        const entry = this.cache.get(key);
        if (entry) {
            const get = await this.getValueGetter(entry.fetchFn(), key, entry.expirationTimeout);
            entry.value = get;
            this.cache.set(key, entry);
        }
    }

    async getRefreshInterval(key: string): Promise<NodeJS.Timeout | undefined> {
        const config = this.config.autoRefresh;

        if (config?.type === 'PERIODICALLY') {
            const refreshInterval = setInterval(() => {
                this.updateValueInCache(key);
            }, config.interval);
            refreshInterval.unref();
            return refreshInterval;
        }

        return undefined;
    }

    async getExpirationTimeout(key: string, refreshInterval?: NodeJS.Timeout): Promise<NodeJS.Timeout | undefined> {
        const config = this.config.expiration;

        if (config) {
            const expirationTimeout = setTimeout(() => {
                // clean everything up so that it can be GC'd
                if (refreshInterval) {
                    clearInterval(refreshInterval);
                }
                this.cache.delete(key);
            }, config.ttl);

            expirationTimeout.unref();

            return expirationTimeout;
        }

        return undefined;
    }

    async getValueGetter<ReturnValue>(value: ReturnValue, key: string, expirationTimeout?: NodeJS.Timeout): Promise<Closure<ReturnValue>> {
        const getValue = () => {
            // trigger an update in the background if configured
            const autoRefreshConfig = this.config.autoRefresh;
            if (autoRefreshConfig?.type === 'AFTER_READ') {
                this.updateValueInCache(key);
            }

            const expirationConfig = this.config.expiration;
            if (expirationConfig?.resetTTLOnRead) {
                expirationTimeout?.refresh();
            }
            return value;
        };

        return getValue;
    }

    async toCacheEntry(key: string, value: ReturnValue, fetchFn: Closure<ReturnValue>): Promise<Entry<ReturnValue>> {
        const refreshInterval = await this.getRefreshInterval(key);
        const expirationTimeout = await this.getExpirationTimeout(key, refreshInterval);
        const get = await this.getValueGetter(value, key, expirationTimeout);

        return {
            value: get,
            key,
            fetchFn,
            expirationTimeout,
            refreshInterval: refreshInterval,
        };
    }
}

export function inMemory<ReturnValue>(config: Config = {}): CacheStrategy<ReturnValue> {
    return new InMemoryCache<ReturnValue>(config);
}
