import type { CommandModule } from "yargs"
import { withClient } from "../playback"
import { commands as mpv } from "../../mpv"
import { getPlaylistItems } from "../../db/playlists"
import { add as addToQueue, clear as clearQueue, setCurrent } from "../../db/queue"

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
        description: "Start at index",
        type: "number",
        default: 0,
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

    const startIndex = Math.min(argv.index as number, items.length - 1)

    let itemsToPlay = [...items]
    if (argv.shuffle) {
      for (let i = itemsToPlay.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[itemsToPlay[i], itemsToPlay[j]] = [itemsToPlay[j], itemsToPlay[i]]
      }
    }

    clearQueue()

    let firstQueueItem = null
    for (const item of itemsToPlay) {
      const queueItem = addToQueue(item.url, item.title || undefined)
      if (itemsToPlay.indexOf(item) === startIndex) {
        firstQueueItem = queueItem
      }
    }

    if (!firstQueueItem) {
      firstQueueItem = addToQueue(itemsToPlay[0].url, itemsToPlay[0].title || undefined)
    }

    setCurrent(firstQueueItem.id)

    await withClient(async (client) => {
      if (!argv.video) {
        await client.setProperty("video", false)
      }
      await mpv.play(client, firstQueueItem!.url)
    })

    console.log(JSON.stringify({
      playlist: argv.name,
      queueSize: itemsToPlay.length,
      playing: firstQueueItem,
    }, null, 2))
  },
}
