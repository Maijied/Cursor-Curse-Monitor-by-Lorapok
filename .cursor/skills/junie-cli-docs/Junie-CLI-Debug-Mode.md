# Debug Mode

<show-structure for="chapter" depth="3" />

Debug Mode turns Junie CLI into an AI debugging assistant. Instead of editing source code, Junie launches or
attaches to a running program, manages breakpoints, inspects runtime state, and evaluates expressions in the
currently paused execution frame.

Use Debug Mode for problems that are easier to investigate at runtime than by reading code — flaky behavior,
unexpected variable values, or tracking down where execution actually goes.

## How Debug Mode works

In Debug Mode, Junie operates against a live debugger session connected to a JetBrains IDE. The agent uses a
specialized set of tools focused on runtime inspection and execution control rather than source code modification:

- **Session control:** Launch a new debug session, attach to an existing process, resume execution, or step through
  code (step over, step into, step out).
- **Breakpoint management:** Set line and exception breakpoints, remove existing ones, and list all active
  breakpoints in the project.
- **State inspection:** Inspect variables in the current scope, view the call stack for all threads, and switch
  between threads and frames.
- **Expression evaluation:** Evaluate expressions or code fragments in the context of the currently paused frame.

Junie does not modify source code while in Debug Mode unless you explicitly ask for a change that is compatible
with the current execution state.

### Example interactions

- _"Why is `x` null?"_ — Junie inspects the current paused frame, retrieves the value of `x` and the surrounding
  context (call stack, related variables), and explains the state.
- _"Stop at line 42 in `Main.kt`."_ — Junie sets a line breakpoint at the requested location.
- _"What is `list.size()`?"_ — Junie evaluates the expression in the current frame and reports the result.

## Requirements

Debug Mode is only useful when Junie CLI can talk to a debugger. Make sure the following is in place before
enabling Debug Mode:

- Junie CLI is connected to a JetBrains IDE with debugging support. For details on the IDE integration, see
  [Junie CLI and JetBrains IDE integration](Junie-CLI-JetBrains-IDE-integration.md).
- The IDE has a debug session active, or you are ready to ask Junie to start or attach to one.

If no IDE with debugging support is connected when you try to enable Debug Mode, Junie CLI reports that
"Debug mode requires an IDE with debugging support connected" and stays in the default mode.

## Enable Debug Mode

To toggle Debug Mode, use the `Shift+Tab+Tab` shortcut or run the `/debug` slash command in the Junie CLI prompt:

```
> /debug
```

Using the same shortcut or running `/debug` again disables Debug Mode and returns Junie CLI to the default mode.

## Related documentation

- [Junie CLI and JetBrains IDE integration](Junie-CLI-JetBrains-IDE-integration.md)
- [Using Junie in the terminal](Junie-CLI-usage.md)
- [Slash commands reference](Slash-commands.md)
