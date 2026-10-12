import { existsSync, readFileSync, readdirSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const CONTENT = resolve(dirname(fileURLToPath(import.meta.url)), "content")

type SkillEntry = { id: string; name: string; description: string; path: string; content: string }

// OpenCode's Plugin.define is `(plugin) => plugin`, so declaring the shape
// locally removes the only dependency. That matters: a dependency-free package
// loads from a bare clone or unpacked tarball, where OpenCode does not install
// deps for local-directory plugin specs.
type PluginContext = {
  options: Record<string, unknown>
  app: { log: { warn(message: string): void } }
  skill: { transform(cb: (editor: { add(skill: SkillEntry): void }) => void): Promise<unknown> }
}

function available(): string[] {
  if (!existsSync(CONTENT)) return []
  return readdirSync(CONTENT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(CONTENT, e.name, "skills")))
    .map((e) => e.name)
    .sort()
}

// Only `name` and `description` matter here, and both are single-line in every
// vendored SKILL.md. A YAML parser would be a dependency for nothing.
function frontmatter(raw: string): { name?: string; description?: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const out: { name?: string; description?: string } = {}
  for (const key of ["name", "description"] as const) {
    const line = match[1].match(new RegExp(`^${key}:\\s*(.+)$`, "m"))
    if (line) out[key] = line[1].trim().replace(/^["']|["']$/g, "")
  }
  return out
}

export default {
  id: "opencode.knowledge-work",

  async setup(ctx: PluginContext) {
    const all = available()
    if (all.length === 0) return

    // Every skill description is advertised to the model on every step. Loading
    // all 179 costs roughly 16k tokens per step, so selection is opt-in.
    const options: unknown[] = Array.isArray(ctx.options.plugins) ? ctx.options.plugins : ["engineering"]

    const wanted = new Set(options.filter((o): o is string => typeof o === "string" && o !== "*" && !o.startsWith("-")))
    const removed = new Set(options.filter((o): o is string => typeof o === "string" && o.startsWith("-")).map((o) => o.slice(1)))
    const selected = (options.includes("*") ? all : [...wanted].filter((n) => all.includes(n))).filter((n) => !removed.has(n))

    const unknown = [...wanted].filter((n) => !all.includes(n))
    if (unknown.length > 0) {
      ctx.app.log.warn(`opencode-knowledge-work: unknown plugin(s) ${unknown.join(", ")}; available: ${all.join(", ")}`)
    }

    const entries: SkillEntry[] = []
    for (const plugin of selected) {
      const skillsDir = join(CONTENT, plugin, "skills")
      for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
        const file = join(skillsDir, entry.name, "SKILL.md")
        if (!entry.isDirectory() || !existsSync(file)) continue
        const raw = readFileSync(file, "utf8")
        const meta = frontmatter(raw)
        if (!meta.description) continue
        entries.push({
          id: basename(entry.name), // namespaced by scripts/sync-upstream.ts
          name: meta.name ?? basename(entry.name),
          description: meta.description,
          path: file,
          content: raw,
        })
      }
    }

    await ctx.skill.transform((editor) => {
      for (const skill of entries) editor.add(skill)
    })
  },
}