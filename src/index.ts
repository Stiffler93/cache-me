import objectHash from 'object-hash';
import { inMemory } from './in-memory-cache';

export type AnyFunction = (...p: any[]) => any;
export type TypedFunction<Params, Value> = (p: Params) => Value;
export type Closure<Value> = () => Value;
export type Cached<Value> = { value: Value };


export type PersistInput<ReturnValue> = {key: string; fetchFn: Closure<ReturnValue>};

export interface CacheStrategy<ReturnValue> {
    retrieve: (key: string) => Cached<ReturnValue> | undefined;
    persist: (input: PersistInput<ReturnValue>) => ReturnValue;
}

export function cacheMe<F extends AnyFunction, P extends Parameters<F>, R extends ReturnType<F>>(fn: F, cacheStrategy: CacheStrategy<R> = inMemory(), ...eager: Array<P>) {

    const func = (...params: P): R => {
        const key = objectHash([fn.name, ...params]);

        const cached = cacheStrategy.retrieve(key);

        if(typeof cached !== 'undefined') {
            return cached.value;
        }

        const fetchFn: Closure<R> = fn.bind(params);

        const value = cacheStrategy.persist({key, fetchFn});
        return value;
    };

    // eager initialization
    for (const params of eager) {
        func(...params);
    }

    return func;
}
