import { debuglog } from 'node:util';

const _log = debuglog('@cache-me/base')

export const log = (msg: string) => {
    _log(msg);
}