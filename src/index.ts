import objectHash from 'object-hash';
import { AnyFunction, Cache, Config, Entry, EntryContext } from './types';

const DEFAULT_CONFIG: Config = {
    expiration: {
        ttl: 60_000,
        resetTTLOnRead: false,
    },
    autoRefresh: undefined,
};

function getRefreshInterval<Params, Value>(context: EntryContext<Params, Value>): NodeJS.Timeout | undefined {
    const config = context.config.autoRefresh;

    if (config?.type === 'PERIODICALLY') {
        const refreshInterval = setInterval(() => {
            // const value = context.fetchFn()
        }, config.interval);
        refreshInterval.unref();
        return refreshInterval;
    }

    return undefined;
}

function getExpirationTimeout<Params, Value>(key: string, context: EntryContext<Params, Value>, refreshInterval?: NodeJS.Timeout) {
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

function getValueGetter<Params, Value>(value: Value, params: Params, context: EntryContext<Params, Value>, expirationTimeout?: NodeJS.Timeout) {
    const getValue = () => {
        // trigger an update in the background if configured
        const autoRefreshConfig = context.config.autoRefresh;
        if (autoRefreshConfig?.type === 'AFTER_READ') {
            new Promise((resolve) => {
                const value = context.fetchFn(params);
            })
        }

        const expirationConfig = context.config.expiration;
        if (expirationConfig?.resetTTLOnRead) {
            expirationTimeout?.refresh();
        }
        return value;
    };

    return getValue;
}

export function cacheMe<F extends AnyFunction, P extends Parameters<F>, R extends ReturnType<F>>(fn: F, config: Config = DEFAULT_CONFIG, ...eager: Array<P>) {
    const cache: Cache<P, R> = new Map();
    const context: EntryContext<P, R> = {
        cache,
        config,
        fetchFn: fn,
    };

    const toEntry = (key: string, value: R, params: P): Entry<P, R> => {
        const refreshInterval = getRefreshInterval(context);
        const expirationTimeout = getExpirationTimeout(key, context, refreshInterval);
        const get = getValueGetter(value, params, context, expirationTimeout);

        return {
            value: get,
            params,
            expirationTimeout,
            refreshInterval: refreshInterval,
        };
    };

    const func = (...params: P): R => {
        const key = objectHash([fn.name, ...params]);

        const entry = cache.get(key);
        if(typeof entry !== 'undefined') {
            return entry.value();
        }

        const value = fn(params);

        cache.set(key, toEntry(key, value, params));
        return value;
    };

    // eager initialization
    for (const params of eager) {
        func(...params);
    }

    return func;
}
