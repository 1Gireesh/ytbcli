import type { CommandModule } from "yargs"
import { add, remove, move, clear, list, current, next, prev, peek, getPosition, setPosition, setCurrent } from "../../db/queue"
import { getRepeatMode, isShuffleEnabled, setRepeatMode, setShuffleEnabled, type RepeatMode } from "../../db/playback"
import { addToHistory } from "../../db/history"
import { withClient, syncQueueToMpv } from "../playback"
import { commands as mpv } from "../../mpv"
import { loadSearchCache, computeDurationSecs, isVideoID } from "../play"
import { pickSelectedItems } from "../selection"
import { getVideoInfo } from "../../ytdlp"

export const addCmd: CommandModule = {
  command: "add <target> [title]",
  describe: "Add a video or search result(s) to the queue",
  builder: (yargs) =>
    yargs
      .positional("target", {
        description: "Video URL, video ID, or search result index/range (e.g. 1, 1-3, all)",
        type: "string",
      })
      .positional("title", {
        description: "Video title",
        type: "string",
      })
      .option("channel", {
        description: "Channel name",
        type: "string",
      })
      .option("duration", {
        description: "Duration in seconds",
        type: "number",
      }),
  handler: async (argv) => {
    const target = argv.target as string
    const isUrl = target.includes("://")
    const looksLikeVideoID = isVideoID(target)
    const isSearchSelection = !isUrl && (!looksLikeVideoID || target.length !== 11) && (target === "all" || /^(\d+([-,]\d+)*)$/.test(target))

    if (isSearchSelection) {
      const cache = loadSearchCache()
      if (!cache || cache.results.length === 0) {
        console.error("No search results found. Run 'ytcli search <query>' first.")
        process.exit(1)
      }

      const selected = pickSelectedItems(cache.results, target)
      if (selected.length === 0) {
        console.error(`Invalid selection '${target}'. Valid: 1-${cache.results.length}`)
        process.exit(1)
      }

      const addedItems = []
      for (const item of selected) {
        const added = add(
          item.url,
          item.title,
          item.channel,
          computeDurationSecs(item.duration),
        )
        addedItems.push(added)
        try {
          await withClient((client) => mpv.append(client, item.url))
        } catch {}
      }

      console.log(JSON.stringify(addedItems.length === 1 ? addedItems[0] : addedItems, null, 2))
      return
    }

    const url = looksLikeVideoID ? `https://youtu.be/${target}` : target
    let title = argv.title as string | undefined
    let channel = argv.channel as string | undefined
    let duration = argv.duration as number | undefined

    if (!title && !channel) {
      try {
        const info = await getVideoInfo(url)
        if (info) {
          title = info.title
          channel = info.channel
          duration = computeDurationSecs(info.duration)
        }
      } catch {}
    }

    const item = add(url, title, channel, duration)
    try {
      await withClient((client) => mpv.append(client, url))
    } catch {}

    console.log(JSON.stringify(item, null, 2))
  },
}

export const playQueueCmd: CommandModule = {
  command: "play [index]",
  describe: "Play queue from an item index (1-based)",
  builder: (yargs) =>
    yargs
      .positional("index", {
        description: "Start at item number (1-based, default: current or 1)",
        type: "number",
      })
      .option("video", {
        description: "Play with video (default: audio only)",
        type: "boolean",
        default: false,
        alias: "v",
      }),
  handler: async (argv) => {
    const items = list()
    if (items.length === 0) {
      console.log("Queue is empty")
      return
    }

    let targetIndex = 0
    if (argv.index !== undefined) {
      const idx = (argv.index as number) - 1
      if (idx < 0 || idx >= items.length) {
        console.error(`Invalid queue index. Choose 1-${items.length}`)
        process.exit(1)
      }
      targetIndex = idx
    } else {
      const cur = current()
      if (cur) {
        const found = items.findIndex((i) => i.id === cur.id)
        if (found >= 0) targetIndex = found
      }
    }

    const targetItem = items[targetIndex]
    setCurrent(targetItem.id)

    await withClient(async (client) => {
      await syncQueueToMpv(client, targetIndex, !!argv.video)
    })

    addToHistory(
      targetItem.url,
      targetItem.title || undefined,
      targetItem.channel || undefined,
      targetItem.duration || undefined,
    )
    console.log(JSON.stringify(targetItem, null, 2))
  },
}

export const syncCmd: CommandModule = {
  command: "sync",
  describe: "Sync queue with mpv playlist",
  handler: async () => {
    const items = list()
    if (items.length === 0) {
      try {
        await withClient((client) => mpv.playlistClear(client))
      } catch {}
      console.log("Queue is empty, mpv playlist cleared")
      return
    }

    await withClient(async (client) => {
      await syncQueueToMpv(client)
    })
    console.log(`Synced ${items.length} items to mpv playlist`)
  },
}

