# @cache-me/base

This is the base package that you need to include to use caching of functions with any arbitrary caching strategy. This package provides in memory caching out of the box, which is also the default.

## In memory cache

This is the default strategy which stores cached values in RAM. It's configurable, offering different means of cache invalidation, value refreshment, limits for cache size and more.

### Examples

```typescript
import { cacheMe, inMemory } from '@cache-me/base';

// falls back to inMemory caching with default config
cacheMe(function);

// cache in memory and expire values after 5000 ms
cacheMe(function, inMemory({ ttlInMs: 5000 }));

// cache in memory, expire values after 5000 ms unless read before. On read, reset TTL.
cacheMe(function, inMemory({ ttlInMs: 2000, resetTTLOnRead: true }));

// refresh the cached value every 30 seconds in background.
cacheMe(function, inMemory({ refreshIntervalInMs: 30_000 }));

// on every read, cached value is returned if present and value is updated in the background
cacheMe(function, inMemory({ refreshAfterRead: true }));

// on every read, cached value is returned if present and value is updated in the background, but not more than once every 5 seconds
cacheMe(function, inMemory({ refreshAfterRead: true, cooldownInMs: 5_000 }));

// caches values for 5 minutes and resets TTL every time a value is read. Furthermore, makes sure that at no point in time there are more than 100 values cached at once.
cacheMe(function, inMemory({ ttlInMs: 300_000, resetTTLOnRead: true, limit: 100 }));

// only cache values when API request was successful
cacheMe(function, inMemory({ cacheWhen: value => {
    return (await value).statusCode === 200;
}}));
```

### Cache configuration

The in memory cache accepts following configurations:

```typescript
export type Config<ReturnValue> = Partial<{
    ttlInMs: number;
    resetTTLOnRead: boolean;
    refreshIntervalInMs: number;
    refreshAfterRead: boolean;
    cooldownInMs: number;
    limit: number;
    cacheWhen: (value: ReturnValue) => Promise<boolean>;
}>;
```

Configuration is optional. Here is an explanation of every single option:

#### ttlInMs

Sets the "time to live" on a value in the cache. The value is in milliseconds and defines the time until the value expires and is removed from the cache.

#### resetTTLOnRead

Every time the value is retrieved from the cache, the TTL resets and expiration of the value postponed. If `ttlInMs` is not set, this config is ignored.

#### refreshIntervalInMs

Specify an interval in that the value is refreshed in the cache. This happens asynchronously in the background by calling the cached function with the same parameters that were used to initially load the value.

Refreshing only works as long as a value stays in the cache. That means, if for any reason the value was removed from the cache before the next interval is over, values are not refreshed anymore.

#### refreshAfterRead

Values are refreshed on every read. The function call returns the cached value and triggers a refresh of the value in the background.

#### cooldownInMs

Specifies a period for that the cached value does not get refreshed. This goes for both, refreshes through `refreshIntervalInMs` and `refreshAfterRead`. Like this it can be avoided that values are being invalidated and refreshed too often.

#### limit

The limit config specifies the maximum number of records the cache holds at max at once. This is important in cases when you only have limited RAM at your disposal. When new values are inserted into the cache and the limit is hit, the oldest value gets automatically disposed of (FIFO).

`limit` only guarantees that the cache won't exceed the specified size, but it could remove cached values before the limit is hit. Especially when used in combination with `ttlInMs`.

#### cacheWhen

Tells the cache when to cache values. You can pass in an async function that takes a single argument and returns a boolean. The argument has to be the same type as the cached functions return type.

Returning "true" means values are being cached. The cache uses this config to decide whether to cache values on updates and insertions. If not provided, values are always cached.