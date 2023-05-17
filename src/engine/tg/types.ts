import type { Context, SessionFlavor } from 'grammy';

import type { AppResources } from '../types';

export type ControlData = {
  commandName?: string,
  moduleInControl?: string,
};

export type EnhancedContext =
  & Context
  & AppResources
  & {
    getControl: () => void,
    dropControl: () => void,
  }
  & SessionFlavor<ControlData>;