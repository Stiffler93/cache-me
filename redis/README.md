# @cache-me/redis

This package provides caching with Redis and is an add-on to the [@cache-me/base](https://www.npmjs.com/package/@cache-me/base) library.

You can find more information around the @cache-me packages in the official [Github repository](https://github.com/Stiffler93/cache-me#readme).

## In Redis cache

This is an addon caching strategy to be used in conjunction with the `@cache-me/base` packages' `cacheMe` function. It stores values in a [Redis](https://redis.io/docs/) server or cluster. 

This offers several advantages to caching values in application RAM (**inMemory** strategy):
* shared memory across multiple instances of an application or even multiple different applications
* cache can be maintained beyond the lifetime of a running app

### Examples

```typescript
import { cacheMe } from '@cache-me/base';
import { inRedis } from '@cache-me/redis';
import { Redis } from 'ioredis';

const redis = new Redis({ host: 'your-redis-server-address', port: 6379 });

// cache in Redis
cacheMe(function, inRedis({ redis }));

// cache in Redis, expire values after 2000 ms
cacheMe(function, inRedis({ redis, ttlInMs: 2000 }));

// only cache values when API request was successful
cacheMe(function, inRedis({ redis, cacheWhen: value => {
    return (await value).statusCode === 200;
}}));

// only cache values when API request was successful. Expire values after 2000 ms
cacheMe(function, inRedis({ redis, ttlInMs: 2000, cacheWhen: value => {
    return (await value).statusCode === 200;
}}));
```

### Cache configuration

The in redis cache accepts following configurations:

```typescript
export type Config<ReturnValue> = {
    redis: RedisCommander;
    ttlInMs?: number;
    cacheWhen?: (value: ReturnValue) => Promise<boolean>;
};
```

Configuration options are optional besides the Redis client. The library supports Redis clients established by the [ioredis](https://www.npmjs.com/package/ioredis) package.

#### redis

Expects a client provided by `ioredis`. It can be any implementation as the argument accepts a generic `RedisCommander` (= interface) object. For more details look into the packages' [Redis](https://www.npmjs.com/package/ioredis#basic-usage) and/or [Cluster](https://www.npmjs.com/package/ioredis#cluster) implementations.

#### ttlInMs

Sets the "time to live" on a value in the cache. The value is in milliseconds and defines the time until the value expires and is removed from Redis.

#### cacheWhen

Tells the cache when to cache values. You can pass in an async function that takes a single argument and returns a boolean. The argument has to be the same type as the cached functions return type.

Returning "true" means values are being cached. The cache uses this config to decide whether to store values to function calls in Redis. If not provided, values are always cached.