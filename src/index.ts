import objectHash from 'object-hash';

type AnyFunction = (...p: any[]) => any;

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

type Config = {
    expiration?: ExpirationConfig;
    autoRefresh?: RefreshConfig;
}

type Entry<Value, Params> = {
    value: () => Value;
    params: Params;
    expirationTimeout?: NodeJS.Timeout;
    refreshInterval?: NodeJS.Timeout;
}
type Cache<Value, Params = Array<unknown>> = Map<string, Entry<Value, Params>>;

type EntryContext<F, Value> = {
    cache: Cache<Value>;
    config: Config;
    fetchFn: F;
}

const DEFAULT_CONFIG: Config = {
    expiration: {
        ttl: 60_000,
        resetTTLOnRead: false,
    },
    autoRefresh: undefined,
};

function getRefreshInterval<F, Value>(context: EntryContext<F, Value>): NodeJS.Timeout | undefined {
    const config = context.config.autoRefresh;
    const refreshInterval = config?.type === 'PERIODICALLY' ? setInterval(() => {}, config.interval) : undefined;
    return refreshInterval;
}

function getExpirationTimeout<F, Value>(key: string, context: EntryContext<F, Value>, refreshTimer?: NodeJS.Timeout) {
    const config = context.config.expiration;
    const expirationTimeout = config ? setTimeout(() => {
        console.log('Timer expired');
        // clean everything up so that it can be GC'd
        if (refreshTimer) {
            clearInterval(refreshTimer);
        }
        context.cache.delete(key);
    }, config.ttl) : undefined;

    return expirationTimeout;
}

function getValueGetter<F extends AnyFunction, Value>(value: Value, context: EntryContext<F, Value>, expirationTimer?: NodeJS.Timeout) {
    const getValue = () => {
        // trigger an update in the background if configured
        const autoRefreshConfig = context.config.autoRefresh;
        if (autoRefreshConfig?.type === 'AFTER_READ') {
            new Promise((resolve) => {
                const value = context.fetchFn(1);
            })
        }

        const expirationConfig = context.config.expiration;
        if (expirationConfig?.resetTTLOnRead) {
            expirationTimer && expirationTimer.refresh();
        }
        return value;
    };

    return getValue;
}

export function augment<F extends AnyFunction, P extends Parameters<F>, R extends ReturnType<F>>(fn: F, config: Config = DEFAULT_CONFIG, ...eager: Array<P>) {
    const cache: Cache<R> = new Map();
    const context: EntryContext<F, R> = {
        cache,
        config,
        fetchFn: fn,
    };

    const toEntry = <Value, Params>(key: string, value: Value, params: Params): Entry<Value, Params> => {
        const refreshInterval = getRefreshInterval(context);
        const expirationTimeout = getExpirationTimeout(key, context, refreshInterval);
        const get = getValueGetter(value, context);

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
            console.log(`from cache ${key}:${entry.value()}`);
            return entry.value();
        }

        const value = fn(params);

        console.log(`calculated ${key}:${value}`);

        cache.set(key, toEntry(key, value, params));
        return value;
    };

    // eager initialization
    for (const params of eager) {
        func(...params);
    }

    return func;
}


async function test1() {
    console.log('call test1');
}

async function test2(_: number) {

}

async function test3(_: string): Promise<boolean> {
    return false;
}

const test4 = async (_: object): Promise<number> => {
    return 7;
}

const test5 = (_: object): number => {
    return 7;
}

// const a = augment(test1, { ttl: 1 });
// a();
// a();
// a();
// a();
const b = augment(test2, {}, [1], [9]);
b(3);
b(8);
b(8);
b(0);
b(2);
// const c = augment(test3);
// // const d = augment(3);
// const e = augment(test4);
// const f = augment(test5);
