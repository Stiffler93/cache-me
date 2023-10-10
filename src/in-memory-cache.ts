import { CacheStrategy, Cached, Closure, PersistInput } from '.';

type ExpirationConfig = {
    type: 'EXPIRE_AFTER';
    ttl: number;
    resetTTLOnRead: boolean;
};
type RefreshConfig<ReturnValue> = ({
    type: 'REFRESH_PERIODICALLY';
    interval: number; // ms
} | {
    type: 'REFRESH_AFTER_READ';
    cooldown: number; // ms
}) & {
    updateIf?: (value: ReturnValue) => Promise<boolean>;
};
type NoConfig = {
    type: 'NO_CONFIG';
};

export type Config<ReturnValue> = ExpirationConfig | RefreshConfig<ReturnValue> | NoConfig;

type Entry<ReturnValue> = {
    value: () => ReturnValue;
    fetchFn: Closure<ReturnValue>,
    expirationTimeout?: NodeJS.Timeout;
    refreshInterval?: NodeJS.Timeout;
    modified: number;
}
type Cache<ReturnValue> = Map<string, Entry<ReturnValue>>;

class InMemoryCache<ReturnValue> implements CacheStrategy<ReturnValue> {
    private cache: Cache<ReturnValue>;
    private config: Config<ReturnValue>;

    constructor(config: Config<ReturnValue>) {
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
        const value = await fetchFn();
        this.cache.set(key, await this.toCacheEntry(key, value, fetchFn));
        return value;
    };

    async updateValueInCache(key: string, cooldown: number = 0) {
        const entry = this.cache.get(key);
        if (entry) {
            const currentTime = new Date().getTime();
            const inCooldown = (entry.modified + cooldown) > currentTime;

            if (inCooldown) {
                return;
            }

            const value = entry.fetchFn();

            if (this.config.type === 'REFRESH_PERIODICALLY' || this.config.type === 'REFRESH_AFTER_READ') {
                const executeUpdate = this.config.updateIf ? await this.config.updateIf(value) : true;
                if (!executeUpdate) {
                    return;
                }
            }

            const get = await this.getValueGetter(value, key, entry.expirationTimeout);
            entry.value = get;
            entry.modified = new Date().getTime();
            this.cache.set(key, entry);
        }
    }

    async getRefreshInterval(key: string): Promise<NodeJS.Timeout | undefined> {
        if (this.config.type === 'REFRESH_PERIODICALLY') {
            const refreshInterval = setInterval(() => {
                this.updateValueInCache(key);
            }, this.config.interval);
            refreshInterval.unref();
            return refreshInterval;
        }

        return undefined;
    }

    async getExpirationTimeout(key: string, refreshInterval?: NodeJS.Timeout): Promise<NodeJS.Timeout | undefined> {
        if (this.config.type === 'EXPIRE_AFTER') {
            const expirationTimeout = setTimeout(() => {
                // clean everything up so that it can be GC'd
                if (refreshInterval) {
                    clearInterval(refreshInterval);
                }
                this.cache.delete(key);
            }, this.config.ttl);

            expirationTimeout.unref();

            return expirationTimeout;
        }

        return undefined;
    }

    async getValueGetter<ReturnValue>(value: ReturnValue, key: string, expirationTimeout?: NodeJS.Timeout): Promise<Closure<ReturnValue>> {
        const getValue = () => {
            // trigger an update in the background if configured
            if (this.config.type === 'REFRESH_AFTER_READ') {
                this.updateValueInCache(key, this.config.cooldown);
            }

            if (this.config.type === 'EXPIRE_AFTER' && this.config.resetTTLOnRead) {
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
            fetchFn,
            expirationTimeout,
            refreshInterval: refreshInterval,
            modified: new Date().getTime(),
        };
    }
}

export function inMemory<ReturnValue>(config: Config<ReturnValue> = {type: 'NO_CONFIG'}): CacheStrategy<ReturnValue> {
    return new InMemoryCache<ReturnValue>(config);
}
