<p align="center">
  <img src="media/icon.png" alt="Tooruba icon" width="128" />
</p>

# Tooruba

Tooruba is a VS Code extension that places arbitrary commands on a panel as buttons.  
Buttons can use text labels, SVG icons, or both.

## ✨ Commands

`Tooruba: Open Settings`  
Opens the settings view for editing Tooruba buttons.

## 🧭 Features

- Adds `Tooruba` to the panel.
- Shows buttons mapped to arbitrary commands.
- Supports command IDs and arguments for each button.
- Supports text, SVG, or both on each button.
- Supports adding, removing, and reordering buttons from the settings view.

## ⚙️ Settings

`toorubaPanel.items`  
- Array of buttons to display

Each item can include the following properties:

| Property | Description |
| --- | --- |
| `command` | VS Code command ID to run |
| `arguments` | Argument array passed to the command |
| `tooltip` | Hover text shown on the button |
| `text` | Text label shown on the button (`svg` is required when omitted) |
| `svg` | Inline SVG shown on the button (`text` is required when omitted) |

### Example

```json
{
  "toorubaPanel.items": [
    {
      "tooltip": "New",
      "command": "workbench.action.files.newUntitledFile",
      "svg": "<svg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'><path d='M4 1.75h5.1L12.25 4.9V14.25H4z' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linejoin='round'/><path d='M9 1.75v3.5h3.25' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linejoin='round'/><path d='M10.75 2.4l.55-1.15M12.6 4.25l1.15-.55M12.65 2.8l.95-.95' stroke='currentColor' stroke-width='1.25' stroke-linecap='round'/></svg>"
    },
    {
      "tooltip": "Open",
      "command": "workbench.action.files.openFile",
      "svg": "<svg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'><path d='M3.75 1.75h5.1L12 4.9v9.35H3.75z' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linejoin='round'/><path d='M8.75 1.75v3.5H12' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linejoin='round'/><path d='M5.5 9h4.75M8.25 6.75l2.25 2.25-2.25 2.25' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>"
    },
    {
      "tooltip": "Save",
      "command": "workbench.action.files.save",
      "svg": "<svg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'><path d='M2.75 1.75h8.5l2 2v10.5h-10.5z' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linejoin='round'/><path d='M5 1.75v4h5v-4M5 12.25h6' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linejoin='round'/></svg>"
    },
    {
      "tooltip": "Sidebar",
      "command": "workbench.action.toggleSidebarVisibility",
      "text": "Sidebar"
    },
    {
      "tooltip": "Panel",
      "command": "workbench.action.togglePanel",
      "text": "Panel"
    },
    {
      "tooltip": "Extension",
      "command": "workbench.view.extensions",
      "text": "Extension"
    },
    {
      "tooltip": "Search",
      "command": "workbench.view.search",
      "svg": "<svg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'><circle cx='7' cy='7' r='4.25' fill='none' stroke='currentColor' stroke-width='1.5'/><path d='M10.5 10.5L14 14' stroke='currentColor' stroke-width='1.5' stroke-linecap='round'/></svg>"
    },
    {
      "tooltip": "ToDo",
      "command": "workbench.action.findInFiles",
      "arguments": [
        {
          "query": "TODO:|ToDo:",
          "isRegex": true,
          "triggerSearch": true
        }
      ],
      "text": "Search Todo",
      "svg": "<svg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'><circle cx='7' cy='7' r='4.25' fill='none' stroke='currentColor' stroke-width='1.5'/><path d='M10.5 10.5L14 14' stroke='currentColor' stroke-width='1.5' stroke-linecap='round'/></svg>"
    }
  ]
}
```

## Development

### PowerShell

```powershell
npm.cmd install
npm.cmd run compile
npm.cmd run package
```

### Command Prompt

```cmd
npm install
npm run compile
npm run package
```

## Other

- This extension was created with Codex.

## License

MIT License
