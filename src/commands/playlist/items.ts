import type { CommandModule } from "yargs"
import { addPlaylistItem, removePlaylistItem, movePlaylistItem, swapPlaylistItems, getPlaylistItems, clearPlaylist, searchPlaylist, sortPlaylist } from "../../db/playlists"

export const addCmd: CommandModule = {
  command: "add <name> <url> [title]",
  describe: "Add a video to a playlist",
  builder: (yargs) =>
    yargs
      .positional("name", {
        description: "Playlist name",
        type: "string",
      })
      .positional("url", {
        description: "Video URL",
        type: "string",
      })
      .positional("title", {
        description: "Video title",
        type: "string",
      }),
  handler: (argv) => {
    const item = addPlaylistItem(argv.name as string, argv.url as string, argv.title as string | undefined)
    console.log(JSON.stringify(item, null, 2))
  },
}

export const removeCmd: CommandModule = {
  command: "remove <name> <index>",
  describe: "Remove a video from a playlist",
  builder: (yargs) =>
    yargs
      .positional("name", {
        description: "Playlist name",
        type: "string",
      })
      .positional("index", {
        description: "Video index to remove",
        type: "number",
      }),
  handler: (argv) => {
    const result = removePlaylistItem(argv.name as string, argv.index as number)
    console.log(result ? "Removed" : "Not found")
  },
}

export const moveCmd: CommandModule = {
  command: "move <name> <from> <to>",
  describe: "Move a video within a playlist",
  builder: (yargs) =>
    yargs
      .positional("name", {
        description: "Playlist name",
        type: "string",
      })
      .positional("from", {
        description: "Source index",
        type: "number",
      })
      .positional("to", {
        description: "Destination index",
        type: "number",
      }),
  handler: (argv) => {
    const result = movePlaylistItem(argv.name as string, argv.from as number, argv.to as number)
    console.log(result ? "Moved" : "Failed")
  },
}

export const swapCmd: CommandModule = {
  command: "swap <name> <index1> <index2>",
  describe: "Swap two videos in a playlist",
  builder: (yargs) =>
    yargs
      .positional("name", {
        description: "Playlist name",
        type: "string",
      })
      .positional("index1", {
        description: "First index",
        type: "number",
      })
      .positional("index2", {
        description: "Second index",
        type: "number",
      }),
  handler: (argv) => {
    const result = swapPlaylistItems(argv.name as string, argv.index1 as number, argv.index2 as number)
    console.log(result ? "Swapped" : "Failed")
  },
}

export const listItemsCmd: CommandModule = {
  command: "list <name>",
  describe: "List videos in a playlist",
  builder: (yargs) =>
    yargs.positional("name", {
      description: "Playlist name",
      type: "string",
    }),
  handler: (argv) => {
    const items = getPlaylistItems(argv.name as string)
    console.log(JSON.stringify(items, null, 2))
  },
}

export const searchCmd: CommandModule = {
  command: "search <name> <query>",
  describe: "Search within a playlist",
  builder: (yargs) =>
    yargs
      .positional("name", {
        description: "Playlist name",
        type: "string",
      })
      .positional("query", {
        description: "Search query",
        type: "string",
      }),
  handler: (argv) => {
    const items = searchPlaylist(argv.name as string, argv.query as string)
    console.log(JSON.stringify(items, null, 2))
  },
}

export const filterCmd: CommandModule = {
  command: "filter <name> <query>",
  describe: "Filter playlist by query",
  builder: (yargs) =>
    yargs
      .positional("name", {
        description: "Playlist name",
        type: "string",
      })
      .positional("query", {
        description: "Filter query",
        type: "string",
      }),
  handler: (argv) => {
    const items = searchPlaylist(argv.name as string, argv.query as string)
    console.log(JSON.stringify(items, null, 2))
  },
}

export const sortCmd: CommandModule = {
  command: "sort <name> <by>",
  describe: "Sort playlist by criteria",
  builder: (yargs) =>
    yargs
      .positional("name", {
        description: "Playlist name",
        type: "string",
      })
      .positional("by", {
        description: "Sort by: title, url, position",
        type: "string",
        choices: ["title", "url", "position"],
      })
      .option("reverse", {
        description: "Sort in reverse order",
        type: "boolean",
        default: false,
      }),
  handler: (argv) => {
    const result = sortPlaylist(argv.name as string, argv.by as "title" | "url" | "position", argv.reverse as boolean)
    console.log(result ? "Sorted" : "Failed")
  },
}

export const clearCmd: CommandModule = {
  command: "clear <name>",
  describe: "Clear a playlist",
  builder: (yargs) =>
    yargs.positional("name", {
      description: "Playlist name",
      type: "string",
    }),
  handler: (argv) => {
    const result = clearPlaylist(argv.name as string)
    console.log(result ? "Cleared" : "Not found")
  },
}
