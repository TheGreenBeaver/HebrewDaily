import type { Express } from 'express';
import express from 'express';
import type { Context } from 'grammy';

import * as googleServices from './routing/google-services';
import type { WebServerResources } from './types';

export const createWebServer = <Ctx extends Context>(resources: WebServerResources<Ctx>): Express => {
  const app = express();
  app.use(express.json());

  app.locals.resources = resources;

  app.use(googleServices.router);

  return app;
};