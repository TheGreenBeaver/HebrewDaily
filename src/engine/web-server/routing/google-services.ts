import express from 'express';
import isString from 'lodash/isString';

import { getVar } from '../../../utils/env';
import { getGoogleTools } from '../../app-resources';
import type { AppResources } from '../../types';

export const router = express.Router();

router.get(getVar('GOOGLE_REDIRECT_PATH'), async (req, res, next) => {
  const { code, state } = req.query;

  if (!isString(code) || !isString(state)) {
    return next(); // TODO: Handle no code on redirect
  }

  const { credentialsStorage }: AppResources = req.app.locals.resources;
  const { authClient } = getGoogleTools();

  const { tokens } = await authClient.getToken(code);
  credentialsStorage.set(+state, tokens);

  // TODO: Redirect to chat from which the user called
  return res.send('Отлично! Теперь можно продолжать работу в Telegram');
});