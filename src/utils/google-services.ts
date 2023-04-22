import type { Maybe } from './types';

type Params = { pageToken?: string };

export const listAll = async <D, Key extends string>(
  performRequest: (
    params?: Params,
  ) => Promise<{ data: { [K in Key]?: D[] } & { nextPageToken?: string | null } }>,
  key: Key,
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
    allData.push(...(data[key] ?? []));

    if (!data.nextPageToken) {
      break;
    }
  }

  return allData;
};