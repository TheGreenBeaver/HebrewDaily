import path from 'path';

export const upPath = (original: string, stepsUp: number = 1): string =>
  path.join(original, ...Array(stepsUp).fill('..'));

export const ROOT = upPath(__dirname, 2);

export const normalizePath = (original: string) => path.normalize(original.replace('<root>', ROOT));

type PathInfoSlice = 'base' | 'dir' | 'ext' | 'loc' | 'name';
type PathInfo = Record<PathInfoSlice, string>;

export const decomposePath = (filePath: string): PathInfo => {
  const ext = path.extname(filePath);
  const name = path.basename(filePath);
  const base = path.basename(filePath, ext);
  const dir = path.dirname(filePath);
  const loc = path.join(dir, base);

  return { base, dir, ext, loc, name };
};