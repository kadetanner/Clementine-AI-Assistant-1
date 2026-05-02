export const THEME_TOKENS = [
  'bg-canvas','bg-surface','bg-elevated',
  'border-subtle','border-default',
  'text-primary','text-secondary','text-tertiary',
  'accent','accent-hover','accent-glow',
  'success','warning','danger','purple',
] as const;

export type ThemeToken = (typeof THEME_TOKENS)[number];
export type ThemeName = 'light' | 'dark';
export type ThemeValues = Record<ThemeToken, string>;
