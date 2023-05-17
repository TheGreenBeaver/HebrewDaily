import type { GoogleServicesContext } from '../types';

export const handleGoogleAuth = (ctx: GoogleServicesContext, emergency?: boolean) => {
  const { session, authClient } = ctx;

  session.courseId = undefined;
  session.availableCourses = undefined;
  session.wordsSourcePattern = undefined;

  const url = authClient.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/classroom.topics.readonly',
    ],
    state: `${ctx.chat?.id}`,
  });

  const introduction = emergency
    ? 'Мне понадобится доступ к Вашему Google Classroom, чтобы обработать эту команду. '
    : '';

  return ctx.reply(
    `${introduction}Пожалуйста, перейдите по <a href="${url}">этой ссылке</a>, чтобы авторизоваться в Google.`,
    { parse_mode: 'HTML' },
  );
};