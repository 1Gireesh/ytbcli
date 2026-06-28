import type { CommandModule } from "yargs"

import {
  listCmd,
  searchCmd,
  filterCmd,
  infoCmd,
  recentCmd,
  removeCmd,
  removeUrlCmd,
  clearCmd,
  sortCmd,
  statsCmd,
  channelsCmd,
  topCmd,
  uniqueCmd,
  deduplicateCmd,
} from "./items"

import { exportCmd, importCmd, backupCmd, restoreCmd } from "./io"

const command: CommandModule = {
  command: "history <action>",
  describe: "Manage play history",
  builder: (yargs) =>
    yargs
      .command(listCmd)
      .command(searchCmd)
      .command(filterCmd)
      .command(infoCmd)
      .command(recentCmd)
      .command(removeCmd)
      .command(removeUrlCmd)
      .command(clearCmd)
      .command(sortCmd)
      .command(statsCmd)
      .command(channelsCmd)
      .command(topCmd)
      .command(uniqueCmd)
      .command(deduplicateCmd)
      .command(exportCmd)
      .command(importCmd)
      .command(backupCmd)
      .command(restoreCmd)
      .demandCommand(1, "Specify a history action"),
  handler: () => {},
}

export default command
