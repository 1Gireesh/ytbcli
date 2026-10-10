import type { CommandModule } from "yargs"
import { addToHistory, getHistoryItems, searchHistory, filterHistory, sortHistory, getHistoryStats, getRecentItems, getTopItems, getUniqueItems, deduplicateHistory, removeFromHistory, removeByUrl, clearHistory, type HistoryItem } from "../../db/history"
import { withClient } from "../playback"
import { commands as mpv } from "../../mpv"
import { add as addToQueue, clear as clearQueue, setCurrent } from "../../db/queue"
import { getRepeatMode } from "../../db/playback"
import { HISTORY_CACHE_PATH, readJsonCache, writeJsonCache } from "../cache"

function writeHistoryCache(items: HistoryItem[]): void {
  writeJsonCache(HISTORY_CACHE_PATH, items)
}

function printHistoryBrowse(items: HistoryItem[]): void {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    console.log(`${i + 1}. ${item.title || item.url}`)
    console.log(`   ${item.channel || "Unknown"}`)
    console.log(`   ${item.url}`)
    console.log()
  }
}

export const listCmd: CommandModule = {
  command: "list",
  describe: "List play history",
  builder: (yargs) =>
    yargs
      .option("limit", {
        description: "Limit number of results",
        type: "number",
        default: 50,
      })
      .option("offset", {
        description: "Offset for pagination",
        type: "number",
        default: 0,
      })
      .option("plain", {
        description: "Output as: index<TAB>title-or-url<TAB>channel",
        type: "boolean",
        default: false,
      }),
  handler: (argv) => {
    const items = getHistoryItems(argv.limit as number, argv.offset as number)
    writeHistoryCache(items)
    if (argv.plain) {
      for (let i = 0; i < items.length; i++) {
        console.log(`${i + 1}\t${items[i].title || items[i].url}\t${items[i].channel || ""}`)
      }
      return
    }
    console.log(JSON.stringify(items, null, 2))
  },
}

export const browseCmd: CommandModule = {
  command: "browse [count]",
  describe: "Browse recent history with numbers (for quick play by number)",
  builder: (yargs) =>
    yargs.positional("count", {
      description: "Number of history items to browse",
      type: "number",
      default: 20,
    }),
  handler: (argv) => {
    const items = getHistoryItems(argv.count as number, 0)
    if (items.length === 0) {
      console.log("History is empty")
      return
    }
    writeHistoryCache(items)
    printHistoryBrowse(items)
    console.log("Play any result: ytcli history play <number>")
  },
}

export const searchCmd: CommandModule = {
  command: "search <query>",
  describe: "Search within play history",
  builder: (yargs) =>
    yargs.positional("query", {
      description: "Search query",
      type: "string",
    }),
  handler: (argv) => {
    const items = searchHistory(argv.query as string)
    console.log(JSON.stringify(items, null, 2))
  },
}

export const filterCmd: CommandModule = {
  command: "filter <query>",
  describe: "Filter history by query",
  builder: (yargs) =>
    yargs
      .positional("query", {
        description: "Filter query",
        type: "string",
      })
      .option("field", {
        description: "Field to filter on",
        type: "string",
        choices: ["title", "url", "channel", "all"],
        default: "all",
      }),
  handler: (argv) => {
    const items = filterHistory(argv.query as string, argv.field as "title" | "url" | "channel" | "all")
    console.log(JSON.stringify(items, null, 2))
  },
}

export const infoCmd: CommandModule = {
  command: "info",
  describe: "Show history statistics",
  handler: () => {
    const stats = getHistoryStats()
    console.log(JSON.stringify(stats, null, 2))
  },
}

export const recentCmd: CommandModule = {
  command: "recent [count]",
  describe: "Show recently played videos",
  builder: (yargs) =>
    yargs.positional("count", {
      description: "Number of recent items",
      type: "number",
      default: 10,
    }),
  handler: (argv) => {
    const items = getRecentItems(argv.count as number)
    console.log(JSON.stringify(items, null, 2))
  },
}

export const removeCmd: CommandModule = {
  command: "remove <index>",
  describe: "Remove a specific history entry",
  builder: (yargs) =>
    yargs.positional("index", {
      description: "History index to remove",
      type: "number",
    }),
  handler: (argv) => {
    const result = removeFromHistory(argv.index as number)
    console.log(result ? "Removed" : "Not found")
  },
}

