/**
 * Information architecture per Lighthouse spec §5.
 * 17 nav items grouped into 5 categories.
 */
import type { IconName } from '../design/icons.js';

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  /** Route hash without the leading #/ */
  route: string;
  /** ⌘<n> shortcut key 1-9 (only for top-level work items) */
  shortcut?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'work',
    label: 'Work',
    items: [
      { id: 'today',     label: 'Today',     icon: 'home',      route: 'today',     shortcut: '1' },
      { id: 'agents',    label: 'Agents',    icon: 'agents',    route: 'agents',    shortcut: '2' },
      { id: 'workflows', label: 'Workflows', icon: 'workflows', route: 'workflows', shortcut: '3' },
      { id: 'cron',      label: 'Cron',      icon: 'cron',      route: 'cron',      shortcut: '4' },
      { id: 'routines',  label: 'Routines',  icon: 'routines',  route: 'routines' },
    ],
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    items: [
      { id: 'memory', label: 'Memory', icon: 'memory', route: 'memory', shortcut: '5' },
      { id: 'brain',  label: 'Brain',  icon: 'brain',  route: 'brain' },
      { id: 'vault',  label: 'Vault',  icon: 'vault',  route: 'vault',  shortcut: '6' },
    ],
  },
  {
    id: 'operate',
    label: 'Operate',
    items: [
      { id: 'connections', label: 'Connections', icon: 'connections', route: 'connections', shortcut: '7' },
      { id: 'skills',      label: 'Skills',      icon: 'skills',      route: 'skills' },
      { id: 'approvals',   label: 'Approvals',   icon: 'approvals',   route: 'approvals' },
      { id: 'budget',      label: 'Budget',      icon: 'budget',      route: 'budget' },
    ],
  },
  {
    id: 'observe',
    label: 'Observe',
    items: [
      { id: 'logs',      label: 'Logs',      icon: 'logs',      route: 'logs',      shortcut: '8' },
      { id: 'advisor',   label: 'Advisor',   icon: 'advisor',   route: 'advisor' },
      { id: 'heartbeat', label: 'Heartbeat', icon: 'heartbeat', route: 'heartbeat' },
      { id: 'build',     label: 'Build',     icon: 'build',     route: 'build' },
    ],
  },
  {
    id: 'console',
    label: 'Console',
    items: [
      { id: 'chat',  label: 'Chat',  icon: 'chat',  route: 'chat',  shortcut: '9' },
      { id: 'trace', label: 'Trace', icon: 'trace', route: 'trace' },
    ],
  },
];

export const NAV_FOOTER: NavItem[] = [
  { id: 'search',   label: 'Search',   icon: 'search',   route: 'search' },
  { id: 'settings', label: 'Settings', icon: 'settings', route: 'settings' },
];

/** Flatten for ⌘K palette etc. */
export function allNavItems(): NavItem[] {
  return [...NAV_GROUPS.flatMap((g) => g.items), ...NAV_FOOTER];
}

/** Reverse lookup: route hash → NavItem */
export function findByRoute(route: string): NavItem | undefined {
  return allNavItems().find((i) => i.route === route);
}
