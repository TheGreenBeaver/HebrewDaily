export type WordDataEntry = { context: string, comment?: string, transLit: string, translation: string };

export type SingleWordData = WordDataEntry[];

export type WordsData<Words extends string = string> = Partial<Record<Words, SingleWordData>>;