export const removeUrlCmd: CommandModule = {
  command: "remove-url <url>",
  describe: "Remove all entries with a specific URL",
  builder: (yargs) =>
    yargs.positional("url", {
      description: "URL to remove from history",
      type: "string",
    }),
  handler: (argv) => {
    const count = removeByUrl(argv.url as string)
    console.log(`Removed ${count} entries`)
  },
}

export const clearCmd: CommandModule = {
  command: "clear",
  describe: "Clear all play history",
  builder: (yargs) =>
    yargs.option("older-than", {
      description: "Clear entries older than N days",
      type: "number",
    }),
  handler: (argv) => {
    const count = clearHistory(argv["older-than"] as number | undefined)
    console.log(`Cleared ${count} entries`)
  },
}

export const sortCmd: CommandModule = {
  command: "sort <by>",
  describe: "Sort history by criteria",
  builder: (yargs) =>
    yargs.positional("by", {
      description: "Sort by: date, title, url, channel",
      type: "string",
      choices: ["date", "title", "url", "channel"],
    }),
  handler: (argv) => {
    const items = sortHistory(argv.by as "date" | "title" | "url" | "channel")
    console.log(JSON.stringify(items, null, 2))
  },
}

export const statsCmd: CommandModule = {
  command: "stats",
  describe: "Show detailed history statistics",
  handler: () => {
    const stats = getHistoryStats()
    console.log(JSON.stringify(stats, null, 2))
  },
}

export const channelsCmd: CommandModule = {
  command: "channels",
  describe: "List unique channels in history",
  handler: () => {
    const stats = getHistoryStats()
    console.log(JSON.stringify(stats.channels, null, 2))
  },
}

export const topCmd: CommandModule = {
  command: "top [count]",
  describe: "Show most played videos",
  builder: (yargs) =>
    yargs.positional("count", {
      description: "Number of top items",
      type: "number",
      default: 10,
    }),
  handler: (argv) => {
    const items = getTopItems(argv.count as number)
    console.log(JSON.stringify(items, null, 2))
  },
}

export const uniqueCmd: CommandModule = {
  command: "unique",
  describe: "Show unique videos from history",
  handler: () => {
    const items = getUniqueItems()
    console.log(JSON.stringify(items, null, 2))
  },
}

export const deduplicateCmd: CommandModule = {
  command: "deduplicate",
  describe: "Remove duplicate entries from history",
  handler: () => {
    const removed = deduplicateHistory()
    console.log(`Removed ${removed} duplicates`)
  },
}

export const playCmd: CommandModule = {
  command: "play <index>",
  describe: "Play a specific history entry (1-based index from history list)",
  builder: (yargs) =>
    yargs
      .positional("index", {
        description: "History item number (1-based)",
        type: "number",
      })
      .option("limit", {
        description: "History window size used for index lookup",
        type: "number",
        default: 50,
      })
      .option("offset", {
        description: "History offset used for index lookup",
        type: "number",
        default: 0,
      })
      .option("video", {
        description: "Play with video (default: audio only)",
        type: "boolean",
        default: false,
        alias: "v",
      })
      .option("cache", {
        description: "Use last history browse/list cache for index lookup",
        type: "boolean",
        default: true,
      }),
  handler: async (argv) => {
    const cached = argv.cache ? readJsonCache<HistoryItem[]>(HISTORY_CACHE_PATH) : null
    const items = cached && cached.length > 0
      ? cached
      : getHistoryItems(argv.limit as number, argv.offset as number)
    const index = Math.max((argv.index as number) - 1, 0)
    const target = items[index]

    if (!target) {
      console.log(`Invalid history index. Choose 1-${items.length}`)
      return
    }

    clearQueue()
    const queueItem = addToQueue(target.url, target.title || undefined, target.channel || undefined, target.duration || undefined)
    for (let i = 0; i < items.length; i++) {
      if (i !== index) {
        const item = items[i]
        addToQueue(item.url, item.title || undefined, item.channel || undefined, item.duration || undefined)
      }
    }
    setCurrent(queueItem.id)

    await withClient(async (client) => {
      await mpv.playlistClear(client)
      await mpv.play(client, target.url)
      for (let i = 0; i < items.length; i++) {
        if (i !== index) {
          await mpv.append(client, items[i].url)
        }
      }
      await mpv.setVideoEnabled(client, !!argv.video)
      await mpv.setRepeatMode(client, getRepeatMode())
      await mpv.unpause(client)
    })

    addToHistory(target.url, target.title || undefined, target.channel || undefined, target.duration || undefined)

    console.log(JSON.stringify(queueItem, null, 2))
  },
}
