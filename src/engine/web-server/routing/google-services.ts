import express from 'express';
import isString from 'lodash/isString';

import { getVar } from '../../../utils/env';
import type { AppResources } from '../../types';

export const router = express.Router();

router.get(getVar('GOOGLE_REDIRECT_PATH'), async (req, res, next) => {
  const { code } = req.query;

  if (!isString(code)) {
    return next(); // TODO: Handle no code on redirect
  }

  const { authClient }: AppResources = req.app.locals.resources;

  const { tokens } = await authClient.getToken(code);
  authClient.setCredentials(tokens);

  // TODO: Redirect to chat from which the user called
  return res.send('Отлично! Теперь можно продолжать работу в Telegram');
});