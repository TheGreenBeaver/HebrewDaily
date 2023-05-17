import { Composer } from 'grammy';

import type { EnhancedContext } from '../../types';
import { handleTranslateWord } from './common';
import { Commands } from './constants';

export const composer = new Composer<EnhancedContext>();

composer.command(Commands.translate, ctx => handleTranslateWord(ctx, ctx.match));