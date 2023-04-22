import fs from 'fs';
import path from 'path';

import { getVar } from './env';
import { normalizePath } from './rom-access';

const ROOT_VAR_NAME = 'FILE_STORAGE';

const getDataSource = (fileName: string): string => {
  const parts = [`${fileName}.json`];
  const rootSource = getVar(ROOT_VAR_NAME);

  if (rootSource) {
    parts.unshift(normalizePath(rootSource));
  }

  return path.join(...parts);
};

export function getFromFile(fileName: string, sync: true): unknown;

export function getFromFile(fileName: string, sync?: false): Promise<unknown>;

export function getFromFile(fileName: string, sync?: boolean) {
  const dataSource = getDataSource(fileName);

  try {
    if (sync) {
      const stringData = fs.readFileSync(dataSource, 'utf-8');

      return JSON.parse(stringData);
    } else {
      return fs.promises.readFile(dataSource, 'utf-8').then(JSON.parse);
    }
  } catch {
    return undefined;
  }
}

export const storeInFile = async (instance: unknown, fileName: string) => {
  const dataSource = getDataSource(fileName);
  await fs.promises.mkdir(path.dirname(dataSource), { recursive: true });
  await fs.promises.writeFile(dataSource, JSON.stringify(instance));
};