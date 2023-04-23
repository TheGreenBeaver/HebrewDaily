import fs from 'fs';
import isArray from 'lodash/isArray';
import path from 'path';
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions, TFontDictionary } from 'pdfmake/interfaces';
import { Transform } from 'stream';

import { ROOT } from './rom-access';
import type { OneOrMany } from './types';

export enum PdfClassName {
  Word = 'word',
  Context = 'context',
  Italics = 'italics',
  Last = 'last',
}

const docStyles: Pick<TDocumentDefinitions, 'defaultStyle' | 'styles'> = {
  defaultStyle: {
    font: 'Roboto',
    fontSize: 14,
  },
  styles: {
    [PdfClassName.Word]: {
      fontSize: 18,
      bold: true,
      font: 'Heebo',
      alignment: 'right',
    },
    [PdfClassName.Context]: {
      fontSize: 16,
      font: 'Heebo',
      alignment: 'right',
    },
    [PdfClassName.Italics]: {
      italics: true,
    },
    [PdfClassName.Last]: {
      margin: [0, 0, 0, 24],
    },
  },
};

export type TextEntries = {
  text: string,
  className: OneOrMany<PdfClassName>,
}[];

const isSingleCnHebrew = (cn: PdfClassName): boolean => [PdfClassName.Word, PdfClassName.Context].includes(cn);

const isCnHebrew = (cn: OneOrMany<PdfClassName>): boolean => isArray(cn)
  ? cn.some(isSingleCnHebrew)
  : isSingleCnHebrew(cn);

const toRtl = (text: string): string => {
  const withFixedSymbols = text.replace(/[)\][(]/g, symbol => ({
    ')': '(',
    '(': ')',
    '[': ']',
    ']': '[',
  }[symbol] ?? symbol));
  const separateWords = withFixedSymbols.split(' ').map(word => /^\w+$/.test(word) ? ` ${word}` : word);

  return ` ${separateWords.reverse().join(' ')} `;
};

export function writePdf(textEntries: TextEntries, dest: string): Promise<void>;
export function writePdf(textEntries: TextEntries): Promise<Buffer>;

export function writePdf(textEntries: TextEntries, dest?: string) {
  const fontsRoot = path.join(ROOT, 'fonts');

  const getFontSrc = (name: string): string => path.join(fontsRoot, `${name}.ttf`);

  const fonts: TFontDictionary = {
    Roboto: {
      normal: getFontSrc('Roboto-Regular'),
      bold: getFontSrc('Roboto-Bold'),
      italics: getFontSrc('Roboto-Italic'),
    },
    Heebo: {
      normal: getFontSrc('Heebo-Regular'),
      bold: getFontSrc('Heebo-Bold'),
    },
  };

  const printer = new PdfPrinter(fonts);

  const docDefinition: TDocumentDefinitions = {
    ...docStyles,
    content: textEntries.map(entry => {
      const text = isCnHebrew(entry.className) ? toRtl(entry.text) : entry.text;

      return { text, style: entry.className };
    }),
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  if (!dest) {
    return new Promise<Buffer>(resolve => {
      const transformer = new Transform();
      const chunks: Buffer[] = [];

      transformer._transform = (chunk, encoding, callback) => {
        callback(null, chunk);
      };

      transformer.on('data', chunk => {
        chunks.push(chunk);
      });

      pdfDoc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      pdfDoc.pipe(transformer);
      pdfDoc.end();
    });
  }

  return new Promise(resolve => {
    pdfDoc.pipe(fs.createWriteStream(dest));
    pdfDoc.on('end', resolve);
    pdfDoc.end();
  });
}