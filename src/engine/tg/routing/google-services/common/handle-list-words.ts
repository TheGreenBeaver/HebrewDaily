import type { classroom_v1 } from 'googleapis';
import { InputFile } from 'grammy';
import isArray from 'lodash/isArray';
import isString from 'lodash/isString';
import noop from 'lodash/noop';
import { DateTime } from 'luxon';

import { withComplicatedCache } from '../../../../../utils/cache';
import { listAll } from '../../../../../utils/google-services';
import { decodeHtml } from '../../../../../utils/misc';
import type { TextEntries } from '../../../../../utils/pdf';
import { PdfClassName, writePdf } from '../../../../../utils/pdf';
import type { WordsData } from '../../../../../word-processing';
import { translator } from '../../../../../word-processing';
import type { Classroom, Drive } from '../../../../types';
import { TEXT_MAX_LENGTH } from '../../../tg-limits';
import type { GoogleServicesContext } from '../types';

const extractTagContent = (text: string, tagName: string): string[] => {
  const pattern = new RegExp(`(?<=<${tagName}).+?(?=</${tagName}>)`, 'g');
  const matches = text.match(pattern);

  if (!matches) {
    return [];
  }

  return matches.map(match => {
    const closingBracket = match.indexOf('>');

    return match.substring(closingBracket + 1);
  });
};

const extractWords = (fileContent: string): string[] => {
  const tableBody = extractTagContent(fileContent, 'table')[0];

  if (!tableBody) {
    return [];
  }

  const decodedTableBody = decodeHtml(tableBody);
  const tableCells = extractTagContent(decodedTableBody, 'td');

  return tableCells.map(cell =>
    extractTagContent(cell, 'span').join('').split(/[/+,.]/).map(word => word.trim()),
  ).flat().filter(Boolean);
};

type Materials = { words: string[], wordsData: WordsData };

const getFileMaterials = withComplicatedCache<Promise<Materials>, [string, Drive]>(async (
  fileId, drive,
) => {
  try {
    const { data } = await drive.files.export({ fileId, mimeType: 'text/html' });

    const words = extractWords(`${data}`);
    const wordsData = await translator.push(words);

    return { words, wordsData };
  } catch (e) {
    return { words: [], wordsData: {} };
  }
}, (...args) => args[0], { timeout: 24 * 60 * 60 * 1000 });

enum SpecialListLimit {
  All = 'All',
  Last = 'Last',
}

type ListLimit = SpecialListLimit | DateTime | [DateTime, DateTime];

const listLimitToString = (listLimit: ListLimit): string => isString(listLimit)
  ? listLimit
  : [listLimit].flat().map(d => d.toISO() ?? 'TTT').join(' ');

type GCMArgs = [string, string, ListLimit, Classroom, Drive];
type TopicsList = classroom_v1.Schema$Topic[];

const filterTopicsByLimit = (
  topics: TopicsList,
  listLimit: ListLimit,
): TopicsList => {
  switch (listLimit) {
    case SpecialListLimit.All:
      return topics;
    case SpecialListLimit.Last:
      return topics.slice(-1);
    default: {
      const filtered: TopicsList = [];

      for (const workPiece of topics) {
        const { updateTime } = workPiece;

        if (!updateTime) {
          continue;
        }

        const workPieceDate = DateTime.fromISO(updateTime).startOf('day');

        if (isArray(listLimit)) {
          if (workPieceDate > listLimit[1].startOf('day')) {
            break;
          }

          if (workPieceDate >= listLimit[0].startOf('day')) {
            filtered.push(workPiece);
          }

          continue;
        }

        if (workPieceDate > listLimit.startOf('day')) {
          break;
        }

        if (workPieceDate === listLimit.startOf('day')) {
          filtered.push(workPiece);
        }
      }

      return filtered;
    }
  }
};

const getCourseMaterials = withComplicatedCache<Promise<Materials>, GCMArgs>(async (
  courseId,
  wordsSourcePattern,
  listLimit,
  classroom,
  drive,
) => {
  const orderBy = listLimit === SpecialListLimit.Last ? 'updateTime desc' : 'updateTime asc';

  const topics = await listAll(
    params => classroom.courses.topics.list({ ...params, courseId }),
    'topic',
  );
  const fittingTopicIds = filterTopicsByLimit(topics, listLimit).reduce<string[]>(
    (result, topic) => topic.topicId ? [...result, topic.topicId] : result, [],
  );

  const courseWork = await listAll(
    params => classroom.courses.courseWork.list({ ...params, courseId, orderBy }),
    'courseWork',
  );

  const regExpPattern = new RegExp(`^${wordsSourcePattern.replaceAll('*', '.*')}$`);

  const fileIds = courseWork.reduce<string[]>((result, { materials, topicId }) => {
    if (!topicId || !fittingTopicIds.includes(topicId)) {
      return result;
    }

    return [
      ...result,
      ...(materials || []).reduce<string[]>(
        (fittingMaterials, { driveFile }) => {
          const title = driveFile?.driveFile?.title;

          return !title || !regExpPattern.test(title) || !driveFile.driveFile?.id
            ? fittingMaterials
            : [...fittingMaterials, driveFile.driveFile.id];
        },
        [],
      ),
    ];
  }, []);

  const allMaterials = await Promise.all(fileIds.map(fileId => getFileMaterials(fileId, drive)));

  return allMaterials.reduce<Materials>((acc, materials) => ({
    words: [...acc.words, ...materials.words],
    wordsData: { ...acc.wordsData, ...materials.wordsData },
  }), { words: [], wordsData: {} });
}, (courseId, wordsSourcePattern, listLimit) => [
  courseId,
  wordsSourcePattern,
  listLimitToString(listLimit),
], { rotationSchedule: '0 0,45 8,13,14,18 * * *', maxSize: 70 });

