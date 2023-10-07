import objectHash from 'object-hash';
import { AnyFunction, Cache, Closure, Config, Entry, EntryContext } from './types';

const DEFAULT_CONFIG: Config = {
    expiration: {
        ttl: 60_000,
        resetTTLOnRead: false,
    },
    autoRefresh: undefined,
};

type UpdateValueInCacheInput<ReturnValue> = {key: string, context: EntryContext<ReturnValue>};
async function updateValueInCache<ReturnValue>({key, context}: UpdateValueInCacheInput<ReturnValue>) {
    const entry = context.cache.get(key);
    if (entry) {
        const get = getValueGetter({value: entry.fetchFn(), key, context, expirationTimeout: entry.expirationTimeout});
        entry.value = get;
        context.cache.set(key, entry);
    }
}

type GetRefreshIntervalInput<ReturnValue> = {key: string; context: EntryContext<ReturnValue>};
function getRefreshInterval<ReturnValue>({key, context}: GetRefreshIntervalInput<ReturnValue>): NodeJS.Timeout | undefined {
    const config = context.config.autoRefresh;

    if (config?.type === 'PERIODICALLY') {
        const refreshInterval = setInterval(() => {
            updateValueInCache({key, context});
        }, config.interval);
        refreshInterval.unref();
        return refreshInterval;
    }

    return undefined;
}

type GetExpirationTimeoutInput<ReturnValue> = {key: string, context: EntryContext<ReturnValue>, refreshInterval?: NodeJS.Timeout};
function getExpirationTimeout<ReturnValue>({key, context, refreshInterval}: GetExpirationTimeoutInput<ReturnValue>) {
    const config = context.config.expiration;

    if (config) {
        const expirationTimeout = setTimeout(() => {
            // clean everything up so that it can be GC'd
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
            context.cache.delete(key);
        }, config.ttl);

        expirationTimeout.unref();

        return expirationTimeout;
    }

    return undefined;
}

type GetValueGetterInput<ReturnValue> = {value: ReturnValue, key: string, context: EntryContext<ReturnValue>, expirationTimeout?: NodeJS.Timeout};
function getValueGetter<ReturnValue>({value, key, context, expirationTimeout}: GetValueGetterInput<ReturnValue>) {
    const getValue = () => {
        // trigger an update in the background if configured
        const autoRefreshConfig = context.config.autoRefresh;
        if (autoRefreshConfig?.type === 'AFTER_READ') {
            updateValueInCache({key, context});
        }

        const expirationConfig = context.config.expiration;
        if (expirationConfig?.resetTTLOnRead) {
            expirationTimeout?.refresh();
        }
        return value;
    };

    return getValue;
}

type ToEntryInput<ReturnValue> = {key: string, value: ReturnValue, fetchFn: Closure<ReturnValue>, context: EntryContext<ReturnValue>};
function toEntry<ReturnValue>({key, value, context, fetchFn}: ToEntryInput<ReturnValue>): Entry<ReturnValue> {
    const refreshInterval = getRefreshInterval({key, context});
    const expirationTimeout = getExpirationTimeout({key, context, refreshInterval});
    const get = getValueGetter({value, key, context, expirationTimeout});

    return {
        value: get,
        key,
        fetchFn,
        expirationTimeout,
        refreshInterval: refreshInterval,
    };
};

export function cacheMe<F extends AnyFunction, P extends Parameters<F>, R extends ReturnType<F>>(fn: F, config: Config = DEFAULT_CONFIG, ...eager: Array<P>) {
    const cache: Cache<R> = new Map();
    const context: EntryContext<R> = {
        cache,
        config,
    };

    const func = (...params: P): R => {
        const key = objectHash([fn.name, ...params]);

        const entry = cache.get(key);
        if(typeof entry !== 'undefined') {
            return entry.value();
        }

        const value = fn(params);

        const fetchFn: Closure<R> = fn.bind(params);

        cache.set(key, toEntry({key, value, fetchFn, context}));
        return value;
    };

    // eager initialization
    for (const params of eager) {
        func(...params);
    }

    return func;
}
