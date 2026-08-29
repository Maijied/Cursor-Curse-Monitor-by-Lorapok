# Remote Mode

<show-structure for="chapter" depth="3" />

Remote Mode lets you open your running Junie CLI session in a web browser and keep working on the same task from
another device. The Junie CLI process keeps running in your terminal — Remote Mode adds a synchronized web UI on top
of it.

## How Remote Mode works

When you start Remote Mode, Junie CLI opens a secure tunnel to the Junie web app and streams the session into a
web UI:

- The CLI session continues to run in your terminal, on your machine.
- The web UI shows the same chat history, progress, interactive prompts, and task status.
- Anything you send from the web UI — prompts, replies to approval requests, plan refinements — is routed
  back to the same running session.

Both the terminal and the web UI work against a single shared session, so you can switch between them at any time
without losing context.

> Your machine must stay awake while a remote session is active. If the computer goes to sleep, the CLI process is
> suspended and the web UI cannot communicate with it until you wake the machine.
> {style="note"}

## Requirements

Remote Mode requires a Junie subscription:

- Sign in with your JetBrains Account, or
- Use a `JUNIE_API_KEY` access token.

[Bring Your Own Key (BYOK)](BYOK.md) on its own is not enough — Remote Mode itself goes through the Junie service
and requires one of the two options above.

> Remote Mode is not available when Junie CLI is signed in through **JetBrains AI Enterprise**. To use Remote
> Mode, sign in with your JetBrains Account or a `JUNIE_API_KEY` instead. See
> [Manage your account](Junie-CLI-usage.md#manage-your-account).
> {style="warning"}

## Start a remote session

1. In Junie CLI, in a new or running session, run the `/remote` command.

    ```
    > /remote
    ```

2. On the **Remote Mode** screen, select **Start Remote Session**.

    Junie CLI creates the tunnel and prints a confirmation message with the connection URL.

3. Open [`junie.jetbrains.com/remote`](https://junie.jetbrains.com/remote) in your browser.

    The web app connects to your running CLI session and replays the chat history. After that, the terminal and
    the browser stay in sync.

> Run `/remote` again to see the status of the active remote session, including connection state and the option to
> stop it.

## What you can do from the web UI

The web UI exposes the most common actions for continuing a task:

- Send a new prompt to the agent.
- Reply to interactive requests (approve or decline an action, answer a question, pick an option).
- Cancel the current task.
- Continue the task after the step limit is reached.
- Toggle [brave mode](Junie-CLI-usage.md#brave-mode).
- Refine a proposed plan in [plan mode](Junie-CLI-Plan-Mode.md), or confirm a plan and ask the agent to
  implement it.

## Limitations

The web UI is intentionally narrower than the terminal. It is built to keep working on an existing CLI session,
not to fully replace the terminal:

- Slash commands such as `/new`, `/history`, `/account`, `/model`, `/usage`, `/ide`, `/mcp`, `/quit`, and custom
  slash commands are available only in the terminal.
- Shell commands invoked with `!` in the prompt are terminal-only.
- File and folder picking with `@` is not available in the web UI.
- Drag-and-drop of files and images is not available in the web UI.
- Prompt history search (`Ctrl+R`) and the session transcript view (`Ctrl+T`) are terminal-only.
- Only one web client can be connected to a remote session at a time. Opening the URL from another tab or device
  takes over the connection from the previous client.

If you need any of these features, switch back to the terminal — the session is the same, and your changes from
the web UI are already there.

## Stop a remote session

To stop sharing the current session with the web app:

1. Run `/remote` in the terminal.
2. On the status screen, select **Stop Remote Session**.

Stopping a remote session does not affect the underlying CLI session — you can continue working in the terminal
or start a new remote session later.

## Related documentation

- [Using Junie in the terminal](Junie-CLI-usage.md)
- [Slash commands reference](Slash-commands.md)
- [Quickstart](Junie-CLI.md)
