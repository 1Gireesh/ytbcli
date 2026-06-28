import type { CommandModule } from "yargs"
import { exportAll, importAll } from "../db/export"

export const exportAllCmd: CommandModule = {
  command: "export [file]",
  describe: "Export all data to JSON file",
  builder: (yargs) =>
    yargs
      .positional("file", {
        description: "Output file path",
        type: "string",
      })
      .option("include", {
        description: "Data to include",
        type: "array",
        choices: ["playlists", "queue", "history", "config"],
        default: ["playlists", "queue", "history"],
      }),
  handler: (argv) => {
    const data = exportAll(argv.file as string | undefined)
    if (!argv.file) {
      console.log(JSON.stringify(data, null, 2))
    } else {
      console.log(`Exported to ${argv.file}`)
    }
  },
}

export const importAllCmd: CommandModule = {
  command: "import <file>",
  describe: "Import data from JSON file",
  builder: (yargs) =>
    yargs
      .positional("file", {
        description: "Input file path",
        type: "string",
      })
      .option("include", {
        description: "Data to import",
        type: "array",
        choices: ["playlists", "queue", "history", "config"],
        default: ["playlists", "queue", "history"],
      })
      .option("merge", {
        description: "Merge with existing data",
        type: "boolean",
        default: false,
      }),
  handler: (argv) => {
    const result = importAll(argv.file as string, {
      merge: argv.merge as boolean,
      include: argv.include as string[],
    })
    console.log(`Imported ${result.imported} items`)
  },
}
