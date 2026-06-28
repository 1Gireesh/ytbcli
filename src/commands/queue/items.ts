import type { CommandModule } from "yargs"
import { add, remove, move, clear, list, current, next, prev, peek, getPosition, setPosition } from "../../db/queue"

export const addCmd: CommandModule = {
  command: "add <url> [title]",
  describe: "Add a video to the queue",
  builder: (yargs) =>
    yargs
      .positional("url", {
        description: "Video URL",
        type: "string",
      })
      .positional("title", {
        description: "Video title",
        type: "string",
      })
      .option("channel", {
        description: "Channel name",
        type: "string",
      })
      .option("duration", {
        description: "Duration in seconds",
        type: "number",
      }),
  handler: (argv) => {
    const item = add(
      argv.url as string,
      argv.title as string | undefined,
      argv.channel as string | undefined,
      argv.duration as number | undefined,
    )
    console.log(JSON.stringify(item, null, 2))
  },
}

export const removeCmd: CommandModule = {
  command: "remove <index>",
  describe: "Remove an item from the queue",
  builder: (yargs) =>
    yargs.positional("index", {
      description: "Queue index to remove",
      type: "number",
    }),
  handler: (argv) => {
    const result = remove(argv.index as number)
    console.log(result ? "Removed" : "Not found")
  },
}

export const moveCmd: CommandModule = {
  command: "move <from> <to>",
  describe: "Move an item within the queue",
  builder: (yargs) =>
    yargs
      .positional("from", {
        description: "Source index",
        type: "number",
      })
      .positional("to", {
        description: "Destination index",
        type: "number",
      }),
  handler: (argv) => {
    const result = move(argv.from as number, argv.to as number)
    console.log(result ? "Moved" : "Failed")
  },
}

export const clearCmd: CommandModule = {
  command: "clear",
  describe: "Clear the queue",
  handler: () => {
    const count = clear()
    console.log(`Cleared ${count} items`)
  },
}

export const listCmd: CommandModule = {
  command: "list",
  describe: "List queue contents",
  handler: () => {
    const items = list()
    console.log(JSON.stringify(items, null, 2))
  },
}

export const currentCmd: CommandModule = {
  command: "current",
  describe: "Show currently playing item",
  handler: () => {
    const item = current()
    console.log(item ? JSON.stringify(item, null, 2) : "Nothing playing")
  },
}

export const nextCmd: CommandModule = {
  command: "next",
  describe: "Show next item in queue",
  handler: () => {
    const item = next()
    console.log(item ? JSON.stringify(item, null, 2) : "No next item")
  },
}

export const prevCmd: CommandModule = {
  command: "prev",
  describe: "Show previous item in queue",
  handler: () => {
    const item = prev()
    console.log(item ? JSON.stringify(item, null, 2) : "No previous item")
  },
}

export const peekCmd: CommandModule = {
  command: "peek",
  describe: "Show next item without changing state",
  handler: () => {
    const item = peek()
    console.log(item ? JSON.stringify(item, null, 2) : "No next item")
  },
}

export const positionCmd: CommandModule = {
  command: "position",
  describe: "Show current playback position",
  handler: () => {
    const position = getPosition()
    console.log(position)
  },
}

export const setPositionCmd: CommandModule = {
  command: "set-position <seconds>",
  describe: "Set playback position",
  builder: (yargs) =>
    yargs.positional("seconds", {
      description: "Position in seconds",
      type: "number",
    }),
  handler: (argv) => {
    setPosition(argv.seconds as number)
    console.log("Position updated")
  },
}
