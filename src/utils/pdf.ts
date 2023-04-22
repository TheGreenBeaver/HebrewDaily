import fs from 'fs';
import merge from 'lodash/merge';
import path from 'path';
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions, TFontDictionary } from 'pdfmake/interfaces';

import { ROOT } from './rom-access';

export enum PdfClassNames {
  Word = 'word',
  Context = 'context',
  Italics = 'italics',
  Last = 'last',
}

const defaultDef: Pick<TDocumentDefinitions, 'defaultStyle' | 'styles'> = {
  defaultStyle: {
    font: 'Roboto',
    fontSize: 14,
  },
  styles: {
    [PdfClassNames.Word]: {
      fontSize: 18,
      bold: true,
      font: 'Heebo',
    },
    [PdfClassNames.Context]: {
      fontSize: 16,
      font: 'Heebo',
    },
    [PdfClassNames.Italics]: {
      italics: true,
    },
    [PdfClassNames.Last]: {
      margin: [0, 0, 0, 24],
    },
  },
};

export function writePdf(docDefinition: TDocumentDefinitions, dest: string): Promise<void>;
export function writePdf(docDefinition: TDocumentDefinitions): Promise<Buffer>;

export async function writePdf(docDefinition: TDocumentDefinitions, dest?: string) {
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

  const pdfDoc = printer.createPdfKitDocument(merge(defaultDef, docDefinition));

  if (!dest) {
    const buf: Buffer[] = [];

    for await (const chunk of pdfDoc) {
      buf.push(Buffer.from(chunk));
    }

    return Buffer.concat(buf);
  }

  return new Promise(resolve => {
    pdfDoc.pipe(fs.createWriteStream(dest));
    pdfDoc.on('end', resolve);
    pdfDoc.end();
  });
}