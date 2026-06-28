import type { CommandModule } from "yargs"
import { getHistoryItems, searchHistory, filterHistory, sortHistory, getHistoryStats, getRecentItems, getTopItems, getUniqueItems, deduplicateHistory, removeFromHistory, removeByUrl, clearHistory } from "../../db/history"

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
      }),
  handler: (argv) => {
    const items = getHistoryItems(argv.limit as number, argv.offset as number)
    console.log(JSON.stringify(items, null, 2))
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
