#!/usr/bin/env bun
// Prints ready-to-run `opencode mcp add` commands for a plugin's connectors.
// Run: bun run mcp <plugin>
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const plugin = process.argv[2]

if (!plugin) {
  console.error("usage: bun run mcp <plugin>")
  const manifest = JSON.parse(readFileSync(join(ROOT, "content/manifest.json"), "utf8"))
  console.error("\nplugins: " + Object.keys(manifest.plugins).join(", "))
  process.exit(1)
}

const file = join(ROOT, "content", plugin, ".mcp.json")
if (!existsSync(file)) {
  console.error(`${plugin} has no .mcp.json`)
  process.exit(1)
}

const { mcpServers } = JSON.parse(readFileSync(file, "utf8"))
console.log(`# ${plugin} connectors. Add only the ones you actually use.\n`)

for (const [name, cfg] of Object.entries<Record<string, any>>(mcpServers)) {
  const id = name.replace(/\s+/g, "-")
  if (cfg.command) {
    console.log(`opencode mcp add ${id} -- ${[cfg.command, ...(cfg.args ?? [])].join(" ")}`)
  } else if (cfg.url) {
    console.log(`opencode mcp add ${id} --url ${cfg.url}`)
  } else {
    console.log(`# skipped ${id}: no url or command`)
  }
}
console.log("\n# then run /mcps in OpenCode to sign in.")