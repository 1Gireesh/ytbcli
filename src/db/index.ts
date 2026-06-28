import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"
import { join } from "path"
import { mkdirSync, existsSync } from "fs"
import * as schema from "./schema"

const DATA_DIR = join(process.env.HOME || "~", ".local/share/ytcli")
const DB_PATH = join(DATA_DIR, "ytcli.db")

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

const sqlite = new Database(DB_PATH)
sqlite.exec("PRAGMA journal_mode = WAL")
sqlite.exec("PRAGMA foreign_keys = ON")

export const db = drizzle(sqlite, { schema })