export const removeCmd: CommandModule = {
  command: "remove <index>",
  describe: "Remove an item from the queue",
  builder: (yargs) =>
    yargs.positional("index", {
      description: "Queue index to remove",
      type: "number",
    }),
  handler: async (argv) => {
    const idx = argv.index as number
    const result = remove(idx)
    if (result) {
      try {
        await withClient((client) => client.command("playlist-remove", idx))
      } catch {}
    }
    console.log(result ? "Removed" : "Not found")
  },
}

export const moveCmd: CommandModule = {
  command: "move <from> <to>",
  describe: "Move an item within the queue",
  builder: (yargs) =>
    yargs
      .positional("from", {
        description: "Source index",
        type: "number",
      })
      .positional("to", {
        description: "Destination index",
        type: "number",
      }),
  handler: (argv) => {
    const result = move(argv.from as number, argv.to as number)
    console.log(result ? "Moved" : "Failed")
  },
}

export const clearCmd: CommandModule = {
  command: "clear",
  describe: "Clear the queue",
  handler: async () => {
    const count = clear()
    try {
      await withClient((client) => mpv.playlistClear(client))
    } catch {}
    console.log(`Cleared ${count} items`)
  },
}

export const listCmd: CommandModule = {
  command: "list",
  describe: "List queue contents",
  handler: () => {
    const items = list()
    console.log(JSON.stringify(items, null, 2))
  },
}

export const currentCmd: CommandModule = {
  command: "current",
  describe: "Show currently playing item",
  handler: async () => {
    try {
      await withClient(async (client) => {
        const path = await client.getProperty<string>("path").catch(() => null)
        if (path) {
          const items = list()
          const matched = items.find(
            (i) => i.url === path || (path.includes(i.url.replace("https://www.youtube.com/watch?v=", "")))
          )
          if (matched) {
            setCurrent(matched.id)
            console.log(JSON.stringify(matched, null, 2))
            return
          } else {
            setCurrent(null)
          }
        } else {
          setCurrent(null)
        }
      })
    } catch {}

    const item = current()
    console.log(item ? JSON.stringify(item, null, 2) : "Nothing playing")
  },
}

export const nextCmd: CommandModule = {
  command: "next",
  describe: "Show next item in queue",
  handler: () => {
    const item = next()
    console.log(item ? JSON.stringify(item, null, 2) : "No next item")
  },
}

export const prevCmd: CommandModule = {
  command: "prev",
  describe: "Show previous item in queue",
  handler: () => {
    const item = prev()
    console.log(item ? JSON.stringify(item, null, 2) : "No previous item")
  },
}

export const peekCmd: CommandModule = {
  command: "peek",
  describe: "Show next item without changing state",
  handler: () => {
    const item = peek()
    console.log(item ? JSON.stringify(item, null, 2) : "No next item")
  },
}

export const positionCmd: CommandModule = {
  command: "position",
  describe: "Show current playback position",
  handler: () => {
    const position = getPosition()
    console.log(position)
  },
}

export const setPositionCmd: CommandModule = {
  command: "set-position <seconds>",
  describe: "Set playback position",
  builder: (yargs) =>
    yargs.positional("seconds", {
      description: "Position in seconds",
      type: "number",
    }),
  handler: (argv) => {
    setPosition(argv.seconds as number)
    console.log("Position updated")
  },
}

export const repeatCmd: CommandModule = {
  command: "repeat [mode]",
  describe: "Get or set repeat mode (off, one, all)",
  builder: (yargs) =>
    yargs.positional("mode", {
      description: "Repeat mode",
      type: "string",
      choices: ["off", "one", "all"],
    }),
  handler: async (argv) => {
    if (!argv.mode) {
      console.log(getRepeatMode())
      return
    }

    const mode = argv.mode as RepeatMode
    setRepeatMode(mode)
    await withClient((client) => mpv.setRepeatMode(client, mode))
    console.log(`Repeat mode: ${mode}`)
  },
}

export const shuffleCmd: CommandModule = {
  command: "shuffle [state]",
  describe: "Get or set shuffle mode (on, off, toggle)",
  builder: (yargs) =>
    yargs.positional("state", {
      description: "Shuffle mode",
      type: "string",
      choices: ["on", "off", "toggle"],
    }),
  handler: (argv) => {
    if (!argv.state) {
      console.log(isShuffleEnabled() ? "on" : "off")
      return
    }

    const state = argv.state as "on" | "off" | "toggle"
    const enabled = state === "toggle" ? !isShuffleEnabled() : state === "on"
    setShuffleEnabled(enabled)
    console.log(`Shuffle: ${enabled ? "on" : "off"}`)
  },
}
