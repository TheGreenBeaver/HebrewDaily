import type { classroom_v1, drive_v3, google } from 'googleapis';
import type { Logger } from 'winston';

export type AuthClient = InstanceType<typeof google['auth']['OAuth2']>;
export type Drive = drive_v3.Drive;

export type Classroom = classroom_v1.Classroom;

type Credentials = Parameters<AuthClient['setCredentials']>[0];
export type CredentialsStorage = Map<number, Credentials>;

export type AppResources = {
  logger: Logger,
  credentialsStorage: CredentialsStorage,
};

export type GoogleTools = {
  authClient: AuthClient,
  classroom: Classroom,
  drive: Drive,
};