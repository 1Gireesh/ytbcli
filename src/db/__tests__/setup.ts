import { beforeAll } from "bun:test"
import { db } from "../index"
import { sql } from "drizzle-orm"

beforeAll(() => {
  db.run(sql`DROP TABLE IF EXISTS history`)
  db.run(sql`DROP TABLE IF EXISTS playback_state`)
  db.run(sql`DROP TABLE IF EXISTS queue`)
  db.run(sql`DROP TABLE IF EXISTS playlist_items`)
  db.run(sql`DROP TABLE IF EXISTS playlists`)
  db.run(sql`DROP TABLE IF EXISTS config`)

  db.run(sql`
    CREATE TABLE playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(sql`
    CREATE TABLE playlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    )
  `)

  db.run(sql`
    CREATE TABLE queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT,
      channel TEXT,
      duration INTEGER,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(sql`
    CREATE TABLE playback_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      queue_id INTEGER,
      position REAL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (queue_id) REFERENCES queue(id) ON DELETE SET NULL
    )
  `)

  db.run(sql`
    CREATE TABLE history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT,
      channel TEXT,
      duration INTEGER,
      started_at TEXT,
      finished_at TEXT,
      watched_duration INTEGER,
      played_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(sql`
    CREATE TABLE config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)
})
