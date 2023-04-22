import type { NextFunction } from 'grammy';
import { Bot, session as sessionMiddleware } from 'grammy';
import mapValues from 'lodash/mapValues';
import now from 'lodash/now';

import { getVar } from '../../utils/env';
import type { AppResources } from '../types';
import * as googleServices from './routing/google-services';
import * as misc from './routing/misc';
import * as translations from './routing/translations';
import type { ControlData, EnhancedContext } from './types';

type CombinedContext = EnhancedContext & (
  googleServices.ExtraContext
);

export const createBot = (resources: AppResources): Bot<CombinedContext> => {
  const { logger } = resources;
  const token = getVar('BOT_TOKEN');

  if (!token) {
    logger.error('No Telegram Bot Token found');

    throw new Error('No Telegram Bot Token found');
  }

  // === === === === ===
  const bot = new Bot<CombinedContext>(token);

  const modules = {
    misc,
    translations,
    googleServices,
  };

  const initControlSession = (): ControlData => ({});

  const initial = (): CombinedContext['session'] => ({
    ...initControlSession(),
    ...Object.values(modules).reduce((state, config) => ({
      ...state,
      ...('initSession' in config ? config.initSession() : {}),
    }), {}),
  });

  bot.use(
    sessionMiddleware({ initial }),

    async (ctx, next) => {
      const { session } = ctx;
      const { commandName } = session;

      // === === ===
      ctx.resources = resources;

      ctx.getControl = () => {
        const moduleName = Object
          .entries(modules)
          .find(([, config]) => 'Commands' in config && commandName && commandName in config.Commands)?.[0];

        logger.info(`${moduleName} got control while handling ${commandName} command`);
        session.moduleInControl = moduleName;
      };

      ctx.dropControl = () => {
        logger.info('No module is in control');
        session.moduleInControl = undefined;
      };

      // === === ===
      session.commandName = ctx.entities().find(entity => entity.type === 'bot_command')?.text.substring(1);

      await next();
    },

    async ({ session: { commandName, moduleInControl } }, next) => {
      const startTime = now();
      await next();
      const endTime = now();
      const processingTime = (endTime - startTime) / 1000;

      const message =
        `Time spent: ${processingTime.toFixed(3)}s. ` +
        `Details: commandName = ${commandName}, moduleInControl = ${moduleInControl}`;

      if (processingTime > 8) {
        logger.error(message);
      } else if (processingTime > 5) {
        logger.warn(message);
      } else {
        logger.debug(message);
      }
    },
  );

  // === === === === ===
  const routeHandlers = mapValues(modules, module => 'extraMiddleware' in module
    ? module.extraMiddleware
    : async (_: CombinedContext, next: NextFunction) => {
      await next();
    },
  );

  bot.route(({ session: { commandName, moduleInControl } }) => {
    for (const [moduleName, moduleConfig] of Object.entries(modules)) {
      if (
        moduleInControl === moduleName ||
        commandName && 'Commands' in moduleConfig && commandName in moduleConfig.Commands
      ) {
        return moduleName as keyof typeof modules;
      }
    }

    return undefined;
  }, routeHandlers);

  // === === === === ===
  Object.values(modules).forEach(module => bot.use(module.composer));

  // === === === === ====
  bot.catch(error => {
    logger.error(error.message);

    return error.ctx.reply('Упс! Что-то пошло не так...');
  });

  return bot;
};