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
