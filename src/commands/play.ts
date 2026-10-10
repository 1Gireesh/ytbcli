import type { CommandModule } from "yargs"
import { readFileSync } from "fs"
import { withClient, syncQueueToMpv } from "./playback"
import { MpvClient, commands as mpv } from "../mpv"
import { add, clear, list, setCurrent } from "../db/queue"
import { getRepeatMode } from "../db/playback"
import { addToHistory } from "../db/history"
import { getVideoInfo, type SearchResult } from "../ytdlp"
import { getSearchCachePath } from "./search"

export interface SearchCache {
  query?: string
  timestamp?: number
  results: SearchResult[]
}

export function loadSearchCache(): SearchCache | null {
  const cachePath = getSearchCachePath()
  try {
    const raw = JSON.parse(readFileSync(cachePath, "utf-8"))
    if (Array.isArray(raw)) {
      return { results: raw }
    }
    return {
      query: raw.query,
      timestamp: raw.timestamp,
      results: raw.results || [],
    }
  } catch {
    return null
  }
}

async function playSingle(url: string, video: boolean): Promise<void> {
  const items = list()
  let currentItem = items.find(i => i.url === url)
  if (!currentItem) {
    currentItem = add(url)
  }
  setCurrent(currentItem.id)

  await withClient(async (client: MpvClient) => {
    await syncQueueToMpv(client, url, video)
  })
}

export function computeDurationSecs(duration: string): number | undefined {
  const parts = duration.split(":").map(Number)
  if (parts.length === 2 && parts[0] !== undefined && parts[1] !== undefined) return parts[0] * 60 + parts[1]
  if (parts.length === 3 && parts[0] !== undefined && parts[1] !== undefined && parts[2] !== undefined) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return undefined
}

export function isVideoID(s: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(s)
}

const command: CommandModule = {
  command: "play <target>",
  describe: "Play a URL or search result number",
  builder: (yargs) =>
    yargs
      .positional("target", {
        description: "URL or search result number",
        type: "string",
      })
      .option("video", {
        description: "Play with video (default: audio only)",
        type: "boolean",
        default: false,
        alias: "v",
      })
      .option("keep-queue", {
        description: "Play single item without clearing or appending to the queue",
        type: "boolean",
        default: false,
      }),
  handler: async (argv) => {
    const target = argv.target as string
    const video = !!argv.video
    const keepQueue = !!argv.keepQueue

    // 11-char IDs are video IDs, not search indexes
    const looksLikeVideoID = /^[a-zA-Z0-9_-]{11}$/.test(target)
    const isNumber = /^\d+$/.test(target) && (target.length !== 11 || !looksLikeVideoID)

    let selected: SearchResult
    let others: SearchResult[] = []
    let cacheQuery: string | undefined

    if (isNumber) {
      const index = parseInt(target) - 1
      const cache = loadSearchCache()
      const cached = cache?.results || []

      if (!cache || cached.length === 0) {
        console.error("No search results. Run: ytcli search <query>")
        process.exit(1)
      }

      if (index < 0 || index >= cached.length) {
        console.error(`Invalid number. Choose 1-${cached.length}`)
        process.exit(1)
      }

      cacheQuery = cache.query
      const hit = cached[index]
      if (!hit) {
        console.error(`Invalid number. Choose 1-${cached.length}`)
        process.exit(1)
      }
      selected = hit
      if (!keepQueue) {
        others = cached.filter((_, i) => i !== index)
      }
    } else {
      selected = {
        id: "",
        title: argv.title as string || "",
        channel: argv.channel as string || "",
        duration: "",
        url: isVideoID(target) ? `https://youtu.be/${target}` : target,
      }

      const info = await getVideoInfo(selected.url)
      if (info) {
        selected.title = info.title
        selected.channel = info.channel
        selected.duration = info.duration
      }
    }

    // play <url> and play <n> --keep-queue both leave the queue untouched
    if (!isNumber || keepQueue) {
      await playSingle(selected.url, video)

      addToHistory(selected.url, selected.title, selected.channel, computeDurationSecs(selected.duration))

      console.log(`Playing: ${selected.title}${cacheQuery ? ` (from search "${cacheQuery}")` : ""}`)
      if (keepQueue) {
        console.log("Queue left intact (--keep-queue)")
      }
      return
    }

    // play <n> (default): replace queue with selected + other results
    clear()

    add(selected.url, selected.title, selected.channel)

    for (const item of others) {
      add(item.url, item.title, item.channel)
    }

    const items = list()
    const currentItem = items.find(i => i.url === selected.url)
    if (currentItem) {
      setCurrent(currentItem.id)
    }

    await withClient(async (client) => {
      await syncQueueToMpv(client, selected.url, video)
    })

    addToHistory(selected.url, selected.title, selected.channel, computeDurationSecs(selected.duration))

    console.log(`Playing: ${selected.title}${cacheQuery ? ` (from search "${cacheQuery}")` : ""}`)
    if (others.length > 0) {
      console.log(`${others.length} items queued`)
    }
  },
}

export default command
