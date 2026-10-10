import type { CommandModule } from "yargs"

import {
  addCmd,
  playQueueCmd,
  syncCmd,
  removeCmd,
  moveCmd,
  clearCmd,
  listCmd,
  currentCmd,
  nextCmd,
  prevCmd,
  peekCmd,
  positionCmd,
  setPositionCmd,
  repeatCmd,
  shuffleCmd,
} from "./items"

const command: CommandModule = {
  command: "queue <action>",
  describe: "Manage play queue",
  builder: (yargs) =>
    yargs
      .command(addCmd)
      .command(playQueueCmd)
      .command(syncCmd)
      .command(listCmd)
      .command(currentCmd)
      .command(nextCmd)
      .command(prevCmd)
      .command(peekCmd)
      .command(removeCmd)
      .command(moveCmd)
      .command(clearCmd)
      .command(positionCmd)
      .command(setPositionCmd)
      .command(repeatCmd)
      .command(shuffleCmd)
      .demandCommand(1, "Specify a queue action"),
  handler: () => {},
}

export default command
