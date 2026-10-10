import { eq, like, sql, desc, or } from "drizzle-orm"
import { db } from "./index"
import { history } from "./schema"

export type HistoryItem = typeof history.$inferSelect

export function addToHistory(
  url: string,
  title?: string,
  channel?: string,
  duration?: number,
  startedAt?: string,
  finishedAt?: string,
  watchedDuration?: number,
): HistoryItem {
  db.insert(history).values({
    url,
    title: title || null,
    channel: channel || null,
    duration: duration || null,
    startedAt: startedAt || null,
    finishedAt: finishedAt || null,
    watchedDuration: watchedDuration || null,
  }).run()

  return db.select().from(history).orderBy(desc(history.playedAt)).limit(1).get()!
}

export function removeFromHistory(index: number): boolean {
  const items = getHistoryItems()
  if (index < 0 || index >= items.length) return false

  const item = items[index]
  db.delete(history).where(eq(history.id, item.id)).run()

  return true
}

export function removeByUrl(url: string): number {
  const result = db.delete(history).where(eq(history.url, url)).run()
  return result.changes
}

export function clearHistory(olderThanDays?: number): number {
  if (olderThanDays) {
    const result = db.delete(history).where(sql`played_at < datetime('now', '-${olderThanDays} days')`).run()
    return result.changes
  }

  const result = db.delete(history).run()
  return result.changes
}

import { getRatingsMap } from "./ratings"

export type HistoryItemWithRating = HistoryItem & {
  rating?: number | null
}

export function getHistoryItems(limit: number = 50, offset: number = 0, minRating?: number): HistoryItemWithRating[] {
  const ratingsMap = getRatingsMap()
  const items = db.select().from(history).orderBy(desc(history.playedAt)).limit(minRating !== undefined ? 1000 : limit).offset(minRating !== undefined ? 0 : offset).all()
  const withRatings = items.map(item => ({
    ...item,
    rating: ratingsMap.get(item.url) ?? null,
  }))

  if (minRating !== undefined) {
    return withRatings
      .filter(item => item.rating !== null && item.rating >= minRating)
      .slice(offset, offset + limit)
  }

  return withRatings
}

export function searchHistory(query: string): HistoryItemWithRating[] {
  const ratingsMap = getRatingsMap()
  return db.select().from(history)
    .where(or(like(history.url, `%${query}%`), like(history.title, `%${query}%`)))
    .orderBy(desc(history.playedAt))
    .all()
    .map(item => ({
      ...item,
      rating: ratingsMap.get(item.url) ?? null,
    }))
}

export function filterHistory(query: string, field: "title" | "url" | "channel" | "all" = "all"): HistoryItemWithRating[] {
  const ratingsMap = getRatingsMap()
  const whereClause = field === "all"
    ? or(like(history.url, `%${query}%`), like(history.title, `%${query}%`), like(history.channel, `%${query}%`))
    : field === "title"
      ? like(history.title, `%${query}%`)
      : field === "url"
        ? like(history.url, `%${query}%`)
        : like(history.channel, `%${query}%`)

  return db.select().from(history).where(whereClause).orderBy(desc(history.playedAt)).all().map(item => ({
    ...item,
    rating: ratingsMap.get(item.url) ?? null,
  }))
}

export function sortHistory(by: "date" | "title" | "url" | "channel" | "rating"): HistoryItemWithRating[] {
  const ratingsMap = getRatingsMap()
  const items = db.select().from(history).all().map(item => ({
    ...item,
    rating: ratingsMap.get(item.url) ?? null,
  }))

  if (by === "rating") {
    return items.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
  }

  if (by === "date") {
    return items.sort((a, b) => ((b.playedAt || "") > (a.playedAt || "") ? 1 : -1))
  }

  if (by === "title") {
    return items.sort((a, b) => (a.title || "").localeCompare(b.title || ""))
  }

  if (by === "url") {
    return items.sort((a, b) => a.url.localeCompare(b.url))
  }

  return items.sort((a, b) => (a.channel || "").localeCompare(b.channel || ""))
}

export function getHistoryStats(): { total: number; uniqueUrls: number; channels: string[] } {
  const items = db.select().from(history).all()
  const uniqueUrls = new Set(items.map(i => i.url))
  const channels = new Set(items.filter(i => i.channel).map(i => i.channel!))

  return {
    total: items.length,
    uniqueUrls: uniqueUrls.size,
    channels: Array.from(channels),
  }
}

export function getRecentItems(count: number = 10): HistoryItem[] {
  return db.select().from(history).orderBy(desc(history.playedAt)).limit(count).all()
}

export function getTopItems(count: number = 10): HistoryItem[] {
  const items = db.select().from(history).all()

  const urlCounts = new Map<string, { item: HistoryItem; count: number }>()
  for (const item of items) {
    const existing = urlCounts.get(item.url)
    if (existing) {
      existing.count++
    } else {
      urlCounts.set(item.url, { item, count: 1 })
    }
  }

  return Array.from(urlCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, count)
    .map(entry => entry.item)
}

export function getUniqueItems(): HistoryItem[] {
  const seen = new Set<string>()
  const unique: HistoryItem[] = []

  const items = db.select().from(history).orderBy(desc(history.playedAt)).all()
  for (const item of items) {
    if (!seen.has(item.url)) {
      seen.add(item.url)
      unique.push(item)
    }
  }

  return unique
}

export function deduplicateHistory(): number {
  const items = db.select().from(history).orderBy(desc(history.playedAt)).all()
  const seen = new Set<string>()
  const toDelete: number[] = []

  for (const item of items) {
    if (seen.has(item.url)) {
      toDelete.push(item.id)
    } else {
      seen.add(item.url)
    }
  }

  for (const id of toDelete) {
    db.delete(history).where(eq(history.id, id)).run()
  }

  return toDelete.length
}

export function exportHistory(limit?: number): HistoryItem[] {
  const query = db.select().from(history).orderBy(desc(history.playedAt))
  return (limit ? query.limit(limit) : query).all()
}

export function importHistory(items: Omit<HistoryItem, "id">[], merge: boolean = false): number {
  if (!merge) {
    db.delete(history).run()
  }

  let count = 0
  for (const item of items) {
    db.insert(history).values({
      url: item.url,
      title: item.title,
      channel: item.channel,
      duration: item.duration,
      startedAt: item.startedAt,
      finishedAt: item.finishedAt,
      watchedDuration: item.watchedDuration,
      playedAt: item.playedAt,
    }).run()
    count++
  }

  return count
}
