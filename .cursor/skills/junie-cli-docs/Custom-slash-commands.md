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
