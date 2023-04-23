import { webhookCallback } from 'grammy';

import { getVar } from '../utils/env';
import { getPort } from '../utils/routing';
import { createAppResources } from './app-resources';
import { createBot } from './tg';
import { createWebServer } from './web-server';

export const start = () => {
  const appResources = createAppResources();
  const bot = createBot(appResources);
  const app = createWebServer({ ...appResources, bot });

  const publicUrl = getVar('PUBLIC_URL');
  const port = getPort();

  if (publicUrl) {
    app.use('/lebot', webhookCallback(bot));
    app.listen(port, async () => {
      await bot.api.setWebhook(`${publicUrl}/lebot`);
      appResources.logger.info(`Started an Express server on port ${port}`);
    });
  } else {
    void bot.start({
      onStart: () => {
        app.listen(port, () => appResources.logger.info(`Started an Express server on port ${port}`));
      },
    });
  }
};