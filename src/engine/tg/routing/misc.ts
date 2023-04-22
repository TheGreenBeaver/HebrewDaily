import { Composer } from 'grammy';

import type { EnhancedContext } from '../types';

export const composer = new Composer<EnhancedContext>();

composer.command('help', ctx => {
  ctx.reply(`
Шалом! Вот список команд, которые я умею обрабатывать:
- <b>/translate</b>: перевести с иврита на русский, пользуясь <a href="https://www.slovar.co.il">словарём Ирис</a> 
`, { parse_mode: 'HTML' });
});