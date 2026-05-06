/**
 * Heroicons-outline subset, vendored as inline SVG strings.
 * Stroke 1.5px to match Lighthouse §4.4.
 *
 * Single icon family; no mixed sets. Each icon is a 24x24 SVG path string
 * the caller wraps in <svg> with the desired size.
 */

export type IconName =
  | 'home' | 'agents' | 'workflows' | 'cron' | 'routines'
  | 'memory' | 'brain' | 'vault' | 'connections' | 'skills'
  | 'approvals' | 'budget' | 'logs' | 'advisor' | 'heartbeat'
  | 'build' | 'team' | 'projects' | 'plans' | 'claims'
  | 'chat' | 'trace' | 'search' | 'settings' | 'notifications'
  | 'play' | 'pause' | 'stop' | 'replay' | 'refresh'
  | 'plus' | 'minus' | 'check' | 'x' | 'chevron-right' | 'chevron-down' | 'chevron-up'
  | 'arrow-up-right' | 'arrow-right' | 'external'
  | 'sun' | 'moon' | 'monitor'
  | 'info' | 'warning' | 'error' | 'success' | 'help'
  | 'edit' | 'copy' | 'trash' | 'pin' | 'star'
  | 'lock' | 'unlock' | 'eye' | 'eye-off'
  | 'calendar' | 'clock' | 'tag' | 'filter' | 'sort'
  | 'grid' | 'list' | 'kanban' | 'table'
  | 'expand' | 'collapse' | 'menu' | 'more-horizontal' | 'more-vertical'
  | 'document' | 'folder' | 'database' | 'globe' | 'code' | 'terminal'
  | 'user' | 'users' | 'shield' | 'cpu' | 'activity' | 'zap'
  | 'bell' | 'bell-off' | 'mail' | 'send' | 'mic' | 'mic-off';

const P = {
  home: 'M3 12l9-9 9 9M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10',
  agents: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  workflows: 'M3 6h6v6H3zM15 6h6v6h-6zM9 9h6M3 18h6v-6H3zM15 18h6v-6h-6zM12 12v6',
  cron: 'M12 6v6l4 2M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z',
  routines: 'M21 12a9 9 0 1 1-9-9c2.5 0 4.78 1 6.4 2.6L21 8M21 3v5h-5',
  memory: 'M9 3v18M15 3v18M3 9h18M3 15h18M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z',
  brain: 'M9.5 2A2.5 2.5 0 0 0 7 4.5v.5a2.5 2.5 0 0 1-2.5 2.5h0A2.5 2.5 0 0 0 2 10v0a2.5 2.5 0 0 0 2.5 2.5h0A2.5 2.5 0 0 1 7 15v.5A2.5 2.5 0 0 0 9.5 18h0A2.5 2.5 0 0 0 12 15.5V4.5A2.5 2.5 0 0 0 9.5 2zM14.5 2A2.5 2.5 0 0 1 17 4.5v.5a2.5 2.5 0 0 0 2.5 2.5h0A2.5 2.5 0 0 1 22 10v0a2.5 2.5 0 0 1-2.5 2.5h0A2.5 2.5 0 0 0 17 15v.5a2.5 2.5 0 0 1-2.5 2.5h0A2.5 2.5 0 0 1 12 15.5V4.5A2.5 2.5 0 0 1 14.5 2z',
  vault: 'M5 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM9 6V4a3 3 0 1 1 6 0v2',
  connections: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  skills: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 1 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  approvals: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  budget: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  logs: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  advisor: 'M12 2a10 10 0 0 1 0 20 10 10 0 0 1 0-20zm0 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 3v3l2 2',
  heartbeat: 'M22 12h-4l-3 9L9 3l-3 9H2',
  build: 'M14.7 6.3l-1 1L20 13.6V21h-7.4l-6.3-6.3-1 1L4 17l-2-2L7 10l-2-2L7 6l2 2 5-5 7 7-3.3 3.3z',
  team: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  projects: 'M3 7l9-4 9 4M3 7v10l9 4 9-4V7M3 7l9 4 9-4M12 11v10',
  plans: 'M9 11l3 3L22 4M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  claims: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  trace: 'M3 6h13M3 12h9M3 18h13M19 6l3 3-3 3M19 12l3 3-3 3',
  search: 'M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  settings: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 0 1 7.04 4.29l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.21.5.7.84 1.27 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  notifications: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  play: 'M5 3l14 9-14 9z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  stop: 'M5 5h14v14H5z',
  replay: 'M3 12a9 9 0 1 0 9-9M3 12V5M3 12h7',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-up': 'M18 15l-6-6-6 6',
  'arrow-up-right': 'M7 17L17 7M7 7h10v10',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',
  sun: 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z',
  monitor: 'M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM8 21h8M12 17v4',
  info: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM12 16v-4M12 8h.01',
  warning: 'M10.29 3.86l-8.16 14.14A2 2 0 0 0 3.86 21h16.28a2 2 0 0 0 1.73-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  error: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM15 9l-6 6M9 9l6 6',
  success: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3',
  help: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
  pin: 'M12 17v5M9 11.5L4.27 5.32A1 1 0 0 1 5.05 4h13.9a1 1 0 0 1 .78 1.32L15 11.5l-3 5.5z',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  lock: 'M5 11h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4',
  unlock: 'M5 11h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 9.9-1',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'eye-off': 'M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5.06-5.94M9.9 4.24A10 10 0 0 1 12 4c7 0 11 8 11 8a17.92 17.92 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24M1 1l22 22',
  calendar: 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18',
  clock: 'M12 6v6l4 2M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83zM7 7h.01',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54z',
  sort: 'M3 6h18M6 12h12M10 18h4',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  kanban: 'M3 3h6v18H3zM10 3h6v12h-6zM17 3h4v8h-4z',
  table: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  collapse: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7',
  menu: 'M3 12h18M3 6h18M3 18h18',
  'more-horizontal': 'M5 12h.01M12 12h.01M19 12h.01',
  'more-vertical': 'M12 5v.01M12 12v.01M12 19v.01',
  document: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  database: 'M12 2C6 2 4 4 4 6v12c0 2 2 4 8 4s8-2 8-4V6c0-2-2-4-8-4zM4 6c0 2 2 4 8 4s8-2 8-4M4 12c0 2 2 4 8 4s8-2 8-4',
  globe: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  terminal: 'M4 17l6-6-6-6M12 19h8',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  cpu: 'M5 5h14v14H5zM9 9h6v6H9zM12 1v3M12 20v3M1 12h3M20 12h3M12 1h0M16 1v3M8 1v3M16 20v3M8 20v3M1 16h3M1 8h3M20 16h3M20 8h3',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  'bell-off': 'M13.73 21a2 2 0 0 1-3.46 0M18.63 13A17.89 17.89 0 0 1 18 8M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.33-5M1 1l22 22',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6L12 13 2 6',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  mic: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8',
  'mic-off': 'M1 1l22 22M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v4M8 23h8',
};

export function iconPath(name: IconName): string | null {
  return P[name] ?? null;
}

/** Returns an SVG string at the requested size. Caller appends to DOM. */
export function iconSvg(name: IconName, size = 16, strokeWidth = 1.5): string {
  const d = P[name];
  if (!d) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d
    .split('M')
    .filter(Boolean)
    .map((p) => `<path d="M${p}" />`)
    .join('')}</svg>`;
}
