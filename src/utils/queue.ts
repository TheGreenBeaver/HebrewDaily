import noop from 'lodash/noop';
import now from 'lodash/now';

import type { MaybePromise } from './types';

type Cb<Result> = (result: Awaited<Result>) => void;
type QueueEntry<Args extends unknown[], Result> = {
  args: Args,
  cb: Cb<Result>,
  timestamp: number,
};
type WorkerRecord<Worker extends object> = {
  worker: Worker,
  isBusy: boolean,
  expiryId?: NodeJS.Timeout,
};

export abstract class Queue<Args extends unknown[], Result, Worker extends object = object, BP = Args> {
  private readonly queue: QueueEntry<Args, Result>[] = [];

  private readonly maxWorkers: number;
  private readonly workerExpiresAfter: number;
  private readonly workerPool: WorkerRecord<Worker>[] = [];

  constructor(maxWorkers: number = 1, workerExpiresAfter: number = 60 * 1000 * 2) {
    this.maxWorkers = maxWorkers;
    this.workerExpiresAfter = workerExpiresAfter;
  }

  private getNext(): QueueEntry<Args, Result> | undefined {
    return this.queue.shift();
  }

  private putBack(entry: QueueEntry<Args, Result>) {
    this.queue.unshift(entry);
  }

  protected spawnWorker(): MaybePromise<Worker> {
    return {} as Worker;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onWorkerExpired(worker: Worker): void {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected shouldPrioritize(nextArgs: Args, bp: BP): boolean {
    return false;
  }

  protected async setBreakpoint(worker: Worker, bp: BP) {
    const next = this.getNext();

    if (!next) {
      return;
    }

    if (this.shouldPrioritize(next.args, bp)) {
      const rawNextResult = this.performWork(worker, ...next.args);

      await Promise.resolve(rawNextResult).then(nextResult => {
        next.cb(nextResult);
      }).catch(noop);
    } else {
      this.putBack(next);
    }
  }

  protected abstract performWork(worker: Worker, ...args: Args): Result;

  private async tick() {
    let workerRecordIdx = this.workerPool.findIndex(record => !record.isBusy);
    let workerRecord = this.workerPool[workerRecordIdx];

    if (!workerRecord && this.workerPool.length >= this.maxWorkers) {
      return;
    }

    const next = this.getNext();

    if (next) {
      if (!workerRecord) {
        try {
          const worker = await this.spawnWorker();
          workerRecord = { worker, isBusy: false };
          workerRecordIdx = this.queue.length;
          this.workerPool.push(workerRecord);
        } catch {
          this.putBack(next);

          return;
        }
      }

      const { worker, expiryId } = workerRecord;

      clearTimeout(expiryId);
      workerRecord.isBusy = true;

      const rawResult = this.performWork(worker, ...next.args);

      Promise.resolve(rawResult).then(result => {
        next.cb(result);

        if (workerRecord) {
          workerRecord.isBusy = false;
          workerRecord.expiryId = setTimeout(() => {
            this.onWorkerExpired(worker);
            this.workerPool.splice(workerRecordIdx, 1);
          }, this.workerExpiresAfter);
        }

        void this.tick();
      }).catch(() => {
        if (workerRecord) {
          workerRecord.isBusy = false;
        }

        this.putBack(next);
        void this.tick();
      });
    }
  }

  public get size(): number {
    return this.queue.length;
  }

  public push(args: Args): Promise<Result>;
  public push(args: Args, cb: Cb<Result>): void;

  public push(args: Args, cb?: Cb<Result>) {
    if (cb) {
      this.queue.push({ args, cb, timestamp: now() });
      void this.tick();

      return;
    }

    return new Promise(resolve => {
      this.queue.push({ args, cb: resolve, timestamp: now() });
      void this.tick();
    });
  }
}