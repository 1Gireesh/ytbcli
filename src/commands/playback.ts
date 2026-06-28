import type { CommandModule } from "yargs"
import { existsSync, unlinkSync } from "fs"
import { execSync, exec } from "child_process"
import { MpvClient, commands as mpv } from "../mpv"
import { current, next, prev, setCurrent, getPosition, setPosition, clear } from "../db/queue"

const SOCKET_PATH = process.env.MPV_SOCKET || "/tmp/mpvsocket"

function killMpvForSocket(): void {
  try {
    const output = execSync("ps aux | grep 'mpv.*input-ipc-server=" + SOCKET_PATH + "' | grep -v grep", {
      encoding: "utf-8",
    })
    const pids = output.trim().split("\n").filter(Boolean).map(line => {
      const parts = line.trim().split(/\s+/)
      return parts[1]
    }).filter(Boolean)

    for (const pid of pids) {
      try { execSync("kill " + pid) } catch {}
    }

    if (existsSync(SOCKET_PATH)) {
      try { unlinkSync(SOCKET_PATH) } catch {}
    }
  } catch {}
}

async function ensureMpv(): Promise<void> {
  if (existsSync(SOCKET_PATH)) {
    try {
      const client = new MpvClient()
      await client.connect()
      client.disconnect()
      return
    } catch {
      killMpvForSocket()
    }
  }

  execSync("mpv --idle --input-ipc-server=" + SOCKET_PATH + " &", {
    stdio: "ignore",
    shell: true,
  })

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 100))
    if (existsSync(SOCKET_PATH)) {
      try {
        const client = new MpvClient()
        await client.connect()
        client.disconnect()
        return
      } catch {}
    }
  }

  throw new Error("Failed to start mpv")
}

export async function withClient<T>(fn: (client: MpvClient) => Promise<T>): Promise<T> {
  await ensureMpv()
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
    await withClient(async (client) => {
      await client.setProperty("vid", argv.video ? 1 : 0)
      await mpv.playlistNext(client)
    })

    const playlist = await withClient(client => mpv.getPlaylist(client))
    const current = playlist?.find(p => p.current)
    const nextItem = next()

    if (nextItem) {
      setCurrent(nextItem.id)
      console.log(JSON.stringify(nextItem, null, 2))
    } else {
      console.log("No next item")
    }
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
    await withClient(async (client) => {
      await client.setProperty("vid", argv.video ? 1 : 0)
      await mpv.playlistPrev(client)
    })

    const prevItem = prev()

    if (prevItem) {
      setCurrent(prevItem.id)
      console.log(JSON.stringify(prevItem, null, 2))
    } else {
      console.log("No previous item")
    }
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
