import type { CommandModule } from "yargs"
import { homedir } from "os"
import { current } from "../db/queue"
import { getHistoryItems } from "../db/history"
import { getPlaylistItems } from "../db/playlists"
import { downloadAudio } from "../ytdlp"
import { parseSelection } from "./selection"

function defaultMusicDir(): string {
  return `${homedir()}/Music`
}

function pickUrls(items: Array<{ url: string }>, selection?: string): string[] {
  if (items.length === 0) return []
  const indexes = parseSelection(selection || "all", items.length)
  return indexes.map((i) => items[i].url).filter(Boolean)
}

const currentCmd: CommandModule = {
  command: "current",
  describe: "Download the currently playing item as mp3",
  builder: (yargs) =>
    yargs.option("output", {
      description: "Output directory",
      type: "string",
      default: defaultMusicDir(),
      alias: "o",
    }),
  handler: async (argv) => {
    const item = current()
    if (!item) {
      console.log("Nothing is currently playing")
      return
    }

    await downloadAudio([item.url], { outputDir: argv.output as string })
    console.log(JSON.stringify({
      downloaded: 1,
      output: argv.output,
      source: "current",
    }, null, 2))
  },
}

const historyCmd: CommandModule = {
  command: "history [items]",
  describe: "Download history items as mp3 (default: all in current window)",
  builder: (yargs) =>
    yargs
      .positional("items", {
        description: "Selection: all | 1,3,5-8",
        type: "string",
      })
      .option("limit", {
        description: "History window size",
        type: "number",
        default: 50,
      })
      .option("offset", {
        description: "History offset",
        type: "number",
        default: 0,
      })
      .option("output", {
        description: "Output directory",
        type: "string",
        default: defaultMusicDir(),
        alias: "o",
      }),
  handler: async (argv) => {
    const items = getHistoryItems(argv.limit as number, argv.offset as number)
    const urls = pickUrls(items, argv.items as string | undefined)
    if (urls.length === 0) {
      console.log("No history items selected")
      return
    }

    await downloadAudio(urls, { outputDir: argv.output as string })
    console.log(JSON.stringify({
      downloaded: urls.length,
      output: argv.output,
      source: "history",
    }, null, 2))
  },
}

const playlistCmd: CommandModule = {
  command: "playlist <name> [items]",
  describe: "Download playlist items as mp3 (default: whole playlist)",
  builder: (yargs) =>
    yargs
      .positional("name", {
        description: "Playlist name",
        type: "string",
      })
      .positional("items", {
        description: "Selection: all | 1,3,5-8",
        type: "string",
      })
      .option("output", {
        description: "Output directory",
        type: "string",
        default: defaultMusicDir(),
        alias: "o",
      }),
  handler: async (argv) => {
    const items = getPlaylistItems(argv.name as string)
    const urls = pickUrls(items, argv.items as string | undefined)
    if (urls.length === 0) {
      console.log("No playlist items selected")
      return
    }

    await downloadAudio(urls, { outputDir: argv.output as string })
    console.log(JSON.stringify({
      downloaded: urls.length,
      output: argv.output,
      source: "playlist",
      playlist: argv.name,
    }, null, 2))
  },
}

const command: CommandModule = {
  command: "download <action>",
  describe: "Download songs as mp3 via yt-dlp",
  builder: (yargs) =>
    yargs
      .command(currentCmd)
      .command(historyCmd)
      .command(playlistCmd)
      .demandCommand(1, "Specify a download action"),
  handler: () => {},
}

export default command

