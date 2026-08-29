# Reference

Complete reference for the slash commands (`/`) and shortcuts available in Junie CLI (interactive mode).

## Built-in slash commands

> Commands shown with `<...>` accept optional raw trailing text: Junie CLI passes everything after the command token 
> as one argument. 
> 
> For example, `/new fix failing tests` opens a new session with `fix failing tests` in the prompt. `/plan refactor commands`
> enables plan mode and submits `refactor commands` immediately. 
> 
> Commands without `<...>` do not accept arguments.

{id="optional-text-as-arguments"}

| Command                  | Description                                                                                                                                                                                                                                                                     |
|--------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `/account`               | Manage your Junie Accounts and Junie API keys, or connect your own API key from Anthropic, OpenAI, and other OpenAI API-compatible providers.                                                                                                                                   | 
| `/brave`                 | Toggle [brave mode](Junie-CLI-usage.md#brave-mode), in which Junie executes all potentially sensitive actions without user approval.                                                                                                                                            |
| `/commands`              | Create and manage custom slash commands.                                                                                                                                                                                                                                        |
| `/debug`                 | Toggle [debug mode](Junie-CLI-Debug-Mode.md), in which Junie acts as an AI debugging assistant against a live debugger session in a connected JetBrains IDE. Shortcut: `Shift+Tab+Tab`.                                                                                          |
| `/demo <arg>`            | Launch a [visual demo](Junie-CLI-demo.md) of a feature inside a disposable VM. Alias: `/test`.                                                                                                                                                                                  |
| `/effort`                | Set the reasoning [effort level](Junie-CLI-usage.md#model-and-effort) for the current model. The set of supported effort levels depends on the selected model.                                                                                                                  |
| `/extensions <arg>`      | Browse, install, update, and manage [Junie CLI extensions](Junie-CLI-Extensions.md) — bundles of agent skills, MCP servers, subagents, custom commands, and guidelines.                                                                                                         |
| `/feedback <prompt>`     | Share feedback about the current session with the Junie team. If you provide `<prompt>`, Junie opens the feedback screen with that text as an editable draft. <tip>A ZIP file with the current session logs is automatically attached to the submitted feedback response. </tip> |
| `/history`               | See the session history and resume one of the previous sessions.                                                                                                                                                                                                                |
| `/ide`                   | Show the current JetBrains IDE connection status and the JetBrains IDE features available to the current session. For details, see [Junie CLI and JetBrains IDE integration](Junie-CLI-JetBrains-IDE-integration.md).                                                           |
| `/install-github-action` | Launch an interactive wizard for installing and configuring [Junie GitHub Action](Junie-on-GitHub.md) in the current GitHub repository.                                                                                                                                         |
| `/import`                | Import user- or project-level configs from other coding agents. <br><br>Junie CLI detects and suggests import of guidelines, agent skills, slash commands, or MCP server configurations from other coding agents like Claude Code, Codex, or Cursor.                            |
| `/mcp`                   | Connect MCP servers to Junie CLI and manage the connections.                                                                                                                                                                                                                    |
| `/model`                 | Select the main Large Language Model (LLM) to be used by Junie and, for supported models, the reasoning [effort level](Junie-CLI-usage.md#model-and-effort). <br><br>`Default` is the recommended pre-selected option with the best price quality ratio. The model behind the `Default` option is set dynamically and may change as new models are released.                 |
| `/new <prompt>`          | Clear up the context and start a new session. If you provide `<prompt>`, Junie opens the new session with that text in the prompt.                                                                                                                                              |
| `/plan <prompt>`         | Toggle [plan mode](Junie-CLI-Plan-Mode.md). If you provide `<prompt>`, Junie enables plan mode and submits the prompt immediately.                                                                                                                                              |
| `/remote`                | Open the current Junie CLI session in a web browser. For details, see [Remote Mode](Junie-CLI-Remote-Mode.md).                                                                                                                                                                  |
| `/review`                | Start a [local code review](Junie-CLI-usage.md#local-code-review) of your changes (compared to `main`, the last commit, or unstaged changes) before you commit them. Requires a git repository.                                                                                 |
| `/settings`              | Change Junie settings, including theme, notifications, step limit, and diff view mode.                                                                                                                                           |
| `/quit`                  | Exit Junie CLI interactive mode while staying logged in.                                                                                                                                                                                                                        |
| `/update`                | Check for updates and install if available.                                                                                                                                                                                                                                     |
| `/usage`                 | See the cost breakdown for the current session, including token usage and used models.                                                                                                                                                                                          |
{width="800"}

You can also add your own slash commands to Junie CLI. For details, see [Custom slash commands](Custom-slash-commands.md).

## Navigation

| Shortcut       | Description                                                             |
|----------------|-------------------------------------------------------------------------|
| `Ctrl+C` twice | Quit Junie CLI interactive mode.                                        |
| `!`            | Run a shell command in the embedded terminal. Example: `!ls`.           |
| `@`            | Search for a file or folder in your project to attach it to the prompt. |
| `/`            | Open the slash command suggestion menu.                                 |
| `?`            | Open the help menu to see all available shortcuts.                      |


## Modes and features

| Shortcut    | Description                                                                                   |
|-------------|-----------------------------------------------------------------------------------------------|
| `Shift+Tab` | Toggle between default mode and [plan mode](Junie-CLI-Plan-Mode.md).                          |
| `Ctrl+B`    | Enable [brave mode](Junie-CLI-usage.md#brave-mode).                                           |
| `Ctrl+R`    | Search the prompt history.                                                                    |
| `Ctrl+T`    | Open the full transcript of the current session.                                              |
| `Ctrl+N`    | Navigate the transcript of the current session after opening it (`Ctrl+T`).                   |

## Text editing

| Shortcut                    | Description                           |
|-----------------------------|---------------------------------------|
| `Shift+Enter` (or `Ctrl+J`) | Insert a new line in the prompt.      |
| `Ctrl+A`                    | Move cursor to the start of the line. |
| `Ctrl+E`                    | Move cursor to the end of the line.   |
| `Alt+B`                     | Move cursor one word backward.        |
| `Alt+F`                     | Move cursor one word forward.         |
| `Ctrl+U`                    | Delete the entire line.               |
| `Ctrl+W`                    | Delete the word before the cursor.    |


