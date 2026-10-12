#!/usr/bin/env bun
// Loads the plugin against a stub context and reports what it would register.
// Run: bun run check [plugin ...]
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const manifest = JSON.parse(readFileSync(join(ROOT, "content/manifest.json"), "utf8"))

const added: { id: string; description?: string; path: string }[] = []
const stub = {
  options: { plugins: process.argv.slice(2) },
  app: { log: { warn: (m: string) => console.log("warn:", m) } },
  skill: {
    transform: async (cb: (e: { add: (s: unknown) => void }) => unknown) => {
      cb({ add: (s: unknown) => { added.push(s as (typeof added)[number]); return undefined } })
      return { dispose: async () => {} }
    },
  },
}

const mod = await import(join(ROOT, "index.ts"))
await mod.default.setup(stub as never)

console.log(`requested: ${JSON.stringify(stub.options.plugins)}`)
console.log(`registered ${added.length} skills`)

const perPlugin: Record<string, number> = {}
for (const s of added) {
  const plugin = s.path.split(/[\\/]/).at(-4)!
  perPlugin[plugin] = (perPlugin[plugin] ?? 0) + 1
  if (!s.id.startsWith(`${plugin}-`)) {
    console.error(`FAIL: ${s.id} is not namespaced with "${plugin}"`)
    process.exit(1)
  }
}
for (const [plugin, count] of Object.entries(perPlugin)) {
  const expected = manifest.plugins[plugin]?.skills
  const mark = expected === count ? "ok" : "MISMATCH"
  console.log(`  ${plugin.padEnd(20)} ${count} skills (manifest ${expected}) ${mark}`)
  if (expected !== count) process.exitCode = 1
}

const dupes = added.map((s) => s.id).filter((id, i, all) => all.indexOf(id) !== i)
if (dupes.length) {
  console.error(`FAIL: duplicate ids: ${[...new Set(dupes)].join(", ")}`)
  process.exit(1)
}
if (added.some((s) => !s.description)) {
  console.error("FAIL: a skill registered without a description (it will not be advertised)")
  process.exit(1)
}
if (!existsSync(join(ROOT, "content/sales/skills/sales-call-prep/SKILL.md"))) {
  console.error("FAIL: namespaced skill missing from content")
  process.exit(1)
}
console.log(process.exitCode ? "FAILED" : "OK")