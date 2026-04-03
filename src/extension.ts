import * as vscode from 'vscode';

type PanelItem = {
  id?: string;
  command: string;
  arguments?: unknown[];
  tooltip?: string;
  text?: string;
  svg?: string;
};

type WebviewMessage =
  | { type: 'run-command'; id: string }
  | { type: 'save-items'; items: PanelItem[] }
  | { type: 'request-items' }
  | { type: 'request-commands' };

type CommandSuggestion = {
  command: string;
  title?: string;
};

class PanelViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'toorubaPanelView';
  private currentView?: vscode.WebviewView;

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.currentView = webviewView;
    webviewView.webview.options = { enableScripts: true };

    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      if (message.type !== 'run-command') {
        return;
      }

      const item = getPanelItems().find((candidate) => candidate.id === message.id);
      if (!item) {
        void vscode.window.showWarningMessage(`Panel item "${message.id}" was not found.`);
        return;
      }

      try {
        await vscode.commands.executeCommand(item.command, ...(item.arguments ?? []));
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Failed to run "${item.command}": ${detail}`);
      }
    });

    this.render();
  }

  render(): void {
    if (!this.currentView) {
      return;
    }

    this.currentView.webview.html = getPanelHtml(this.currentView.webview);
  }
}

class SettingsPanel {
  private static readonly viewType = 'toorubaPanel.settings';
  private panel?: vscode.WebviewPanel;
  private commandCache?: CommandSuggestion[];

  show(extensionUri: vscode.Uri): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active, false);
      this.render();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      SettingsPanel.viewType,
      'Tooruba Settings',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'container-icon.svg');
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      if (message.type === 'request-items') {
        await this.postItems();
        return;
      }

      if (message.type === 'request-commands') {
        await this.postCommands();
        return;
      }

      if (message.type === 'save-items') {
        await savePanelItems(message.items.filter(isPanelItem));
        void vscode.window.showInformationMessage('Tooruba settings saved.');
        await this.postItems();
      }
    });

    this.render();
  }

  render(): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.html = getSettingsHtml(this.panel.webview);
  }

  async postItems(): Promise<void> {
    if (!this.panel) {
      return;
    }

    await this.panel.webview.postMessage({
      type: 'load-items',
      items: getPanelItems()
    });
  }

  async postCommands(): Promise<void> {
    if (!this.panel) {
      return;
    }

    if (!this.commandCache) {
      this.commandCache = await getKnownCommands();
    }

    await this.panel.webview.postMessage({
      type: 'load-commands',
      commands: this.commandCache
    });
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new PanelViewProvider();
  const settingsPanel = new SettingsPanel();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PanelViewProvider.viewType, provider),
    vscode.commands.registerCommand('toorubaPanel.openSettings', () => settingsPanel.show(context.extensionUri)),
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('toorubaPanel.items')) {
        provider.render();
        await settingsPanel.postItems();
      }
    })
  );
}

export function deactivate(): void {}

function getPanelItems(): PanelItem[] {
  const config = vscode.workspace.getConfiguration('toorubaPanel');
  const inspect = config.inspect<unknown[]>('items');
  const items = inspect?.globalValue ?? config.get<unknown[]>('items', []);

  return items.flatMap((item) => {
    if (!isPanelItem(item)) {
      return [];
    }

    return [withComputedId(item)];
  });
}

async function savePanelItems(items: PanelItem[]): Promise<void> {
  const config = vscode.workspace.getConfiguration('toorubaPanel');
  await config.update('items', items.map(stripInternalId), vscode.ConfigurationTarget.Global);
}

function isPanelItem(value: unknown): value is PanelItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Record<string, unknown>;
  return typeof item.command === 'string';
}

function withComputedId(item: PanelItem): PanelItem {
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

function stripInternalId(item: PanelItem): PanelItem {
  const { id: _id, ...rest } = item;
  return rest;
}

async function getKnownCommands(): Promise<CommandSuggestion[]> {
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

function getPanelHtml(webview: vscode.Webview): string {
  const nonce = getNonce();
  const items = JSON.stringify(getPanelItems());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tooruba</title>
  <style>
    :root {
      color-scheme: var(--vscode-color-scheme);
      --panel-bg: var(--vscode-editorWidget-background, var(--vscode-editor-background));
      --button-bg-top: var(--vscode-button-secondaryBackground, var(--vscode-toolbar-hoverBackground, var(--vscode-editor-background)));
      --button-bg-bottom: var(--vscode-list-inactiveSelectionBackground, var(--vscode-editorWidget-background, var(--vscode-editor-background)));
      --button-hover-top: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground, var(--vscode-button-secondaryHoverBackground)));
      --button-hover-bottom: var(--vscode-list-hoverBackground, var(--vscode-button-secondaryHoverBackground, var(--vscode-editorWidget-background)));
      --button-active-top: var(--vscode-list-activeSelectionBackground, var(--vscode-button-background));
      --button-active-bottom: var(--vscode-button-background, var(--vscode-list-activeSelectionBackground));
      --button-border: var(--vscode-contrastBorder, var(--vscode-widget-border, var(--vscode-panel-border, #808080)));
      --text-color: var(--vscode-foreground);
      --separator: var(--vscode-widget-border, var(--vscode-panel-border, #808080));
      --focus-ring: var(--vscode-focusBorder, var(--text-color));
      --shadow-highlight: color-mix(in srgb, white 45%, transparent);
      --shadow-pressed: color-mix(in srgb, black 28%, transparent);
    }

    body {
      margin: 0;
      padding: 6px 8px;
      color: var(--text-color);
      font-family: "Segoe UI", sans-serif;
      background: var(--panel-bg);
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    }

    .button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      border: 1px solid var(--button-border);
      background: linear-gradient(180deg, var(--button-bg-top) 0%, var(--button-bg-bottom) 100%);
      border-radius: 0;
      color: inherit;
      padding: 0 10px;
      cursor: pointer;
      user-select: none;
      box-shadow: inset 1px 1px 0 var(--shadow-highlight);
    }

    .button:hover {
      background: linear-gradient(180deg, var(--button-hover-top) 0%, var(--button-hover-bottom) 100%);
    }

    .button:active {
      background: linear-gradient(180deg, var(--button-active-top) 0%, var(--button-active-bottom) 100%);
      box-shadow: inset 1px 1px 2px var(--shadow-pressed);
    }

    .button:focus-visible {
      outline: 1px solid var(--focus-ring);
      outline-offset: 1px;
    }

    .icon {
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: currentColor;
      flex: 0 0 auto;
    }

    .icon svg {
      width: 16px;
      height: 16px;
      display: block;
      fill: currentColor;
    }

    .label {
      white-space: nowrap;
      font-size: 12px;
    }

    .empty {
      border: 1px dashed var(--separator);
      padding: 12px;
      font-size: 12px;
      background: color-mix(in srgb, var(--panel-bg) 84%, var(--text-color) 16%);
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const items = ${items};
    const app = document.getElementById('app');

    if (!items.length) {
      app.innerHTML = '<div class="empty">Add items in settings or open <code>Tooruba: Open Settings</code>.</div>';
    } else {
      const toolbar = document.createElement('div');
      toolbar.className = 'toolbar';

      for (const item of items) {
        const button = document.createElement('button');
        button.className = 'button';
        button.type = 'button';
        button.title = item.tooltip || item.command;
        button.setAttribute('aria-label', item.tooltip || item.text || item.command);

        if (item.svg) {
          const icon = document.createElement('span');
          icon.className = 'icon';
          icon.innerHTML = item.svg;
          button.appendChild(icon);
        }

        if (item.text) {
          const label = document.createElement('span');
          label.className = 'label';
          label.textContent = item.text;
          button.appendChild(label);
        }

        if (!item.svg && !item.text) {
          const label = document.createElement('span');
          label.className = 'label';
          label.textContent = item.command;
          button.appendChild(label);
        }

        button.addEventListener('click', () => {
          vscode.postMessage({ type: 'run-command', id: item.id });
        });

        toolbar.appendChild(button);
      }

      app.appendChild(toolbar);
    }
  </script>
</body>
</html>`;
}

