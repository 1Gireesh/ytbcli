import type { CommandModule } from "yargs"
import { exportHistory, importHistory } from "../../db/history"
import { readFileSync, writeFileSync } from "fs"

export const exportCmd: CommandModule = {
  command: "export [file]",
  describe: "Export history to JSON file",
  builder: (yargs) =>
    yargs
      .positional("file", {
        description: "Output file path",
        type: "string",
      })
      .option("limit", {
        description: "Limit number of entries to export",
        type: "number",
      }),
  handler: (argv) => {
    const items = exportHistory(argv.limit as number | undefined)
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
  command: "import <file>",
  describe: "Import history from JSON file",
  builder: (yargs) =>
    yargs
      .positional("file", {
        description: "Input file path",
        type: "string",
      })
      .option("merge", {
        description: "Merge with existing history",
        type: "boolean",
        default: false,
      }),
  handler: (argv) => {
    const content = readFileSync(argv.file as string, "utf-8")
    const items = JSON.parse(content)
    const count = importHistory(items, argv.merge as boolean)
    console.log(`Imported ${count} entries`)
  },
}

export const backupCmd: CommandModule = {
  command: "backup [file]",
  describe: "Create a backup of history",
  builder: (yargs) =>
    yargs.positional("file", {
      description: "Backup file path",
      type: "string",
    }),
  handler: (argv) => {
    const items = exportHistory()
    const data = JSON.stringify(items, null, 2)
    const file = argv.file as string || `history-backup-${Date.now()}.json`
    writeFileSync(file, data)
    console.log(`Backed up to ${file}`)
  },
}

export const restoreCmd: CommandModule = {
  command: "restore <file>",
  describe: "Restore history from backup",
  builder: (yargs) =>
    yargs.positional("file", {
      description: "Backup file path",
      type: "string",
    }),
  handler: (argv) => {
    const content = readFileSync(argv.file as string, "utf-8")
    const items = JSON.parse(content)
    const count = importHistory(items, false)
    console.log(`Restored ${count} entries`)
  },
}
