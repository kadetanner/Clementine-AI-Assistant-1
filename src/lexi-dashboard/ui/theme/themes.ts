import { THEME_TOKENS, type ThemeName, type ThemeValues } from './tokens.js';
export { THEME_TOKENS };
export type { ThemeName, ThemeValues };

export const DARK: ThemeValues = {
  'bg-canvas': '#0a0a0a', 'bg-surface': '#111111', 'bg-elevated': '#1a1a1a',
  'border-subtle': '#1f1f1f', 'border-default': '#2a2a2a',
  'text-primary': '#ededed', 'text-secondary': '#888888', 'text-tertiary': '#666666',
  'accent': '#0070f3', 'accent-hover': '#3b8eff', 'accent-glow': 'rgba(0,112,243,0.15)',
  'success': '#10b981', 'warning': '#f59e0b', 'danger': '#ef4444', 'purple': '#a855f7',
};

export const LIGHT: ThemeValues = {
  'bg-canvas': '#ffffff', 'bg-surface': '#fafafa', 'bg-elevated': '#f4f4f5',
  'border-subtle': '#e4e4e7', 'border-default': '#d4d4d8',
  'text-primary': '#0a0a0a', 'text-secondary': '#52525b', 'text-tertiary': '#a1a1aa',
  'accent': '#0070f3', 'accent-hover': '#0058c4', 'accent-glow': 'rgba(0,112,243,0.08)',
  'success': '#059669', 'warning': '#d97706', 'danger': '#dc2626', 'purple': '#9333ea',
};

export function applyTheme(name: ThemeName): void {
  const values = name === 'light' ? LIGHT : DARK;
  document.documentElement.dataset.theme = name;
  for (const token of THEME_TOKENS) {
    document.documentElement.style.setProperty(`--${token}`, values[token]);
  }
}

export function currentTheme(): ThemeName {
  return (document.documentElement.dataset.theme as ThemeName) ?? 'dark';
}

export function systemPrefers(): ThemeName {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
