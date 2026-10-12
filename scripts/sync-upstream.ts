#!/usr/bin/env bun
// Vendors plugin content from anthropics/knowledge-work-plugins into content/.
//
// The one transformation we apply is namespacing skill directories
// (skills/call-prep -> skills/sales-call-prep). Skill IDs are derived from the
// directory name, and 15 skill names collide across plugins upstream, where the
// later plugin silently wins. Namespacing makes that impossible.
//
// Run: bun run sync

import { execFileSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const CONTENT = join(ROOT, "content")
const UPSTREAM = "https://github.com/anthropics/knowledge-work-plugins"
const CHECKOUT = join(ROOT, ".upstream")

// Excluded because they are not knowledge-work content: partner-built is mostly
// app-development skills (ios/web/android repeated four times each), and
// cowork-plugin-management teaches authoring Claude Cowork plugins.
const EXCLUDE = new Set(["partner-built", "cowork-plugin-management"])

function sh(cmd: string, args: string[]) {
  return execFileSync(cmd, args, { encoding: "utf8" }).trim()
}

console.log("Fetching upstream...")
if (existsSync(CHECKOUT)) {
  sh("git", ["-C", CHECKOUT, "fetch", "--depth", "1", "origin", "main"])
  sh("git", ["-C", CHECKOUT, "checkout", "--force", "FETCH_HEAD"])
} else {
  sh("git", ["clone", "--depth", "1", UPSTREAM, CHECKOUT])
}
const sha = sh("git", ["-C", CHECKOUT, "rev-parse", "HEAD"])
console.log(`  upstream ${sha.slice(0, 12)}`)

rmSync(CONTENT, { recursive: true, force: true })
mkdirSync(CONTENT, { recursive: true })

const plugins = readdirSync(CHECKOUT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !EXCLUDE.has(e.name))
  .map((e) => e.name)
  .sort()

const manifest: Record<string, { skills: number; commands: number; servers: number }> = {}
let totalSkills = 0
let totalCommands = 0

for (const plugin of plugins) {
  const src = join(CHECKOUT, plugin)
  const dst = join(CONTENT, plugin)
  mkdirSync(dst, { recursive: true })

  // Skill directory names get the plugin prefix so IDs cannot collide.
  const skillsSrc = join(src, "skills")
  const skillsDst = join(dst, "skills")
  let skills = 0
  if (existsSync(skillsSrc)) {
    mkdirSync(skillsDst, { recursive: true })
    for (const entry of readdirSync(skillsSrc, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const skillSrc = join(skillsSrc, entry.name)
      if (!existsSync(join(skillSrc, "SKILL.md"))) continue
      cpSync(skillSrc, join(skillsDst, `${plugin}-${entry.name}`), { recursive: true })
      skills++
    }
    // Loose files at the skills root (shared references, for example).
    for (const entry of readdirSync(skillsSrc, { withFileTypes: true })) {
      if (entry.isFile()) cpSync(join(skillsSrc, entry.name), join(skillsDst, entry.name))
    }
  }

  // Commands keep upstream names; the README documents installing them under
  // ~/.config/opencode/commands/<plugin>/ for the /<plugin>/<name> slash form.
  let commands = 0
  const commandsSrc = join(src, "commands")
  if (existsSync(commandsSrc)) {
    cpSync(commandsSrc, join(dst, "commands"), { recursive: true })
    commands = readdirSync(commandsSrc).filter((f) => f.endsWith(".md")).length
  }

  for (const file of ["README.md", "CONNECTORS.md", ".mcp.json", "LICENSE"]) {
    const from = join(src, file)
    if (existsSync(from)) cpSync(from, join(dst, file))
  }

  let servers = 0
  const mcp = join(dst, ".mcp.json")
  if (existsSync(mcp)) {
    const parsed = JSON.parse(readFileSync(mcp, "utf8"))
    servers = Object.keys(parsed.mcpServers ?? {}).length
  }

  manifest[plugin] = { skills, commands, servers }
  totalSkills += skills
  totalCommands += commands
  console.log(`  ${plugin.padEnd(20)} ${skills} skills  ${commands} commands  ${servers} servers`)
}

writeFileSync(join(CONTENT, "manifest.json"), JSON.stringify({ upstream: UPSTREAM, sha, plugins: manifest }, null, 2) + "\n")
console.log(`\nVendored ${plugins.length} plugins, ${totalSkills} skills, ${totalCommands} commands`)