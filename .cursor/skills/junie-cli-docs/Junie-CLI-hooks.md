# Hooks

<primary-label ref="nightly"/>

Hooks let you run a shell command automatically when Junie CLI starts.
Use them to launch a local proxy, refresh credentials, or run any other prerequisite before the agent begins working.

> This feature is currently in the [Early Access program](Junie-CLI-EAP.md). To try it,
> [install the Early Access version](Junie-CLI-EAP.md#install-eap) of Junie CLI.

## Configure a hook

Add a `hooks` object to your user `~/.junie/config.json` or to a file passed with `--config-location`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "aws sso login --profile dev",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

Each `SessionStart` entry has a `matcher` and a list of `hooks` to run when the matcher matches.

Project-local hooks from `<project-root>/.junie/config.json` are ignored by default for safety.
Project configuration is repository-controlled, so Junie will not run shell commands from it automatically.
If you intentionally want to run hooks from a project file, pass that file explicitly with `--config-location`.

### Matcher entry fields

| Field | Required | Description |
|---|---|---|
| `matcher` | No | A regular expression matched against the full session source (`startup` or `resume`). If omitted, the entry runs on every session start. A configured matcher must match at least one supported source. |
| `hooks` | Yes | A list of hook commands to run when the matcher matches. |

### Hook command fields

| Field | Required | Description |
|---|---|---|
| `type` | Yes | The hook type. Only `command` is currently supported. |
| `command` | Yes | The shell command to run. Executed via `sh -c` on macOS/Linux and `cmd /c` on Windows. |
| `timeout` | No | Maximum execution time in seconds. Defaults to 10. |

## Triggering events

Junie fires `SessionStart` once per session with one of the following sources:

| Source | When |
|---|---|
| `startup` | A fresh CLI session starts. |
| `resume` | An existing session is resumed within the same CLI process. |

The hook launcher is owned by the shared CLI runner, so the event is available to interactive, batch, server, and ACP launches.

You can scope a hook to a specific source using `matcher`. For example, `"matcher": "startup"` runs the hook only on a fresh start, while `"matcher": "startup\|resume"` runs it on both. Omitting `matcher` is equivalent to matching every source.

## Hook input

Each hook receives a single line of JSON on standard input:

```json
{"hook_event_name":"SessionStart","source":"startup"}
```

This matches the input format used by Gemini and Codex hooks, so the same hook script can be shared between agents.

## Failure handling

Hook output and exit status do not block Junie startup:

* Standard output and standard error are captured and logged at debug level. If a hook fails, captured output can be included in TUI error details, but it is not stored in session history.
* A non-zero exit code is logged as a warning and shown as a TUI error message. Junie continues to start.
* If the command exceeds its `timeout`, it is force-killed, logged as a warning, and shown as a TUI error message. Junie continues to start.
* Invalid hook configuration, such as an unsupported `type`, invalid `matcher`, or non-positive `timeout`, is shown as a TUI error message. Junie continues to start.

Junie will not abort on hook failure; use the TUI system message and logs to diagnose failed hooks.

## Merging hooks across configuration files

When multiple configuration files define `SessionStart` entries, all entries from all files are concatenated.
Higher-priority files do not override lower-priority files; their entries are appended.

Only trusted sources participate in hook merging: user configuration and explicit `--config-location` files.
Default project-local `hooks` entries are skipped and reported as a hook configuration warning.

For the configuration precedence order, see [Configuration files](Junie-CLI-configuration.md#configuration-precedence).

## Limitations

* Only the `SessionStart` event is supported.
* Only `type: "command"` hooks are supported.
* Hooks within a `SessionStart` entry run sequentially. Parallel execution is not supported.
* There is no way to pass data from a hook back to Junie. Output is discarded.
