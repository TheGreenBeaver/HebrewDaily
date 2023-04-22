import { google } from 'googleapis';

import { getVar } from '../../utils/env';
import { getOrigin } from '../../utils/routing';
import type { AppResources } from '../types';
import { createLogger } from './logger';

export const createAppResources = (): AppResources => {
  // TODO: Stored credentials
  const authClient = new google.auth.OAuth2(
    getVar('GOOGLE_CLIENT_ID'),
    getVar('GOOGLE_CLIENT_SECRET'),
    `${getOrigin()}${getVar('GOOGLE_REDIRECT_PATH')}`,
  );

  const classroom = google.classroom({
    version: 'v1',
    auth: authClient,
  });

  const drive = google.drive({
    version: 'v3',
    auth: authClient,
  });

  const logger = createLogger();

  return { authClient, classroom, logger, drive };
};