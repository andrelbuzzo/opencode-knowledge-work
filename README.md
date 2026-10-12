# opencode-knowledge-work

Anthropic's [knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)
collection, adapted to run as an OpenCode plugin.

Upstream ships 16 role-based plugins (sales, legal, finance, data, …) as Claude
Cowork / Claude Code plugin bundles. The content is plain markdown and JSON, so
porting it is mostly a packaging problem rather than a rewrite.

- **16 plugins, 179 skills, 5 slash commands**
- Skill IDs are namespaced per plugin, so nothing collides
- Plugins are opt-in, because advertising all 179 skill descriptions costs
  roughly 16k tokens on every model step

## Install

```sh
npm install opencode-knowledge-work
```

Or from a checkout:

```sh
opencode plugin add andrelbuzzo/opencode-knowledge-work
```

## Configure

Add it to `opencode.json`. Plugins are opt-in, so list the ones you want:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "opencode-knowledge-work",
      "options": {
        "plugins": ["engineering", "sales"]
      }
    }
  ]
}
```

### Options

| Value | Behaviour |
| --- | --- |
| omitted | defaults to `["engineering"]` |
| `["sales", "legal"]` | load exactly those |
| `["*"]` | load all 16 (expensive, see above) |
| `["*", "-small-business"]` | everything except one |

Unknown names log a warning with the available list rather than failing.

### Skill IDs

Skill IDs are `<plugin>-<skill>`, so `sales`'s `call-prep` is `sales-call-prep`.
Upstream has 15 skill names that appear in more than one plugin; without the
prefix the later plugin silently wins. Reference them with `@sales-call-prep`.

## Connectors

The plugins assume MCP connectors for the tools in each role. They are **not**
registered automatically — most need OAuth and you should only enable the ones
you use. Print the commands for a plugin:

```sh
bun run mcp sales     # from a checkout; prints opencode mcp add ... lines
```

Then run `/mcps` in OpenCode to sign in.

## Commands

Five plugins ship slash commands. OpenCode discovers commands as files, so copy
the ones you want into your config directory to get the `/<plugin>/<name>` form:

```sh
cp -r node_modules/opencode-knowledge-work/content/pdf-viewer/commands/pdf \
  ~/.config/opencode/commands/pdf
```

Then `/pdf/...` is available. Source for these lives in `content/<plugin>/commands`.

## What changed from upstream

1. **Skill directories are namespaced.** `skills/call-prep` becomes
   `skills/sales-call-prep`, applied by `scripts/sync-upstream.ts`.
2. **`partner-built` is excluded.** It is mostly app-development skills
   (`ios`, `web`, `android` repeated four times each), not knowledge work.
3. **`cowork-plugin-management` is excluded.** It teaches authoring Claude Cowork
   plugins, which is meaningless outside Cowork.

The skill and command bodies are otherwise unmodified. The upstream
`../../CONNECTORS.md` relative links already resolve correctly once the content
sits at `content/<plugin>/`, so no path rewriting is needed.

## Development

```sh
bun install
bun run sync        # re-vendor from upstream into content/
bun run check sales # load the plugin against a stub context, assert counts
bun run typecheck
```

`content/manifest.json` records the upstream commit that was vendored, so
`sync` is a one-command refresh. Pinning to one snapshot means upstream's
frequent commits cannot break you silently.

## Caveats

- Skills describe workflows that call connector tools. Without the matching MCP
  server connected, a skill will describe steps it cannot execute.
- Content is vendored, not live. Run `bun run sync` to pick up upstream changes,
  then review the diff.
- Several skills mention Claude by name in their prose. That is cosmetic, but
  the collection was written for a different agent and has not been rewritten
  for OpenCode's conventions.

## License

Apache-2.0. Plugin content is Copyright Anthropic, PBC, redistributed under the
same license. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).