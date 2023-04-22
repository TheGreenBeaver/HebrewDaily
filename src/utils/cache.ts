import isFunction from 'lodash/isFunction';
import isString from 'lodash/isString';
import sortBy from 'lodash/sortBy';
import schedule from 'node-schedule';

import type { OneOrMany } from './types';

type KeyPath = OneOrMany<string>;

type CacheEntry<D> = { data: D | Map<string, CacheEntry<D>>, hits: number };
type CacheStore<D> = {
  get: (keyPath: KeyPath) => D | undefined,
  set: (keyPath: KeyPath, value: D) => void,
};

type Options= Partial<{
  timeout: number,
  maxSize: number,
  rotationSchedule: string,
  thisArg: unknown,
}>;

type ArgsForStandard<Result, Args extends unknown[]> = [
  (...args: Args) => Result,
  (...args: Args) => KeyPath,
  Options?,
];
type ArgsForCustom<Result, Args extends unknown[], D = Awaited<Result>> = [
  (cacheStore: CacheStore<D>, ...args: Args) => Result,
  Options?,
];

const isArgsForStandard = <Result, Args extends unknown[]>(
  hocArgs: unknown[],
): hocArgs is ArgsForStandard<Result, Args> => isFunction(hocArgs[1]);

export function withComplicatedCache<Result, Args extends unknown[]>(
  ...hocArgs: ArgsForStandard<Result, Args>
): (...args: Args) => Result;

export function withComplicatedCache<Result, Args extends unknown[], D = Awaited<Result>>(
  ...hocArgs: ArgsForCustom<Result, Args, D>
): (...args: Args) => Result;

export function withComplicatedCache<Result, Args extends unknown[], D = Awaited<Result>>(
  ...hocArgs: ArgsForStandard<Result, Args> | ArgsForCustom<Result, Args, D>
) {
  const standard = isArgsForStandard<Result, Args>(hocArgs);
  const cache = new Map<string, CacheEntry<D>>();
  const { maxSize = 150, timeout, rotationSchedule, thisArg } = (standard ? hocArgs[2] : hocArgs[1]) ?? {};

  if (rotationSchedule) {
    schedule.scheduleJob(rotationSchedule, () => {
      cache.clear();
    });
  }

  const getCachedData = (keyPath: KeyPath, _cache = cache): D | undefined => {
    const [key, ...rest] = isString(keyPath) ? keyPath : keyPath;

    if (key == null) {
      return undefined;
    }

    const entry = _cache.get(key);

    if (!entry) {
      return undefined;
    }

    entry.hits++;

    if (entry.data instanceof Map) {
      return rest.length ? getCachedData(rest, entry.data) : undefined;
    } else {
      return rest.length ? undefined : entry.data;
    }
  };

  const setCachedData = (keyPath: KeyPath, value: D, _cache = cache): void => {
    const [key, ...rest] = isString(keyPath) ? keyPath : keyPath;

    if (key == null) {
      return;
    }

    if (_cache.size >= maxSize) {
      const entriesToDrop = sortBy([..._cache.entries()], '[1].hits').slice(0, maxSize - _cache.size);
      entriesToDrop.forEach(([keyToDrop]) => _cache.delete(keyToDrop));
    }

    if (!rest.length) {
      _cache.set(key, { data: value, hits: 1 });
    } else {
      let entry = _cache.get(key);

      if (!entry) {
        entry = { data: new Map(), hits: 1 };
        _cache.set(key, entry);
      }

      if (!(entry.data instanceof Map)) {
        return;
      }

      setCachedData(rest, value, entry.data);
    }

    const cleanup = () => {
      _cache.delete(key);
    };

    if (timeout) {
      setTimeout(cleanup, timeout);
    }
  };

  return (...args: Args) => {
    if (standard) {
      const keyPath = hocArgs[1](...args);
      const cachedResult = getCachedData(keyPath);

      if (cachedResult) {
        return cachedResult;
      }

      const result = hocArgs[0].call(thisArg, ...args);
      setCachedData(keyPath, result as unknown as D);

      return result;
    }

    return hocArgs[0].call(thisArg, {
      get: keyPath => getCachedData(keyPath),
      set: (keyPath, value) => setCachedData(keyPath, value),
    }, ...args);
  };
}