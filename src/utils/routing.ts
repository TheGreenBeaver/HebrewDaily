import { getVar } from './env';

export const getPort = (): number => +getVar('PORT', '8000');

export const getOrigin = (): string => {
  const publicUrl = getVar('PUBLIC_URL');

  return publicUrl || `http://localhost:${getPort()}`;
};