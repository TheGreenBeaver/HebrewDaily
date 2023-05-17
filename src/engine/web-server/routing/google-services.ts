import express from 'express';
import isString from 'lodash/isString';

import { getVar } from '../../../utils/env';
import { getGoogleTools } from '../../app-resources';
import type { AppResources } from '../../types';

export const router = express.Router();

router.get(`${getVar('GOOGLE_REDIRECT_PATH')}/:chatId`, async (req, res, next) => {
  const { code } = req.query;
  const { chatId } = req.params;

  if (!isString(code)) {
    return next(); // TODO: Handle no code on redirect
  }

  const { credentialsStorage }: AppResources = req.app.locals.resources;
  const { authClient } = getGoogleTools(+chatId);

  const { tokens } = await authClient.getToken(code);
  credentialsStorage.set(+chatId, tokens);

  // TODO: Redirect to chat from which the user called
  return res.send('Отлично! Теперь можно продолжать работу в Telegram');
});