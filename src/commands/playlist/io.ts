import type { CommandModule } from "yargs"
import {
  getPlaylistItems,
  getPlaylist,
  createPlaylist,
  addPlaylistItem,
} from "../../db/playlists"
import { readFileSync, writeFileSync } from "fs"

export const exportCmd: CommandModule = {
  command: "export <name> [file]",
  describe: "Export playlist to JSON file",
  builder: (yargs) =>
    yargs
      .positional("name", {
        description: "Playlist name",
        type: "string",
      })
      .positional("file", {
        description: "Output file path",
        type: "string",
      }),
  handler: (argv) => {
    const items = getPlaylistItems(argv.name as string)
    const data = JSON.stringify(items, null, 2)
    if (argv.file) {
      writeFileSync(argv.file as string, data)
      console.log(`Exported to ${argv.file}`)
    } else {
      console.log(data)
    }
  },
}

export const importCmd: CommandModule = {
  command: "import <name> <file>",
  describe: "Import playlist from JSON file",
  builder: (yargs) =>
    yargs
      .positional("name", {
        description: "Playlist name",
        type: "string",
      })
      .positional("file", {
        description: "Input file path",
        type: "string",
      })
      .option("replace", {
        description: "Replace existing playlist items",
        type: "boolean",
        default: false,
      }),
  handler: (argv) => {
    const name = argv.name as string
    const file = argv.file as string

    let data: { url: string; title?: string }[]
    try {
      data = JSON.parse(readFileSync(file, "utf-8"))
    } catch {
      console.error(`Cannot read file: ${file}`)
      process.exit(1)
    }

    if (!Array.isArray(data) || data.length === 0) {
      console.error("File contains no items")
      process.exit(1)
    }

    let playlist = getPlaylist(name)
    if (!playlist) {
      playlist = createPlaylist(name)
    }

    if (argv.replace) {
      const { clearPlaylist } = require("../../db/playlists")
      clearPlaylist(name)
    }

    for (const item of data) {
      if (item.url) {
        addPlaylistItem(name, item.url, item.title)
      }
    }

    console.log(`Imported ${data.length} items to "${name}"`)
  },
}
