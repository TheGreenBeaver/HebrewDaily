import { Composer } from 'grammy';

import { formatTranslation, translator } from '../../../word-processing';
import type { EnhancedContext } from '../types';

export const composer = new Composer<EnhancedContext>();

composer.command('translate', async ctx => {
  const text = ctx.match;

  console.log(`request to translate ${text}`);
  translator.push([text], async wordsData => {
    const wordData = wordsData[text];
    console.log(wordData);

    return wordData?.length && ctx.reply(formatTranslation(wordData), { parse_mode: 'HTML' });
  });

  return ctx.replyWithChatAction('typing');
});