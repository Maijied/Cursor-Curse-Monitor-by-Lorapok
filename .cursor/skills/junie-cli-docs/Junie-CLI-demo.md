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
