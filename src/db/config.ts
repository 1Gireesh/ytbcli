import { eq } from "drizzle-orm"
import { db } from "./index"
import { config } from "./schema"

export type ConfigItem = typeof config.$inferSelect

export function getConfig(key: string): string | undefined {
  const item = db.select().from(config).where(eq(config.key, key)).get()
  return item?.value
}

export function setConfig(key: string, value: string): void {
  const existing = db.select().from(config).where(eq(config.key, key)).get()

  if (existing) {
    db.update(config).set({ value, updatedAt: new Date().toISOString() }).where(eq(config.key, key)).run()
  } else {
    db.insert(config).values({ key, value }).run()
  }
}

export function listConfig(): ConfigItem[] {
  return db.select().from(config).all()
}

export function resetConfig(key?: string): boolean {
  if (key) {
    const result = db.delete(config).where(eq(config.key, key)).run()
    return result.changes > 0
  }

  const result = db.delete(config).run()
  return result.changes > 0
}

export function getConfigPath(): string {
  const home = process.env.HOME || "~"
  return `${home}/.local/share/ytcli/ytcli.db`
}
