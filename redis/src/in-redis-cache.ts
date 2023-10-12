import {CacheStrategy, Cached, PersistInput} from '@cache-me/base';

class InRedisCache<ReturnValue> implements CacheStrategy<ReturnValue> {
    retrieve(key: string): Promise<Cached<ReturnValue> | undefined> {
        return Promise.resolve(undefined);
    }

    persist(input: PersistInput<ReturnValue>): Promise<ReturnValue> {
        return Promise.resolve({} as ReturnValue);
    }
}

export function inRedis<ReturnValue>() : CacheStrategy<ReturnValue> {
    return new InRedisCache<ReturnValue>();
}