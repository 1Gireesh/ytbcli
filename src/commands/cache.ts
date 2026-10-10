import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"

export const HISTORY_CACHE_PATH = "/tmp/ytcli-history.json"
export const PLAYLIST_CACHE_PATH = "/tmp/ytcli-playlist.json"

export function writeJsonCache(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2))
}

export function readJsonCache<T>(path: string): T | null {
  try {
    const content = readFileSync(path, "utf-8")
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

export function playlistCacheId(name: string): string {
  return createHash("sha1").update(name).digest("hex")
}
