import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core"

export const playlists = sqliteTable("playlists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").default("datetime('now')"),
  updatedAt: text("updated_at").default("datetime('now')"),
})

export const playlistItems = sqliteTable("playlist_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playlistId: integer("playlist_id").notNull().references(() => playlists.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title"),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").default("datetime('now')"),
})

export const queue = sqliteTable("queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull(),
  title: text("title"),
  channel: text("channel"),
  duration: integer("duration"),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").default("datetime('now')"),
})

export const playbackState = sqliteTable("playback_state", {
  id: integer("id").primaryKey().default(1),
  queueId: integer("queue_id").references(() => queue.id, { onDelete: "set null" }),
  position: real("position").default(0),
  updatedAt: text("updated_at").default("datetime('now')"),
})

export const history = sqliteTable("history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull(),
  title: text("title"),
  channel: text("channel"),
  duration: integer("duration"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  watchedDuration: integer("watched_duration"),
  playedAt: text("played_at").default("datetime('now')"),
})

export const config = sqliteTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").default("datetime('now')"),
})
