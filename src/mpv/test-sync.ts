import { MpvClient, commands as mpv } from "../mpv"
import { add, clear, list, setCurrent, current } from "../db/queue"
import { readFileSync, writeFileSync } from "fs"

const SOCKET_PATH = process.env.MPV_SOCKET || "/tmp/mpvsocket"
const SEARCH_CACHE = "/tmp/ytcli-search.json"

async function ensureMpv(): Promise<MpvClient> {
  const client = new MpvClient()
  try {
    await client.connect()
    return client
  } catch {
    const { execSync } = await import("child_process")
    const { existsSync, unlinkSync } = await import("fs")

    if (existsSync(SOCKET_PATH)) {
      try { unlinkSync(SOCKET_PATH) } catch {}
    }

    execSync("mpv --idle --input-ipc-server=" + SOCKET_PATH + " &", {
      stdio: "ignore",
      shell: true,
    })

    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 100))
      if (existsSync(SOCKET_PATH)) {
        try {
          const c = new MpvClient()
          await c.connect()
          return c
        } catch {}
      }
    }
    throw new Error("Failed to start mpv")
  }
}

async function loadQueueToMpv(client: MpvClient): Promise<void> {
  const items = list()
  if (items.length === 0) return

  for (const item of items) {
    await client.command("loadfile", item.url, "append-play")
  }
}

async function syncCurrentToMpv(client: MpvClient): Promise<void> {
  const cur = current()
  if (!cur) return

  const playlist = await client.getProperty<any[]>("playlist")
  if (!playlist) return

  const idx = playlist.findIndex((p: any) => p.filename === cur.url)
  if (idx >= 0) {
    await client.command("playlist-play-index", idx)
  }
}

async function test() {
  console.log("=== Testing mpv queue sync ===\n")

  clear()

  const cached = JSON.parse(readFileSync(SEARCH_CACHE, "utf-8"))
  console.log(`Loaded ${cached.length} search results\n`)

  for (const item of cached) {
    add(item.url, item.title, item.channel)
  }

  const items = list()
  console.log(`Queue has ${items.length} items:`)
  items.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.title} (${item.url})`)
  })
  console.log()

  console.log("Connecting to mpv...")
  const client = await ensureMpv()
  console.log("Connected!\n")

  console.log("Clearing mpv playlist...")
  await client.command("playlist-clear")

  console.log("Loading queue to mpv...")
  await loadQueueToMpv(client)
  console.log("Done!\n")

  const playlist = await client.getProperty<any[]>("playlist")
  console.log(`mpv playlist now has ${playlist?.length || 0} items:`)
  playlist?.forEach((p: any, i: number) => {
    console.log(`  ${i}. ${p.filename}`)
  })
  console.log()

  console.log("Syncing current item to mpv...")
  await syncCurrentToMpv(client)
  console.log("Playing!\n")

  console.log("=== Test complete ===")
  console.log("Now try: playerctl next / playerctl prev / playerctl play-pause")

  client.disconnect()
}

test().catch(console.error)
