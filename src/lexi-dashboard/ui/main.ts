import { applyTheme, currentTheme, systemPrefers, type ThemeName } from './theme/themes.js';
import './components/lexi-app.js';

const stored = localStorage.getItem('lexi-theme') as ThemeName | null;
applyTheme(stored ?? systemPrefers());
console.log('Lexi UI ready · theme:', currentTheme());
