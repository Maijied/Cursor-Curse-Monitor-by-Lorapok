---
name: junie-cli-docs
description: Complete documentation for using Junie CLI in the terminal. Use this skill when the user asks about Junie itself, its features, configuration, where agent sessions/settings/logs are located, or CLI commands.
---

# Junie CLI documentation

Use this skill when you need complete Junie CLI documentation.
The full documentation bundle is embedded below

**IMPORTANT**: The agent cannot directly execute Junie CLI commands (such as `new`, `usage`, `model`, etc.).
The agent can only suggest to the user which commands to run.

## Full documentation

### Quickstart

# Quickstart

<show-structure for="chapter,procedure" depth="3"/>

**Junie CLI** is the agentic coding tool by JetBrains that provides an interactive terminal interface for developers to 
review, write, and modify code.

<procedure title="Supported operating systems" id="supported-operating-systems">
Junie CLI is available on Linux, macOS, and Windows.
</procedure>

## Step 1: Install Junie CLI {level="3"}

In the terminal or command prompt of your choice, run:

<tabs>
    <tab title="Linux / macOS">
        <code-block lang="Console">curl -fsSL https://junie.jetbrains.com/install.sh | bash</code-block>
    </tab>
    <tab title="Windows">
        <code-block lang="PowerShell">powershell -NoProfile -ExecutionPolicy Bypass -Command "iex (irm 'https://junie.jetbrains.com/install.ps1')"</code-block>
    </tab>
    <tab title="Homebrew">
            <code-block lang="Console">
                brew tap jetbrains/junie
                brew update
                brew install junie
            </code-block>
            <p>
                To verify the installation:
            </p>
            <code-block lang="Console">
                junie --version
            </code-block>
    </tab>
</tabs>

