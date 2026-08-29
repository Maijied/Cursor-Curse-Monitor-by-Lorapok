# Parse PR input

User commands use Azure DevOps title format:

```
Pull Request 16739: Fix client admin company and route access for API clients.
Pull Request 16775: `Namespace` Addition Into All `Exception`, `Provider` & `Trait` Files
```

Also accepted:

| Input | PR id |
|-------|-------|
| `https://dev.azure.com/Shohoz/ticket/_git/bus/pullrequest/16739` | 16739 |
| `16739` | 16739 |
| `PR 16739` | 16739 |

Script: `.cursor/skills/pr-review/scripts/parse-pr-id.sh "<full user string>"`

Cache key is always `pr-{id}` regardless of title text.
