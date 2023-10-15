import objectHash from 'object-hash';
import { inMemory } from './in-memory-cache';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type AnyFunction = (...p: any[]) => any;
export type TypedFunction<Params, Value> = (p: Params) => Value;
export type Closure<Value> = () => Value;
export type Cached<Value> = { value: Value };

export type PersistInput<ReturnValue> = {
    key: string;
    fetchFn: Closure<ReturnValue>;
};
export interface CacheStrategy<ReturnValue> {
    retrieve: (key: string) => Promise<Cached<ReturnValue> | undefined>;
    persist: (input: PersistInput<ReturnValue>) => Promise<ReturnValue>;
}

export function cacheMe<F extends AnyFunction>(
    fn: F,
    cacheStrategy: CacheStrategy<ReturnType<F>> = inMemory(),
    ...eager: Array<Parameters<F>>
) {
    const func = async (...params: Parameters<F>): Promise<ReturnType<F>> => {
        const key = objectHash([fn.name, ...params]);

        const cached = await cacheStrategy.retrieve(key);

        if (typeof cached !== 'undefined') {
            return cached.value;
        }

        const fetchFn: Closure<ReturnType<F>> = () => fn(...params);

        const value = await cacheStrategy.persist({ key, fetchFn });
        return value;
    };

    // eager initialization
    for (const params of eager) {
        func(...params);
    }

    return func;
}

export { inMemory } from './in-memory-cache';
