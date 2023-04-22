import puppeteer from 'puppeteer';

import { withComplicatedCache } from '../utils/cache';
import type { SingleWordData, WordsData } from './types';

type Browser = Awaited<ReturnType<typeof puppeteer['launch']>>;
type Page = Awaited<ReturnType<Browser['newPage']>>;
type FireResult = (result: WordsData) => void;
type QueueEntry = { words: string[], fireResult: FireResult };

class Translator {
  private browser: Browser | undefined;
  private page: Page | undefined;
  private browserTimeoutId: NodeJS.Timeout | undefined;
  private readonly closeBrowserAfter: number;
  private readonly queue: QueueEntry[] = [];
  private isProcessing = false;

  constructor(closeBrowserAfter: number = 60 * 1000) {
    this.closeBrowserAfter = closeBrowserAfter;
  }

  private static mergeArrays<T>(odd: T[], even: T[]): T[] {
    const result: T[] = [];
    let oddIndex = 0;
    let evenIndex = 0;

    while (oddIndex < odd.length || evenIndex < even.length) {
      const oddItem = odd[oddIndex++];

      if (oddItem !== undefined) {
        result.push(oddItem);
      }

      const evenItem = even[evenIndex++];

      if (evenItem !== undefined) {
        result.push(evenItem);
      }
    }

    return result;
  }

  private doWork = withComplicatedCache<void, [FireResult, ...string[]], SingleWordData>(async (
    cacheStore, fireResult, ...allWords
  ) => {
    this.isProcessing = true;

    const wordsData: WordsData = {};

    const words = allWords.filter(word => {
      const cached = cacheStore.get(word);

      if (cached) {
        wordsData[word] = cached;

        return false;
      }

      return true;
    });

    if (!words.length) {
      return fireResult(wordsData);
    }

    clearTimeout(this.browserTimeoutId);

    if (!this.browser) {
      this.browser = await puppeteer.launch();
    }

    if (!this.page) {
      this.page = await this.browser.newPage();

      await this.page.goto('https://www.slovar.co.il/translate.php');
    }

    const inputSelector = 'input[type="text"]';
    const input = await this.page.$(inputSelector);
    const submitBtn = await this.page.$('input[type="image"]');

    if (!input || !submitBtn) {
      return fireResult(wordsData);
    }

    for (const word of words) {
      await this.page.type(inputSelector, word);
      await input.press('Enter', { text: '\n' });

      await submitBtn.click();

      await this.page.waitForResponse('https://www.slovar.co.il/txajax.php');

      const oddNodes = await this.page.$$('.cycle1');
      const evenNodes = await this.page.$$('.cycle-1');
      const wordDataNodes = Translator.mergeArrays(oddNodes, evenNodes);

      let comment: string | undefined;
      const singleWordData: SingleWordData = [];

      for (const wordDataNode of wordDataNodes) {
        const contextNode = await wordDataNode.$('.word');
        const commentNode = await wordDataNode.$('.wordtype');
        const transLitNode = await wordDataNode.$('.translit');
        const translationNode = await wordDataNode.$('.translation');

        const containsComment = !!commentNode;

        if (containsComment) {
          comment = await commentNode.evaluate(node => node.textContent);
        }

        if (!contextNode || !transLitNode || !translationNode) {
          continue;
        }

        const context = await contextNode.evaluate(node => node.textContent);
        const transLit = await transLitNode.evaluate(node => node.textContent);
        const translation = await translationNode.evaluate(node => node.textContent);

        singleWordData.push({ context, comment, transLit, translation });

        if (!containsComment) {
          comment = undefined;
        }
      }

      wordsData[word] = singleWordData;
      cacheStore.set(word, singleWordData);

      await input.click({ clickCount: 3 });
    }

    this.browserTimeoutId = setTimeout(() => {
      this.browser?.close().then(() => {
        this.browser = undefined;
      });
    }, this.closeBrowserAfter);

    fireResult(wordsData);

    this.isProcessing = false;
    const nextTick = this.queue.shift();

    if (nextTick) {
      this.doWork(nextTick.fireResult, ...nextTick.words);
    }
  }, { maxSize: 500, thisArg: this });

  public async getWordsData(...words: string[]): Promise<WordsData> {
    return new Promise(resolve => {
      if (!this.isProcessing) {
        this.doWork(resolve, ...words);
      } else {
        this.queue.push({ words, fireResult: resolve });
      }
    });
  }
}

export const translator = new Translator();