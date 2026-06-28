import { readFileSync, writeFileSync, existsSync } from "fs"
import { db } from "./index"
import { playlists, playlistItems, queue, history, config } from "./schema"
import { eq } from "drizzle-orm"

export interface ExportData {
  playlists: {
    name: string
    items: { url: string; title: string | null; position: number }[]
  }[]
  queue: { url: string; title: string | null; channel: string | null; duration: number | null; position: number }[]
  history: { url: string; title: string | null; channel: string | null; duration: number | null; startedAt: string | null; finishedAt: string | null; watchedDuration: number | null; playedAt: string | null }[]
  config: { key: string; value: string }[]
}

export function exportAll(file?: string): ExportData {
  const allPlaylists = db.select().from(playlists).all()
  const allPlaylistItems = db.select().from(playlistItems).all()
  const allQueue = db.select().from(queue).all()
  const allHistory = db.select().from(history).all()
  const allConfig = db.select().from(config).all()

  const playlistsWithItems = allPlaylists.map(p => ({
    name: p.name,
    items: allPlaylistItems
      .filter(item => item.playlistId === p.id)
      .map(item => ({ url: item.url, title: item.title, position: item.position })),
  }))

  const data: ExportData = {
    playlists: playlistsWithItems,
    queue: allQueue.map(q => ({ url: q.url, title: q.title, channel: q.channel, duration: q.duration, position: q.position })),
    history: allHistory.map(h => ({ url: h.url, title: h.title, channel: h.channel, duration: h.duration, startedAt: h.startedAt, finishedAt: h.finishedAt, watchedDuration: h.watchedDuration, playedAt: h.playedAt })),
    config: allConfig.map(c => ({ key: c.key, value: c.value })),
  }

  if (file) {
    writeFileSync(file, JSON.stringify(data, null, 2))
  }

  return data
}

export function importAll(file: string, options: { merge?: boolean; include?: string[] } = {}): { imported: number } {
  if (!existsSync(file)) {
    throw new Error(`File not found: ${file}`)
  }

  const content = readFileSync(file, "utf-8")
  const data: ExportData = JSON.parse(content)
  const { merge = false, include = ["playlists", "queue", "history", "config"] } = options

  let imported = 0

  if (include.includes("playlists")) {
    if (!merge) {
      db.delete(playlistItems).run()
      db.delete(playlists).run()
    }

    for (const p of data.playlists || []) {
      const existing = db.select().from(playlists).where(eq(playlists.name, p.name)).get()
      let playlistId = existing?.id

      if (!existing) {
        db.insert(playlists).values({ name: p.name }).run()
        const newPlaylist = db.select().from(playlists).where(eq(playlists.name, p.name)).get()!
        playlistId = newPlaylist.id
      }

      if (playlistId) {
        for (const item of p.items || []) {
          db.insert(playlistItems).values({
            playlistId,
            url: item.url,
            title: item.title,
            position: item.position,
          }).run()
          imported++
        }
      }
    }
  }

  if (include.includes("queue")) {
    if (!merge) {
      db.delete(queue).run()
    }

    for (const q of data.queue || []) {
      db.insert(queue).values({
        url: q.url,
        title: q.title,
        channel: q.channel,
        duration: q.duration,
        position: q.position,
      }).run()
      imported++
    }
  }

  if (include.includes("history")) {
    if (!merge) {
      db.delete(history).run()
    }

    for (const h of data.history || []) {
      db.insert(history).values({
        url: h.url,
        title: h.title,
        channel: h.channel,
        duration: h.duration,
        startedAt: h.startedAt,
        finishedAt: h.finishedAt,
        watchedDuration: h.watchedDuration,
        playedAt: h.playedAt,
      }).run()
      imported++
    }
  }

  if (include.includes("config")) {
    if (!merge) {
      db.delete(config).run()
    }

    for (const c of data.config || []) {
      db.insert(config).values({
        key: c.key,
        value: c.value,
      }).run()
      imported++
    }
  }

  return { imported }
}
