import type { CommandModule } from "yargs"

// Management commands
import { createCmd, deleteCmd, renameCmd, copyCmd, listCmd, infoCmd, mergeCmd, duplicateCmd, deduplicateCmd } from "./manage"

// Item operations
import { addCmd, removeCmd, moveCmd, swapCmd, listItemsCmd, browseCmd, searchCmd, filterCmd, sortCmd, clearCmd } from "./items"

// Import/Export
import { exportCmd, importCmd } from "./io"

// Playback
import { playCmd, pickCmd } from "./play"

const command: CommandModule = {
  command: "playlist <action>",
  describe: "Manage playlists",
  builder: (yargs) =>
    yargs
      // Management
      .command(listCmd)
      .command(createCmd)
      .command(deleteCmd)
      .command(renameCmd)
      .command(copyCmd)
      .command(infoCmd)
      .command(mergeCmd)
      .command(duplicateCmd)
      .command(deduplicateCmd)
      // Items
      .command(addCmd)
      .command(removeCmd)
      .command(moveCmd)
      .command(swapCmd)
      .command(listItemsCmd)
      .command(browseCmd)
      .command(searchCmd)
      .command(filterCmd)
      .command(sortCmd)
      .command(clearCmd)
      // IO
      .command(exportCmd)
      .command(importCmd)
      // Playback
      .command(playCmd)
      .command(pickCmd)
      .demandCommand(1, "Specify a playlist action"),
  handler: () => {},
}

export default command
