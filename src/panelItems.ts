import * as vscode from 'vscode';

import { CommandSuggestion, PanelItem } from './types';

const DEFAULT_PANEL_ITEMS: ReadonlyArray<PanelItem> = [
  {
    tooltip: 'New',
    command: 'workbench.action.files.newUntitledFile',
    svg: "<svg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'><path d='M4 1.75h5.1L12.25 4.9V14.25H4z' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linejoin='round'/><path d='M9 1.75v3.5h3.25' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linejoin='round'/><path d='M10.75 2.4l.55-1.15M12.6 4.25l1.15-.55M12.65 2.8l.95-.95' stroke='currentColor' stroke-width='1.25' stroke-linecap='round'/></svg>"
  },
  {
    tooltip: 'Open',
    command: 'workbench.action.files.openFile',
    svg: "<svg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'><path d='M3.75 1.75h5.1L12 4.9v9.35H3.75z' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linejoin='round'/><path d='M8.75 1.75v3.5H12' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linejoin='round'/><path d='M5.5 9h4.75M8.25 6.75l2.25 2.25-2.25 2.25' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>"
  },
  {
    tooltip: 'Save',
    command: 'workbench.action.files.save',
    svg: "<svg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'><path d='M2.75 1.75h8.5l2 2v10.5h-10.5z' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linejoin='round'/><path d='M5 1.75v4h5v-4M5 12.25h6' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linejoin='round'/></svg>"
  },
  {
    tooltip: 'Sidebar',
    command: 'workbench.action.toggleSidebarVisibility',
    text: 'Sidebar'
  },
  {
    tooltip: 'Panel',
    command: 'workbench.action.togglePanel',
    text: 'Panel'
  },
  {
    tooltip: 'Extension',
    command: 'workbench.view.extensions',
    text: 'Extension'
  },
  {
    tooltip: 'Search',
    command: 'workbench.view.search',
    svg: "<svg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'><circle cx='7' cy='7' r='4.25' fill='none' stroke='currentColor' stroke-width='1.5'/><path d='M10.5 10.5L14 14' stroke='currentColor' stroke-width='1.5' stroke-linecap='round'/></svg>"
  },
  {
    tooltip: 'ToDo',
    command: 'workbench.action.findInFiles',
    arguments: [
      {
        query: 'TODO:|ToDo:',
        isRegex: true,
        triggerSearch: true
      }
    ],
    text: 'Search Todo',
    svg: "<svg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'><circle cx='7' cy='7' r='4.25' fill='none' stroke='currentColor' stroke-width='1.5'/><path d='M10.5 10.5L14 14' stroke='currentColor' stroke-width='1.5' stroke-linecap='round'/></svg>"
  }
];

/**
 * Reads user-configured panel items, validates them, and appends computed ids for runtime use.
 */
export function getPanelItems(): PanelItem[] {
  const config = vscode.workspace.getConfiguration('toorubaPanel');
  const debugDefault = config.get<boolean>('debugDefault', false);

  if (debugDefault) {
    return getDefaultPanelItems();
  }

  const inspect = config.inspect<unknown[]>('items');
  const items = inspect?.globalValue ?? config.get<unknown[]>('items', []);

  return items.flatMap((item) => {
    if (!isPanelItem(item)) {
      return [];
    }

    return [withComputedId(item)];
  });
}

/**
 * Returns the built-in default panel items for debug runs.
 */
export function getDefaultPanelItems(): PanelItem[] {
  return DEFAULT_PANEL_ITEMS.map(withComputedId);
}

/**
 * Persists panel items into global user settings without the transient runtime ids.
 */
export async function savePanelItems(items: PanelItem[]): Promise<void> {
  const config = vscode.workspace.getConfiguration('toorubaPanel');
  await config.update('items', items.map(stripInternalId), vscode.ConfigurationTarget.Global);
}

/**
 * Narrows an arbitrary value to a minimally valid panel item.
 */
export function isPanelItem(value: unknown): value is PanelItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Record<string, unknown>;
  return typeof item.command === 'string';
}

/**
 * Generates a stable item id from visible fields so the webview can target commands reliably.
 */
export function withComputedId(item: PanelItem): PanelItem {
  const seed = [item.command, item.text ?? '', item.tooltip ?? '', item.svg ?? ''].join('|');
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return {
    ...item,
    id: `item-${hash.toString(16)}`
  };
}

/**
 * Removes runtime-only ids before saving panel items back to settings.json.
 */
export function stripInternalId(item: PanelItem): PanelItem {
  const { id: _id, ...rest } = item;
  return rest;
}

/**
 * Builds a sorted list of known commands from registered and contributed VS Code commands.
 */
export async function getKnownCommands(): Promise<CommandSuggestion[]> {
  const registered = await vscode.commands.getCommands(true);
  const contributed = vscode.extensions.all.flatMap((extension) => {
    const packageJson = extension.packageJSON as {
      contributes?: {
        commands?: Array<{ command?: unknown; title?: unknown }>;
      };
    };

    return (packageJson.contributes?.commands ?? []).flatMap((entry) => {
      return typeof entry.command === 'string'
        ? [{
            command: entry.command,
            title: typeof entry.title === 'string' ? entry.title : undefined
          }]
        : [];
    });
  });

  const byCommand = new Map<string, CommandSuggestion>();

  for (const entry of contributed) {
    byCommand.set(entry.command, entry);
  }

  for (const command of registered) {
    const existing = byCommand.get(command);
    byCommand.set(command, existing ?? { command });
  }

  return [...byCommand.values()].sort((left, right) => {
    const leftLabel = left.title ?? left.command;
    const rightLabel = right.title ?? right.command;
    return leftLabel.localeCompare(rightLabel) || left.command.localeCompare(right.command);
  });
}
