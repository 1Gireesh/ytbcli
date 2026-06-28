import { eq, like, sql } from "drizzle-orm";
import { db } from "./index";
import { playlists, playlistItems } from "./schema";

export type Playlist = typeof playlists.$inferSelect;
export type PlaylistItem = typeof playlistItems.$inferSelect;

export function createPlaylist(name: string): Playlist {
  db.insert(playlists).values({ name }).run();
  return db.select().from(playlists).where(eq(playlists.name, name)).get()!;
}

export function deletePlaylist(name: string): boolean {
  const result = db.delete(playlists).where(eq(playlists.name, name)).run();
  return result.changes > 0;
}

export function renamePlaylist(oldName: string, newName: string): boolean {
  const result = db
    .update(playlists)
    .set({ name: newName, updatedAt: new Date().toISOString() })
    .where(eq(playlists.name, oldName))
    .run();
  return result.changes > 0;
}

export function getPlaylist(name: string): Playlist | undefined {
  return db.select().from(playlists).where(eq(playlists.name, name)).get();
}

export function listPlaylists(): Playlist[] {
  return db.select().from(playlists).orderBy(playlists.name).all();
}

export function copyPlaylist(source: string, dest: string): boolean {
  const sourcePlaylist = getPlaylist(source);
  if (!sourcePlaylist) return false;
  if (getPlaylist(dest)) return false;

  const newPlaylist = createPlaylist(dest);
  const items = getPlaylistItems(source);

  if (items.length > 0) {
    db.insert(playlistItems)
      .values(
        items.map((item) => ({
          playlistId: newPlaylist.id,
          url: item.url,
          title: item.title,
          position: item.position,
        })),
      )
      .run();
  }

  return true;
}

export function mergePlaylists(source: string, dest: string): boolean {
  const sourcePlaylist = getPlaylist(source);
  const destPlaylist = getPlaylist(dest);
  if (!sourcePlaylist || !destPlaylist) return false;

  const items = getPlaylistItems(source);
  const destItems = getPlaylistItems(dest);
  const maxPosition =
    destItems.length > 0
      ? Math.max(...destItems.map((i) => i.position)) + 1
      : 0;

  if (items.length > 0) {
    db.insert(playlistItems)
      .values(
        items.map((item) => ({
          playlistId: destPlaylist.id,
          url: item.url,
          title: item.title,
          position: maxPosition + item.position,
        })),
      )
      .run();
  }

  return true;
}

export function addPlaylistItem(
  playlistName: string,
  url: string,
  title?: string,
): PlaylistItem {
  const playlist = getPlaylist(playlistName);
  if (!playlist) throw new Error(`Playlist "${playlistName}" not found`);

  const items = getPlaylistItems(playlistName);
  const position = items.length;

  db.insert(playlistItems)
    .values({
      playlistId: playlist.id,
      url,
      title: title || null,
      position,
    })
    .run();

  return db
    .select()
    .from(playlistItems)
    .where(eq(playlistItems.playlistId, playlist.id))
    .orderBy(playlistItems.position)
    .all()
    .pop()!;
}

export function removePlaylistItem(
  playlistName: string,
  index: number,
): boolean {
  const playlist = getPlaylist(playlistName);
  if (!playlist) return false;

  const items = getPlaylistItems(playlistName);
  if (index < 0 || index >= items.length) return false;

  const item = items[index];
  db.delete(playlistItems).where(eq(playlistItems.id, item.id)).run();

  reorderPlaylistItems(playlist.id);
  return true;
}

export function movePlaylistItem(
  playlistName: string,
  from: number,
  to: number,
): boolean {
  const playlist = getPlaylist(playlistName);
  if (!playlist) return false;

  const items = getPlaylistItems(playlistName);
  if (from < 0 || from >= items.length || to < 0 || to >= items.length)
    return false;

  const movedItem = items.splice(from, 1)[0];
  items.splice(to, 0, movedItem);

  for (let i = 0; i < items.length; i++) {
    db.update(playlistItems)
      .set({ position: i })
      .where(eq(playlistItems.id, items[i].id))
      .run();
  }

  return true;
}

