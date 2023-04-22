import type { Bot, Context } from 'grammy';

import type { AppResources } from '../types';

export type WebServerResources<Ctx extends Context> = AppResources & {
  bot: Bot<Ctx>,
};