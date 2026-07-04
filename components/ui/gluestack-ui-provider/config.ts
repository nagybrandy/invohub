import { vars } from 'nativewind';
import { themeTokens } from '@/lib/theme/tokens';

export const colors = themeTokens;

export const config = {
  light: vars(colors.light),
  dark: vars(colors.dark),
};
