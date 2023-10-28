import { debuglog } from 'node:util';

const _log = debuglog('@cache-me/redis');

export const log = (msg: string) => {
    _log(msg);
};
