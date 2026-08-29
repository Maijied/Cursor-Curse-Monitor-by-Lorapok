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
