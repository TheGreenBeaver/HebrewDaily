import type { classroom_v1 } from 'googleapis';
import type { SessionFlavor } from 'grammy';

import type { EnhancedContext } from '../../types';

export type SessionData = {
  courseId?: string | null,
  availableCourses?: classroom_v1.Schema$Course[],
  wordsSourcePattern?: string,
  googleToken?: string | null,
};

export type ExtraContext = SessionFlavor<SessionData>;

export type GoogleServicesContext = EnhancedContext & ExtraContext;