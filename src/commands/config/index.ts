import type { CommandModule } from "yargs"

import { getCmd, setCmd, listCmd, resetCmd, pathCmd } from "./config"

const command: CommandModule = {
  command: "config <action>",
  describe: "Manage configuration",
  builder: (yargs) =>
    yargs
      .command(getCmd)
      .command(setCmd)
      .command(listCmd)
      .command(resetCmd)
      .command(pathCmd)
      .demandCommand(1, "Specify a config action"),
  handler: () => {},
}

export default command
