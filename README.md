# cache-me

`cache-me` is a small library which provides out of the box caching of functions. It works by wrapping the function you want to cache with the `cacheMe` function provided by `@cache-me/base`. It returns an identical function, requiring the same arguments and returning the same value and takes care of the caching logic for you.

There is a small caveat: it always returns an asynchronous function, meaning also caching a synchronous function returns an async function. The API was created like this to support different storage systems that might need to execute network requests.

## How to use it
```typescript
import { cacheMe } from '@cache-me/base';

async function anyFunction(id: string) {
    return await fetch(`...?id=${id}`);
}

const cachedAnyFunction = cacheMe(anyFunction);

const response = await cachedAnyFunction('abc');
```

It's as simple as that and now `cachedAnyFunction` is a perfect replacement for `anyFunction` with internal caching.

## Caching

By default results are cached in memory (RAM). So far, only in-memory caching is supported, but other caching strategies will be supported in the future. Support for caching with Redis is currently in the works.

You can also write your own caching strategy by creating a class that implements the `CacheStrategy<ReturnValue>` interface exported by `@cache-me/base`.

### In memory cache

This is the default strategy which stores cached values indefinitely in RAM.

