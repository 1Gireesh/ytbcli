import type { CommandModule } from "yargs"
import { MpvClient, commands as mpv } from "../mpv"
import { current, next, prev, setCurrent, getPosition, setPosition, clear } from "../db/queue"

export async function withClient<T>(fn: (client: MpvClient) => Promise<T>): Promise<T> {
  const client = new MpvClient()
  try {
    await client.connect()
    return await fn(client)
  } finally {
    client.disconnect()
  }
}

export const statusCmd: CommandModule = {
  command: "status",
  describe: "Show playback status",
  handler: async () => {
    const currentItem = current()
    await withClient(async (client) => {
      const [title, paused, volume, position, duration] = await Promise.allSettled([
        client.getProperty<string>("media-title"),
        client.getProperty<boolean>("pause"),
        client.getProperty<number>("volume"),
        client.getProperty<number>("time-pos"),
        client.getProperty<number>("duration"),
      ])
      console.log(JSON.stringify({
        queue: currentItem,
        title: title.status === "fulfilled" ? title.value : null,
        paused: paused.status === "fulfilled" ? paused.value : null,
        volume: volume.status === "fulfilled" ? volume.value : null,
        position: position.status === "fulfilled" ? position.value : null,
        duration: duration.status === "fulfilled" ? duration.value : null,
      }, null, 2))
    })
  },
}

export const currentCmd: CommandModule = {
  command: "current",
  describe: "Show currently playing video",
  handler: async () => {
    const currentItem = current()
    console.log(JSON.stringify({
      queue: currentItem,
    }, null, 2))
  },
}

export const nextCmd: CommandModule = {
  command: "next",
  describe: "Play next video",
  builder: (yargs) =>
    yargs.option("video", {
      description: "Play with video (default: audio only)",
      type: "boolean",
      default: false,
      alias: "v",
    }),
  handler: async (argv) => {
    const nextItem = next()
    if (!nextItem) {
      console.log("No next item in queue")
      return
    }

    setCurrent(nextItem.id)

    await withClient(async (client) => {
      if (!argv.video) {
        await client.setProperty("video", false)
      }
      await mpv.play(client, nextItem.url)
    })

    console.log(JSON.stringify(nextItem, null, 2))
  },
}

export const prevCmd: CommandModule = {
  command: "prev",
  describe: "Play previous video",
  builder: (yargs) =>
    yargs.option("video", {
      description: "Play with video (default: audio only)",
      type: "boolean",
      default: false,
      alias: "v",
    }),
  handler: async (argv) => {
    const prevItem = prev()
    if (!prevItem) {
      console.log("No previous item in queue")
      return
    }

    setCurrent(prevItem.id)

    await withClient(async (client) => {
      if (!argv.video) {
        await client.setProperty("video", false)
      }
      await mpv.play(client, prevItem.url)
    })

    console.log(JSON.stringify(prevItem, null, 2))
  },
}

export const pauseCmd: CommandModule = {
  command: "pause",
  describe: "Pause playback",
  handler: async () => {
    await withClient((client) => mpv.togglePause(client))
  },
}

export const stopCmd: CommandModule = {
  command: "stop",
  describe: "Stop playback",
  handler: async () => {
    await withClient((client) => mpv.stop(client))
  },
}
