import { Composer } from 'grammy';

import type { EnhancedContext } from '../../types';
import { handleTranslateWord } from './common';
import { Commands } from './constants';

export const extraMiddleware = new Composer<EnhancedContext>(async (ctx, next) => {
  if (ctx.session.commandName !== Commands.translate) {
    return handleTranslateWord(
      ctx,
      ctx.msg?.text,
    );
  }

  await next();

  return;
});