import { eq, desc, asc, gte } from "drizzle-orm"
import { db } from "./index"
import { ratings } from "./schema"

export type RatingItem = typeof ratings.$inferSelect

export function setRating(
  url: string,
  rating: number,
  title?: string,
  channel?: string,
  duration?: number,
): RatingItem {
  if (rating < 1 || rating > 10) {
    throw new Error("Rating must be an integer between 1 and 10")
  }

  const existing = db.select().from(ratings).where(eq(ratings.url, url)).get()

  if (existing) {
    db.update(ratings)
      .set({
        rating,
        title: title || existing.title,
        channel: channel || existing.channel,
        duration: duration || existing.duration,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(ratings.id, existing.id))
      .run()
    return db.select().from(ratings).where(eq(ratings.id, existing.id)).get()!
  }

  db.insert(ratings)
    .values({
      url,
      rating,
      title: title || null,
      channel: channel || null,
      duration: duration || null,
    })
    .run()

  return db.select().from(ratings).where(eq(ratings.url, url)).get()!
}

export function getRating(url: string): RatingItem | null {
  const item = db.select().from(ratings).where(eq(ratings.url, url)).get()
  return item || null
}

export function removeRating(url: string): boolean {
  const res = db.delete(ratings).where(eq(ratings.url, url)).run()
  return res.changes > 0
}

export function listRatings(options?: {
  minRating?: number
  sortBy?: "rating" | "date" | "title"
  limit?: number
  offset?: number
}): RatingItem[] {
  const minRating = options?.minRating ?? 1
  const sortBy = options?.sortBy || "rating"
  const limit = options?.limit || 50
  const offset = options?.offset || 0

  let order
  if (sortBy === "date") {
    order = desc(ratings.updatedAt)
  } else if (sortBy === "title") {
    order = asc(ratings.title)
  } else {
    order = desc(ratings.rating)
  }

  return db
    .select()
    .from(ratings)
    .where(gte(ratings.rating, minRating))
    .orderBy(order)
    .limit(limit)
    .offset(offset)
    .all()
}

export function getRatingsMap(): Map<string, number> {
  const allRatings = db.select().from(ratings).all()
  const map = new Map<string, number>()
  for (const r of allRatings) {
    map.set(r.url, r.rating)
  }
  return map
}
