import type { CommandModule } from "yargs"
import { createPlaylist, deletePlaylist, renamePlaylist, copyPlaylist, getPlaylist, listPlaylists, mergePlaylists, findDuplicates, deduplicatePlaylist, getPlaylistStats } from "../../db/playlists"

export const createCmd: CommandModule = {
  command: "create <name>",
  describe: "Create a new playlist",
  builder: (yargs) =>
    yargs.positional("name", {
      description: "Playlist name",
      type: "string",
    }),
  handler: (argv) => {
    const playlist = createPlaylist(argv.name as string)
    console.log(JSON.stringify(playlist, null, 2))
  },
}

export const deleteCmd: CommandModule = {
  command: "delete <name>",
  describe: "Delete a playlist",
  builder: (yargs) =>
    yargs.positional("name", {
      description: "Playlist name",
      type: "string",
    }),
  handler: (argv) => {
    const result = deletePlaylist(argv.name as string)
    console.log(result ? "Deleted" : "Not found")
  },
}

export const renameCmd: CommandModule = {
  command: "rename <old> <new>",
  describe: "Rename a playlist",
  builder: (yargs) =>
    yargs
      .positional("old", {
        description: "Current playlist name",
        type: "string",
      })
      .positional("new", {
        description: "New playlist name",
        type: "string",
      }),
  handler: (argv) => {
    const result = renamePlaylist(argv.old as string, argv.new as string)
    console.log(result ? "Renamed" : "Not found")
  },
}

export const copyCmd: CommandModule = {
  command: "copy <source> <dest>",
  describe: "Copy a playlist to a new name",
  builder: (yargs) =>
    yargs
      .positional("source", {
        description: "Source playlist name",
        type: "string",
      })
      .positional("dest", {
        description: "Destination playlist name",
        type: "string",
      }),
  handler: (argv) => {
    const result = copyPlaylist(argv.source as string, argv.dest as string)
    console.log(result ? "Copied" : "Failed")
  },
}

export const listCmd: CommandModule = {
  command: "names",
  describe: "List all playlist names",
  handler: () => {
    const playlists = listPlaylists()
    console.log(JSON.stringify(playlists, null, 2))
  },
}

export const infoCmd: CommandModule = {
  command: "info <name>",
  describe: "Show playlist details",
  builder: (yargs) =>
    yargs.positional("name", {
      description: "Playlist name",
      type: "string",
    }),
  handler: (argv) => {
    const playlist = getPlaylist(argv.name as string)
    if (!playlist) {
      console.log("Not found")
      return
    }
    const stats = getPlaylistStats(argv.name as string)
    console.log(JSON.stringify({ ...playlist, ...stats }, null, 2))
  },
}

export const mergeCmd: CommandModule = {
  command: "merge <source> <dest>",
  describe: "Merge two playlists into one",
  builder: (yargs) =>
    yargs
      .positional("source", {
        description: "Source playlist to merge from",
        type: "string",
      })
      .positional("dest", {
        description: "Destination playlist to merge into",
        type: "string",
      }),
  handler: (argv) => {
    const result = mergePlaylists(argv.source as string, argv.dest as string)
    console.log(result ? "Merged" : "Failed")
  },
}

export const duplicateCmd: CommandModule = {
  command: "duplicate <name>",
  describe: "Find duplicate videos in a playlist",
  builder: (yargs) =>
    yargs.positional("name", {
      description: "Playlist name",
      type: "string",
    }),
  handler: (argv) => {
    const duplicates = findDuplicates(argv.name as string)
    console.log(JSON.stringify(duplicates, null, 2))
  },
}

export const deduplicateCmd: CommandModule = {
  command: "deduplicate <name>",
  describe: "Remove duplicate videos from a playlist",
  builder: (yargs) =>
    yargs.positional("name", {
      description: "Playlist name",
      type: "string",
    }),
  handler: (argv) => {
    const removed = deduplicatePlaylist(argv.name as string)
    console.log(`Removed ${removed} duplicates`)
  },
}
