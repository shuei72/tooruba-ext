/**
 * Describes a single toolbar item shown in the Tooruba panel.
 */
export type PanelItem = {
  id?: string;
  command: string;
  arguments?: unknown[];
  tooltip?: string;
  text?: string;
  svg?: string;
};

/**
 * Describes messages exchanged between the extension host and webviews.
 */
export type WebviewMessage =
  | { type: 'run-command'; id: string }
  | { type: 'save-items'; items: PanelItem[] }
  | { type: 'request-items' }
  | { type: 'request-commands' };

/**
 * Represents a command suggestion shown in the settings editor.
 */
export type CommandSuggestion = {
  command: string;
  title?: string;
};
