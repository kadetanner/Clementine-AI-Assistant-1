import { applyTheme, currentTheme, systemPrefers, type ThemeName } from './theme/themes.js';
import './components/lexi-app.js';
import './components/lexi-command-palette.js';

const stored = localStorage.getItem('lexi-theme') as ThemeName | null;
applyTheme(stored ?? systemPrefers());

const palette = document.createElement('lexi-command-palette');
document.body.appendChild(palette);

console.log('Lexi UI ready · theme:', currentTheme());