[//]: # (EAP channel:)

[//]: # (<code-block lang="Console">curl -fsSL https://junie.jetbrains.com/install-eap.sh | bash</code-block>)

## Step 2: Start Junie in your project {level="3"}

Navigate to the root directory of the project where you want to use Junie CLI and run `junie`:

```console
cd /path/to/your/project
```

```sh
junie
```

## Step 3: Authenticate {level="3"}

On the Junie welcome screen, select one of the available authentication options:

* **Log in with your JetBrains Account**

    Use Junie CLI as part of your subscription plan with JetBrains. When selecting this option, you'll be redirected to 
the JetBrains Junie login page in your browser.

* **Use `JUNIE_API_KEY`** 

    Run Junie CLI with usage-based billing. When selecting this option, you'll be prompted to provide an access 
token. To generate your `JUNIE_API_KEY` access token, go to [junie.jetbrains.com/cli](https://junie.jetbrains.com/cli).

* **[Bring Your Own Key (BYOK)](BYOK.md)**

    Use your own API keys or OAuth tokens from Anthropic, OpenAI, Google, or other third-party LLM providers.
    Junie CLI uses these API keys to send requests to LLMs directly without requiring a JetBrains AI subscription.

    BYOK can be used on its own or together with JetBrains Account authorization or Junie API key.
    If a model is available through both the BYOK API key and JetBrains AI subscription, the requests are billed to your BYOK provider directly.

[//]: # (> By authenticating with Junie CLI, you agree to [Junie Terms of Service]&#40;https://junie.jetbrains.com/tos-eap&#41;.)

[//]: # (> {style="note"})

## Step 4: Type your prompt {level="3"} 

Type the prompt in the interactive CLI, for example:

```Console
> give me an overview of this codebase
```

Use `@` to attach a file or folder from the current project to the request context. 
To see the list of available slash commands and use them, type `/`.

[Learn more about using Junie in the terminal](Junie-CLI-usage.md)

## Non-interactive (headless) mode {level="3"}

You can run Junie CLI in headless mode, that is, programmatically without interactive UI, in CI/CD environments
and build pipelines. 

To add Junie to your CI/CD script:

```bash
# Install Junie CLI
curl -fsSL https://junie.jetbrains.com/install.sh | bash

# Authenticate and use Junie
junie --auth="$JUNIE_API_KEY" "Review and fix any code quality issues in the latest commit"
```
The `junie` command takes [options](Parameters.md) and [environment variables](Parameters.md#environment-variables). 

For more information and examples, see [Headless mode](Junie-headless.md).

## Other scenarios {level="3"}

* [Junie GitHub Action](Junie-on-GitHub.md)
* [Junie GitLab CI/CD](Junie-GitLab-CI-CD.md)

### Using Junie in the terminal

# Using Junie in the terminal

<show-structure for="chapter" depth="2" />

Learn about working with Junie CLI in an interactive terminal interface.

## Prompting

With Junie CLI [installed and authenticated](Junie-CLI.md), navigate to the project directory where you want to use it.

1. Start an interactive session with Junie CLI.

    ```
    junie
    ```

2. Type your prompt in the natural language, for example:

    ```
    > find the files in this project that handle log error descriptions
    ```

[//]: # (Tabs are normalized to spaces: when you type or paste a tab character into the input field, it is converted to two spaces. )

[//]: # (This ensures consistent rendering and cursor alignment in the terminal. Practical effect:)

[//]: # (- Typing the Tab key inserts two spaces.)

[//]: # (- Pasting text that contains tabs &#40;for example, code snippets&#41; will have each tab replaced with two spaces.)
  
> For persistent guidance that Junie CLI will apply to all tasks, provide instructions in the `.junie/AGENTS.md` 
> file at the project's root directory. [Learn more](Guidelines-and-memory.md)

### Real-time follow-ups

You can type follow-up prompts while Junie CLI is working on the task without waiting for it to finish. 
The added clarifications are appended to the initial prompt and taken into account by the agent immediately.

### Reference files and directories

Use `@` to quickly reference files or directories in your prompt.

[//]: # (When you include file paths directly in the prompt using the `@<path>` syntax, the CLI now validates those paths and sends only the ones that actually exist on your machine.)

[//]: # ()
[//]: # (- Non-existent paths are ignored silently and are not attached to the request.)

[//]: # (- Existing paths are attached and will be available to Junie during task processing.)

[//]: # (- Use your OS-native path format &#40;the CLI checks paths using the local filesystem&#41;.)

![](reference_files_and_folders.png){width="706"}

You can also drag and drop files and images into the terminal window to reference them.

### Image inputs

Drag and drop or reference screenshots or design specs in the prompt for Junie CLI to read the image details. 
Junie CLI accepts all common image formats such as PNG and JPEG.

### Search the prompt history

Junie CLI preserves your prompt history across all sessions and application runs. 

To search the prompt history, use `Ctrl+R`, and then navigate through the results using Up and Down arrow keys.

## Slash commands and shortcuts

Slash commands allow you to access various Junie CLI features directly from the prompt.
Type `/` in the prompt to see and use the [available slash commands](Slash-commands.md).

Some built-in slash commands accept user prompts as arguments. For example, `/new fix tests` [starts a new session](#clear-up-session-context) with
`fix tests` in the prompt, and `/plan refactor commands` enables [plan mode](#plan-mode) and submits `refactor commands` immediately.

In addition to the built-in commands, you can [add custom slash commands](Custom-slash-commands.md) for frequently used prompts and
repetitive tasks.

To see all available shortcuts, type `?`.

## Run shell commands

You can run shell commands without leaving Junie CLI by prefixing it with `!`, for example:

```
!ls -la
```

## Command approval

For running potentially sensitive actions, such as executing most of the terminal commands, 
editing files outside the project, or invoking MCP tools, Junie will ask for approval from the user.

### Action Allowlist

When Junie CLI stops for user approval, you can select the **→ Always allow** option to add 
the indicated command to the Action Allowlist. Once on the Action Allowlist, the command will always be executed 
without user approval in the future Junie runs.

![](action_allowlist_junie_cli.png){width="706"}

The full list of allowed commands and command patterns is stored in the `~/.junie/allowlist.json` file. You can also 
edit this file manually to add or remove allowed or restricted commands and patterns. For details, see 
[Action Allowlist configuration](Action-Allowlist-Junie-CLI.md).

### Brave mode

You can authorize Junie CLI to execute all potentially sensitive actions without user approval by enabling brave mode
with the `/brave` slash command or the `Ctrl+B` shortcut.

![](brave_mode_on.png){width="706"}

## Plan mode

In plan mode, Junie CLI analyzes the codebase with read-only operations and produces a design document for the task
before any code is written. Toggle plan mode with the `Shift+Tab` shortcut or the `/plan` slash command. For details,
see [Plan Mode](Junie-CLI-Plan-Mode.md).

## Debug mode

In debug mode, Junie CLI acts as an AI debugging assistant that manages breakpoints, inspects runtime state, and
evaluates expressions against a live debugger session in a connected JetBrains IDE. Toggle debug mode with the
`Shift+Tab+Tab` shortcut or the `/debug` slash command. For details, see [Debug Mode](Junie-CLI-Debug-Mode.md).

[//]: # (## Terminal mode)

[//]: # (You can run shell commands directly within Junie to inspect your project or run tests:)

[//]: # (1. Type `!` followed by your command &#40;e.g., `!./gradlew test`&#41;.)

[//]: # (2. Junie will execute the command and display the output.)

[//]: # (3. You can also type `/terminal` to enter a persistent terminal session.)

## Manage your account

Use the `/account` command to manage your credentials and API keys:

* Select **Junie Account** to authenticate with Junie CLI via JetBrains Account or a Junie API key. 

  To generate a `JUNIE_API_KEY` access token, go to [junie.jetbrains.com/cli](https://junie.jetbrains.com/cli).

* Select **Bring Your Own Key (BYOK)** to add API keys for LLM providers like OpenAI, Anthropic, Google, or xAI.

    > BYOK can be used on its own or together with JetBrains Account authorization.
    > If a model is available through both the BYOK API key and JetBrains AI subscription, 
  > the requests are billed directly to the model provider without consuming credits from your JetBrains account.

## Manage your session

### Clear up session context

Use `/new` to clear up the context of the current session and start a new session in Junie CLI interactive mode.
Use `/new <prompt>` to start a new session with the prompt text already filled in.

### View session transcript

To access the full transcript of the current session, including all previous prompts and the agent output,
use the `Ctrl+T` shortcut.
When in the Transcript view, use `Ctrl+N` to load older entries, or `Esc` to return to the main view.

### Resume previous sessions

To see the session history and resume one of the previous sessions, use `/history`.

Junie CLI stores the full session context, including LLM usage data and the history of user prompts and agent responses, 
for the last 10 sessions.

### Quit the session

To exit the Junie CLI interactive mode without losing login credentials, use `/quit`.
Alternatively, you can exit Junie CLI by using `Ctrl+C` twice.

### Continue the session in a browser

Use `/remote` to share the running Junie CLI session with the Junie web app and continue working on the same task
from another device. For details, see [Remote Mode](Junie-CLI-Remote-Mode.md).

## Model and effort {id="model-and-effort"}

Use `/model` to select the LLM and, for supported models, the reasoning **effort level** used for the current
session. `Default` is the recommended pre-selected option that uses a dynamically set model with the best
price-quality ratio.

The selection of available models depends on your [authentication method](Junie-CLI.md#step-3-authenticate) with
Junie CLI. With BYOK, only the provider-specific models are available.

![](model_selection_with_effort.png){width="706"}

### Effort level

For models that support adjustable reasoning effort (for example, recent Claude, GPT-5, and Gemini models), you can
pick how hard the model thinks before answering. The set of supported effort levels (such as `Low`, `Medium`,
`High`, `XHigh`, `Max`) depends on the selected model.

You can change the effort level in two ways:

- Use the `/model` command and pick an effort level alongside the model.
- Use the dedicated `/effort` command to change only the effort level for the current model.

![](effort_level_selection.png){width="706"}

You can also set the default effort level for new sessions with the `--effort <level>` CLI flag or the
`JUNIE_EFFORT` environment variable. For details, see [Model selection](Junie-CLI-Model-selection.md).

> We recommend keeping the default model and effort settings. Higher effort levels do not always produce noticeably
> better results, but they can cost significantly more and make the model take noticeably longer to respond as it
> spends more time reasoning. Increase the effort only when you have observed that a specific task benefits from it.
> {style="note"}

## Local code review {id="local-code-review"}

Use the `/review` slash command to run a code review of your local changes before you commit them. Junie CLI uses
the same review backend as [automated code reviews](Automated-code-reviews.md) on GitHub, so the feedback you get
locally is consistent with what would be reported on a pull request.

When you run `/review`, Junie CLI detects the git state of the project and offers a wizard with only the
review targets that make sense in the current state:

- **From Main** — review your current branch against `main`. Shown only when a `main` branch exists and you are
  not currently on it (there is nothing to compare if you are already on `main`).
- **Last Commit** — review the diff of the most recent commit. Always available as long as the project has at
  least one commit.
- **Unstaged Changes** — review changes that are not yet staged. Shown only when there are actual unstaged
  changes in the working tree.

Pick an option, and Junie will start a review task that comments on the selected diff.

![](review_wizard.png){width="706"}

After the review is complete, Junie presents the findings and lets you accept or dismiss individual comments.

![](review_results.png){width="706"}

> `/review` requires the current project to be a git repository. If no `.git` directory is found, Junie reports
> that no git repository was detected and does not start the wizard.
> {style="note"}

## Token usage and costs

The `/usage` command shows the cost breakdown for the current session, including token usage, used models, and remaining balance.

![](check_session_cost.png){width="706"}

## Extend Junie CLI

* [Model Context Protocol (MCP)](Junie-CLI-MCP-configuration.md)
* [](Agent-Skills.md)
* [Subagents](Junie-CLI-subagents.md)
* [](Custom-slash-commands.md)
* [Guidelines and memory](Guidelines-and-memory.md)

### Junie CLI and JetBrains IDE integration

# Junie CLI and JetBrains IDE integration

<show-structure for="chapter" depth="3" />

This page describes how Junie CLI integrates with JetBrains IDEs, what products are supported, which features depend on the JetBrains IDE connection, and how to inspect the connection with `/ide`.

## What JetBrains IDE integration does

When JetBrains IDE integration is available, Junie CLI can connect to the Junie plugin running inside a JetBrains IDE for the same project and use JetBrains IDE awareness for that session.

This improves features that depend on project understanding inside the IDE, such as symbol-aware search, safer code edits, code inspections, test workflows, and product-specific actions.

JetBrains IDE integration requires the Junie IDE plugin. For installation and setup details, see [Junie IDE plugin](Junie-IDE-plugin.md).

JetBrains IDE integration is passive from the CLI side:

- The IDE plugin becomes available automatically when you open the same project.
- The CLI discovers running IDE sessions automatically.
- The CLI selects the best matching JetBrains IDE for the current working directory.
- The CLI connects to the JetBrains IDE only when IDE-backed features are needed or when you inspect the state with `/ide`.

> Junie CLI currently supports only JetBrains IDEs for this integration. It does not connect to non-JetBrains editors or IDEs.
> {style="note"}

## Supported JetBrains IDEs

The current IDE discovery implementation supports these JetBrains IDEs:

- IntelliJ IDEA, PyCharm, WebStorm, GoLand, PhpStorm, RubyMine, RustRover, CLion, and Rider

Support means that the CLI can detect installed and running instances of these products and match them to the current project when the Junie plugin is available.

## What features are affected

The JetBrains IDE connection affects user-visible features that benefit from the IDE understanding your project.

In practice, JetBrains IDE integration can improve tasks such as:

- Code search with symbol awareness and project indexes
- Code edits that use the IDE understanding of your project structure
- Code inspections and structure-aware analysis
- Test discovery and test execution from the IDE project context
- Refactorings and other project-aware changes
- Product-specific workflows in IDEs such as CLion or Rider

JetBrains IDE integration also improves `@` completions in the prompt. When the IDE is connected, Junie CLI can suggest not only project files and folders, but also classes and symbols known to the connected JetBrains IDE.

The CLI can also use JetBrains IDE context for the session, such as which files are currently open in the IDE.

If no JetBrains IDE is connected, Junie CLI can still work, but IDE-backed capabilities are unavailable.

## Requirements

For JetBrains IDE integration to work:

- Open the target project in a supported JetBrains IDE
- Make sure the Junie plugin is installed and running
- Open the same project so the IDE integration can start
- Run Junie CLI from the same project or a child directory of that project

If the project paths do not match, the CLI will not select that IDE session.

## Use the `/ide` command

Use `/ide` in Junie CLI to inspect the current JetBrains IDE integration state.

What `/ide` does:

- Lists running IDEs and their states
- Allows you to switch between multiple IDEs and projects
- Helps install the plugin if it is missing

### Possible states

| State | Meaning |
|------|---------|
| `Connected` | The CLI is connected to that JetBrains IDE and can use JetBrains IDE-backed features |
| `Connecting…` | The CLI found a matching JetBrains IDE and is opening the connection |
| `Auth required` | The JetBrains IDE session is running, but the current connection is no longer authorized |
| `Error` | The JetBrains IDE was found, but the connection failed for another reason |
| `Ready` | The Junie plugin for that JetBrains IDE is available and can be selected |
| `Missing` | The Junie plugin is not installed for that JetBrains IDE |
| `Not responding` | The Junie plugin is installed, but it is not responding |
| `Unsupported` | That JetBrains IDE version is too old for Junie IDE integration |

### Notes

- `/ide` is a status command. It does not start a JetBrains IDE or enable JetBrains IDE integration by itself.
- The available features depend on the connected JetBrains IDE, the open project, and which capabilities are available in that session.
- If several JetBrains IDEs are running, the CLI prefers the one whose project path matches the current working directory most closely.
- `/ide` reports only JetBrains IDE integration state. It does not represent support for other editors or IDEs.

## Troubleshooting

| Problem | What to check |
|---------|---------------|
| `/ide` shows `Missing` | Install the Junie plugin for that JetBrains IDE, then wait a moment and run `/ide` again |
| `/ide` shows `Auth required` | Restart the JetBrains IDE, then run `/ide` again. If the problem stays, inspect `~/.junie/logs/junie.log` |
| `/ide` shows `Not responding` | Check whether the Junie plugin is enabled and update it to the latest version if needed |
| `/ide` shows `Error` | Check `~/.junie/logs/junie.log` for the connection error and verify that the JetBrains IDE project path matches the CLI working directory |
| `/ide` shows `Unsupported` | Update that JetBrains IDE to version `2026.1` or newer |
| `/ide` shows few available features after connecting | Verify that the JetBrains IDE session is fully loaded for that project and that the required JetBrains IDE features are available for that product and project |

## Related documentation

- [Using Junie in the terminal](Junie-CLI-usage.md)
- [Junie for ACP clients](Junie-CLI-ACP.md)
- [Junie IDE plugin](Junie-IDE-plugin.md)

### Plan Mode

# Plan Mode

<show-structure for="chapter" depth="3" />

In Plan Mode, Junie CLI analyzes the codebase with read-only operations and produces a design document for the task
before any code is written. You can review the plan, push back on assumptions, and adjust the scope — and only then
let Junie implement it.

## How Plan Mode works

When Plan Mode is enabled, Junie focuses on understanding the task and shaping a concrete implementation plan rather
than modifying the project:

- Junie uses read-only operations to explore the codebase, configuration, and any context attached to the prompt.
- Instead of editing files, Junie produces a plan that captures the scope, key decisions, and the reasoning behind
  them.
- The plan is treated as a living design document: when requirements change in the same session, the plan is
  updated alongside them.
- Once the plan is confirmed, Junie switches to implementation and applies the changes described in the plan.

Plan Mode is most useful for non-trivial tasks where alignment on intent and approach matters more than producing
code as fast as possible.

## Enable Plan Mode

You can enable Plan Mode in two ways:

- Press `Shift+Tab` in the prompt area to toggle between the default mode and Plan Mode.
- Run the `/plan` slash command to toggle Plan Mode. To start in Plan Mode with your prompt submitted immediately,
  type `/plan <prompt>`, for example:

    ```
    > /plan refactor commands
    ```

![](plan_mode_enabled.png){width="706"}

When Plan Mode is active, the prompt area shows a corresponding indicator, and the agent's behavior changes to
plan-first.

## Review and refine the plan

After Junie proposes a plan, the session pauses and waits for your input. The prompt area shows a set of actions
you can pick from:

- **Confirm and implement** — accept the plan and let Junie proceed with the implementation using the agreed-upon
  scope and decisions.
- **View the entire plan** (`Ctrl+P`) — open the dedicated plan view with the full design document.
- **Open `<plan-file>`** — open the saved plan file (Markdown) in your default editor or viewer.
- **Save the plan and stop** — keep the plan file on disk and end the session without implementing it.

![](plan_actions.png){width="706"}

You can iterate on the plan as many times as needed before implementation starts. This keeps course corrections
cheap — adjusting a plan is much faster than reverting code that does not match your intent.

## Plan view

Press `Ctrl+P` at any time during a plan-mode session to open the dedicated plan view. The plan view shows the
proposed design document split into tabs. The exact set of tabs depends on the task and may vary between sessions,
but typically you will see something like:

- **Requirements** — what the change should achieve: goals, scope, user stories, functional and non-functional
  requirements.
- **Technical design** — how the change is going to be implemented: the affected modules, key decisions,
  data flows, and trade-offs.
- **Testing** — the test strategy and specific test cases that will verify the implementation.
- **Delivery steps** — the concrete steps Junie plans to take during implementation, in order.

Simple tasks may have fewer sections, while more complex tasks may include additional design sections alongside
the delivery steps.

![](plan_view_tabs.png){width="706"}

Use `Tab` or the arrow keys to switch between tabs. Press `Ctrl+P` again to return to the chat.

## Related documentation

- [Using Junie in the terminal](Junie-CLI-usage.md)
- [Slash commands reference](Slash-commands.md)

### Debug Mode

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

### Remote Mode

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

### Junie CLI configuration files

# Junie CLI configuration files

Junie CLI can load settings from JSON configuration files in addition to command-line flags and environment variables.
Configuration files are useful when you want to keep shared project defaults in the repository or define personal defaults once for all projects.

## Default configuration locations

By default, Junie CLI looks for `config.json` in these locations:

* **User scope**: `~/.junie/config.json`
* **Project scope**: `<project-root>/.junie/config.json`

The project-level configuration is intended for settings that should be shared with the whole team.
The user-level configuration is intended for personal defaults on your machine.

## Configuration precedence

When the same setting is defined in multiple places, Junie resolves it in this order
(highest priority first):

1. Command-line flags
2. User settings from `~/.junie/settings.json`
3. Project configuration from `<project-root>/.junie/config.json`
4. User configuration from `~/.junie/config.json`

For example, if `~/.junie/config.json` sets `"model": "sonnet"`, the project config sets `"model": "gpt"`,
and you run `junie --model opus`, the effective model is `opus`.

## Add extra configuration files

To load additional configuration files, use `--config-location`.
You can specify it multiple times:

```bash
junie \
  --config-location /opt/company/junie/config.json \
  --config-location ./configs/junie.local.json
```

To disable loading from the default user and project locations, use `--config-default-locations false`.

For CI, you can use the equivalent environment variables:

| Environment variable | CLI equivalent | Description |
|---|---|---|
| <code-block>JUNIE_CONFIG_LOCATION</code-block> | <code-block>--config-location</code-block> | Additional configuration file paths. Can be specified multiple times. |
| <code-block>JUNIE_CONFIG_DEFAULT_LOCATIONS</code-block> | <code-block>--config-default-locations</code-block> | Enable or disable loading `config.json` from the default user and project locations. Defaults to `true`. |

## Supported configuration fields

The following JSON fields are currently supported in `config.json`:

| Field | Description |
|---|---|
| `model` | Default model to use. For supported built-in model IDs and custom model profiles, see [Model selection](Junie-CLI-Model-selection.md) and [Custom LLM models](Custom-LLM-models.md). |
| `provider` | Default BYOK provider. For supported provider values, see [LLM providers](Junie-CLI-Model-selection.md#llm-providers). |
| `brave` | Enables brave mode by default. |
| `flags` | Additional feature flags. |
| `mcp-locations` | Extra folders where Junie should search for MCP configurations. |
| `mcp-default-locations` | Enable or disable the default MCP locations. |
| `skill-locations` | Extra folders where Junie should search for agent skills. |
| `skill-default-locations` | Enable or disable the default skill locations. |
| `command-locations` | Extra folders where Junie should search for custom slash commands. |
| `command-default-locations` | Enable or disable the default custom slash command locations. |
| `agent-locations` | Extra folders where Junie should search for custom agents. |
| `agent-default-location` | Enable or disable the default custom agent locations. |
| `model-locations` | Extra folders where Junie should search for custom model profiles. |
| `model-default-locations` | Enable or disable the default model locations. |
| `auto-update` | Enable or disable automatic update checks. |
| `guidelines-location` | Path to the guidelines file Junie should use. |
| `time-limit` | Default task time limit. |
| `byok` | Default BYOK API keys for supported providers. |
| `proxies` | Custom proxy endpoints for routing LLM traffic. |
| `hooks` | Shell commands to run on session lifecycle events. See [Hooks](Junie-CLI-hooks.md). |

Relative paths in `config.json` are resolved relative to the folder that contains that configuration file.

For safety, `hooks` from the default project configuration file are ignored.
Use `~/.junie/config.json` for personal hooks, or pass a hook config file explicitly with `--config-location`.

## Example configuration file

```json
{
  "model": "sonnet",
  "provider": "anthropic",
  "brave": false,
  "flags": ["copilot"],
  "mcp-locations": ["./mcp", "./shared/mcp"],
  "mcp-default-locations": true,
  "skill-locations": ["./skills"],
  "skill-default-locations": true,
  "command-locations": ["./commands"],
  "command-default-locations": true,
  "agent-locations": ["./agents"],
  "agent-default-location": true,
  "model-locations": ["./models"],
  "model-default-locations": true,
  "auto-update": true,
  "guidelines-location": "./team-guidelines.md",
  "time-limit": 3600,
  "byok": {
    "anthropic": "sk-ant-...",
    "openai": "sk-..."
  },
  "proxies": [
    {
      "name": "my-proxy",
      "kind": "Ingrazzio",
      "api-url": "https://my-ingrazzio-instance.example.com",
      "headers": ["X-Custom-Header: value"]
    }
  ],
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          { "type": "command", "command": "aws sso login --profile dev" }
        ]
      }
    ]
  }
}
```

## How configuration combines with other features

Configuration files control discovery for several other Junie CLI features:

* [MCP configuration](Junie-CLI-MCP-configuration.md)
* [Agent skills](Agent-Skills.md)
* [Custom slash commands](Custom-slash-commands.md)
* [Custom LLM models](Custom-LLM-models.md)
* [Guidelines and memory](Guidelines-and-memory.md)
* [Hooks](Junie-CLI-hooks.md)

For the exact command-line flags, see [CLI reference](Parameters.md).

### Action Allowlist

# Add commands to Action Allowlist

If [brave mode](Junie-CLI-usage.md#brave-mode) is not explicitly enabled, Junie will ask for user approval before 
running terminal commands, MCP tools, and other [types of actions](Action-Allowlist.md#types-of-action-allowlist-rules) 
that are considered to be sensitive by the coding agent.

You can manually add or remove allowed commands by editing the `~/.junie/allowlist.json` file.

There are three types of actions that can be allowed with the `allowlist.json` file:

* `fileEditing` – Editing files outside the project directory where Junie CLI is launched; editing build scripts outside 
    or inside the project directory.
* `executables` – Running terminal commands, including execution of tests, running apps, or build actions.
* `mcpTools` – Usage of Model Context Protocol (MCP) tools.
* `readOutsideProject` – Reading files outside the current project directory where Junie CLI is launched.

An example `allowlist.json` file looks as follows:

```json
{
  "defaultBehavior": "ask",
  "allowReadonlyCommands": true,
  "rules": {
    "fileEditing": {
      "rules": [
        {
          "prefix": "src/main/kotlin/", // The path is relative to the current project directory. For absolute paths, start with `/`.
          "action": "allow"
        }
      ]
    },
    "executables": {
      "rules": [
        {
          "prefix": "git",
          "action": "allow"
        },
        {
          "pattern": "grep **",
          "action": "allow"
        },
        {
          "pattern": "npm [iur]*",
          "action": "ask"
        }
      ]
    },
    "mcpTools": {
      "rules": [
        {
          "prefix": "github-server:",
          "action": "allow"
        }
      ]
    },
    "readOutsideProject": {
      "rules": [
        { 
          "pattern": "/etc/**", 
          "action": "ask"
        }
      ]
    }
  }
}
```

Each rule must specify either a `prefix` or a `pattern`, along with an `action` (`allow` or `ask`).
Select the appropriate action type and edit its `rules` array:

| Field     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
|-----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `prefix`  | Set a literal string to match all commands that start with it. <br><br>For example, indicating a `git` prefix allows all `git` commands (`git status`, `git commit`, `git push`, etc.)                                                                                                                                                                                                                                                                                                                                                      |
| `pattern` | Set a pattern using wildcard characters (Glob syntax): <list><li>`*` – Matches zero or more arbitrary characters, except for the path separator `/`.</li><li>`**` – Matches zero or more arbitrary characters, including the path separator `/`.</li><li>`?` – Matches exactly one arbitrary character, except for the path separator `/`.</li><li>`[abc]` – Matches any single character from the characters listed in brackets.</li><li>`[!abc]` – Matches any single character except for the characters listed in brackets.</li></list> |
| `action`  | The action to take for the command. Possible values: <list><li>`allow` – Execute automatically without user approval.</li><li>`ask`– Prompt for user approval before execution.</li></list>                                                                                                                                                                                                                                                                                                                                                 |
{width=800}

Rules are evaluated top to bottom, with the first match taking precedence. Thus, in the following example, `npm install`
will ask for permission, but `npm test` will be allowed automatically:

```json
{                                                                                                                                                                                                             
     "rules": [                                                                                                                                                                                                  
       {                                                                                                                                                                                                         
         "pattern": "npm install *",                                                                                                                                                                              
         "action": "ask"                                                                                                                                                                                         
       },                                                                                                                                                                                                        
       {                                                                                                                                                                                                         
         "prefix": "npm",                                                                                                                                                                                        
         "action": "allow"                                                                                                                                                                                       
       }                                                                                                                                                                                                         
     ]                                                                                                                                                                                                           
   }
```

### Agent skills

# Agent skills

<show-structure for="chapter" depth="3"/>

Agent skills are folders with instructions, templates, scripts, and reference materials that provide Junie with 
task-specific context. Skills follow the open [Agent Skills](https://agentskills.io/specification) 
format and are portable across agents.

Unlike [guidelines](Guidelines-and-memory.md), which are applied with every prompt, agent skills are only invoked when they match
the needs of the current task. Junie follows the skill instructions, loading referenced materials or executing 
bundled scrips as needed.

The added agent skill folders are available both to Junie CLI and [Junie in JetBrains IDEs](Junie-IDE-plugin.md).

## Why agent skills?

Think of skills as cheat sheets that Junie consults when working on specific types of tasks to produce better results.
The benefits of agent skills are:

* **Progressive disclosure:** Each skill's name and description are available to Junie, so it knows what skills exist, 
but doesn't read the full content of a skill until it determines its relevance to the task.
* **Instructions with attached files:** Instructions are bundled with reference materials such as templates or 
assets, so Junie has all the context it needs to complete the task.  
* **Portability**: If your project already has skill folders from other agents (`.cursor/skills/`, `.claude/skills/`, 
or `.codex/skills/`), Junie CLI will detect them and suggest importing into Junie's `.junie/skills/` directory.


## How Junie CLI uses skills

Junie CLI invokes agent skills *automatically*. It scans folders inside `.junie/skills/` at the user and project 
levels and selects the skills that are relevant to the current task.

### Skill location

Junie CLI looks for skill folders in two locations:

* *Project scope:* `<projectRoot>/.junie/skills/<skill-name>/`. 

  Skills in this folder are available only in the current 
  project, but can be checked into version control and shared across all team members. 
    
* *User scope:* `~/.junie/skills/<skill-name>/` on macOS/Linux or `%\USERPROFILE%\.junie\skills\<skill-name>\` on Windows. 

  Skills in this folder are available globally across all projects on your machine while remaining private to your user account.

[//]: # (> The default user-level path can be changed by setting the `JUNIE_HOME` environment)
[//]: # (> variable. In that case, skills are loaded from `$JUNIE_HOME/skills/` &#40;macOS/Linux&#41; or `%\JUNIE_HOME%\skills\` &#40;Windows&#41;.)

> If a project-level (`<projectRoot>/.junie/skills/<skill-name>/`) and a user-level (`~/.junie/skills/<skill-name>/`) 
> skills share the same name, the project-level skill takes precedence and the user-level skill is ignored.
> {style="note" title="Scope priority"}

[//]: # (When you add or update skills, Junie CLI notifies you at the start of the next session.)

### Skill directory structure

Each skill lives in its own folder under the `.junie/skills` directory:

```
.junie/skills/
├── my-skill/
│   ├── SKILL.md              # Required: Main skill documentation
│   ├── scripts/              # Optional: Executable scripts
│   │   └── setup.sh
│   ├── templates/            # Optional: Code or doc templates
│   │   └── component.kt
│   └── checklists/           # Optional: Detailed checklists
│       └── review.md
├── another-skill/
│   └── SKILL.md
```

- The `SKILL.md` file is **required**. A folder without it is not recognized as a skill.
- Subdirectories are optional and can contain any supporting files (checklists, scripts, templates, etc.) that Junie CLI
  can read when needed.

### `SKILL.md` format

The `SKILL.md` file uses Markdown with a YAML frontmatter header:

```Markdown
---
name: my-skill-name
description: A short description of what this skill provides
---

# My Skill Name

Use this skill when [describe when Junie should use this skill].

## Key Principles
- Principle 1
- Principle 2

## Guidelines
- Guideline 1
- Guideline 2

## Examples

[Include code examples, patterns, or references to project files]

## Checklist

See `checklists/review.md` for a detailed checklist.
```

#### Frontmatter fields

| Field         | Type   | Required | Description                                                                                    |
|---------------|--------|----------|------------------------------------------------------------------------------------------------|
| `name`        | String | **Yes**  | A unique identifier for the skill.                                                             |
| `description` | String | No       | A short summary that Junie CLI can use to determine the skill's relevance to the current task. |
{width="800"}

> If `description` is not provided in the frontmatter, Junie CLI extracts the first paragraph of the body content
> as the description. If the body is also empty or contains only headings, the skill will fail to load.
> For best results, always provide an explicit `description`. Accurate description helps Junie CLI trigger the skill at the right time.
> {style="note" title="Description fallback"}

#### Body content

The body (everything after the closing `---`) is the main skill documentation, which should contain actionable 
instructions that Junie CLI should follow along with the paths to relevant project files, templates, or additional 
materials within the skill folder.

## Adding a skill

### Prompt Junie to add a skill

The easiest way to add a skill is to ask Junie to create it for you. Describe what you want the skill to cover, 
and Junie will generate the skill folder, `SKILL.md`, and any supporting files.

<procedure>

**Example prompt:**

Create a skill that enforces our API design conventions: all REST endpoints must use kebab-case URLs, return JSON
responses wrapped in a `{ data, error }` envelope, and include request validation using our shared `ValidationUtils`
class. Add a checklist for reviewing new endpoints.

</procedure>

You can also create skills on the fly from your current task if the guidelines or patterns Junie followed 
could be reused in future tasks.

<procedure>

**Example prompt:**

The conventions we've been following for database migrations in this task are useful — create a skill from them so we
follow the same approach next time.

</procedure>

### Create your own skill

1. Create a `.junie/skills/` directory.

2. Add a skill folder to the `.junie/skills/` directory.

3. Add a `SKILL.md` file to the skill folder.

```Markdown
---
name: my-new-skill
description: Provides guidelines for [specific domain or task]
---

# My New Skill

Use this skill when [describe the trigger conditions].

## Key Principles

- [Actionable principle 1]
- [Actionable principle 2]

## Guidelines

- [Specific guideline with examples]
- [Reference to project files: `path/to/relevant/file.kt`]

## Code Patterns

    ```kotlin
    // Example of the preferred pattern
    fun example() {
        // ...
    }
    ```
## Additional Resources

- See `checklists/my-checklist.md` for a detailed checklist.
- Run `scripts/setup.sh` to configure the environment.
```
{collapsible="true" default-state="collapsed" collapsed-title=".junie/skills/my-new-skill/SKILL.md"}

4. (Optional) Add supporting files to the skill folder.

    If your skill needs additional resources, create subdirectories with supporting files.

5. Verify that the skill loads. 

    Ask Junie to list its available skills to confirm it loaded correctly.

[//]: # (Start a new Junie session. You should see a notification that a new skill was detected.)

### Add skills from public repositories

You can import skills shared by the community or your organization by copying them from public Git repositories into
your skills directory.

<tabs>
<tab title="macOS/Linux">

```bash
# Clone the repo (or download just the skill folder)
git clone https://github.com/example/junie-skills.git /tmp/junie-skills

# Copy a specific skill to your project
cp -r /tmp/junie-skills/code-review .junie/skills/

# Or copy to your global skills for use across all projects
cp -r /tmp/junie-skills/code-review ~/.junie/skills/

# Clean up
rm -rf /tmp/junie-skills]]>
```
</tab>

<tab title="Windows">

```powershell
# Clone the repo (or download just the skill folder)
git clone https://github.com/example/junie-skills.git $env:TEMP\junie-skills

# Copy a specific skill to your project
Copy-Item -Recurse -Force $env:TEMP\junie-skills\code-review .junie\skills\

# Or copy to your global skills for use across all projects
Copy-Item -Recurse -Force $env:TEMP\junie-skills\code-review "$env:USERPROFILE\.junie\skills\"

# Clean up
Remove-Item -Recurse -Force $env:TEMP\junie-skills]]>
```
</tab>
</tabs>

>Junie modifies your code and executes scripts, so it's important to make sure that the skills it uses are safe.
>Treat third-party skills with the same caution as you would with any third-party code you add to your project:
>
>* Only use skills from sources you trust.
>* Read the `SKILL.md` file and all supporting files carefully.
>* Prefer pinning to a specific commit or tag rather than pulling from a branch that may change.
> 
{title="Always review skills from external sources before using them" style="warning"}

## Best practices

* Be specific and actionable and provide as many details as possible. A good example is: 
  
  ```markdown
  Use the AAA pattern (Arrange, Act, Assert). 
  One assertion concept per test. 
  Use fakes instead of mocking libraries.
  ```

* Include examples and show the exact patterns you want Junie to follow. 
Skills with code examples are significantly more effective. 

* Reference project files. Point Junie to existing code that exemplifies the desired patterns:

    ```markdown
    See `src/test/kotlin/com/example/MyServiceTest.kt` for a reference 
    test implementation.
    ```

* Keep it focused. Each skill should cover one domain or concern. Don't create a single monolithic skill that covers 
everything – create multiple focused skills instead.

* Use subdirectories for complex skills. If a skill has extensive documentation, break it into multiple files:
    - Main `SKILL.md` provides an overview and links to sub-documents.
  - `checklists/` for step-by-step verification lists.
  - `scripts/` for automation scripts Junie can execute.
  - `templates/` for boilerplate code Junie can use as starting points.

* Write a clear description. The `description` field is what Junie uses to decide whether a skill is relevant.
Although the field is optional (Junie CLI can extract a description from the body content), providing an explicit 
`description` is recommended so Junie can match the skill to the right tasks without ambiguity.

## Troubleshooting

<procedure collapsible="true" default-state="collapsed" title="Junie not using a skill">

- Junie selects skills based on task relevance. If a skill isn't being used, it may not match the current task, 
or its description may be too vague or generic. Make sure the skill's `description` clearly communicates when it should be used.
- Try asking Junie to use a specific skill explicitly, for example: *Use the testing skill to write tests for this module.*
- Check for name conflicts: if a project-level and a user-level skills have the same name, the user-level skill will be skipped.
- Verify the [SKILL.md file format](#skill-md-format) is followed: proper YAML formatting (no tabs, correct indentation), 
the YAML frontmatter starts with `---`, contains at least the `name` field, and ends with `---`; 
if `description` is omitted, make sure the body contains at least one paragraph of text so Junie CLI can extract a description.
- Check file permissions and encoding (UTF-8) for file read errors.
</procedure>

## Example skill folder

Below is an example code review skill that contains the main `SKILL.md` file and a referenced checklist.

```
.junie/skills/code-review/
├── SKILL.md
└── checklists/
    └── kotlin.md
```

```Markdown
---
name: code-review
description: Provides guidelines and checklists for thorough Kotlin code reviews
---

# Code Review Skill

Use this skill when reviewing Kotlin code for quality, correctness, and maintainability.

## Review Priorities

1. **Correctness** — Does the code do what it's supposed to?
2. **Error Handling** — Are errors handled gracefully?
3. **Readability** — Is the code easy to understand?
4. **Performance** — Are there obvious performance issues?
5. **Testing** — Are there adequate tests?

## Kotlin-Specific Checks

- Prefer `val` over `var`
- Use data classes for value objects
- Prefer early returns over nested `if` blocks
- Use sealed classes for restricted hierarchies

## Detailed Checklist

See `checklists/kotlin.md` for a comprehensive review checklist.]]>
```
{collapsible="true" default-state="collapsed" collapsed-title=".junie/skills/code-review/SKILL.md"}

```Markdown
# Kotlin Code Review Checklist

## Naming
- [ ] Classes use PascalCase
- [ ] Functions and variables use camelCase
- [ ] Constants use SCREAMING_SNAKE_CASE

## Null Safety
- [ ] Avoid `!!` operator
- [ ] Use `?.let {}` or safe calls
- [ ] Nullable types are justified

## Error Handling
- [ ] Errors are handled gracefully
- [ ] Error propagation is clean and readable

## Testing
- [ ] New code has corresponding tests
- [ ] Edge cases are covered
- [ ] Tests follow AAA pattern]]>
```
{collapsible="true" default-state="collapsed" collapsed-title=".junie/skills/code-review/checklists/kotlin.md"}

### MCP

<show-structure depth="3"/>

# Add and configure MCP servers

You can connect Junie CLI to external tools via Model Context Protocol (MCP).
Junie CLI uses the same MCP JSON configuration as
[Junie in JetBrains IDEs](Junie-IDE-plugin.md#mcp-configuration).

The `/mcp` slash command shows the [list of configured MCP servers](#list-configured-mcp-servers) and the
[MCP Installation Assistant](#mcp-installation-assistant) to guide you through
adding, editing, or troubleshooting configs for MCP servers.

[//]: # (TODO: differentiation between inactive and failed statuses is not clear)

## MCP Installation Assistant

Junie's MCP Installation Assistant is an AI helper that streamlines and simplifies the process of adding new MCP servers.
It guides you through adding MCP servers from a registry of pre-configured servers or from scratch.

When adding a server from the registry, Junie CLI automatically configures the correct command or URL and prompts the user for 
any required secrets or environment variables.

When adding a server from scratch, it searches the [official MCP registry](https://registry.modelcontextprotocol.io/)
for the proper server configuration, prompts for parameters, env variables, secrets, or API tokens if needed, adds the server
configuration to the `mcp.json` file, and verifies the server startup.

![](mcp_installation_assistant.png){width=680}

### Add an MCP server

1. Use the `/mcp` command to open the MCP server configuration screen.

2. Press `Ctrl+A` to open and search the list of pre-configured MCP servers. 

    If the MCP server you need is not on the list, press `Ctrl+A` once again and follow Installation Assistant's prompts 
to set up the server configuration from scratch.

3. Select the server installation scope:

    * *Project* — MCP server configs are stored in the `.junie/mcp/mcp.json` file at the root of your project. This file
      can be checked into version control and shared across all team members.
        > For project-scope installations, avoid sharing secrets or sensitive environment variables 
      > if the `.junie/mcp/mcp.json` file is committed to version control. 
      > {title="Warning"}

    * *User* — user-scope MCP configs are stored in `~/.junie/mcp/mcp.json` and available across all projects
      on your machine while remaining private to your user account.

4. Select the server connection type:

    * *Remote* — Connect to a hosted server via HTTP/HTTPS.

      Junie CLI connects to an MCP server hosted on a remote machine or service.

    * *Local* — Run on your machine (Docker, npx, or binary).

      Junie CLI starts an MCP server instance locally, e.g.
      using the `npx` command or via Docker.

### OAuth authorization

Remote MCP servers that require OAuth authorization are added to the list of configured servers with 
an **Authorization required** status. Use MCP Installation Assistant to set up OAuth authorization:

1. Select the server on the list to open its configuration menu.

2. Select **→ Authorize** and then follow the steps to login in the respective server's browser page that opens.

3. Verify that the server's status has changed to **Active**.

## Add an MCP server from JSON configuration

If you have a JSON configuration for an MCP server, you can add it manually directly to the `.junie/mcp/mcp.json` file 
at the project or user scope. 

The `mcp.json` file uses the following JSON structure:

```json
{
  "mcpServers": {
    "Context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {
        "ENV_VAR": "value"
      }
    },
    "RemoteServer": {
      "url": "https://mcp.example.com/v1",
      "headers": {
        "Authorization": "Bearer token"
      }
    }
  }
}
```
{collapsible="true" collapsed-title="mcp.json"}

Manually added configurations are imported to the list of MCP servers and enabled by default.
To verify that the server is available to Junie CLI and active, use the `/mcp` command.

## List configured MCP servers

To list all configured MCP servers, as well as disable/enable, modify,
or delete existing configurations, use the `/mcp` command. The list shows:

* MCP server name.
* Installation scope (project or user).
* Server status (Starting/Active/Inactive/Disabled/Failed/Authorization required).

> Servers that are neither *Active* nor *Disabled* can be either *Inactive* or *Failed*.
>
> The *Inactive* status indicates that the server is correctly configured and enabled but is not currently running.
>
> The *Failed* status indicates that an error occurred while attempting to connect to the server,
> the server cannot be started or crashes while running.
> This could be due to invalid configuration, authentication failure, missing dependencies, or server's runtime crash.
> {title="MCP server statuses"}

Configuration for MCP servers is stored in the `mcp.json` file at the following default locations:
* **Project scope**: `.junie/mcp/mcp.json` at the root of your project.
* **User scope**: `~/.junie/mcp/mcp.json` on your machine.

You can control where Junie searches for MCP configurations using the following command-line options:

| Option | Default | Description |
|---|---|---|
| `--mcp-default-locations` | `true` | Enable or disable adding MCP servers from default locations (per user / per project). |
| `--mcp-location <path>` | — | Additional folders where MCP servers should be found. Can be specified multiple times. |

## Enable or disable an MCP server

The MCP servers connected via MCP Installation Assistant or imported from the `mcp.json` file are enabled by default.

To disable a server, list all the configured servers with the `/mcp` command, select the necessary server,
and then select the **→ Disable** action. To enable a previously disabled server, use **→ Enable**.

### Extensions

<show-structure for="chapter" depth="3"/>

# Add and configure extensions

Extensions are reusable bundles that extend Junie CLI with project-specific or
domain-specific capabilities. A single extension can package any combination of:

* [Agent skills](Agent-Skills.md)
* [MCP servers](Junie-CLI-MCP-configuration.md)
* [Subagents](Junie-CLI-subagents.md)
* [Custom slash commands](Custom-slash-commands.md)
* [Guidelines](Guidelines-and-memory.md)

This makes extensions a convenient way to install a curated set of capabilities for a particular
technology stack (for example, an Android, Spring Boot, or SQL extension), share team-wide setups,
or distribute community-built integrations — without manually configuring each piece.

Run the `/extensions` slash command (aliases: `/plugin`, `/plugins`) to open the
extensions screen, where you can browse marketplaces, install, update and remove
extensions, and configure additional marketplaces.

## Marketplaces

Extensions are distributed via marketplaces. A marketplace is a Git repository that contains
a manifest with a list of available extensions and references to where their content is hosted.

Junie CLI supports two marketplace manifest formats:

* The native Junie format with `.junie-extension/marketplace.json`.
* The [Claude plugin](https://docs.claude.com/) format with `.claude-plugin/marketplace.json`.

This means you can connect any Claude-compatible plugin marketplace to Junie CLI in addition to
Junie's native marketplaces.

### Built-in marketplace

Junie CLI ships with the official JetBrains marketplace pre-registered:

[https://github.com/JetBrains/junie-extensions](https://github.com/JetBrains/junie-extensions)

The marketplace contains a curated set of extensions maintained by the Junie team —
for example, extensions for Java, Kotlin, Android, Spring Boot, SQL, Redis, and others.

### Add a custom marketplace

To register an additional marketplace:

1. Run `/extensions` and switch to the **Marketplaces** tab.
2. Choose **Add marketplace** and provide a GitHub repository URL (or `owner/repo` shorthand,
   which is expanded to `https://github.com/owner/repo`).

   The repository must contain either a `.junie-extension/marketplace.json` or a
   `.claude-plugin/marketplace.json` file at its root.

3. Junie CLI clones the repository locally and lists its extensions in the catalog.

To remove a custom marketplace, select it in the **Marketplaces** tab and choose **Remove**.
The built-in JetBrains marketplace cannot be removed.

You can also drive the same actions inline via `/extensions <arg>`:

```text
/extensions marketplace add <github-repo-url-or-owner/repo>
/extensions marketplace remove
```

## Install an extension

1. Run `/extensions` to open the extensions screen.

2. Browse the catalog of available extensions across all registered marketplaces, or use search
   to find a specific extension.

3. Select an extension and choose the installation scope:

    * *Project* — the extension is enabled only in the current project. The reference is stored
      in `.junie/extensions.json` at the root of the project. This file can be checked into
      version control and shared with the team.

    * *User* — the extension is enabled across all projects on your machine. The reference is
      stored in `~/.junie/extensions/extensions.json` (or `%\USERPROFILE%\.junie\extensions\extensions.json` on Windows).

Extension content (skills, agents, commands, MCP configs, guidelines) is downloaded once into
the user-level cache directory `~/.junie/extensions/<marketplace>/<extension>/` and reused across
projects.

You can also pass a raw trailing argument directly to the `/extensions` command, for example:

```text
/extensions install <extension-name>
```

Newly installed extensions become available within the running session — there is no need to
restart Junie CLI.

## Remove an extension

To uninstall an extension:

1. Run `/extensions` and switch to the **Installed** tab.
2. Select the extension and choose **Remove**.

The reference is removed from the corresponding `extensions.json` file. Cached content under
`~/.junie/extensions/` may be reused if the extension is reinstalled later.

## Update an extension

To pull the latest version of an installed extension, select it in the **Installed** tab and
choose **Update**.

## Where extensions are stored

| Location                                | Purpose                                                                                          |
|-----------------------------------------|--------------------------------------------------------------------------------------------------|
| `~/.junie/extensions/`                  | Base directory for cached extension content.                                                     |
| `~/.junie/extensions/extensions.json`   | User-scope configuration: extensions enabled for the current user across all projects.           |
| `~/.junie/extensions/marketplaces.json` | Registry for registered marketplace repositories and their sync status.                          |
| `.junie/extensions.json`                | Project-scope configuration: extensions enabled for the current project; can be committed to VCS. |
| `~/.junie/extensions/marketplaces/`     | Cloned marketplace repositories.                                                                 |

Both `extensions.json` files share the same format: a flat JSON object that maps a marketplace
identifier to the list of installed extensions for that marketplace. For non-built-in
marketplaces the GitHub `url` is also stored, so a teammate who pulls the project can auto-register
the marketplace without configuring it manually:

```json
{
  "github-JetBrains-junie-extensions": { "extensions": ["context7"] },
  "github-myorg-myrepo": { "url": "https://github.com/myorg/myrepo", "extensions": ["my-ext"] }
}
```

You can override the base directory with the following command-line option:

| Option                                 | Default              | Description                                                                                                                                              |
|----------------------------------------|----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--extensions-default-location <path>` | `~/.junie/extensions` | Override the default extensions directory. Can also be set via the `JUNIE_EXTENSIONS_DEFAULT_LOCATION` environment variable. |

### Subagents

# Custom subagents

<show-structure for="chapter" depth="3" />

Subagents in Junie extend the built-in logic of the main agent with task-specific instructions that define a tailored system 
prompt, tool restrictions, and usage of models and [agent skills](Agent-Skills.md).

When Junie CLI runs across a task that matches a subagent’s name and description, it delegates this task to that subagent. 
The subagent then works independently in its own context and returns the result to the main agent.

This page describes the [benefits of using custom subagents](#why-subagents), 
[how custom subagents are invoked](#how-junie-cli-uses-subagents), 
[adding your own subagents](#creating-a-custom-subagent) to Junie CLI, and what [built-in tools](#supported-tool-groups) 
are supported.

## Why subagents?

With subagents, Junie CLI can extend the capabilities to the main agent by delegating tasks to the most appropriate handler 
based on the nature of the request. Subagents let you:

* **Break down complex tasks** into focused, single-purpose chunks that the main agent can delegate 
while keeping the subagent's context out of the main conversation.
* **Tailor and reuse agent's behaviour for specific tasks** by defining coding standards, checklists, procedures, or 
agent skills to invoke and reusing these instructions across projects.
* **Optimize performance and costs** by using lightweight models for simple repetitive tasks, or predefined models for
    specific types of tasks.
* **Enforce tool restrictions** for specific types of tasks, such as restricting the agent to read-only operations 
for security auditing and reviews.

## How Junie CLI uses subagents

Junie CLI invokes subagents *automatically*, informing the user which subagent has started 
working on the task.

The main agent discovers all available subagents, selects the relevant subagent by matching its [`name` and `description`](#frontmatter-fields) to the task at hand, 
runs it as a subtask, and brings the result back into the main session.

> Unlike [custom slash commands](Custom-slash-commands.md), custom subagents cannot be invoked manually 
> via slash commands. They are only called automatically through delegation.

> If your project already has agent files from other tools (`.cursor/agents/`, `.claude/agents/`, or `.codex/agents/`),
> Junie CLI detects such files when opening the project and suggests importing them into Junie's `.junie/agents/` 
> directory automatically.
{title="Agent import"}

## Creating a custom subagent

Subagents are Markdown files with YAML metadata stored in the `.junie/agents/` or `.agents/` directory. For example, a simple 
subagent file for a changelog assistant (`.junie/agents/changelog.md`) looks as follows:

```yaml
---
name: "changelog"
description: "Write a changelog entry for a PR"
---

You are a changelog assistant.

Given the PR title and description, produce a short changelog entry.
```

### File location

Junie CLI looks for custom subagent `*.md` files in the following locations:

* *Project scope:* `<projectRoot>/.junie/agents/`.
* *Project scope:* `<projectRoot>/.agents/`.
* *User scope:* `~/.junie/agents/` on macOS/Linux or `%\USERPROFILE%\.junie\agents\` on Windows.
* *User scope:* `~/.agents/` on macOS/Linux or `%\USERPROFILE%\.agents\` on Windows.

### File format

Subagent files use YAML frontmatter for metadata, followed by the prompt body in Markdown for the system prompt. 

An example subagent file that uses the commonly used supported frontmatter fields looks as follows:

```markdown
---
description: "Review a change and propose a safe patch"
name: "code-review-helper"
tools: ["Read", "Grep", "Edit"]
disallowedTools: ["Bash", "WebSearch"]
model: "sonnet"
reasoningLevel: "high"
skills: ["kotlin", "writerside"]
allowPromptArgument: true
---

You are a careful code reviewer.

Context:

- File: $path
- Focus area: $focus

Tasks:

1) Explain the issue concisely.
2) Propose a minimal fix.
3) If edits are needed, prepare a small patch.

If you need additional context, ask for it.
```

#### Frontmatter fields

| Field             | Type           | Required | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
|-------------------|----------------|----------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `name`            | `String`       | no       | The subagent name. If missing, the file name (without extension) is used. <br><br>Must match: `[a-z][a-z0-9-]*` (lowercase letters, digits, hyphens).                                                                                                                                                                                                                                                                                                                   |
| `description`     | `String`       | yes      | The subagent description. Used by the main agent to decide when to delegate a task to this subagent.                                                                                                                                                                                                                                                                                                                                                                    |
| `tools`           | `List<String>` | no       | If present and non-empty: an allowlist of [tool groups](#supported-tool-groups).                                                                                                                                                                                                                                                                                                                                                                                        |
| `disallowedTools` | `List<String>` | no       | A denylist of [tool groups](#supported-tool-groups). Applied after the `tools` filtering.                                                                                                                                                                                                                                                                                                                                                                               |
| `model`           | `String`       | no       | Model override for this subagent run (if supported by your environment). Accepted values depend on your environment; to see the model names currently available in your setup, start Junie and use `/model`, or use a name accepted by the `--model` CLI flag. Some builds also support aliases like `sonnet`, `opus`, `grok`, and custom model profile IDs in the `custom:<profile-id>` format. For more details, see [Model selection](Junie-CLI-Model-selection.md). |
| `reasoningLevel`  | `String`       | no       | Optional reasoning override for this subagent run. In most cases, use values such as `low`, `medium`, or `high`, but supported values can vary by model, so check the model's own documentation if in doubt. Junie maps the selected level to the provider-specific reasoning field for the effective model, including compatible custom model profiles.                                                                 |
| `skills`          | `List<String>` | no       | IDs/names of agent skills to load for the subagent worker (if supported by your environment).                                                                                                                                                                                                                                                                                                                                                                           |
| `allowPromptArgument` | `Boolean`  | no       | If `true`, Junie exposes an additional `$prompt` argument to the subagent prompt. When `$prompt` is not referenced explicitly in the prompt body, the delegated user request is appended automatically as `User Input: ...`.                                                                                                                                                                                                                                       |

#### Prompt body

In the prompt body, provide the set of instructions to guide the subagent’s behavior. This prompt will be added to the 
instructions delegated from the main agent.

#### Tips 

* Make delegated work items as independent as possible.
* Ask for specific outputs (for example, “return file paths and the exact symbol names”).
* If you want to keep changes small, say so (“no refactors”, “touch at most one module”, “prefer config-only fix”).

## Supported tool groups

Custom subagents can define which tool groups are allowed (`tools`) or forbidden (`disallowedTools`) during task execution. 

If the `tools` field in the YAML frontmatter is present and non-empty, **only the specified groups are allowed**,
with the rest being banned by default. There's no need to disallow them explicitly using the `disallowedTools` field. 

There are two types of tools that can be either allowed or banned:

* **Built-in tool groups**.
* **Tools provided by MCP servers** (if available in your environment).

The built-in tool group labels are:

| Built-in tool group label | What it enables                                         |                               
|---------------------------|---------------------------------------------------------|
| `Read`                    | Read-only file viewing actions (open/scroll).           |
| `Bash`                    | Running shell commands in the local environment.        |
| `Glob`                    | Searching for files by path pattern (`glob`).           |
| `Grep`                    | Searching for text by regular expression (`grep`).      |
| `Write`                   | Creating new files.                                     |
| `Edit`                    | Modifying existing files (search/replace, apply patch). | 
| `WebSearch`               | Searching the web for up-to-date information.           | 
| `AskUserQuestion`         | Asking the user for input or a choice.                  |

Example of a read-only subagent allowed to search for a text by regular expression:

```yaml
---
name: "symbol-finder"
description: "Find where a symbol is used and summarize"
tools: [ "Read", "Grep" ]
---
```

### Guidelines and memory

# Guidelines and memory

<show-structure depth="3" for="chapter"/>

## Guidelines

Guidelines allow you to provide persistent, reusable context to the agent. Junie CLI reads guidelines 
from the `AGENTS.md` file and adds this context to every task it works on.

Additionally, Junie CLI checks for any guidelines or memory files from other AI agents when it opens the project
for the first time. If such files are detected, it will suggest importing the instructions into `.junie/AGENTS.md`.

### AGENTS.md

[AGENTS.md](https://agents.md/) is an open file format for guiding coding agents. It's a standard Markdown file 
with headings, lists, and plain text that the agents can parse to add to the prompt context. 

[//]: # (For user-defined instructions and project context, Junie CLI reads the `.junie/AGENTS.md` file at the root of your project.)

### How Junie CLI discovers guidelines

When Junie CLI starts a task, it looks for guidelines in the following order:

1. `.junie/AGENTS.md` file in the project root.
2. `AGENTS.md` file in the project root.
3. `.junie/guidelines.md` file or `.junie/guidelines/` folder – Junie's legacy format for guidelines (still supported).

### Global guidelines {id="global-guidelines"}

In addition to project-level guidelines, Junie CLI also supports **global guidelines** from `~/.junie/AGENTS.md`.
On Windows, the global guidelines path is `&#37;USERPROFILE&#37;\.junie\AGENTS.md`.
This file lets you define personal preferences or organization-wide rules that apply to all your projects 
without duplicating them in every repository.

**How it works:**

- If only global or only project guidelines exist, Junie uses whichever is available — no extra annotations are added.
- If both global and project guidelines exist, Junie includes both and marks them clearly. 
  **Project-level guidelines always take precedence** over global ones when they conflict.
- If the global and project guidelines have identical content, Junie automatically deduplicates and uses the content only once.

<procedure title="Examples of guidelines">

An `AGENTS.md` file can include project-specific context such as tech stacks, conventions, or rules.
Providing this information helps Junie better understand your environment, avoid incompatible libraries,
and follow your project's specific architectural patterns.

Below are some examples of what you can include:

* **Quick-start checklist:**

```markdown
# A short bullet list of the most critical rules the agent must follow before doing anything

- [ ] Read this file and `README.md` before acting.
- [ ] Update `CHANGELOG.md` for user-facing changes.
```

* **Local development commands**:

```markdown
# A table or list of project-specific commands for install, lint, test, build, and span dev server

| Task                 | Command        |
|----------------------|----------------|
| Install dependencies | `pnpm install` |
| Start dev server     | `pnpm dev`     |
| Run unit tests       | `pnpm test`    |
```

* **Feature development and decision making:**

```markdown
# Feature development and decision making

- Make small, targeted changes instead of building for hypothetical future needs.
- If something is unclear, ask before making assumptions.
```

* **UI and architecture:**

```markdown
# UI and architecture guidelines

- Use existing design system components.
- Avoid inline styles.
- Follow current domain boundaries.
- Prefer extending existing services.
```

* **Security and data handling:**

```markdown
# Security and data handling

- Never log tokens or sensitive data.
- Sanitize all user input and use existing auth middleware.
```

* **Testing and contribution:**

```markdown
# Testing and contribution

- Add unit tests for new business logic.
- Keep changes minimal and avoid large refactors in feature tasks.
- Do not rename files without a valid technical reason.
```

* **Non-goals for agents:**

```markdown
# Explicit prohibitions what agents must NOT do 

- Do not bump major versions of core dependencies without a dedicated PR and discussion.
- Do not change database schema without a corresponding migration file.
```

For more technology-specific examples of guidelines with explanations, see the 
[junie-guidelines](https://github.com/JetBrains/junie-guidelines) catalog.
</procedure>


[//]: # (## Memory)

[//]: # ()
[//]: # (TBD)

### Custom slash commands

# Custom slash commands

Junie CLI supports custom slash commands that you can create to quickly execute frequently used prompts or
repetitive tasks. Custom commands are added to the list of built-in slash commands that is shown when you type `/`.

[//]: # (![]&#40;custom-slash-command.png&#41;{width="706"})

To create a custom command:

1. Use `/commands` → `Create New Command` and provide the command name and description.

2. Select the command scope:
    * *Project-specific commands* are stored as Markdown files in the `.junie/commands` folder at your project’s root directory.
      You can commit this folder to version control to ensure that all team members can use it.
    * *User commands* are stored as Markdown files in the `~/.junie/commands` folder on your machine, making them
      available across all projects you open locally.

3. Enter and save the prompt.

To view, modify, or delete the added custom commands, use `/commands`.

### Use arguments in the command prompt

You can use special keywords `$argumentName` in the prompt text to pass parameter values when invoking
the custom slash command.

For example, if you create a command named *explain* and set the prompt as `Explain the code in $file and suggest improvements`,
the `/explain` slash command should be used with the `file` argument when invoked as follows:

```
/explain file=src/main.kt
```
Argument values may be either unquoted or quoted with double or single quotes.

> A custom slash command will only be executed when all arguments from the command template are provided.
>
> Junie CLI shows inline hints for missing arguments. To autocomplete the missing argument name, use `Tab`.

Custom slash commands do not accept optional prompts as arguments the same way as [some built-in slash commands](Slash-commands.md#optional-text-as-arguments).
Only named arguments defined in the command template are supported.

### Slash command file format

Each custom slash command is saved as a separate Markdown file with YAML frontmatter that defines the command metadata.
The file name is taken from the command name.

For example, a file for the `/explain` command will be named `explain.md` and look as follows:


```markdown

---

description: Explains code in a given file

---


Explain the code in $file and suggest improvements.

```

### Custom LLMs

# Custom LLMs

Junie CLI supports custom models defined via JSON profiles. This feature allows you to integrate with local providers 
(e.g., Ollama), enterprise proxies, or any LLM endpoint that follows the supported API formats.

## Configuration

### Location and discovery

By default, custom models are discovered from JSON files located in:
- User-scope: `$JUNIE_HOME/models/*.json`.
- Project-scope: `.junie/models/*.json`.

The filename (without the `.json` extension) is used as the **profile identifier**.

You can control where Junie searches for custom models using the following command-line options:

| Option                                            | Default | Description                                                                              |
|---------------------------------------------------|---------|------------------------------------------------------------------------------------------|
| `--model-default-locations` | `true`  | Enable or disable adding custom models from default locations (per user / per project).  |
| `--model-location <path>`  | —       | Additional folders where custom models should be found. Can be specified multiple times. |
{width="800"}

You can also set these values in the `config.json` file. For details, see [Junie CLI configuration files](Junie-CLI-configuration.md).

### Profile structure

A custom model profile consists of a top-level configuration and two optional model roles:

1. **Top-level properties**: Serve as the default configuration (base URL, API key, API type, and extra headers) for the models in the profile.
2. **`primaryModel`**: The model used for main reasoning and code generation tasks.
3. **`fasterModel`**: The model used for internal helper tasks like summarizing context or classifying tasks.

If `primaryModel` or `fasterModel` is not explicitly defined, they inherit the top-level properties.

### Top-level parameters

These parameters appear at the root of the JSON profile and define the defaults shared by both model roles.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | String | Yes | The model identifier as expected by the API endpoint (for example, `gpt-4o` or `qwen3-coder:latest`). |
| `baseUrl` | String | Yes | The full URL of the LLM API endpoint (for example, `http://localhost:11434/v1/responses`). |
| `apiType` | String | Yes | The API format to use when communicating with the endpoint. See [Supported API types](#supported-api-types) for the list of accepted values. |
| `apiKey` | String | No | The API key for authenticating with the endpoint. If omitted, requests are sent without an `Authorization` header. |
| `extraHeaders` | Object | No | A key-value map of additional HTTP headers to include in every request to the endpoint. |
| `temperature` | Number | No | The sampling temperature to use for requests. If omitted, the provider's default temperature is used. See [Temperature](#temperature). |
| `primaryModel` | Object | No | Role-specific overrides for the primary model. See [Role-specific parameters](#role-specific-parameters). |
| `fasterModel` | Object | No | Role-specific overrides for the faster model. See [Role-specific parameters](#role-specific-parameters). |

### Role-specific parameters

`primaryModel` and `fasterModel` accept the same set of parameters. Any parameter specified here overrides the corresponding top-level value for that model role. Omitted parameters fall back to the top-level defaults.

| Parameter | Type | Description |
|---|---|---|
| `id` | String | Override for the model identifier used for this role. |
| `baseUrl` | String | Override for the API endpoint URL used for this role. |
| `apiType` | String | Override for the API format used for this role. |
| `apiKey` | String | Override for the API key used for this role. |
| `extraHeaders` | Object | Additional headers for this role. Merged with (not replaced by) the top-level `extraHeaders`. |
| `temperature` | Number | Override for the sampling temperature used for this role. |

### Merging logic

Overrides in `primaryModel` or `fasterModel` are merged with the top-level defaults:
- **Simple fields** (`id`, `baseUrl`, `apiKey`, `apiType`, `temperature`) are replaced by the override value when present.
- **Headers** (`extraHeaders`) are merged: headers defined in the override are added to the top-level headers. If the same header key appears in both, the role-level value takes precedence.

### Supported API types {id="supported-api-types"}

The `apiType` field controls which request format Junie uses when calling the endpoint.

| Value | Description |
|---|---|
| `OpenAICompletion` | OpenAI Chat Completions API (`/v1/chat/completions`). Compatible with most self-hosted and third-party OpenAI-compatible endpoints. |
| `OpenAIResponses` | OpenAI Responses API (`/v1/responses`). Use this for endpoints that implement the newer Responses API format. |
| `Google` | Google Gemini API format. Use this for Google AI Studio or Vertex AI endpoints. |
| `Anthropic` | Anthropic Messages API format. Use this for Anthropic Claude endpoints. |

## Temperature {id="temperature"}

By default, Junie does not send a temperature value for custom models, allowing the provider to use its own default.
You can set a specific temperature at the top level (shared by both model roles) or override it per role.

Recommended temperature values vary by model. For example:

| Model | Recommended temperature |
|---|---|
| DeepSeek | 0 |
| Gemini | 1 |
| Kimi | 0.6–1 |
| GLM | 0.7 |
| Qwen | 0.6 |
| MiMo | 0.3 |

> Consult your model provider's documentation for the optimal temperature value.
> Setting temperature to 0 may cause looping behavior with some models.

## Example profiles

### Basic profile

Below is an example of a profile named `local-ollama.json`:

```json
{
  "baseUrl": "http://localhost:11434/v1/responses",
  "id": "qwen3-coder:latest",
  "apiType": "OpenAIResponses",
  "extraHeaders": {
    "X-Custom-Source": "Junie"
  },
  "fasterModel": {
    "id": "qwen2.5-coder:1.5b"
  }
}
```

In this example, the primary model will be `qwen3-coder:latest`, and the faster model will be `qwen2.5-coder:1.5b`. Both will use the same base URL, API type, and extra headers.

### Profile with temperature

Below is an example that sets a default temperature and overrides it for the primary model:

```json
{
  "baseUrl": "http://localhost:11434/v1/responses",
  "id": "qwen3-coder:latest",
  "apiType": "OpenAIResponses",
  "temperature": 0.6,
  "primaryModel": {
    "id": "qwen3-coder:latest",
    "temperature": 0.3
  },
  "fasterModel": {
    "id": "qwen2.5-coder:1.5b"
  }
}
```

In this example, the primary model uses temperature `0.3` (overridden), while the faster model inherits the top-level temperature `0.6`.

## Using custom models

Once a profile is created, you can select it using the `/model` command or the `--model` flag. Custom models are identified by a `custom:` prefix followed by the profile ID:

```bash
junie --model custom:local-ollama
```

In the interactive TUI, custom models appear in the model selection list after the built-in providers.

### Custom proxies

# Custom proxies

<primary-label ref="nightly"/>

Custom proxies let you route Junie's LLM traffic through a self-hosted or third-party proxy endpoint instead of the default JetBrains AI service.
This is useful when your organization runs its own inference gateway, needs to add custom authentication headers, or wants to use a private Ingrazzio-compatible deployment.

> This feature is currently in the [Early Access program](Junie-CLI-EAP.md). To try it,
> [install the Early Access version](Junie-CLI-EAP.md#install-eap) of Junie CLI.

## About the Ingrazzio proxy {id="about-ingrazzio"}

Ingrazzio is JetBrains' internal proxy protocol that Junie uses to communicate with LLM providers.
The production Ingrazzio endpoint is `https://ingrazzio-cloud-prod.labs.jb.gg`.

When Junie connects through an Ingrazzio proxy, it uses the base URL to access several sub-endpoints:

- **LLM chat** — the base path handles streaming chat completion requests.
- **Web search** — the `/search` path provides web search capabilities.
- **URL extraction** — the `/extract` path fetches and extracts content from URLs.

When using the default JetBrains provider, Junie authenticates automatically via JetBrains Account (JBA).
When using a custom proxy, JBA authentication is bypassed — you must supply any required credentials (such as `Authorization: Bearer <token>`) through the proxy's `headers` field.

## Configure a proxy

Add a `proxies` array to your `config.json`. Each entry describes a named proxy endpoint:

```json
{
  "proxies": [
    {
      "name": "my-proxy",
      "kind": "Ingrazzio",
      "api-url": "https://ingrazzio-cloud-prod.labs.jb.gg",
      "headers": [
        "Authorization: Bearer <your-token>"
      ]
    }
  ]
}
```

### Proxy fields

| Field | Required | Description |
|---|---|---|
| `name` | Yes | A unique name for this proxy. Used to reference it from the `provider` field. |
| `kind` | No | The proxy protocol type. Defaults to `Ingrazzio` if omitted. See [Supported proxy kinds](#supported-proxy-kinds). |
| `api-url` | Yes | The base URL of the proxy endpoint. |
| `headers` | No | A list of extra HTTP headers to send with every request. Each entry uses the format `Header-Name: Header-Value`. |

## Select a proxy as the active provider

To make Junie use a configured proxy, set the `provider` field to the proxy name:

```json
{
  "proxies": [
    {
      "name": "corp-proxy",
      "kind": "Ingrazzio",
      "api-url": "https://ingrazzio-cloud-prod.labs.jb.gg",
      "headers": [
        "Authorization: Bearer <your-token>"
      ]
    }
  ],
  "provider": "corp-proxy",
  "model": "sonnet"
}
```

You can also override the provider at runtime with the `--provider` CLI flag:

```bash
junie --provider corp-proxy
```

When a proxy is selected as the provider, Junie does **not** use JetBrains AI authentication.
All authentication must be handled through the `headers` you configure on the proxy entry.

## Supported proxy kinds {id="supported-proxy-kinds"}

The `kind` field determines which protocol Junie uses to communicate with the proxy.

| Kind | Status | Description |
|---|---|---|
| `Ingrazzio` | **Supported** | Junie's native proxy protocol. Compatible with JetBrains Ingrazzio deployments. This is the default when `kind` is omitted. |
| `OpenAI` | Planned | OpenAI-compatible API. |
| `Anthropic` | Planned | Anthropic-compatible API. |
| `JetBrainsAI` | Planned | JetBrains AI Gateway. |
| `OpenRouter` | Planned | OpenRouter-compatible API. |

> Currently, only the `Ingrazzio` kind is functional. Selecting any other kind will result in an error at startup.

## Quick setup example

1. Create a configuration file (for example, `my-config.json`):

```json
{
  "proxies": [
    {
      "name": "my-ing",
      "kind": "Ingrazzio",
      "api-url": "https://ingrazzio-cloud-prod.labs.jb.gg",
      "headers": [
        "Authorization: Bearer <your-token>"
      ]
    }
  ],
  "provider": "my-ing",
  "model": "opus"
}
```

2. Run Junie with the custom config:

```bash
junie --config-location="/path/to/my-config.json"
```

You can still override the model at runtime with the `--model` flag:

```bash
junie --config-location="/path/to/my-config.json" --model sonnet
```

## Merging proxies across configuration files

When multiple configuration files define proxies, they are merged by name:

* If two files define a proxy with the same `name`, the higher-priority file's fields override the lower-priority file's fields on a per-field basis.
* Headers from both files are combined (deduplicated).
* Proxies with different names are all included in the final list.

For the configuration precedence order, see [Configuration files](Junie-CLI-configuration.md#configuration-precedence).

## Limitations

* Only the `Ingrazzio` proxy kind is currently supported. Other kinds are reserved for future use.
* Proxy configuration is only available through `config.json`. There are no dedicated CLI flags for defining proxy entries.
* When using a proxy provider, JetBrains AI authentication is bypassed entirely. You must supply any required credentials via the `headers` field.

### Hooks

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

### Demo agent (`/demo`)

# Demo agent (`/demo`)

<show-structure for="chapter" depth="3" />

The `/demo` slash command launches a **visual demo** of your project. Junie CLI
spins up a disposable virtual machine, builds and starts your app inside it,
and then drives the running UI — clicking, typing, and taking screenshots — to show
that a feature or recent change works. The result is a structured Markdown
answer in the TUI plus a folder of [output artifacts](#output-artifacts) —
screenshots, a screen recording, and a self-contained HTML report — that you
can share or attach to a PR.

Think of it as **'show me, don't tell me'**: instead of asking Junie to read
code and explain a change, you ask Junie to *use* the app and prove the change
is real on screen.

> Alias: `/test` does exactly the same thing.

## Prerequisites

`/demo` requires:

* **Docker running on your machine.** This is the most important prerequisite —
  the demo VM is a Docker container, and `/demo` will not start without a
  working Docker daemon. If `docker ps` doesn't work in your terminal,
  `/demo` won't work either. Start Docker Desktop before running `/demo`.
* **A model with Computer Use support.** Right now only **GPT‑5.4 and newer**
  (GPT‑5.4, GPT‑5.5) are supported. More models will be added later as
  Computer Use becomes available on them. If your active model doesn't
  qualify, `/demo` refuses to start and shows the supported list. See
  [Junie CLI Model selection](Junie-CLI-Model-selection.md).
* **A demo VM image** at `.junie/vms/<name>/Dockerfile`, layered on top of
  the base image `registry.jetbrains.team/p/junie-cli/containers/demo-base:1`.
  The base is Debian bookworm and ships Chromium, Node.js, xterm, ffmpeg,
  xdotool, screenshot tooling and a headless Xvfb desktop with a window
  manager — everything Computer Use needs to drive a desktop or web app.
  The first time `/demo` runs in a project with no VM template, Junie
  seeds a starter one for you — see [First-run setup](#first-run-setup).
  Add the runtimes your app needs on top, as shown in
  [Customizing the demo](#customizing-the-demo).

## Quick start

You have two ways to set up `/demo` for a project: **author the files by
hand** as shown below, or **skip authoring** and let `/demo` create
starter versions for you on the first run (see
[First-run setup](#first-run-setup)).

For projects that need anything beyond "open a browser at localhost", you'll
typically set up three things in your repo:

1. **A custom image on top of `demo-base`.** Create
   `.junie/vms/<your-vm>/Dockerfile` that starts with
   `FROM registry.jetbrains.team/p/junie-cli/containers/demo-base:1` and adds
   the runtimes your app needs (JDK, Node, Python, system packages…). The
   base already handles the display stack — don't reinstall it.

   Node example:

   ```dockerfile
   # .junie/vms/node-vm/Dockerfile
   FROM registry.jetbrains.team/p/junie-cli/containers/demo-base:1
   RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm
   ```

   Python example:

   ```dockerfile
   # .junie/vms/python-vm/Dockerfile
   FROM registry.jetbrains.team/p/junie-cli/containers/demo-base:1
   RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip
   ```

2. **Mounts (optional).** The project root is always mounted at `/workspace`
   automatically — you don't need to configure that. For extra bind mounts
   (host credentials, fixture data, prebuilt artifacts on the host), create
   a text file at `.junie/vms/<your-vm>/mounts` (no extension, **not a
   directory**) with one mount per line:

   ```text
   # <hostPath>:<guestPath>[:ro|:rw]
   # $HOME and ${HOME} are expanded from the environment.
   # Lines starting with # are ignored.
   $HOME/.config/my-app:/root/.config/my-app:ro
   /tmp/my-fixtures:/workspace/fixtures
   ```

   Missing host paths are skipped with a warning — Junie won't refuse to
   start the VM because of a stale mount line.

3. **A `.junie/demo.md` file** telling the agent which VM to use and how to
   build/launch the app. The **`vm:` value must match the subdirectory name
   you created in step 1** — that's how Junie binds the file to your
   Dockerfile.

   Node project — `vm: node-vm` matches `.junie/vms/node-vm/`:

   ```markdown
   # My web app

   vm: node-vm

   ## Build inside the VM
       npm install && npm run build

   ## Launch
       npm run start &
       # ready when http://localhost:3000 responds 200
   ```

   Python project — `vm: python-vm` matches `.junie/vms/python-vm/`:

   ```markdown
   # My Python app

   vm: python-vm

   ## Build inside the VM
       pip install -r requirements.txt

   ## Launch
       python app.py &
       # ready when http://localhost:5000 responds 200
   ```

   Shortcut: if you only ever need one VM, you can skip the subdirectory and
   put the Dockerfile straight at `.junie/vms/Dockerfile`. Then reference it
   in `.junie/demo.md` as `vm: default`.

Now `/demo` will pick up your custom image, mounts, and launch instructions
automatically.

## Basic usage

The syntax is:

```text
/demo [what to demo]
```

The argument is free‑form natural language describing what you want to see.
Everything after `/demo ` is passed to the demo agent verbatim.

### With no arguments

```text
/demo
```

If you don't pass anything, `/demo` **picks up the previous context of the
current session automatically** — the messages you exchanged, the files
Junie touched, the task it just finished. You don't have to repeat what was
done; the demo agent already sees it. Junie then demos whatever stands out
from that history. If nothing stands out — for example you've just opened
a fresh project — Junie demos the app's main functionality.

This is the most common way to use `/demo`: you've just had Junie implement
or fix something, and you want to *see* it working before you commit. Just
type `/demo` and hit Enter.

### With a specific request

```text
/demo show the new dark-theme toggle in Settings
/demo open the search dialog and find 'TODO'
/demo log in as user@example.com and open the profile page
```

The more concrete the request, the tighter the demo. A request like
`/demo show X` is treated as self‑contained — Junie won't go hunting through
git history to find unrelated context.

### Demoing a specific feature from scratch

```text
/demo the file-tree drag-and-drop in the sidebar
```

When you want a demo of an existing feature (not a recent change), name the
feature explicitly. Junie will resolve how to reach it (menu item, hotkey,
URL, etc.) and walk through it.

## What happens when you run `/demo`

A `/demo` run goes through four phases. Knowing the phases helps you interpret
what's on screen at any moment.

### 1. Plan

Before any VM starts, Junie writes a short **visible demo plan** —
an ordered list of user‑visible milestones, e.g.:

```text
1. Launch the app — main window shows the file tree.
2. Open Settings via the gear icon — Settings dialog appears.
3. Toggle "Dark theme" — UI re-renders in dark colors.
4. Close Settings — main window remains in dark mode.
```

The plan is your contract with the agent. If a step looks wrong, interrupt
with <kbd>Esc</kbd> and adjust the request before the VM starts.

### 2. Build and launch

Junie:

1. (Optionally) builds artifacts on **your host machine** — but only if
   `.junie/demo.md` explicitly asks for it. By default nothing is built on the
   host.
2. Starts the VM (`vm_start`). Your project root is mounted at `/workspace`
   inside it.
3. Builds the project inside the VM (commands come from `.junie/demo.md`
   if present, otherwise Junie figures them out).
4. Launches the app in the background and waits for it to be ready
   (health endpoint, log line, or just a visual wait).

A blank screen right after `vm_start` is normal — the app hasn't started yet.

### 3. Demonstrate

Junie drives the running app via Computer Use: clicks, keystrokes,
screenshots. The TUI shows a `Working… esc to stop` indicator while the agent
is acting. Each action is followed by an automatic screenshot, so you'll see
the run progress step by step.

If a visual attempt fails 2–3 times and Junie can't figure out the next step
from the screen, it falls back to **targeted code lookups** (grep + open
file). This is allowed but rare — the primary source of truth is the running
app, not the source code.

### 4. Finish

Junie shuts down the VM (`vm_stop`) and writes a structured Markdown report
with two main sections:

* **What has been tested** — the steps that ran and what was visible.
* **Result** — pass / fail / partial, plus any issues spotted.

The screenshots, video, and HTML report from the run are saved alongside
the session — see [Output artifacts](#output-artifacts) for the exact paths.

## Stopping a demo

* Press <kbd>Esc</kbd> while the `Working…` indicator is visible to interrupt
  the agent. The VM is shut down cleanly.
* The agent won't launch the VM twice in one session unless you explicitly
  ask.

## Output artifacts

After a `/demo` run finishes, you get a folder of artifacts on disk that you
can share, attach to a PR, or rewatch later. They live under your Junie home
directory, grouped by session:

```text
~/.junie/sessions/<session-id>/demo/
├── screenshots/         PNG screenshots captured during the run
│   └── shot_20260520_120005_000.png …
├── demo.mp4             screen recording of the VM (if recording finished)
├── captions.vtt         caption track aligned to the video
└── report.html          self-contained HTML report
```

What each one contains:

* **`report.html`** — the main artifact. A single self-contained page with the
  user request, the agent's Markdown answer ('What has been tested' + result),
  the embedded video, and the screenshots inline. This is what you usually
  attach to a PR or send to a teammate.
* **`demo.mp4`** — the screen recording. Only present if the recorder
  started and was stopped cleanly before VM teardown. Embedded inside
  `report.html` too.
* **`captions.vtt`** — WebVTT caption track generated from screenshot
  timestamps. Used by `report.html` to label moments in the video.
* **`screenshots/`** — every screenshot Computer Use took during the run,
  one PNG per `computer` call.

The Markdown answer the agent shows in the TUI is **not written to a
separate file** — it lives in the session transcript and inside
`report.html`. If you want the raw text, copy it from the TUI or open the
report.

**Persistence:** artifacts are kept across sessions — nothing is auto-cleaned.
If you want them gone, delete the session folder under `~/.junie/sessions/`
manually.

## Customizing the demo

`.junie/demo.md` tells the demo agent project‑specific build and launch
commands. Use it when 'how to start the app' isn't obvious from the source
tree. The [Quick start](#quick-start) above shows the basic structure; this
section lists the kinds of things you can usefully put inside.

Common things to put in `.junie/demo.md`:

* **`vm: <name>`** — required. The agent passes this value to `vm_start` as
  the template name, and the action fails if it's missing. The name must
  resolve to a Dockerfile under `.junie/vms/`: either a subdirectory
  (`.junie/vms/<name>/Dockerfile`) or the literal value `default` for the
  top-level `.junie/vms/Dockerfile`.
* The exact build command(s) to run inside the VM.
* The launch command — always background it (`&` or `nohup … &`).
* A health check Junie can wait on before interacting with the UI.
* Whether the jar/binary should be built on the host first (and the exact
  `bash` command to do it — Junie will only run it if you explicitly ask).

## First-run setup

If you haven't configured `/demo` for this project yet — meaning no
`.junie/vms/<name>/Dockerfile` exists — the first run won't start a real
demo. Instead, Junie seeds a starter configuration for you and aborts with
a chat message asking you to fill it in. Two files appear in your project:

### What gets seeded

* **`.junie/demo.md`** — the project-level guide that tells the demo agent
  which VM to use and how to launch your app. The file is free-form
  Markdown; the agent reads it as instructions before doing anything. Two
  things in it are essential:

    - **`vm:`** — the name of a subdirectory under `.junie/vms/`. The
      seeded file already has `vm: template-vm` wired up.
    - **The launch command** — how to start your app inside the VM. Goes
      under the `## Running inside the VM` section.

  Everything else is optional. Useful things to grow `demo.md` with later
  include: host-side build steps you want Junie to run, environment
  variables, test users, known quirks, or links to other docs.

* **`.junie/vms/template-vm/Dockerfile`** — the VM image. Extends
  `registry.jetbrains.team/p/junie-cli/containers/demo-base:1` — see
  [Prerequisites](#prerequisites) for what the base ships. Add the apt
  packages and language runtimes your app needs on top.

### After editing

Once both files are filled in, re-run `/demo`. Junie will pick up the new
VM template and start a real demo run. The seed only fires when no VM
template exists yet — once `.junie/vms/` has any Dockerfile, your
configuration is treated as authoritative and Junie leaves it alone.

If you mess something up and want to start over, delete `.junie/vms/`
(and optionally `.junie/demo.md`) and re-run `/demo` — the seed will fire
again.

> **Note:** the seeded `demo.md` carries explanatory HTML comments at the
> top describing what each section is for. Once your file is in good
> shape, delete those comments so the agent context isn't bloated by
> generator boilerplate it doesn't need.

If you'd rather author `.junie/demo.md` and the Dockerfile from scratch
without using the seeded starter, just create them yourself before the
first `/demo` run — the seed only fires when nothing is there.

## Multiple VM templates in one project

`.junie/vms/` is a directory — you can put **as many VM subdirectories
under it as you want**, each with its own Dockerfile (and optionally its
own `mounts` file). A typical layout for a project that ships several
VMs side by side:

```text
.junie/
├── demo.md
└── vms/
    ├── backend-vm/
    │   ├── Dockerfile
    │   └── mounts
    ├── frontend-vm/
    │   └── Dockerfile
    └── cli-vm/
        └── Dockerfile
```

All templates discovered under `.junie/vms/` are listed to the demo agent
on every `/demo` run, so it can pick the right one according to the
instructions in `.junie/demo.md`.

## Examples

### Verify a fix you just made

```text
> fix the bug where the search box loses focus after typing one character
…Junie edits files, runs tests…
> /demo
```

Junie picks up the change from the current session, opens the search box,
types several characters, and shows that focus stays.

### Demo a feature in a fresh repo

```text
/demo open the project, run the example notebook, show the chart it produces
```

Useful for onboarding videos or PR descriptions.

### Compare a 'before / after' change

```text
> /demo show the old behavior, then the new behavior of the export button
```

If the session history doesn't contain a clear "before" state, Junie will
note that in the report instead of inventing one.

## Troubleshooting

**'Demo agent requires access to a model with computer use support…'**
: Your active model isn't on the supported list. Today that list is
GPT‑5.4 and GPT‑5.5; more models will land later. Switch via
[Junie CLI Model selection](Junie-CLI-Model-selection.md).

**The VM starts but the screen stays blank**
: Normal in the first few seconds after `vm_start`. If it persists, the app
probably failed to launch — check `.junie/demo.md` for the right build/launch
commands, or add a health check Junie can wait on.

**Junie keeps reading source files instead of clicking**
: This usually means the entry path (how to reach the feature) isn't obvious.
Tell Junie directly in the request: `/demo open Settings via Cmd+, and toggle X`.

**`/demo` is disabled / greyed out**
: Either Docker isn't running, or no Computer Use model is available for
your account.

## Related

* [Slash commands](Slash-commands.md) — full list of slash commands.
* [Junie CLI Model selection](Junie-CLI-Model-selection.md) — picking a model
  that supports Computer Use.

### Reference

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

### Junie CLI: What is stored on the user's disk

# Junie CLI: What is stored on the user's disk

This document describes what data the `junie` CLI stores on the user's disk, where it is stored, and what it is used for.

## Base `junieHome` directory

The main user directory for the CLI is `junieHome`.

The path is resolved in this order:

1. the `JUNIE_HOME` environment variable
2. the `junie.home` system property
3. the default directory `~/.junie`

Examples:

- macOS / Linux: `~/.junie`
- Windows: `%USERPROFILE%/.junie`

## What is stored inside `junieHome`

### `logs/`

Directory for CLI logs. It is created when the application starts.

### `settings.json`

File with CLI user settings.

At the moment, it stores values such as:

- `braveMode`
- `modelForLaunch`
- `selectedTheme`
- `sessionCount`
- `junieId`
- `shareAnonymousStatistics`

Format: JSON.

### `sessions/`

Directory with saved CLI sessions.

Structure:

- `sessions/index.jsonl` — session index, one JSON record per line
- `sessions/<sessionId>/events.jsonl` — session event stream
- `sessions/<sessionId>/state.json` — latest saved agent state

Notes:

- some environment variables inside `state.json` and state events are encrypted through `EnvEncryptionService`
- the index and events are used to restore the history and state of interactive sessions

Format:

- `index.jsonl` and `events.jsonl` — JSONL
- `state.json` — JSON

### `misc/`

Directory for small internal CLI files.

Here, `junie` stores small internal files as separate key-based entries.

#### `misc/config_hashes.json`

Hashes of local custom skill configurations.

Used to track new, updated, and problematic local skill file configurations.

#### `misc/migration_state.json`

Migration state for user and project settings imported from other products.

Contains the list of already processed projects.

### `secure_credentials.json`

Fallback secret storage file.

It is used only when system secure storage is unavailable:

- macOS Keychain
- Windows Credential Manager
- Linux Secret Service

If fallback storage is enabled, secrets are stored in this file as JSON.

This is sensitive data.

### `mcp/mcp.json`

User MCP server configuration.

### `declined_mcps.json`

List of MCP servers declined by the user.

Format: JSON.

### `models/`

Custom user model profiles.

The CLI scans this directory for `*.json` files and loads model profiles from them.

### `agent-skills/`

User agent skills.

The CLI reads skills from:

- `<project>/.junie/agent-skills`
- `<junieHome>/agent-skills`

User files inside `junieHome` are stored in this directory.

## What may be stored outside `junieHome`

### `<project>/.junie/mcp/mcp.json`

Project-level MCP configuration.

It belongs to a specific project rather than global user state.

### `<project>/.junie/models`

Project-level custom model profiles.

These take priority over user profiles from `<junieHome>/models`.

## Short summary

If you only look at the CLI's global user data, the main locations are:

- `~/.junie/settings.json`
- `~/.junie/sessions/`
- `~/.junie/logs/`
- `~/.junie/misc/`
- `~/.junie/mcp/mcp.json`
- `~/.junie/declined_mcps.json`
- `~/.junie/models/`
- `~/.junie/agent-skills/`
- `~/.junie/secure_credentials.json` — only if system secure storage is unavailable

The most sensitive locations are:

- `secure_credentials.json`, if fallback storage is used
- the contents of `sessions/`, because they may contain work history and agent state
- user model profiles in `models/`, if they contain keys or custom headers


