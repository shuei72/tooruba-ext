# Tooruba

Toorubaは、任意のVS Codeコマンドをパネルにボタンとして並べられる拡張機能です。  
ボタンには、テキストやSVGアイコンを割り当てることができます。

## コマンド
<!-- コマンド行の最後には空白を2ついれること -->

`Tooruba: Open Settings`  
Toorubaのボタンを編集する設定画面を開きます。

## 特徴
- パネルに`Tooruba`を追加します。
- パネルに任意のコマンドを割り当てたボタンを表示します。
- 各ボタンに任意のVS CodeコマンドIDと引数を設定できます。
- ボタンはテキスト、SVG、またはその両方で表示できます。
- 設定画面からボタンの追加、削除、並べ替えを行えます。

## 設定

`toorubaPanel.items`  
- 表示するボタンの配列

各要素には次のプロパティを指定できます。

| 要素 | 説明 |
| --- | --- |
| `command` | 実行するVS CodeコマンドID |
| `arguments` | コマンドへ渡す引数配列 |
| `tooltip` | ボタンにマウスオーバーしたときの説明文 |
| `text` | ボタンに表示する文字列(`svg`がない場合は必須) |
| `svg` | ボタンに表示するインラインSVG(`text`がない場合は必須) |

### 設定例

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

## 開発用

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

## その他

- この拡張機能の作成にはCodexを利用しています。

## ライセンス

MIT License
