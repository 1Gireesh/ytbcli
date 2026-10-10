import type { CommandModule } from "yargs"
import { withClient } from "../playback"
import { commands as mpv } from "../../mpv"
import type { PlaylistItem } from "../../db/playlists"
import { getPlaylistItems } from "../../db/playlists"
import { add as addToQueue, clear as clearQueue, setCurrent } from "../../db/queue"
import { addToHistory } from "../../db/history"
import { getRepeatMode, isShuffleEnabled } from "../../db/playback"
import { PLAYLIST_CACHE_PATH, readJsonCache, playlistCacheId } from "../cache"

interface PlaylistCachePayload {
  cacheId: string
  name: string
  items: PlaylistItem[]
}

async function playItems(name: string, itemsToPlay: PlaylistItem[], startIndex: number, video: boolean): Promise<void> {
  clearQueue()

  const queueItems = []
  for (const item of itemsToPlay) {
    queueItems.push(addToQueue(item.url, item.title || undefined))
  }

  const firstQueueItem = queueItems[startIndex] || queueItems[0]
  if (!firstQueueItem) {
    console.log("Playlist is empty")
    return
  }

  setCurrent(firstQueueItem.id)

  await withClient(async (client) => {
    await mpv.playlistClear(client)
    await mpv.play(client, itemsToPlay[0].url)
    for (let i = 1; i < itemsToPlay.length; i++) {
      await mpv.append(client, itemsToPlay[i].url)
    }
    if (startIndex > 0) {
      await mpv.playlistPlayIndex(client, startIndex)
    }
    await mpv.setVideoEnabled(client, video)
    await mpv.setRepeatMode(client, getRepeatMode())
  })

  const targetItem = itemsToPlay[startIndex] || itemsToPlay[0]
  if (targetItem) {
    addToHistory(targetItem.url, targetItem.title || undefined)
  }

  console.log(JSON.stringify({
    playlist: name,
    queueSize: itemsToPlay.length,
    playing: firstQueueItem,
  }, null, 2))
}

export const playCmd: CommandModule = {
  command: "play <name> [index]",
  describe: "Play a playlist",
  builder: (yargs) =>
    yargs
      .positional("name", {
        description: "Playlist name",
        type: "string",
      })
      .positional("index", {
        description: "Start at item number (1-based)",
        type: "number",
        default: 1,
      })
      .option("video", {
        description: "Play with video (default: audio only)",
        type: "boolean",
        default: false,
        alias: "v",
      })
      .option("shuffle", {
        description: "Shuffle before playing",
        type: "boolean",
        default: false,
      }),
  handler: async (argv) => {
    const items = getPlaylistItems(argv.name as string)
    if (items.length === 0) {
      console.log("Playlist is empty")
      return
    }

    const requestedIndex = Math.max((argv.index as number) - 1, 0)
    const startIndex = Math.min(requestedIndex, items.length - 1)

    let itemsToPlay = [...items]
    if (argv.shuffle || isShuffleEnabled()) {
      for (let i = itemsToPlay.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[itemsToPlay[i], itemsToPlay[j]] = [itemsToPlay[j], itemsToPlay[i]]
      }
    }

    await playItems(argv.name as string, itemsToPlay, startIndex, !!argv.video)
  },
}

export const pickCmd: CommandModule = {
  command: "pick <index>",
  describe: "Play from the last browsed playlist by number",
  builder: (yargs) =>
    yargs
      .positional("index", {
        description: "Item number from `ytcli playlist browse <name>`",
        type: "number",
      })
      .option("video", {
        description: "Play with video (default: audio only)",
        type: "boolean",
        default: false,
        alias: "v",
      }),
  handler: async (argv) => {
    const cache = readJsonCache<PlaylistCachePayload>(PLAYLIST_CACHE_PATH)
    if (!cache || !cache.items || cache.items.length === 0) {
      console.log("No playlist browse cache. Run: ytcli playlist browse <name>")
      return
    }
    if (cache.cacheId !== playlistCacheId(cache.name)) {
      console.log("Playlist cache is invalid. Run: ytcli playlist browse <name>")
      return
    }

    const index = Math.max((argv.index as number) - 1, 0)
    if (index >= cache.items.length) {
      console.log(`Invalid number. Choose 1-${cache.items.length}`)
      return
    }

    await playItems(cache.name, cache.items, index, !!argv.video)
  },
}
