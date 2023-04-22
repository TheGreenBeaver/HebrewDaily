import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import { getNodeEnv, getVar } from '../../utils/env';
import { decomposePath, normalizePath } from '../../utils/rom-access';
import type { Ensure } from '../../utils/types';

type Transports = Ensure<winston.LoggerOptions['transports']>;

const getTransports = (): Transports => {
  const transports: Transports = [new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
    ),
  })];

  const logsStorage = getVar('LOGS_STORAGE');

  if (logsStorage) {
    const { dir, name } = decomposePath(normalizePath(logsStorage));

    transports.push(new DailyRotateFile({
      dirname: dir,
      filename: name,
      datePattern: 'YYYY-MM-DD',
      maxSize: '1m',
      maxFiles: '1d',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'hh:mm:ss' }),
        winston.format.printf(({ level, message, timestamp }) => `[${timestamp}] ${level}: ${message}`),
      ),
    }));
  }

  return transports;
};

const getLevel = () => getNodeEnv() === 'dev' ? 'debug' : 'info';

export const createLogger = (): winston.Logger => winston.createLogger({
  level: getLevel(),
  transports: getTransports(),
});