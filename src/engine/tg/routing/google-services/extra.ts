import type { classroom_v1 } from 'googleapis';
import { Composer } from 'grammy';

import { getGoogleTools } from '../../../app-resources';
import { handleGoogleAuth, handleListWords } from './common';
import { Commands } from './constants';
import type { GoogleServicesContext, SessionData } from './types';

export const initSession = (): SessionData => ({});

export const extraMiddleware = new Composer<GoogleServicesContext>(
  async (ctx, next) => {
    const { chat, credentialsStorage } = ctx;

    if (!chat) {
      return ctx.reply('Где я?..');
    }

    const googleTools = getGoogleTools(chat.id);

    const tokens = credentialsStorage.get(chat.id);

    if (tokens) {
      googleTools.authClient.setCredentials(tokens);
    }

    Object.assign(ctx, googleTools);

    await next();

    return undefined;
  },

  async (ctx, next) => {
    const { authClient, session: { commandName } } = ctx;

    if (!authClient.credentials.access_token && commandName !== Commands.googleAuth) {
      return handleGoogleAuth(ctx, true);
    }

    await next();

    return undefined;
  },

  async (ctx, next) => {
    const { session, message } = ctx;
    const { availableCourses, courseId } = session;

    if (availableCourses && !courseId) {
      const text = message?.text;
      const asIndex = Number(text);
      let pickedCourse: classroom_v1.Schema$Course | undefined;

      if (!isNaN(asIndex)) {
        pickedCourse = availableCourses[asIndex - 1];
      } else {
        pickedCourse = availableCourses.find(course => course.name === text);
      }

      if (pickedCourse) {
        session.courseId = pickedCourse.id;

        const coursePrefix = pickedCourse.name?.trim().match(/\w+(?=\W)/)?.[0];
        session.wordsSourcePattern = `${coursePrefix ?? ''}*`;

        await handleListWords(ctx);

        return undefined;
      }

      return ctx.reply('Курса, подходящего под заданные параметры, не нашлось');
    }

    await next();

    return undefined;
  },
);