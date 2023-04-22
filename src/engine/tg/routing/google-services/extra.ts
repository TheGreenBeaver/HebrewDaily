import type { classroom_v1 } from 'googleapis';
import { Composer } from 'grammy';

import { handleGoogleAuth, handleListWords } from './common';
import { Commands } from './constants';
import type { GoogleServicesContext, SessionData } from './types';

export const initSession = (): SessionData => ({});

export const extraMiddleware = new Composer<GoogleServicesContext>(
  async (ctx, next) => {
    const { resources: { authClient }, session: { commandName } } = ctx;

    if (!authClient.credentials.access_token && commandName !== Commands.googleAuth) {
      handleGoogleAuth(ctx, true);
    } else {
      await next();
    }
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
      } else {
        await next();
      }
    } else {
      await next();
    }
  },
);