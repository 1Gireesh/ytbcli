import type { CommandModule } from "yargs"
import { readFileSync } from "fs"
import { withClient } from "./playback"
import { commands as mpv } from "../mpv"
import { add, clear, list, setCurrent } from "../db/queue"
import { getVideoInfo, type SearchResult } from "../ytdlp"
import { getSearchCachePath } from "./search"

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
      }),
  handler: async (argv) => {
    const target = argv.target as string
    const isNumber = /^\d+$/.test(target)

    let selected: SearchResult
    let others: SearchResult[] = []

    if (isNumber) {
      const index = parseInt(target) - 1
      const cachePath = getSearchCachePath()

      let cached: SearchResult[]
      try {
        cached = JSON.parse(readFileSync(cachePath, "utf-8"))
      } catch {
        console.error("No search results. Run: ytcli search <query>")
        process.exit(1)
      }

      if (index < 0 || index >= cached.length) {
        console.error(`Invalid number. Choose 1-${cached.length}`)
        process.exit(1)
      }

      selected = cached[index]
      others = cached.filter((_, i) => i !== index)
    } else {
      selected = {
        id: "",
        title: argv.title as string || "",
        channel: argv.channel as string || "",
        duration: "",
        url: target,
      }

      const info = await getVideoInfo(target)
      if (info) {
        selected.title = info.title
        selected.channel = info.channel
        selected.duration = info.duration
      }
    }

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
      await client.setProperty("vid", argv.video ? 1 : 0)

      await mpv.playlistClear(client)

      const idx = items.findIndex(i => i.url === selected.url)

      await mpv.play(client, selected.url)

      for (let i = 0; i < items.length; i++) {
        if (i !== idx) {
          await mpv.append(client, items[i].url)
        }
      }
    })

    console.log(`Playing: ${selected.title}`)
    if (others.length > 0) {
      console.log(`${others.length} items queued`)
    }
  },
}

export default command