const formats = [
  'dd/MM/yy',
  'dd.MM.yy',
  'dd/MM/yyyy',
  'dd.MM.yyyy',
  'dd/MM',
  'dd.MM',
  'd/M/yy',
  'd.M.yy',
];

const stringToDateTime = (dateString: string): DateTime | null => {
  const iso = DateTime.fromISO(dateString);

  if (iso.isValid) {
    return iso.toUTC();
  }

  for (const format of formats) {
    const custom = DateTime.fromFormat(dateString, format);

    if (custom.isValid) {
      return custom.toUTC();
    }
  }

  return null;
};

const getListLimit = (rawMatch?: string | RegExpMatchArray): ListLimit => {
  if (!isString(rawMatch) || !rawMatch) {
    return SpecialListLimit.Last;
  }

  const match = rawMatch.trim().toLowerCase();

  if (['all', 'dct', 'vse', 'все', 'фдд', 'הכל'].includes(match)) {
    return SpecialListLimit.All;
  }

  if (match.includes(' - ')) {
    const [fromString, toString] = match.split(' - ');

    if (!fromString || !toString) {
      return SpecialListLimit.Last;
    }

    const from = stringToDateTime(fromString);
    const to = stringToDateTime(toString);

    return from && to ? [from, to] : SpecialListLimit.Last;
  }

  const at = stringToDateTime(match);

  return at ?? SpecialListLimit.Last;
};

export const handleListWords = async (ctx: GoogleServicesContext): Promise<boolean> => {
  const { session: { courseId, wordsSourcePattern }, classroom, drive, match } = ctx;

  ctx.dropControl();

  // TODO: Separate status if !wordsSourcePattern
  if (!courseId || !wordsSourcePattern) {
    return false;
  }

  await ctx.reply('Ваш запрос обрабатывается, это может занять некоторое время');
  const listLimit = getListLimit(match);

  getCourseMaterials(courseId, wordsSourcePattern, listLimit, classroom, drive).then(async ({ words, wordsData }) => {
    let answerLength = 0;
    const shortAnswer: string[] = [];
    const pdfDocContent: TextEntries = [];

    const sendShortAnswer = () => ctx.reply(shortAnswer.join('\n\n'), { parse_mode: 'HTML' });

    for (const word of words) {
      const singleWordData = wordsData[word];
      const noAutoTranslationFraze = 'Не удалось перевести автоматически';

      pdfDocContent.push({ text: word, className: PdfClassName.Word });

      if (!singleWordData?.length) {
        pdfDocContent.push({ text: noAutoTranslationFraze, className: [PdfClassName.Italics, PdfClassName.Last] });
      } else {
        pdfDocContent.push(...singleWordData.map(({ context, transLit, translation, comment }) => {
          const lines: TextEntries = [
            { text: context, className: PdfClassName.Context },
            { text: transLit, className: PdfClassName.Italics },
            { text: translation, className: PdfClassName.Last },
          ];

          if (comment) {
            lines.splice(2, 0, { text: comment, className: PdfClassName.Italics });
          }

          return lines;
        }).flat());
      }

      const translation = singleWordData?.[0]?.translation ?? `<i>${noAutoTranslationFraze}</i>`;

      const line = `<b>${word}</b>\n${translation}`;
      answerLength += line.length;

      if (answerLength > TEXT_MAX_LENGTH) {
        await sendShortAnswer();

        shortAnswer.splice(0, shortAnswer.length, line);
        answerLength = line.length;
      } else {
        shortAnswer.push(line);
      }
    }

    if (shortAnswer.length) {
      await sendShortAnswer();
    }

    const pdf = await writePdf(pdfDocContent);
    await ctx.replyWithDocument(new InputFile(pdf, `C#${courseId}-${wordsSourcePattern}-${listLimit}.pdf`), {
      caption: 'В этом файле собрана полная информация об изученных словах.',
    });
  }).catch(noop);

  return true;
};