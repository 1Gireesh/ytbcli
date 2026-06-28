import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import "./setup"
import { createPlaylist, deletePlaylist, getPlaylist, listPlaylists, renamePlaylist, copyPlaylist, mergePlaylists, addPlaylistItem, removePlaylistItem, movePlaylistItem, swapPlaylistItems, getPlaylistItems, clearPlaylist, searchPlaylist, sortPlaylist, getPlaylistStats, findDuplicates, deduplicatePlaylist } from "../playlists"

describe("Playlist Controller", () => {
  beforeEach(() => {
    deletePlaylist("test-playlist")
    deletePlaylist("test-playlist-2")
    deletePlaylist("copy-playlist")
    deletePlaylist("merge-playlist")
  })

  afterEach(() => {
    deletePlaylist("test-playlist")
    deletePlaylist("test-playlist-2")
    deletePlaylist("copy-playlist")
    deletePlaylist("merge-playlist")
  })

  it("should create a playlist", () => {
    const playlist = createPlaylist("test-playlist")
    expect(playlist.name).toBe("test-playlist")
    expect(playlist.id).toBeDefined()
  })

  it("should get a playlist", () => {
    createPlaylist("test-playlist")
    const playlist = getPlaylist("test-playlist")
    expect(playlist).toBeDefined()
    expect(playlist?.name).toBe("test-playlist")
  })

  it("should list playlists", () => {
    createPlaylist("test-playlist")
    createPlaylist("test-playlist-2")
    const playlists = listPlaylists()
    expect(playlists.length).toBeGreaterThanOrEqual(2)
  })

  it("should rename a playlist", () => {
    createPlaylist("test-playlist")
    const result = renamePlaylist("test-playlist", "renamed-playlist")
    expect(result).toBe(true)
    expect(getPlaylist("renamed-playlist")).toBeDefined()
    expect(getPlaylist("test-playlist")).toBeUndefined()
    deletePlaylist("renamed-playlist")
  })

  it("should delete a playlist", () => {
    createPlaylist("test-playlist")
    const result = deletePlaylist("test-playlist")
    expect(result).toBe(true)
    expect(getPlaylist("test-playlist")).toBeUndefined()
  })

  it("should copy a playlist", () => {
    createPlaylist("test-playlist")
    addPlaylistItem("test-playlist", "https://example.com/1", "Video 1")
    const result = copyPlaylist("test-playlist", "copy-playlist")
    expect(result).toBe(true)
    expect(getPlaylist("copy-playlist")).toBeDefined()
    expect(getPlaylistItems("copy-playlist").length).toBe(1)
  })

  it("should merge playlists", () => {
    createPlaylist("test-playlist")
    createPlaylist("merge-playlist")
    addPlaylistItem("test-playlist", "https://example.com/1", "Video 1")
    addPlaylistItem("merge-playlist", "https://example.com/2", "Video 2")
    const result = mergePlaylists("test-playlist", "merge-playlist")
    expect(result).toBe(true)
    expect(getPlaylistItems("merge-playlist").length).toBe(2)
  })

  it("should add items to playlist", () => {
    createPlaylist("test-playlist")
    const item = addPlaylistItem("test-playlist", "https://example.com/1", "Video 1")
    expect(item.url).toBe("https://example.com/1")
    expect(item.title).toBe("Video 1")
  })

  it("should remove items from playlist", () => {
    createPlaylist("test-playlist")
    addPlaylistItem("test-playlist", "https://example.com/1", "Video 1")
    const result = removePlaylistItem("test-playlist", 0)
    expect(result).toBe(true)
    expect(getPlaylistItems("test-playlist").length).toBe(0)
  })

  it("should move items in playlist", () => {
    createPlaylist("test-playlist")
    addPlaylistItem("test-playlist", "https://example.com/1", "Video 1")
    addPlaylistItem("test-playlist", "https://example.com/2", "Video 2")
    const result = movePlaylistItem("test-playlist", 0, 1)
    expect(result).toBe(true)
    const items = getPlaylistItems("test-playlist")
    expect(items[0].url).toBe("https://example.com/2")
    expect(items[1].url).toBe("https://example.com/1")
  })

  it("should swap items in playlist", () => {
    createPlaylist("test-playlist")
    addPlaylistItem("test-playlist", "https://example.com/1", "Video 1")
    addPlaylistItem("test-playlist", "https://example.com/2", "Video 2")
    const result = swapPlaylistItems("test-playlist", 0, 1)
    expect(result).toBe(true)
    const items = getPlaylistItems("test-playlist")
    expect(items[0].url).toBe("https://example.com/2")
    expect(items[1].url).toBe("https://example.com/1")
  })

  it("should clear playlist", () => {
    createPlaylist("test-playlist")
    addPlaylistItem("test-playlist", "https://example.com/1", "Video 1")
    const result = clearPlaylist("test-playlist")
    expect(result).toBe(true)
    expect(getPlaylistItems("test-playlist").length).toBe(0)
  })

  it("should search playlist", () => {
    createPlaylist("test-playlist")
    addPlaylistItem("test-playlist", "https://example.com/1", "Video 1")
    addPlaylistItem("test-playlist", "https://example.com/2", "Video 2")
    const results = searchPlaylist("test-playlist", "Video 1")
    expect(results.length).toBe(1)
    expect(results[0].title).toBe("Video 1")
  })

  it("should sort playlist", () => {
    createPlaylist("test-playlist")
    addPlaylistItem("test-playlist", "https://example.com/2", "Video 2")
    addPlaylistItem("test-playlist", "https://example.com/1", "Video 1")
    const result = sortPlaylist("test-playlist", "title")
    expect(result).toBe(true)
    const items = getPlaylistItems("test-playlist")
    expect(items[0].title).toBe("Video 1")
    expect(items[1].title).toBe("Video 2")
  })

  it("should get playlist stats", () => {
    createPlaylist("test-playlist")
    addPlaylistItem("test-playlist", "https://example.com/1", "Video 1")
    const stats = getPlaylistStats("test-playlist")
    expect(stats.count).toBe(1)
    expect(stats.urls).toContain("https://example.com/1")
  })

  it("should find duplicates", () => {
    createPlaylist("test-playlist")
    addPlaylistItem("test-playlist", "https://example.com/1", "Video 1")
    addPlaylistItem("test-playlist", "https://example.com/1", "Video 1 Duplicate")
    const duplicates = findDuplicates("test-playlist")
    expect(duplicates.length).toBe(1)
  })

  it("should deduplicate playlist", () => {
    createPlaylist("test-playlist")
    addPlaylistItem("test-playlist", "https://example.com/1", "Video 1")
    addPlaylistItem("test-playlist", "https://example.com/1", "Video 1 Duplicate")
    const removed = deduplicatePlaylist("test-playlist")
    expect(removed).toBe(1)
    expect(getPlaylistItems("test-playlist").length).toBe(1)
  })
})