export function swapPlaylistItems(
  playlistName: string,
  index1: number,
  index2: number,
): boolean {
  const playlist = getPlaylist(playlistName);
  if (!playlist) return false;

  const items = getPlaylistItems(playlistName);
  if (
    index1 < 0 ||
    index1 >= items.length ||
    index2 < 0 ||
    index2 >= items.length
  )
    return false;
  if (!items || items.length === 0) return false;

  const temp = items[index1].position;
  items[index1].position = items[index2].position;
  items[index2].position = temp;

  db.update(playlistItems)
    .set({ position: items[index1].position })
    .where(eq(playlistItems.id, items[index1].id))
    .run();
  db.update(playlistItems)
    .set({ position: items[index2].position })
    .where(eq(playlistItems.id, items[index2].id))
    .run();

  return true;
}

export function getPlaylistItems(playlistName: string): PlaylistItem[] {
  const playlist = getPlaylist(playlistName);
  if (!playlist) return [];

  return db
    .select()
    .from(playlistItems)
    .where(eq(playlistItems.playlistId, playlist.id))
    .orderBy(playlistItems.position)
    .all();
}

export function clearPlaylist(playlistName: string): boolean {
  const playlist = getPlaylist(playlistName);
  if (!playlist) return false;

  const result = db
    .delete(playlistItems)
    .where(eq(playlistItems.playlistId, playlist.id))
    .run();
  return result.changes > 0;
}

export function searchPlaylist(
  playlistName: string,
  query: string,
): PlaylistItem[] {
  const playlist = getPlaylist(playlistName);
  if (!playlist) return [];

  return db
    .select()
    .from(playlistItems)
    .where(
      sql`${playlistItems.playlistId} = ${playlist.id} AND (${like(playlistItems.url, `%${query}%`)} OR ${like(playlistItems.title, `%${query}%`)})`,
    )
    .orderBy(playlistItems.position)
    .all();
}

export function sortPlaylist(
  playlistName: string,
  by: "title" | "url" | "position",
  reverse: boolean = false,
): boolean {
  const playlist = getPlaylist(playlistName);
  if (!playlist) return false;

  const items = getPlaylistItems(playlistName);
  items.sort((a, b) => {
    const aVal =
      by === "position" ? a.position : by === "title" ? a.title || "" : a.url;
    const bVal =
      by === "position" ? b.position : by === "title" ? b.title || "" : b.url;
    return reverse ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
  });

  for (let i = 0; i < items.length; i++) {
    db.update(playlistItems)
      .set({ position: i })
      .where(eq(playlistItems.id, items[i].id))
      .run();
  }

  return true;
}

export function getPlaylistStats(playlistName: string): {
  count: number;
  urls: string[];
} {
  const items = getPlaylistItems(playlistName);
  return {
    count: items.length,
    urls: items.map((i) => i.url),
  };
}

export function findDuplicates(playlistName: string): PlaylistItem[] {
  const items = getPlaylistItems(playlistName);
  const seen = new Map<string, PlaylistItem[]>();
  const duplicates: PlaylistItem[] = [];

  for (const item of items) {
    const existing = seen.get(item.url) || [];
    existing.push(item);
    seen.set(item.url, existing);
  }

  for (const [, group] of seen) {
    if (group.length > 1) {
      duplicates.push(...group.slice(1));
    }
  }

  return duplicates;
}

export function deduplicatePlaylist(playlistName: string): number {
  const playlist = getPlaylist(playlistName);
  if (!playlist) return 0;

  const items = getPlaylistItems(playlistName);
  const seen = new Set<string>();
  const toDelete: number[] = [];

  for (const item of items) {
    if (seen.has(item.url)) {
      toDelete.push(item.id);
    } else {
      seen.add(item.url);
    }
  }

  if (toDelete.length > 0) {
    for (const id of toDelete) {
      db.delete(playlistItems).where(eq(playlistItems.id, id)).run();
    }
    reorderPlaylistItems(playlist.id);
  }

  return toDelete.length;
}

function reorderPlaylistItems(playlistId: number): void {
  const items = db
    .select()
    .from(playlistItems)
    .where(eq(playlistItems.playlistId, playlistId))
    .orderBy(playlistItems.position)
    .all();

  for (let i = 0; i < items.length; i++) {
    db.update(playlistItems)
      .set({ position: i })
      .where(eq(playlistItems.id, items[i].id))
      .run();
  }
}
