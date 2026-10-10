import type { CommandModule } from "yargs"
import { existsSync, unlinkSync } from "fs"
import { execSync } from "child_process"
import { MpvClient, commands as mpv } from "../mpv"
import { current, list, setCurrent } from "../db/queue"
import { addToHistory } from "../db/history"
import { getRepeatMode, isShuffleEnabled } from "../db/playback"

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

  execSync(`nohup setsid mpv --idle --vid=no --input-ipc-server="${SOCKET_PATH}" </dev/null >/dev/null 2>&1 &`, {
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

export async function syncQueueToMpv(client: MpvClient, targetUrlOrIndex?: string | number, video?: boolean): Promise<void> {
  const items = list()
  if (items.length === 0) return

  let targetIndex = 0
  if (typeof targetUrlOrIndex === "number") {
    targetIndex = Math.max(0, Math.min(targetUrlOrIndex, items.length - 1))
  } else if (typeof targetUrlOrIndex === "string") {
    const idx = items.findIndex(i => i.url === targetUrlOrIndex)
    if (idx >= 0) targetIndex = idx
  } else {
    const cur = current()
    if (cur) {
      const idx = items.findIndex(i => i.id === cur.id)
      if (idx >= 0) targetIndex = idx
    }
  }

  const playlist = await mpv.getPlaylist(client) as Array<{ filename: string; current?: boolean }> | undefined
  const matches = playlist && playlist.length === items.length && items.every((item, i) => playlist[i]?.filename === item.url)

  if (!matches) {
    await mpv.playlistClear(client)
    for (const item of items) {
      await mpv.append(client, item.url)
    }
  }

  if (targetIndex >= 0 && targetIndex < items.length) {
    await mpv.playlistPlayIndex(client, targetIndex)
    setCurrent(items[targetIndex].id)
  }

  if (video !== undefined) {
    await mpv.setVideoEnabled(client, video)
  }
  await mpv.setRepeatMode(client, getRepeatMode())
  await mpv.unpause(client)
}

function pickRandomIndex(size: number, exclude: number): number {
  if (size <= 1) return 0
  const random = Math.floor(Math.random() * (size - 1))
  return random >= exclude ? random + 1 : random
}

function getCurrentIndex(items: Array<{ id: number }>): number {
  const currentItem = current()
  if (!currentItem) return -1
  return items.findIndex(item => item.id === currentItem.id)
}

function resolveNextIndex(currentIndex: number, size: number): number | null {
  if (size === 0) return null

  const repeatMode = getRepeatMode()
  const shuffleEnabled = isShuffleEnabled()

  if (repeatMode === "one") {
    return currentIndex >= 0 ? currentIndex : 0
  }
  if (shuffleEnabled) {
    return pickRandomIndex(size, currentIndex < 0 ? 0 : currentIndex)
  }
  if (currentIndex < 0) {
    return 0
  }
  if (currentIndex < size - 1) {
    return currentIndex + 1
  }
  if (repeatMode === "all") {
    return 0
  }
  return null
}

function resolvePrevIndex(currentIndex: number, size: number): number | null {
  if (size === 0) return null

  const repeatMode = getRepeatMode()
  const shuffleEnabled = isShuffleEnabled()

  if (repeatMode === "one") {
    return currentIndex >= 0 ? currentIndex : 0
  }
  if (shuffleEnabled) {
    return pickRandomIndex(size, currentIndex < 0 ? 0 : currentIndex)
  }
  if (currentIndex <= 0) {
    if (repeatMode === "all") {
      return size - 1
    }
    return null
  }
  return currentIndex - 1
}

export const statusCmd: CommandModule = {
  command: "status",
  describe: "Show playback status",
  handler: async () => {
    let currentItem = current()
    await withClient(async (client) => {
      const [title, paused, volume, position, duration, path] = await Promise.allSettled([
        client.getProperty<string>("media-title"),
        client.getProperty<boolean>("pause"),
        client.getProperty<number>("volume"),
        client.getProperty<number>("time-pos"),
        client.getProperty<number>("duration"),
        client.getProperty<string>("path"),
      ])

      const currentPath = path.status === "fulfilled" ? path.value : null
      if (currentPath) {
        const items = list()
        const matched = items.find(i => i.url === currentPath || (currentPath.includes(i.url.replace("https://www.youtube.com/watch?v=", ""))))
        if (matched && (!currentItem || currentItem.id !== matched.id)) {
          setCurrent(matched.id)
          currentItem = matched
        }
      }

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
    const items = list()
    if (items.length === 0) {
      console.log("No next item")
      return
    }

    const currentIndex = getCurrentIndex(items)
    const targetIndex = resolveNextIndex(currentIndex, items.length)

    if (targetIndex === null) {
      console.log("No next item")
      return
    }

    const nextItem = items[targetIndex]
    await withClient(async (client) => {
      const playlist = await mpv.getPlaylist(client) as Array<{ filename: string }> | undefined
      if (playlist && playlist.length === items.length && playlist[targetIndex]?.filename === nextItem.url) {
        await mpv.playlistNext(client)
      } else {
        await syncQueueToMpv(client, targetIndex, !!argv.video)
      }
      await mpv.setVideoEnabled(client, !!argv.video)
      await mpv.setRepeatMode(client, getRepeatMode())
      await mpv.unpause(client)
    })

    setCurrent(nextItem.id)
    addToHistory(nextItem.url, nextItem.title || undefined, nextItem.channel || undefined, nextItem.duration || undefined)
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
    const items = list()
    if (items.length === 0) {
      console.log("No previous item")
      return
    }

    const currentIndex = getCurrentIndex(items)
    const targetIndex = resolvePrevIndex(currentIndex, items.length)

    if (targetIndex === null) {
      console.log("No previous item")
      return
    }

    const prevItem = items[targetIndex]
    await withClient(async (client) => {
      const playlist = await mpv.getPlaylist(client) as Array<{ filename: string }> | undefined
      if (playlist && playlist.length === items.length && playlist[targetIndex]?.filename === prevItem.url) {
        await mpv.playlistPrev(client)
      } else {
        await syncQueueToMpv(client, targetIndex, !!argv.video)
      }
      await mpv.setVideoEnabled(client, !!argv.video)
      await mpv.setRepeatMode(client, getRepeatMode())
      await mpv.unpause(client)
    })

    setCurrent(prevItem.id)
    addToHistory(prevItem.url, prevItem.title || undefined, prevItem.channel || undefined, prevItem.duration || undefined)
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
