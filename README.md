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

## Caching strategies

* [In Memory](./base/README.md) _(default)_
* [Redis](./redis/README.md) _(soon to be released)_

### Write custom caching strategies

Writing a caching strategy is simple. Create a class that implements the `CacheStrategy<ReturnValue>` interface exported by `@cache-me/base`. Then you can pass an instance of the class into the `cacheMe` function.

**Example:**

```typescript
class MyCustomCache<ReturnValue> implements CacheStrategy<ReturnValue> {
    public async retrieve(key: string): Promise<Cached<ReturnValue> | undefined> {
        // your logic here
        // retrieve value by `key`
        return value;
    }
    public async persist({ key, fetchFn }: PersistInput<ReturnValue>): Promise<ReturnValue> {
        const value = await fetchFn();
        // your logic here
        // persist value by `key`
        return value;
    }
}

export function inMyCustomCache<ReturnValue>(): CacheStrategy<ReturnValue> {
    return new MyCustomCache<ReturnValue>();
}

// USAGE:
cacheMe(function, inMyCustomCache());
```