function getSettingsHtml(webview: vscode.Webview): string {
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tooruba Settings</title>
  <style>
    :root {
      color-scheme: var(--vscode-color-scheme);
      --bg: var(--vscode-editor-background);
      --surface: var(--vscode-editorWidget-background, var(--bg));
      --surface-2: var(--vscode-sideBar-background, var(--surface));
      --border: var(--vscode-panel-border, var(--vscode-widget-border, #808080));
      --text: var(--vscode-foreground);
      --muted: var(--vscode-descriptionForeground, var(--text));
      --input-bg: var(--vscode-input-background);
      --input-border: var(--vscode-input-border, var(--border));
      --button-bg: var(--vscode-button-background);
      --button-fg: var(--vscode-button-foreground);
      --button-hover: var(--vscode-button-hoverBackground);
      --secondary-bg: var(--vscode-button-secondaryBackground, var(--surface-2));
      --secondary-fg: var(--vscode-button-secondaryForeground, var(--text));
      --secondary-hover: var(--vscode-button-secondaryHoverBackground, var(--surface));
      --focus: var(--vscode-focusBorder, var(--text));
      --danger: var(--vscode-errorForeground, #c72e0f);
      --popup-bg: var(--vscode-quickInput-background, var(--surface));
      --popup-border: var(--vscode-widget-border, var(--border));
      --popup-hover: var(--vscode-list-hoverBackground, var(--surface-2));
      --popup-active-bg: var(--vscode-list-activeSelectionBackground, var(--secondary-bg));
      --popup-active-fg: var(--vscode-list-activeSelectionForeground, var(--text));
      --popup-muted: var(--vscode-descriptionForeground, color-mix(in srgb, var(--text) 72%, var(--popup-bg)));
      --popup-match: var(--vscode-list-highlightForeground, var(--vscode-textLink-foreground, #0b6cf0));
    }

    body {
      margin: 0;
      padding: 12px;
      background: var(--bg);
      color: var(--text);
      font-family: "Segoe UI", sans-serif;
    }

    .layout {
      max-width: 760px;
      margin: 0 auto;
      display: grid;
      gap: 12px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: end;
      flex-wrap: wrap;
    }

    .title {
      margin: 0;
      font-size: 20px;
    }

    .subtitle {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 12px;
    }

    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .button {
      min-height: 30px;
      padding: 0 12px;
      border: 1px solid transparent;
      cursor: pointer;
      color: var(--button-fg);
      background: var(--button-bg);
    }

    .button:hover {
      background: var(--button-hover);
    }

    .button.secondary {
      color: var(--secondary-fg);
      background: var(--secondary-bg);
      border-color: var(--border);
    }

    .button.secondary:hover {
      background: var(--secondary-hover);
    }

    .button-with-icon {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .button-icon {
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
    }

    .button-icon svg {
      width: 16px;
      height: 16px;
      display: block;
      fill: none;
    }

    .panel {
      border: 1px solid var(--border);
      background: var(--surface);
      padding: 12px;
    }

    .item-list {
      display: grid;
      gap: 12px;
    }

    .item {
      border: 1px solid var(--border);
      background: var(--surface-2);
      padding: 12px;
      display: grid;
      gap: 10px;
    }

    .item.invalid {
      border-color: var(--danger);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--danger) 45%, transparent);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
    }

    .field {
      display: grid;
      gap: 6px;
      position: relative;
    }

    .field.full {
      grid-column: 1 / -1;
    }

    label {
      font-size: 12px;
      color: var(--muted);
    }

    input, textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--input-border);
      background: var(--input-bg);
      color: var(--text);
      padding: 8px;
      font: inherit;
    }

    textarea {
      min-height: 96px;
      resize: vertical;
    }

    input:focus, textarea:focus, button:focus-visible {
      outline: 1px solid var(--focus);
      outline-offset: 1px;
    }

    .item-actions {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }

    .preview {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      border: 1px solid var(--border);
      padding: 0 10px;
      background: var(--surface);
    }

    .preview svg {
      width: 16px;
      height: 16px;
      display: block;
      fill: currentColor;
    }

    .danger {
      color: var(--danger);
    }

    .empty {
      border: 1px dashed var(--border);
      padding: 12px;
      color: var(--muted);
    }

    .help {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.5;
    }

    .error-banner {
      display: none;
      border: 1px solid var(--danger);
      background: color-mix(in srgb, var(--danger) 12%, var(--surface));
      color: var(--text);
      padding: 10px 12px;
      font-size: 12px;
      line-height: 1.5;
    }

    .error-banner.visible {
      display: block;
    }

    .command-popup {
      position: fixed;
      z-index: 1000;
      min-width: 260px;
      max-width: 520px;
      max-height: 220px;
      overflow: auto;
      border: 1px solid var(--popup-border);
      background: var(--popup-bg);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
    }

    .command-popup.hidden {
      display: none;
    }

    .command-option {
      padding: 8px 10px;
      cursor: pointer;
      font-size: 12px;
      border-bottom: 1px solid color-mix(in srgb, var(--popup-border) 50%, transparent);
      overflow: hidden;
    }

    .command-option:hover {
      background: var(--popup-hover);
    }

    .command-option-title,
    .command-option-id {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .command-option-title {
      color: inherit;
    }

    .command-option-id {
      margin-top: 2px;
      color: var(--popup-muted);
    }

    .command-option:last-child {
      border-bottom: 0;
    }

    .command-option.active {
      background: var(--popup-active-bg);
      color: var(--popup-active-fg);
    }

    .command-option.active .command-option-id {
      color: color-mix(in srgb, var(--popup-active-fg) 78%, transparent);
    }

    .command-match {
      color: var(--popup-match);
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="layout">
    <div class="header">
      <div>
        <h1 class="title">Tooruba Settings</h1>
      </div>
      <div class="actions">
        <button id="addButton" class="button secondary" type="button">Add Item</button>
        <button id="saveButton" class="button button-with-icon" type="button">
          <span class="button-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M2 1.5h9.5L14.5 4v10.5H1.5V2A.5.5 0 0 1 2 1.5Z" fill="none" stroke="currentColor"/><path d="M4 1.5h6v4H4z" fill="none" stroke="currentColor"/><path d="M4 9.5h8v4H4z" fill="none" stroke="currentColor"/><path d="M9 2.5h1v2H9z" fill="currentColor" stroke="currentColor"/></svg></span>
          <span>Save</span>
        </button>
      </div>
    </div>

    <div class="panel">
      <div id="errorBanner" class="error-banner" role="alert"></div>
      <div id="itemList" class="item-list"></div>
    </div>

    <div id="commandPopup" class="command-popup hidden"></div>

    <div class="help">
      <div><strong>command</strong> is any VS Code command ID, like <code>workbench.view.explorer</code>.</div>
      <div><strong>arguments</strong> accepts JSON array text, for example <code>["value", 1]</code>.</div>
      <div><strong>svg</strong> can contain inline SVG markup. Leave blank if you only want text.</div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const itemList = document.getElementById('itemList');
    const addButton = document.getElementById('addButton');
    const saveButton = document.getElementById('saveButton');
    const commandPopup = document.getElementById('commandPopup');
    const errorBanner = document.getElementById('errorBanner');
    let items = [];
    let commands = [];
    let activeCommandInput = null;
    let filteredCommands = [];
    let activeCommandIndex = 0;

    function createEmptyItem() {
      return { command: '', tooltip: '', text: '', svg: '', argumentsText: '[]' };
    }

    function clearValidationState() {
      if (errorBanner) {
        errorBanner.textContent = '';
        errorBanner.classList.remove('visible');
      }

      document.querySelectorAll('.item.invalid').forEach((element) => {
        element.classList.remove('invalid');
      });
    }

    function showValidationError(section, message) {
      clearValidationState();

      if (section instanceof HTMLElement) {
        section.classList.add('invalid');
        section.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }

      if (errorBanner) {
        errorBanner.textContent = message;
        errorBanner.classList.add('visible');
      }
    }

    function escapeHtml(value) {
      return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
    }

    function toEditableItem(item) {
      return {
        command: item.command || '',
        tooltip: item.tooltip || '',
        text: item.text || '',
        svg: item.svg || '',
        argumentsText: JSON.stringify(item.arguments || [])
      };
    }

    function getFuzzyMatch(value, query) {
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery) {
        return { matched: true, score: 0, positions: [] };
      }

      const normalizedValue = value.toLowerCase();
      const positions = [];
      let searchIndex = 0;

      for (const char of normalizedQuery) {
        const foundIndex = normalizedValue.indexOf(char, searchIndex);
        if (foundIndex === -1) {
          return { matched: false, score: Number.POSITIVE_INFINITY, positions: [] };
        }

        positions.push(foundIndex);
        searchIndex = foundIndex + 1;
      }

      const span = positions[positions.length - 1] - positions[0];
      const contiguousBonus = normalizedValue.includes(normalizedQuery) ? -50 : 0;
      const startBonus = positions[0];
      const gapPenalty = span - positions.length;
      const lengthPenalty = normalizedValue.length * 0.01;

      return {
        matched: true,
        score: startBonus + gapPenalty + lengthPenalty + contiguousBonus,
        positions
      };
    }

    function highlightCommand(command, positions) {
      if (!positions.length) {
        return escapeHtml(command);
      }

      const positionSet = new Set(positions);
      return Array.from(command)
        .map((char, index) => {
          const escaped = escapeHtml(char);
          return positionSet.has(index) ? \`<span class="command-match">\${escaped}</span>\` : escaped;
        })
        .join('');
    }

    function closeCommandPopup() {
      if (!commandPopup) {
        return;
      }

      commandPopup.classList.add('hidden');
      commandPopup.innerHTML = '';
      activeCommandInput = null;
      filteredCommands = [];
      activeCommandIndex = 0;
    }

    function applyCommandSelection(command) {
      if (!activeCommandInput) {
        return;
      }

      activeCommandInput.value = command;
      closeCommandPopup();
    }

    function renderCommandPopup() {
      if (!commandPopup || !activeCommandInput) {
        return;
      }

      if (!filteredCommands.length) {
        closeCommandPopup();
        return;
      }

      commandPopup.innerHTML = filteredCommands
        .map((entry, index) => \`<div class="command-option \${index === activeCommandIndex ? 'active' : ''}" data-command="\${escapeHtml(entry.command)}"><div class="command-option-title">\${highlightCommand(entry.title || entry.command, entry.positions)}</div><div class="command-option-id">\${escapeHtml(entry.command)}</div></div>\`)
        .join('');

      const rect = activeCommandInput.getBoundingClientRect();
      const popupHeight = Math.min(filteredCommands.length * 35, 220);
      const showAbove = window.innerHeight - rect.bottom < popupHeight + 12 && rect.top > popupHeight + 12;

      commandPopup.style.left = \`\${rect.left}px\`;
      commandPopup.style.top = showAbove ? \`\${Math.max(8, rect.top - popupHeight - 4)}px\` : \`\${rect.bottom + 4}px\`;
      commandPopup.style.width = \`\${Math.max(rect.width, 320)}px\`;
      commandPopup.classList.remove('hidden');

      Array.from(commandPopup.querySelectorAll('.command-option')).forEach((option) => {
        option.addEventListener('mousedown', (event) => {
          event.preventDefault();
          if (!(option instanceof HTMLElement)) {
            return;
          }

          applyCommandSelection(option.dataset.command || '');
        });
      });

      const activeOption = commandPopup.querySelector('.command-option.active');
      if (activeOption instanceof HTMLElement) {
        const optionTop = activeOption.offsetTop;
        const optionBottom = optionTop + activeOption.offsetHeight;
        const viewTop = commandPopup.scrollTop;
        const viewBottom = viewTop + commandPopup.clientHeight;

        if (optionTop < viewTop) {
          commandPopup.scrollTop = optionTop;
        } else if (optionBottom > viewBottom) {
          commandPopup.scrollTop = optionBottom - commandPopup.clientHeight;
        }
      }
    }

    function updateCommandPopup(input) {
      activeCommandInput = input;
      const query = input.value.trim().toLowerCase();
      filteredCommands = commands
        .map((entry) => ({
          ...entry,
          ...getFuzzyMatch(\`\${entry.title || ''} \${entry.command}\`.trim(), query)
        }))
        .filter((entry) => entry.matched)
        .sort((left, right) => left.score - right.score || (left.title || left.command).localeCompare(right.title || right.command) || left.command.localeCompare(right.command))
        .slice(0, 100);
      activeCommandIndex = 0;
      renderCommandPopup();
    }

    function fromForm(root) {
      const command = root.querySelector('[data-field="command"]').value.trim();
      const tooltip = root.querySelector('[data-field="tooltip"]').value.trim();
      const text = root.querySelector('[data-field="text"]').value.trim();
      const svg = root.querySelector('[data-field="svg"]').value.trim();
      const argumentsText = root.querySelector('[data-field="arguments"]').value.trim();

      let parsedArguments = [];
      if (argumentsText) {
        const parsed = JSON.parse(argumentsText);
        if (!Array.isArray(parsed)) {
          throw new Error('Arguments must be a JSON array.');
        }
        parsedArguments = parsed;
      }

      if (!command) {
        throw new Error('Each item needs a command.');
      }

      if (!text && !svg) {
        throw new Error('Each item needs either Text or SVG.');
      }

      if (svg && !isValidSvg(svg)) {
        throw new Error('SVG must be valid inline SVG markup.');
      }

      return {
        command,
        arguments: parsedArguments,
        tooltip: tooltip || undefined,
        text: text || undefined,
        svg: svg || undefined
      };
    }

    function isValidSvg(svg) {
      try {
        const parser = new DOMParser();
        const document = parser.parseFromString(svg, 'image/svg+xml');
        if (document.querySelector('parsererror')) {
          return false;
        }

        const root = document.documentElement;
        return root?.tagName?.toLowerCase() === 'svg';
      } catch {
        return false;
      }
    }

    function updateItemPreview(section) {
      if (!(section instanceof HTMLElement)) {
        return;
      }

      const preview = section.querySelector('.preview');
      if (!(preview instanceof HTMLElement)) {
        return;
      }

      const textInput = section.querySelector('[data-field="text"]');
      const svgInput = section.querySelector('[data-field="svg"]');
      const text = textInput instanceof HTMLInputElement ? textInput.value : '';
      const svg = svgInput instanceof HTMLTextAreaElement ? svgInput.value.trim() : '';

      preview.innerHTML = (svg || '') + '<span>' + escapeHtml(text || '') + '</span>';
    }

    function render() {
      clearValidationState();

      if (!items.length) {
        itemList.innerHTML = '<div class="empty">No items yet. Click <strong>Add Item</strong> to create one.</div>';
        return;
      }

      itemList.innerHTML = '';

      items.forEach((item, index) => {
        const section = document.createElement('section');
        section.className = 'item';
        section.innerHTML = \`
          <div class="grid">
            <div class="field">
              <label>Command</label>
              <input data-field="command" value="\${escapeHtml(item.command)}" autocomplete="off" />
            </div>
            <div class="field">
              <label>Tooltip</label>
              <input data-field="tooltip" value="\${escapeHtml(item.tooltip)}" />
            </div>
            <div class="field">
              <label>Text</label>
              <input data-field="text" value="\${escapeHtml(item.text)}" />
            </div>
            <div class="field full">
              <label>Arguments (JSON array)</label>
              <input data-field="arguments" value="\${escapeHtml(item.argumentsText)}" />
            </div>
            <div class="field full">
              <label>SVG</label>
              <textarea data-field="svg">\${escapeHtml(item.svg)}</textarea>
            </div>
          </div>
          <div class="item-actions">
            <div class="preview">\${item.svg || ''}<span>\${escapeHtml(item.text || '')}</span></div>
            <div class="actions">
              <button type="button" class="button secondary" data-action="up">Up</button>
              <button type="button" class="button secondary" data-action="down">Down</button>
              <button type="button" class="button secondary danger" data-action="delete">Delete</button>
            </div>
          </div>
        \`;

        section.addEventListener('click', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) {
            return;
          }

          const action = target.dataset.action;
          if (!action) {
            return;
          }

          if (action === 'up' && index > 0) {
            [items[index - 1], items[index]] = [items[index], items[index - 1]];
            render();
          } else if (action === 'down' && index < items.length - 1) {
            [items[index + 1], items[index]] = [items[index], items[index + 1]];
            render();
          } else if (action === 'delete') {
            items.splice(index, 1);
            render();
          }
        });

        section.addEventListener('input', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) {
            return;
          }

          if (target.matches('[data-field="text"], [data-field="svg"]')) {
            updateItemPreview(section);
          }
        });

        const commandInput = section.querySelector('[data-field="command"]');
        if (commandInput instanceof HTMLInputElement) {
          commandInput.addEventListener('focus', () => {
            updateCommandPopup(commandInput);
          });

          commandInput.addEventListener('input', () => {
            updateCommandPopup(commandInput);
          });

          commandInput.addEventListener('keydown', (event) => {
            if (!filteredCommands.length) {
              return;
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              activeCommandIndex = (activeCommandIndex + 1) % filteredCommands.length;
              renderCommandPopup();
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              activeCommandIndex = (activeCommandIndex - 1 + filteredCommands.length) % filteredCommands.length;
              renderCommandPopup();
            } else if (event.key === 'Enter') {
              event.preventDefault();
              applyCommandSelection(filteredCommands[activeCommandIndex].command);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              closeCommandPopup();
            }
          });

          commandInput.addEventListener('blur', () => {
            window.setTimeout(() => {
              if (document.activeElement !== commandInput) {
                closeCommandPopup();
              }
            }, 100);
          });
        }

        itemList.appendChild(section);
      });
    }

    function syncFromDom() {
      const sections = Array.from(document.querySelectorAll('.item'));
      items = sections.map((section) => ({
        command: section.querySelector('[data-field="command"]').value,
        tooltip: section.querySelector('[data-field="tooltip"]').value,
        text: section.querySelector('[data-field="text"]').value,
        svg: section.querySelector('[data-field="svg"]').value,
        argumentsText: section.querySelector('[data-field="arguments"]').value
      }));
    }

    addButton.addEventListener('click', () => {
      syncFromDom();
      items.push(createEmptyItem());
      render();
    });

    saveButton.addEventListener('click', () => {
      try {
        syncFromDom();
        const nextItems = Array.from(document.querySelectorAll('.item')).map((section, index) => {
          try {
            return fromForm(section);
          } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            showValidationError(section, 'Could not save settings. Item ' + (index + 1) + ' is invalid: ' + detail);
            throw new Error('Could not save settings. Item ' + (index + 1) + ' is invalid: ' + detail);
          }
        });
        clearValidationState();
        vscode.postMessage({ type: 'save-items', items: nextItems });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        window.alert(detail);
      }
    });

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'load-commands') {
        commands = event.data.commands || [];
        return;
      }

      if (event.data?.type !== 'load-items') {
        return;
      }

      items = (event.data.items || []).map(toEditableItem);
      render();
    });

    window.addEventListener('resize', () => {
      if (activeCommandInput) {
        renderCommandPopup();
      }
    });

    window.addEventListener('scroll', () => {
      if (activeCommandInput) {
        renderCommandPopup();
      }
    }, true);

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[data-field="command"]')) {
        return;
      }

      if (target instanceof HTMLElement && target.closest('.command-popup')) {
        return;
      }

      closeCommandPopup();
    });

    vscode.postMessage({ type: 'request-items' });
    vscode.postMessage({ type: 'request-commands' });
  </script>
</body>
</html>`;
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';

  for (let index = 0; index < 16; index += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return nonce;
}
