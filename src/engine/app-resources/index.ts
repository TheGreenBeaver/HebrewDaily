import type { AppResources } from '../types';
import { createCredentialsStorage } from './credentials-storage';
import { createLogger } from './logger';

export const createAppResources = (): AppResources => {
  const logger = createLogger();
  const credentialsStorage = createCredentialsStorage();

  return { logger, credentialsStorage };
};

export { getGoogleTools } from './google-tools';