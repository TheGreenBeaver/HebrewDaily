import { Composer } from 'grammy';

import type { EnhancedContext } from '../types';

export const composer = new Composer<EnhancedContext>();

const Desc = {
  translate:
    'перевести с иврита на русский, пользуясь <a href="https://www.slovar.co.il">словарём Ирис</a>',
  googleAuth:
    'авторизоваться в Google; это нужно, чтобы я мог получить доступ' +
    ' к Google Classroom и обработать следующую команду',
  listWords:
    'перечислить слова, изученные на занятиях, с переводом' +
    ' (непосредственно в сообщении - только один вариант перевода,' +
    ' в прикреплённом PDF-файле - полная информация из словаря)',
};

composer.command('help', ctx => ctx.reply(`
Шалом! Вот список команд, которые я умею обрабатывать:
- <b>/translate</b>: ${Desc.translate}

- <b>/googleAuth</b>: ${Desc.googleAuth}
- <b>/listWords</b>: ${Desc.listWords}
  - Просто <code>/listWords</code>: данные по последнему занятию
  - <code>/listWords all</code>: данные по всем прошедшим занятиям
  - <code>/listWords 04/04/23</code>: данные по занятию от 4 апреля
  - <code>/listWords 04/04/23 - 10/04/23</code>: данные по занятиям с 4 по 10 апреля
`, { parse_mode: 'HTML' }));