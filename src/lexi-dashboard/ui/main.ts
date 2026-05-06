import { applyTheme, currentTheme, systemPrefers, type ThemeName } from './theme/themes.js';
import './components/lexi-app.js';
import './components/lexi-command-palette.js';
import './components/workflows/lexi-workflows-view.js';
import './components/workflows/lexi-workflow-detail.js';
import './components/lexi-vault-view.js';
import './components/lexi-memory-view.js';
import './components/lexi-cron-view.js';
import './components/lexi-settings-view.js';

const stored = localStorage.getItem('lexi-theme') as ThemeName | null;
applyTheme(stored ?? systemPrefers());

const palette = document.createElement('lexi-command-palette');
document.body.appendChild(palette);

console.log('Lexi UI ready · theme:', currentTheme());
