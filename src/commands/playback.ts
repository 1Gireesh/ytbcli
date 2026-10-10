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
    await mpv.play(client, items[0].url)
    for (let i = 1; i < items.length; i++) {
      await mpv.append(client, items[i].url)
    }
  }

  if (targetIndex > 0 && targetIndex < items.length) {
    await mpv.playlistPlayIndex(client, targetIndex)
  }

  setCurrent(items[targetIndex].id)

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
      let currentItem = null

      if (currentPath) {
        const items = list()
        const matched = items.find(
          (i) => i.url === currentPath || (currentPath.includes(i.url.replace("https://www.youtube.com/watch?v=", "")))
        )
        if (matched) {
          setCurrent(matched.id)
          currentItem = matched
        } else {
          setCurrent(null)
        }
      } else {
        setCurrent(null)
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
    try {
      await withClient(async (client) => {
        const [path, title] = await Promise.allSettled([
          client.getProperty<string>("path"),
          client.getProperty<string>("media-title"),
        ])
        const currentPath = path.status === "fulfilled" ? path.value : null
        const mediaTitle = title.status === "fulfilled" ? title.value : null

        if (!currentPath) {
          setCurrent(null)
          console.log(JSON.stringify({ queue: null, message: "Nothing playing" }, null, 2))
          return
        }

        const items = list()
        const matched = items.find(
          (i) => i.url === currentPath || (currentPath.includes(i.url.replace("https://www.youtube.com/watch?v=", "")))
        )
        if (matched) {
          setCurrent(matched.id)
          console.log(JSON.stringify({ queue: matched, title: mediaTitle, url: currentPath }, null, 2))
        } else {
          setCurrent(null)
          console.log(JSON.stringify({ queue: null, title: mediaTitle, url: currentPath }, null, 2))
        }
      })
    } catch {
      const currentItem = current()
      console.log(JSON.stringify({ queue: currentItem }, null, 2))
    }
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

    await withClient(async (client) => {
      const playlist = await mpv.getPlaylist(client) as Array<{ filename: string; current?: boolean }> | undefined
      const matches = playlist && playlist.length === items.length && items.every((item, i) => playlist[i]?.filename === item.url)

      if (matches) {
        await mpv.playlistNext(client)
      } else {
        const currentPath = await client.getProperty<string>("path").catch(() => null)
        let curIdx = -1
        if (currentPath) {
          curIdx = items.findIndex((i) => i.url === currentPath || currentPath.includes(i.url.replace("https://www.youtube.com/watch?v=", "")))
        }
        const targetIdx = resolveNextIndex(curIdx, items.length)
        if (targetIdx === null) {
          console.log("No next item")
          return
        }
        await syncQueueToMpv(client, targetIdx, !!argv.video)
      }

      await mpv.setVideoEnabled(client, !!argv.video)
      await mpv.setRepeatMode(client, getRepeatMode())
      await mpv.unpause(client)

      const newPath = await client.getProperty<string>("path").catch(() => null)
      const newTitle = await client.getProperty<string>("media-title").catch(() => null)
      const matched = items.find((i) => newPath && (i.url === newPath || newPath.includes(i.url.replace("https://www.youtube.com/watch?v=", ""))))

      if (matched) {
        setCurrent(matched.id)
        addToHistory(matched.url, matched.title || undefined, matched.channel || undefined, matched.duration || undefined)
        console.log(JSON.stringify(matched, null, 2))
      } else if (newPath) {
        setCurrent(null)
        console.log(JSON.stringify({ title: newTitle, url: newPath }, null, 2))
      } else {
        console.log("No next item")
      }
    })
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

    await withClient(async (client) => {
      const playlist = await mpv.getPlaylist(client) as Array<{ filename: string; current?: boolean }> | undefined
      const matches = playlist && playlist.length === items.length && items.every((item, i) => playlist[i]?.filename === item.url)

      if (matches) {
        await mpv.playlistPrev(client)
      } else {
        const currentPath = await client.getProperty<string>("path").catch(() => null)
        let curIdx = -1
        if (currentPath) {
          curIdx = items.findIndex((i) => i.url === currentPath || currentPath.includes(i.url.replace("https://www.youtube.com/watch?v=", "")))
        }
        const targetIdx = resolvePrevIndex(curIdx, items.length)
        if (targetIdx === null) {
          console.log("No previous item")
          return
        }
        await syncQueueToMpv(client, targetIdx, !!argv.video)
      }

      await mpv.setVideoEnabled(client, !!argv.video)
      await mpv.setRepeatMode(client, getRepeatMode())
      await mpv.unpause(client)

      const newPath = await client.getProperty<string>("path").catch(() => null)
      const newTitle = await client.getProperty<string>("media-title").catch(() => null)
      const matched = items.find((i) => newPath && (i.url === newPath || newPath.includes(i.url.replace("https://www.youtube.com/watch?v=", ""))))

      if (matched) {
        setCurrent(matched.id)
        addToHistory(matched.url, matched.title || undefined, matched.channel || undefined, matched.duration || undefined)
        console.log(JSON.stringify(matched, null, 2))
      } else if (newPath) {
        setCurrent(null)
        console.log(JSON.stringify({ title: newTitle, url: newPath }, null, 2))
      } else {
        console.log("No previous item")
      }
    })
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
