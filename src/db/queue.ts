import { eq, asc } from "drizzle-orm"
import { db } from "./index"
import { queue, playbackState } from "./schema"

export type QueueItem = typeof queue.$inferSelect

export function add(url: string, title?: string, channel?: string, duration?: number): QueueItem {
  const items = list()
  const position = items.length

  db.insert(queue).values({
    url,
    title: title || null,
    channel: channel || null,
    duration: duration || null,
    position,
  }).run()

  return db.select().from(queue).orderBy(asc(queue.position)).all().pop()!
}

export function remove(index: number): boolean {
  const items = list()
  if (index < 0 || index >= items.length) return false

  const item = items[index]
  db.delete(queue).where(eq(queue.id, item.id)).run()

  reorder()
  return true
}

export function move(from: number, to: number): boolean {
  const items = list()
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return false

  const movedItem = items.splice(from, 1)[0]
  items.splice(to, 0, movedItem)

  for (let i = 0; i < items.length; i++) {
    db.update(queue).set({ position: i }).where(eq(queue.id, items[i].id)).run()
  }

  return true
}

export function clear(): number {
  const items = list()
  const count = items.length

  db.delete(playbackState).run()
  db.delete(queue).run()

  return count
}

export function list(): QueueItem[] {
  return db.select().from(queue).orderBy(asc(queue.position)).all()
}

export function current(): QueueItem | null {
  const state = db.select().from(playbackState).limit(1).get()
  if (!state?.queueId) return null

  const item = db.select().from(queue).where(eq(queue.id, state.queueId)).get()
  return item || null
}

export function setCurrent(queueId: number | null): void {
  const existing = db.select().from(playbackState).limit(1).get()

  if (existing) {
    db.update(playbackState)
      .set({
        queueId,
        updatedAt: new Date().toISOString(),
      })
      .run()
  } else {
    db.insert(playbackState)
      .values({
        id: 1,
        queueId,
        position: 0,
      })
      .run()
  }
}

export function next(): QueueItem | null {
  const items = list()
  const state = db.select().from(playbackState).limit(1).get()

  if (!state?.queueId || items.length === 0) return null

  const currentIndex = items.findIndex(item => item.id === state.queueId)
  if (currentIndex === -1 || currentIndex >= items.length - 1) return null

  return items[currentIndex + 1]
}

export function prev(): QueueItem | null {
  const items = list()
  const state = db.select().from(playbackState).limit(1).get()

  if (!state?.queueId || items.length === 0) return null

  const currentIndex = items.findIndex(item => item.id === state.queueId)
  if (currentIndex <= 0) return null

  return items[currentIndex - 1]
}

export function peek(): QueueItem | null {
  const items = list()
  const state = db.select().from(playbackState).limit(1).get()

  if (!state?.queueId) return items[0] || null

  const currentIndex = items.findIndex(item => item.id === state.queueId)
  if (currentIndex === -1 || currentIndex >= items.length - 1) return null

  return items[currentIndex + 1]
}

export function getPosition(): number {
  const state = db.select().from(playbackState).limit(1).get()
  return state?.position || 0
}

export function setPosition(seconds: number): void {
  const existing = db.select().from(playbackState).limit(1).get()

  if (existing) {
    db.update(playbackState)
      .set({
        position: seconds,
        updatedAt: new Date().toISOString(),
      })
      .run()
  } else {
    db.insert(playbackState)
      .values({
        id: 1,
        queueId: null,
        position: seconds,
      })
      .run()
  }
}

function reorder(): void {
  const items = db.select().from(queue).orderBy(asc(queue.position)).all()

  for (let i = 0; i < items.length; i++) {
    db.update(queue).set({ position: i }).where(eq(queue.id, items[i].id)).run()
  }
}
