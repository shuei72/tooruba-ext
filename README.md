# Tooruba

Configurable command panel UI for VS Code.

## Features

- Appears in the bottom panel for quick access beside Terminal and Problems
- Assign any VS Code command to each button
- Render button content with `text`, `svg`, or both
- Includes a visual settings editor

## Usage

1. Open the `Tooruba` view in the bottom panel area
2. Run `Tooruba: Open Settings` to edit and save into user settings
3. You can still configure user `settings.json` manually

```json
{
  "toorubaPanel.items": [
    {
      "text": "Explorer",
      "tooltip": "Open Explorer",
      "command": "workbench.view.explorer"
    },
    {
      "text": "Save",
      "tooltip": "Save File",
      "command": "workbench.action.files.save",
      "svg": "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M2 1.5h9.5L14.5 4v10.5H1.5V2A.5.5 0 0 1 2 1.5Z\" fill=\"none\" stroke=\"currentColor\"/><path d=\"M4 1.5h6v4H4z\" fill=\"none\" stroke=\"currentColor\"/><path d=\"M4 9.5h8v4H4z\" fill=\"none\" stroke=\"currentColor\"/><path d=\"M9 2.5h1v2H9z\" fill=\"currentColor\" stroke=\"currentColor\"/></svg>"
    },
    {
      "text": "Find TODO",
      "tooltip": "Find TODO in files",
      "command": "workbench.action.findInFiles",
      "arguments": [
        {
          "query": "TODO",
          "triggerSearch": true,
          "isRegex": false
        }
      ]
    },
    {
      "tooltip": "Search",
      "command": "workbench.view.search",
      "svg": "<svg viewBox=\"0 0 16 16\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"7\" cy=\"7\" r=\"4.25\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M10.5 10.5L14 14\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></svg>"
    }
  ]
}
```

## Development

### PowerShell

```powershell
npm.cmd install
npm.cmd run compile
npx.cmd @vscode/vsce package
```

### Command Prompt

```cmd
npm install
npm run compile
npx @vscode/vsce package
```

Press `F5` in VS Code to launch the extension in Extension Development Host.

## Note

This extension was created with the help of OpenAI Codex (GPT-5 based).

## License

MIT
