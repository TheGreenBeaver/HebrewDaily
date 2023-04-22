/* eslint-disable max-len */
import { Composer } from 'grammy';

import type { EnhancedContext } from '../types';

export const composer = new Composer<EnhancedContext>();

composer.command('help', ctx => ctx.reply(`
Шалом! Вот список команд, которые я умею обрабатывать:
- <b>/translate</b>: перевести с иврита на русский, пользуясь <a href="https://www.slovar.co.il">словарём Ирис</a>

- <b>/googleAuth</b>: авторизоваться в Google; это нужно, чтобы я мог получить доступ к Google Classroom и обработать следующую команду
- <b>/listWords</b>: вывести список всех слов, которые Вы успели изучить на занятиях
`, { parse_mode: 'HTML' }));