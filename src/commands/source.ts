import { existsSync, statSync } from "fs"
import { homedir } from "os"
import { isAbsolute, resolve } from "path"

export interface SourceValue {
  value: string
  kind: "url" | "file"
}

export function isLikelyUrl(input: string): boolean {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) return true
  if (input.startsWith("www.")) return true
  if (input.includes("youtube.com/") || input.includes("youtu.be/")) return true
  return false
}

function expandHome(input: string): string {
  if (input === "~") return homedir()
  if (input.startsWith("~/")) return `${homedir()}/${input.slice(2)}`
  return input
}

export function resolvePlayableSource(input: string): SourceValue {
  if (isLikelyUrl(input)) {
    return { value: input, kind: "url" }
  }

  const expanded = expandHome(input)
  const candidate = isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded)

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return { value: candidate, kind: "file" }
  }

  return { value: input, kind: "url" }
}

