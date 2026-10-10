export function parseSelection(selection: string, max: number): number[] {
  if (selection === "all") {
    return Array.from({ length: max }, (_, i) => i)
  }

  const result = new Set<number>()
  const parts = selection.split(",").map((p) => p.trim()).filter(Boolean)
  for (const part of parts) {
    if (part.includes("-")) {
      const [startRaw, endRaw] = part.split("-")
      const start = Number.parseInt(startRaw, 10)
      const end = Number.parseInt(endRaw, 10)
      if (Number.isNaN(start) || Number.isNaN(end) || start < 1 || end < 1) {
        throw new Error(`Invalid range: ${part}`)
      }
      const lo = Math.min(start, end)
      const hi = Math.max(start, end)
      for (let i = lo; i <= hi; i++) {
        if (i <= max) result.add(i - 1)
      }
      continue
    }

    const index = Number.parseInt(part, 10)
    if (Number.isNaN(index) || index < 1) {
      throw new Error(`Invalid index: ${part}`)
    }
    if (index <= max) result.add(index - 1)
  }

  return Array.from(result).sort((a, b) => a - b)
}

export function pickSelectedItems<T>(items: T[], selection?: string): T[] {
  if (items.length === 0) return []
  const indexes = parseSelection(selection || "all", items.length)
  return indexes.map((i) => items[i]).filter(Boolean)
}

export function pickRandomItems<T>(items: T[], count?: number): T[] {
  if (!count || count <= 0 || items.length === 0) return items
  if (count >= items.length) return [...items]

  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

