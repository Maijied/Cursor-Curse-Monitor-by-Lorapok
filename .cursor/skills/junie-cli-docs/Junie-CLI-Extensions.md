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
