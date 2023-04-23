import type { Maybe } from './types';

type Params = { pageToken?: string };

export const listAll = async <D, Key extends string>(
  performRequest: (
    params?: Params,
  ) => Promise<{ data: { [K in Key]?: D[] } & { nextPageToken?: string | null } }>,
  key: Key,
  getShouldStop?: (dataChunk?: D[]) => boolean,
): Promise<D[]> => {
  const allData: D[] = [];
  let pageToken: Maybe<string> = undefined;

  while (true) {
    const params: Params = {};

    if (pageToken) {
      params.pageToken = pageToken;
    }

    const { data } = await performRequest(params);

    pageToken = data.nextPageToken;
    const dataChunk = data[key];
    allData.push(...(dataChunk ?? []));

    if (!data.nextPageToken || getShouldStop?.(dataChunk)) {
      break;
    }
  }

  return allData;
};