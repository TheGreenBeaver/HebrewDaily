import type { classroom_v1, drive_v3, google } from 'googleapis';
import type { Logger } from 'winston';

export type AuthClient = InstanceType<typeof google['auth']['OAuth2']>;

export type Drive = drive_v3.Drive;

export type Classroom = classroom_v1.Classroom;

export type AppResources = {
  authClient: AuthClient,
  classroom: Classroom,
  drive: Drive,
  logger: Logger,
};