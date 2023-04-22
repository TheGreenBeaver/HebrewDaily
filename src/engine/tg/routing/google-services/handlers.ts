import { Composer } from 'grammy';

import { listAll } from '../../../../utils/google-services';
import { handleGoogleAuth, handleListWords } from './common';
import { Commands } from './constants';
import type { GoogleServicesContext } from './types';

export const composer = new Composer<GoogleServicesContext>();

composer.command(Commands.googleAuth, ctx => handleGoogleAuth(ctx));

composer.command(Commands.listWords, async ctx => {
  const { resources: { classroom }, session, getControl } = ctx;

  const handled = await handleListWords(ctx);

  if (handled) {
    return;
  }

  const allCourses = await listAll(params => classroom.courses.list(params), 'courses');

  if (!allCourses.length) {
    return ctx.reply('У Вас нет доступных активных курсов');
  }

  session.availableCourses = allCourses;
  const coursesList = allCourses.map((course, idx) => `  ${idx + 1}. ${course.name}`).join('\n');

  getControl();
  return ctx.reply(
    `Пожалуйста, выберите нужный курс (введите название или номер). Доступные курсы:\n${coursesList}`,
  );
});