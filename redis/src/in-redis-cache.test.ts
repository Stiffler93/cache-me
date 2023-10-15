import { cacheMe } from '@cache-me/base';
import { inRedis } from './in-redis-cache';

test('Test works', async () => {
    const func = jest.fn(async () => 'value');
    cacheMe(func, inRedis());
    expect(func).toBeCalledTimes(0);
});
