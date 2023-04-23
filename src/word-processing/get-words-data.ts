import puppeteer from 'puppeteer';

import { withComplicatedCache } from '../utils/cache';
import { Queue } from '../utils/queue';
import type { SingleWordData, WordsData } from './types';

type Browser = Awaited<ReturnType<typeof puppeteer['launch']>>;
type Page = Awaited<ReturnType<Browser['newPage']>>;
type Worker = { page: Page };

class TranslatorQueue extends Queue<string[], Promise<WordsData>, Worker, number>{
  private browser: Browser | undefined;
  private launchBrowser: Promise<Browser> | undefined;
  private static MAX_RETRIES = 5;

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

  protected override async onWorkerExpired({ page }: Worker) {
    try {
      await page.close();
      await this.browser?.close();
    } catch {}

    this.browser = undefined;
    this.launchBrowser = undefined;
  }

  protected override async spawnWorker(): Promise<Worker> {
    console.log('spawning new worker');
    if (!this.browser) {
      if (!this.launchBrowser) {
        this.launchBrowser = puppeteer.launch();
      }

      this.browser = await this.launchBrowser;
    }

    const page = await this.browser.newPage();
    let retriesLeft = TranslatorQueue.MAX_RETRIES;

    while (true) {
      try {
        await page.goto('https://www.slovar.co.il/translate.php');

        return { page };
      } catch (e) {
        console.log('error while spawning', e);
        if (--retriesLeft === 0) {
          await page.close();
          throw e;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  protected override shouldPrioritize(nextArgs: string[], wordsLeft: number): boolean {
    return nextArgs.length < wordsLeft;
  }

  protected performWork = withComplicatedCache<Promise<WordsData>, [Worker, ...string[]], SingleWordData>(async (
    cacheStore, worker, ...allWords
  ) => {
    console.log('performing work on ', allWords);
    const wordsData: WordsData = {};
    const { page } = worker;

    const words = allWords.filter(word => {
      const cached = cacheStore.get(word);

      if (cached) {
        wordsData[word] = cached;

        return false;
      }

      return true;
    });

    if (!words.length) {
      return wordsData;
    }

    const inputSelector = 'input[type="text"]';
    const input = await page.$(inputSelector);
    const submitBtn = await page.$('input[type="image"]');

    if (!input || !submitBtn) {
      return wordsData;
    }

    let wordsLeft = words.length;

    for (const word of words) {
      await page.type(inputSelector, word);
      await input.press('Enter', { text: '\n' });

      await submitBtn.click();

      await page.waitForResponse('https://www.slovar.co.il/txajax.php');

      const oddNodes = await page.$$('.cycle1');
      const evenNodes = await page.$$('.cycle-1');
      const wordDataNodes = TranslatorQueue.mergeArrays(oddNodes, evenNodes);

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
      await this.setBreakpoint(worker, --wordsLeft);
    }

    return wordsData;
  }, { maxSize: 500, thisArg: this });
}

export const translator = new TranslatorQueue(10);