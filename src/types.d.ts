export type AnyFunction = (...p: any[]) => any;
export type TypedFunction<Params, Value> = (p: Params) => Value;
export type Closure<Value> = () => Value;

export type ExpirationConfig = {
    ttl: number;
    resetTTLOnRead: boolean;
};
export type RefreshConfig = {
    type: 'PERIODICALLY';
    interval: number; // ms
} | {
    type: 'AFTER_READ';
};

export type Config = {
    expiration?: ExpirationConfig;
    autoRefresh?: RefreshConfig;
}

export type Entry<ReturnValue> = {
    value: () => ReturnValue;
    fetchFn: Closure<ReturnValue>,
    key: string;
    expirationTimeout?: NodeJS.Timeout;
    refreshInterval?: NodeJS.Timeout;
}
export type Cache<ReturnValue> = Map<string, Entry<ReturnValue>>;

export type EntryContext<ReturnValue> = {
    cache: Cache<ReturnValue>;
    config: Config;
}
