import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"
import { join } from "path"
import { existsSync, readFileSync } from "fs"
import * as schema from "./db/schema"
import { eq, like, desc, asc, sql, or } from "drizzle-orm"

const DATA_DIR = join(process.env.HOME || "~", ".local/share/ytcli")
const DB_PATH = join(DATA_DIR, "ytcli.db")
const sqlite = new Database(DB_PATH)
sqlite.exec("PRAGMA journal_mode = WAL")
sqlite.exec("PRAGMA foreign_keys = ON")
const db = drizzle(sqlite, { schema })

const FRONTEND_PATH = join(import.meta.dir, "frontend", "index.html")

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function error(msg: string, status = 400) {
  return json({ error: msg }, status)
}

async function body(req: Request) {
  try { return await req.json() } catch { return {} }
}

function serveFrontend() {
  return new Response(readFileSync(FRONTEND_PATH, "utf-8"), {
    headers: { "Content-Type": "text/html" },
  })
}

// Helpers
function getPlaylistByName(name: string) {
  return db.select().from(schema.playlists).where(eq(schema.playlists.name, name)).get()
}
function getPlaylistItems(playlistId: number) {
  return db.select().from(schema.playlistItems).where(eq(schema.playlistItems.playlistId, playlistId)).orderBy(schema.playlistItems.position).all()
}
function reorderPlaylistItems(playlistId: number) {
  const items = getPlaylistItems(playlistId)
  for (let i = 0; i < items.length; i++) {
    db.update(schema.playlistItems).set({ position: i }).where(eq(schema.playlistItems.id, items[i].id)).run()
  }
}
function getQueueItems() {
  return db.select().from(schema.queue).orderBy(asc(schema.queue.position)).all()
}
function reorderQueue() {
  const items = getQueueItems()
  for (let i = 0; i < items.length; i++) {
    db.update(schema.queue).set({ position: i }).where(eq(schema.queue.id, items[i].id)).run()
  }
}

