import type { SingleWordData } from './types';

export const formatTranslation = (wordData: SingleWordData): string => wordData.map(entry => `
<b>${entry.context}</b>
<i>${entry.transLit}</i>${entry.comment ? `\n<i>${entry.comment}</i>` : ''}
${entry.translation}
`).join('\n');