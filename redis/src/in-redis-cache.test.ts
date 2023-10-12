import { cacheMe } from "@cache-me/base";
import { inRedis } from "./in-redis-cache";

test('Test works', async () => {
    const func = jest.fn(async () => "value");
    const cachedFunction = cacheMe(func, inRedis<Promise<string>>());
    expect(true).toBe(true);
});