const routes: Record<string, (req: Request, params: Record<string, string>) => Response | Promise<Response>> = {
  "GET /": () => serveFrontend(),

  // ── Playlists ──────────────────────────────────────────────
  "GET /api/playlists": () => {
    const pls = db.select().from(schema.playlists).orderBy(schema.playlists.name).all()
    const allItems = db.select().from(schema.playlistItems).all()
    return json(pls.map(p => ({
      ...p,
      itemCount: allItems.filter(i => i.playlistId === p.id).length,
    })))
  },
  "POST /api/playlists": async (req) => {
    const { name } = await body(req)
    if (!name) return error("name required")
    try {
      db.insert(schema.playlists).values({ name }).run()
      return json(getPlaylistByName(name), 201)
    } catch (e: any) { return error(e.message) }
  },
  "DELETE /api/playlists/:name": (_req, params) => {
    const r = db.delete(schema.playlists).where(eq(schema.playlists.name, params.name)).run()
    return json({ deleted: r.changes > 0 })
  },
  "PATCH /api/playlists/:name": async (req, params) => {
    const { name: newName } = await body(req)
    if (!newName) return error("name required")
    const r = db.update(schema.playlists).set({ name: newName, updatedAt: new Date().toISOString() }).where(eq(schema.playlists.name, params.name)).run()
    return json({ renamed: r.changes > 0 })
  },
  "POST /api/playlists/:name/copy": async (req, params) => {
    const { name: dest } = await body(req)
    if (!dest) return error("destination name required")
    const src = getPlaylistByName(params.name)
    if (!src) return error("source not found", 404)
    if (getPlaylistByName(dest)) return error("destination already exists")
    const newPl = db.insert(schema.playlists).values({ name: dest }).returning().get()
    const items = getPlaylistItems(src.id)
    if (items.length) {
      db.insert(schema.playlistItems).values(items.map(i => ({ playlistId: newPl.id, url: i.url, title: i.title, position: i.position }))).run()
    }
    return json({ copied: true, itemCount: items.length })
  },
  "POST /api/playlists/:name/merge": async (req, params) => {
    const { name: dest } = await body(req)
    if (!dest) return error("destination name required")
    const src = getPlaylistByName(params.name)
    const destPl = getPlaylistByName(dest)
    if (!src || !destPl) return error("playlist not found", 404)
    const srcItems = getPlaylistItems(src.id)
    const destItems = getPlaylistItems(destPl.id)
    const maxPos = destItems.length ? Math.max(...destItems.map(i => i.position)) + 1 : 0
    if (srcItems.length) {
      db.insert(schema.playlistItems).values(srcItems.map(i => ({ playlistId: destPl.id, url: i.url, title: i.title, position: maxPos + i.position }))).run()
    }
    return json({ merged: true, addedCount: srcItems.length })
  },
  "POST /api/playlists/:name/sort": async (req, params) => {
    const { by = "title", reverse = false } = await body(req)
    const pl = getPlaylistByName(params.name)
    if (!pl) return error("not found", 404)
    const items = getPlaylistItems(pl.id)
    items.sort((a, b) => {
      const aVal = by === "position" ? a.position : by === "url" ? a.url : (a.title || "")
      const bVal = by === "position" ? b.position : by === "url" ? b.url : (b.title || "")
      return reverse ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal)
    })
    for (let i = 0; i < items.length; i++) {
      db.update(schema.playlistItems).set({ position: i }).where(eq(schema.playlistItems.id, items[i].id)).run()
    }
    return json({ sorted: true })
  },
  "POST /api/playlists/:name/dedup": (_req, params) => {
    const pl = getPlaylistByName(params.name)
    if (!pl) return error("not found", 404)
    const items = getPlaylistItems(pl.id)
    const seen = new Set<string>()
    const toDelete: number[] = []
    for (const item of items) {
      if (seen.has(item.url)) toDelete.push(item.id)
      else seen.add(item.url)
    }
    for (const id of toDelete) db.delete(schema.playlistItems).where(eq(schema.playlistItems.id, id)).run()
    if (toDelete.length) reorderPlaylistItems(pl.id)
    return json({ removed: toDelete.length })
  },
  "GET /api/playlists/:name/dupes": (_req, params) => {
    const pl = getPlaylistByName(params.name)
    if (!pl) return error("not found", 404)
    const items = getPlaylistItems(pl.id)
    const seen = new Map<string, typeof items>()
    for (const item of items) {
      const existing = seen.get(item.url) || []
      existing.push(item)
      seen.set(item.url, existing)
    }
    const dupes: { url: string; count: number; indices: number[] }[] = []
    for (const [url, group] of seen) {
      if (group.length > 1) dupes.push({ url, count: group.length, indices: group.map(g => g.position) })
    }
    return json(dupes)
  },
  "POST /api/playlists/:name/clear": (_req, params) => {
    const pl = getPlaylistByName(params.name)
    if (!pl) return error("not found", 404)
    const r = db.delete(schema.playlistItems).where(eq(schema.playlistItems.playlistId, pl.id)).run()
    return json({ cleared: r.changes })
  },
  "GET /api/playlists/:name/search": (req, params) => {
    const q = new URL(req.url).searchParams.get("q") || ""
    const pl = getPlaylistByName(params.name)
    if (!pl) return error("not found", 404)
    const items = db.select().from(schema.playlistItems).where(
      sql`${schema.playlistItems.playlistId} = ${pl.id} AND (${like(schema.playlistItems.url, `%${q}%`)} OR ${like(schema.playlistItems.title, `%${q}%`)})`
    ).orderBy(schema.playlistItems.position).all()
    return json(items)
  },
  "GET /api/playlists/:name/stats": (_req, params) => {
    const pl = getPlaylistByName(params.name)
    if (!pl) return error("not found", 404)
    const items = getPlaylistItems(pl.id)
    return json({ count: items.length, urls: items.map(i => i.url) })
  },

  // ── Playlist Items ─────────────────────────────────────────
  "GET /api/playlists/:name/items": (_req, params) => {
    const pl = getPlaylistByName(params.name)
    if (!pl) return error("not found", 404)
    return json(getPlaylistItems(pl.id))
  },
  "POST /api/playlists/:name/items": async (req, params) => {
    const pl = getPlaylistByName(params.name)
    if (!pl) return error("not found", 404)
    const { url, title } = await body(req)
    if (!url) return error("url required")
    const items = getPlaylistItems(pl.id)
    db.insert(schema.playlistItems).values({ playlistId: pl.id, url, title: title || null, position: items.length }).run()
    const newItem = getPlaylistItems(pl.id).pop()!
    return json(newItem, 201)
  },
  "DELETE /api/playlists/:name/items/:index": (_req, params) => {
    const pl = getPlaylistByName(params.name)
    if (!pl) return error("not found", 404)
    const items = getPlaylistItems(pl.id)
    const idx = parseInt(params.index)
    if (idx < 0 || idx >= items.length) return error("invalid index")
    db.delete(schema.playlistItems).where(eq(schema.playlistItems.id, items[idx].id)).run()
    reorderPlaylistItems(pl.id)
    return json({ deleted: true })
  },
  "PATCH /api/playlists/:name/items/:index": async (req, params) => {
    const pl = getPlaylistByName(params.name)
    if (!pl) return error("not found", 404)
    const items = getPlaylistItems(pl.id)
    const idx = parseInt(params.index)
    if (idx < 0 || idx >= items.length) return error("invalid index")
    const { title, url } = await body(req)
    const updates: any = { }
    if (title !== undefined) updates.title = title || null
    if (url !== undefined) updates.url = url
    db.update(schema.playlistItems).set(updates).where(eq(schema.playlistItems.id, items[idx].id)).run()
    return json({ updated: true })
  },
  "POST /api/playlists/:name/items/move": async (req, params) => {
    const pl = getPlaylistByName(params.name)
    if (!pl) return error("not found", 404)
    const { from, to } = await body(req)
    const items = getPlaylistItems(pl.id)
    if (from < 0 || from >= items.length || to < 0 || to >= items.length) return error("invalid index")
    const moved = items.splice(from, 1)[0]
    items.splice(to, 0, moved)
    for (let i = 0; i < items.length; i++) {
      db.update(schema.playlistItems).set({ position: i }).where(eq(schema.playlistItems.id, items[i].id)).run()
    }
    return json({ moved: true })
  },

  // ── Queue ──────────────────────────────────────────────────
  "GET /api/queue": () => {
    const items = getQueueItems()
    const state = db.select().from(schema.playbackState).limit(1).get()
    return json({ items, currentId: state?.queueId || null, position: state?.position || 0 })
  },
  "POST /api/queue": async (req) => {
    const { url, title, channel, duration } = await body(req)
    if (!url) return error("url required")
    const items = getQueueItems()
    db.insert(schema.queue).values({ url, title: title || null, channel: channel || null, duration: duration || null, position: items.length }).run()
    return json(getQueueItems().pop(), 201)
  },
  "DELETE /api/queue/:index": (_req, params) => {
    const items = getQueueItems()
    const idx = parseInt(params.index)
    if (idx < 0 || idx >= items.length) return error("invalid index")
    db.delete(schema.queue).where(eq(schema.queue.id, items[idx].id)).run()
    reorderQueue()
    return json({ deleted: true })
  },
  "DELETE /api/queue": () => {
    db.delete(schema.playbackState).run()
    const r = db.delete(schema.queue).run()
    return json({ cleared: r.changes })
  },
  "POST /api/queue/move": async (req) => {
    const { from, to } = await body(req)
    const items = getQueueItems()
    if (from < 0 || from >= items.length || to < 0 || to >= items.length) return error("invalid index")
    const moved = items.splice(from, 1)[0]
    items.splice(to, 0, moved)
    for (let i = 0; i < items.length; i++) {
      db.update(schema.queue).set({ position: i }).where(eq(schema.queue.id, items[i].id)).run()
    }
    return json({ moved: true })
  },
  "POST /api/queue/current": async (req) => {
    const { queueId } = await body(req)
    const existing = db.select().from(schema.playbackState).limit(1).get()
    if (existing) {
      db.update(schema.playbackState).set({ queueId: queueId || null, updatedAt: new Date().toISOString() }).run()
    } else {
      db.insert(schema.playbackState).values({ id: 1, queueId: queueId || null, position: 0 }).run()
    }
    return json({ set: true })
  },
  "POST /api/queue/shuffle": () => {
    const items = getQueueItems()
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]]
    }
    for (let i = 0; i < items.length; i++) {
      db.update(schema.queue).set({ position: i }).where(eq(schema.queue.id, items[i].id)).run()
    }
    return json({ shuffled: true })
  },
  "POST /api/queue/position": async (req) => {
    const { position } = await body(req)
    const existing = db.select().from(schema.playbackState).limit(1).get()
    if (existing) {
      db.update(schema.playbackState).set({ position: position || 0, updatedAt: new Date().toISOString() }).run()
    } else {
      db.insert(schema.playbackState).values({ id: 1, queueId: null, position: position || 0 }).run()
    }
    return json({ set: true })
  },

  // ── History ────────────────────────────────────────────────
  "GET /api/history": (req) => {
    const limit = parseInt(new URL(req.url).searchParams.get("limit") || "200")
    const items = db.select().from(schema.history).orderBy(desc(schema.history.playedAt)).limit(limit).all()
    return json(items)
  },
  "POST /api/history": async (req) => {
    const { url, title, channel, duration, startedAt, finishedAt, watchedDuration } = await body(req)
    if (!url) return error("url required")
    db.insert(schema.history).values({
      url, title: title || null, channel: channel || null, duration: duration || null,
      startedAt: startedAt || null, finishedAt: finishedAt || null, watchedDuration: watchedDuration || null,
    }).run()
    return json(db.select().from(schema.history).orderBy(desc(schema.history.playedAt)).limit(1).get(), 201)
  },
  "DELETE /api/history/:id": (_req, params) => {
    const r = db.delete(schema.history).where(eq(schema.history.id, parseInt(params.id))).run()
    return json({ deleted: r.changes > 0 })
  },
  "DELETE /api/history": () => {
    const r = db.delete(schema.history).run()
    return json({ cleared: r.changes })
  },
  "GET /api/history/search": (req) => {
    const q = new URL(req.url).searchParams.get("q") || ""
    const field = (new URL(req.url).searchParams.get("field") || "all") as "title" | "url" | "channel" | "all"
    const whereClause = field === "all"
      ? or(like(schema.history.url, `%${q}%`), like(schema.history.title, `%${q}%`), like(schema.history.channel, `%${q}%`))
      : field === "title" ? like(schema.history.title, `%${q}%`)
      : field === "url" ? like(schema.history.url, `%${q}%`)
      : like(schema.history.channel, `%${q}%`)
    return json(db.select().from(schema.history).where(whereClause).orderBy(desc(schema.history.playedAt)).all())
  },
  "GET /api/history/sort": (req) => {
    const by = (new URL(req.url).searchParams.get("by") || "date") as "date" | "title" | "url" | "channel"
    const orderBy = by === "date" ? desc(schema.history.playedAt) : by === "title" ? schema.history.title : by === "url" ? schema.history.url : schema.history.channel
    return json(db.select().from(schema.history).orderBy(orderBy).all())
  },
  "GET /api/history/stats": () => {
    const items = db.select().from(schema.history).all()
    const uniqueUrls = new Set(items.map(i => i.url))
    const channels = new Set(items.filter(i => i.channel).map(i => i.channel!))
    return json({ total: items.length, uniqueUrls: uniqueUrls.size, channels: Array.from(channels) })
  },
  "GET /api/history/top": (req) => {
    const count = parseInt(new URL(req.url).searchParams.get("count") || "10")
    const items = db.select().from(schema.history).all()
    const urlCounts = new Map<string, { item: typeof items[0]; count: number }>()
    for (const item of items) {
      const existing = urlCounts.get(item.url)
      if (existing) existing.count++
      else urlCounts.set(item.url, { item, count: 1 })
    }
    return json(Array.from(urlCounts.values()).sort((a, b) => b.count - a.count).slice(0, count).map(e => ({ ...e.item, playCount: e.count })))
  },
  "GET /api/history/recent": (req) => {
    const count = parseInt(new URL(req.url).searchParams.get("count") || "10")
    return json(db.select().from(schema.history).orderBy(desc(schema.history.playedAt)).limit(count).all())
  },
  "GET /api/history/unique": () => {
    const items = db.select().from(schema.history).orderBy(desc(schema.history.playedAt)).all()
    const seen = new Set<string>()
    return json(items.filter(i => { if (seen.has(i.url)) return false; seen.add(i.url); return true }))
  },
  "POST /api/history/dedup": () => {
    const items = db.select().from(schema.history).orderBy(desc(schema.history.playedAt)).all()
    const seen = new Set<string>()
    const toDelete: number[] = []
    for (const item of items) {
      if (seen.has(item.url)) toDelete.push(item.id)
      else seen.add(item.url)
    }
    for (const id of toDelete) db.delete(schema.history).where(eq(schema.history.id, id)).run()
    return json({ removed: toDelete.length })
  },

  // ── Config ─────────────────────────────────────────────────
  "GET /api/config": () => {
    return json(db.select().from(schema.config).all())
  },
  "POST /api/config": async (req) => {
    const { key, value } = await body(req)
    if (!key || value === undefined) return error("key and value required")
    const existing = db.select().from(schema.config).where(eq(schema.config.key, key)).get()
    if (existing) {
      db.update(schema.config).set({ value, updatedAt: new Date().toISOString() }).where(eq(schema.config.key, key)).run()
    } else {
      db.insert(schema.config).values({ key, value }).run()
    }
    return json({ set: true })
  },
  "DELETE /api/config/:key": (_req, params) => {
    const r = db.delete(schema.config).where(eq(schema.config.key, params.key)).run()
    return json({ deleted: r.changes > 0 })
  },
  "DELETE /api/config": () => {
    const r = db.delete(schema.config).run()
    return json({ cleared: r.changes })
  },

  // ── Export / Import ────────────────────────────────────────
  "GET /api/export": () => {
    const allPls = db.select().from(schema.playlists).all()
    const allItems = db.select().from(schema.playlistItems).all()
    const allQueue = db.select().from(schema.queue).all()
    const allHistory = db.select().from(schema.history).all()
    const allConfig = db.select().from(schema.config).all()
    return json({
      playlists: allPls.map(p => ({ name: p.name, items: allItems.filter(i => i.playlistId === p.id).map(i => ({ url: i.url, title: i.title, position: i.position })) })),
      queue: allQueue.map(q => ({ url: q.url, title: q.title, channel: q.channel, duration: q.duration, position: q.position })),
      history: allHistory.map(h => ({ url: h.url, title: h.title, channel: h.channel, duration: h.duration, startedAt: h.startedAt, finishedAt: h.finishedAt, watchedDuration: h.watchedDuration, playedAt: h.playedAt })),
      config: allConfig.map(c => ({ key: c.key, value: c.value })),
    })
  },
  "POST /api/import": async (req) => {
    const { data, merge = false, include = ["playlists", "queue", "history", "config"] } = await body(req)
    if (!data) return error("data required")
    let imported = 0

    if (include.includes("playlists") && data.playlists) {
      if (!merge) { db.delete(schema.playlistItems).run(); db.delete(schema.playlists).run() }
      for (const p of data.playlists) {
        const existing = getPlaylistByName(p.name)
        let plId = existing?.id
        if (!existing) { db.insert(schema.playlists).values({ name: p.name }).run(); plId = getPlaylistByName(p.name)?.id }
        if (plId) for (const item of p.items || []) {
          db.insert(schema.playlistItems).values({ playlistId: plId, url: item.url, title: item.title, position: item.position }).run()
          imported++
        }
      }
    }
    if (include.includes("queue") && data.queue) {
      if (!merge) db.delete(schema.queue).run()
      const qItems = getQueueItems()
      const maxPos = qItems.length ? Math.max(...qItems.map(i => i.position)) + 1 : 0
      for (const q of data.queue) {
        db.insert(schema.queue).values({ url: q.url, title: q.title, channel: q.channel, duration: q.duration, position: maxPos + q.position }).run()
        imported++
      }
    }
    if (include.includes("history") && data.history) {
      if (!merge) db.delete(schema.history).run()
      for (const h of data.history) {
        db.insert(schema.history).values({ url: h.url, title: h.title, channel: h.channel, duration: h.duration, startedAt: h.startedAt, finishedAt: h.finishedAt, watchedDuration: h.watchedDuration, playedAt: h.playedAt }).run()
        imported++
      }
    }
    if (include.includes("config") && data.config) {
      if (!merge) db.delete(schema.config).run()
      for (const c of data.config) {
        db.insert(schema.config).values({ key: c.key, value: c.value }).run()
        imported++
      }
    }
    return json({ imported })
  },
}

function matchRoute(method: string, path: string): { handler: Function; params: Record<string, string> } | null {
  for (const [pattern, handler] of Object.entries(routes)) {
    const [m, routePath] = pattern.split(" ")
    if (m !== method) continue
    const routeParts = routePath.split("/")
    const pathParts = path.split("/")
    if (routeParts.length !== pathParts.length) continue
    const params: Record<string, string> = {}
    let match = true
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(":")) { params[routeParts[i].slice(1)] = pathParts[i] }
      else if (routeParts[i] !== pathParts[i]) { match = false; break }
    }
    if (match) return { handler, params }
  }
  return null
}

const PORT = parseInt(process.env.PORT || "3000")

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const corsHeaders: Record<string, string> = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
    const matched = matchRoute(req.method, url.pathname)
    if (!matched) return error("not found", 404)
    const res = await matched.handler(req, matched.params)
    for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v)
    return res
  },
})

console.log(`ytbcli server running at http://localhost:${PORT}`)
