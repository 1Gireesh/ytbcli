import type { CommandModule } from "yargs"
import { getConfig, setConfig, listConfig, resetConfig, getConfigPath } from "../../db/config"

export const getCmd: CommandModule = {
  command: "get <key>",
  describe: "Get a config value",
  builder: (yargs) =>
    yargs.positional("key", {
      description: "Config key to get",
      type: "string",
    }),
  handler: (argv) => {
    const value = getConfig(argv.key as string)
    console.log(value !== undefined ? value : "Not found")
  },
}

export const setCmd: CommandModule = {
  command: "set <key> <value>",
  describe: "Set a config value",
  builder: (yargs) =>
    yargs
      .positional("key", {
        description: "Config key to set",
        type: "string",
      })
      .positional("value", {
        description: "Value to set",
        type: "string",
      }),
  handler: (argv) => {
    setConfig(argv.key as string, argv.value as string)
    console.log("Set")
  },
}

export const listCmd: CommandModule = {
  command: "list",
  describe: "List all config values",
  handler: () => {
    const items = listConfig()
    console.log(JSON.stringify(items, null, 2))
  },
}

export const resetCmd: CommandModule = {
  command: "reset [key]",
  describe: "Reset config to defaults (all or specific key)",
  builder: (yargs) =>
    yargs.positional("key", {
      description: "Config key to reset",
      type: "string",
    }),
  handler: (argv) => {
    const result = resetConfig(argv.key as string | undefined)
    console.log(result ? "Reset" : "Nothing to reset")
  },
}

export const pathCmd: CommandModule = {
  command: "path",
  describe: "Show config file path",
  handler: () => {
    console.log(getConfigPath())
  },
}
