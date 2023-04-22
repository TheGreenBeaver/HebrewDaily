import { Composer } from 'grammy';

import { formatTranslation, translator } from '../../../word-processing';
import type { EnhancedContext } from '../types';

export const composer = new Composer<EnhancedContext>();

composer.command('translate', async ctx => {
  const text = ctx.match;

  translator.push([text], async wordsData => {
    const wordData = wordsData[text];

    return wordData?.length && ctx.reply(formatTranslation(wordData), { parse_mode: 'HTML' });
  });

  return ctx.replyWithChatAction('typing');
});