import { getErrorString } from '../../../../../utils/misc';
import { formatTranslation, translator } from '../../../../../word-processing';
import type { EnhancedContext } from '../../../types';

export const handleTranslateWord = (ctx: EnhancedContext, text?: string) => {
  if (!text) {
    ctx.getControl();

    return ctx.reply('Пожалуйста, введите слово, которое хотите перевести.');
  }

  ctx.dropControl();

  translator.push([text], async wordsData => {
    const wordData = Object.values(wordsData)[0];

    const responseMsg = !wordData?.length
      ? `Увы! В словаре не нашлось перевода для "${text}"...`
      : formatTranslation(wordData);

    return ctx.reply(responseMsg, { parse_mode: 'HTML' });
  }, e => {
    ctx.logger.error(getErrorString(e));

    return ctx.reply('Упс... При попытке перевода произошла ошибка!');
  });

  return ctx.replyWithChatAction('typing');
};