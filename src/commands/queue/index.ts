import type { CommandModule } from "yargs"

import {
  addCmd,
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
} from "./items"

const command: CommandModule = {
  command: "queue <action>",
  describe: "Manage play queue",
  builder: (yargs) =>
    yargs
      .command(addCmd)
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
      .demandCommand(1, "Specify a queue action"),
  handler: () => {},
}

export default command
