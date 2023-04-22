import { Composer } from 'grammy';

import { formatTranslation, translator } from '../../../word-processing';
import type { EnhancedContext } from '../types';

export const composer = new Composer<EnhancedContext>();

composer.command('translate', async ctx => {
  const text = ctx.match;

  const wordData = (await translator.getWordsData(text))[text];

  if (!wordData?.length) {
    return;
  }

  ctx.reply(formatTranslation(wordData), { parse_mode: 'HTML' });
});