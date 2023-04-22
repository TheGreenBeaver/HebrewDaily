import { InputFile } from 'grammy';
import noop from 'lodash/noop';
import type { Content } from 'pdfmake/interfaces';

import { withComplicatedCache } from '../../../../../utils/cache';
import { listAll } from '../../../../../utils/google-services';
import { decodeHtml } from '../../../../../utils/misc';
import { PdfClassNames, writePdf } from '../../../../../utils/pdf';
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

const getCourseMaterials = withComplicatedCache<Promise<Materials>, [string, string, Classroom, Drive]>(async (
  courseId,
  wordsSourcePattern,
  classroom,
  drive,
) => {
  const courseWork = await listAll(
    params => classroom.courses.courseWork.list({ ...params, courseId, orderBy: 'updateTime asc' }),
    'courseWork',
  );

  const regExpPattern = new RegExp(`^${wordsSourcePattern.replaceAll('*', '.*')}$`);

  const fileIds = courseWork.reduce<string[]>((result, { materials }) => [
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
  ], []);

  const allMaterials = await Promise.all(fileIds.map(fileId => getFileMaterials(fileId, drive)));

  return allMaterials.reduce<Materials>((acc, materials) => ({
    words: [...acc.words, ...materials.words],
    wordsData: { ...acc.wordsData, ...materials.wordsData },
  }), { words: [], wordsData: {} });
}, (...args) => [args[0], args[1]], { rotationSchedule: '0 0,45 8,13,14,18 * * *', maxSize: 70 });

export const handleListWords = async (ctx: GoogleServicesContext): Promise<boolean> => {
  const { session: { courseId, wordsSourcePattern }, resources: { classroom, drive }, dropControl } = ctx;

  dropControl();

  // TODO: Separate status if !wordsSourcePattern
  if (!courseId || !wordsSourcePattern) {
    return false;
  }

  await ctx.reply('Ваш запрос обрабатывается, это может занять некоторое время');

  getCourseMaterials(courseId, wordsSourcePattern, classroom, drive).then(async ({ words, wordsData }) => {
    let answerLength = 0;
    let wordsLeft = words.length;
    const shortAnswer: string[] = [];
    const pdfDocContent: Content[] = [];

    for (const word of words) {
      const singleWordData = wordsData[word];
      const noAutoTranslationFraze = 'Не удалось перевести автоматически';

      pdfDocContent.push({ text: word, style: PdfClassNames.Word });

      if (!singleWordData?.length) {
        pdfDocContent.push({ text: noAutoTranslationFraze, style: [PdfClassNames.Italics, PdfClassNames.Last] });
      } else {
        pdfDocContent.push(...singleWordData.map(({ context, transLit, translation, comment }) => {
          const lines: Content[] = [
            { text: context, style: PdfClassNames.Context },
            { text: transLit, style: PdfClassNames.Italics },
            { text: translation, style: PdfClassNames.Last },
          ];

          if (comment) {
            lines.splice(2, 0, { text: comment, style: PdfClassNames.Italics });
          }

          return lines;
        }).flat());
      }

      const translation = singleWordData?.[0]?.translation ?? `<i>${noAutoTranslationFraze}</i>`;

      const line = `<b>${word}</b>\n${translation}`;
      answerLength += line.length;
      wordsLeft--;

      if (answerLength > TEXT_MAX_LENGTH) {
        if (answerLength - line.length + 17 + `${wordsLeft}`.length > TEXT_MAX_LENGTH) {
          shortAnswer.pop();
          wordsLeft++;
        }

        shortAnswer.push(`...и ещё ${wordsLeft} слов.`);

        break;
      } else {
        shortAnswer.push(line);
      }
    }

    const p = 'testdoc.pdf';
    /*const pdf = */await writePdf({ content: pdfDocContent }, p);
    await ctx.replyWithDocument(new InputFile(p, `C#${courseId}-${wordsSourcePattern}.pdf`), {
      caption: 'В этом файле собрана полная информация об изученных словах.',
    });
    await ctx.reply(shortAnswer.join('\n\n'), { parse_mode: 'HTML' });
  }).catch(noop);

  return true;
};