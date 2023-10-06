export type AnyFunction = (...p: any[]) => any;
export type TypedFunction<Params, Value> = (p: Params) => Value;

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

export type Entry<Params, Value> = {
    value: () => Value;
    params: Params;
    expirationTimeout?: NodeJS.Timeout;
    refreshInterval?: NodeJS.Timeout;
}
export type Cache<Params, Value> = Map<string, Entry<Params, Value>>;

export type EntryContext<Params, Value> = {
    cache: Cache<Params, Value>;
    config: Config;
    fetchFn: TypedFunction<Params, Value>;
}
