import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import "./setup"
import { addToHistory, removeFromHistory, removeByUrl, clearHistory, getHistoryItems, searchHistory, filterHistory, sortHistory, getHistoryStats, getRecentItems, getTopItems, getUniqueItems, deduplicateHistory, exportHistory, importHistory } from "../history"

describe("History Controller", () => {
  beforeEach(() => {
    clearHistory()
  })

  afterEach(() => {
    clearHistory()
  })

  it("should add items to history", () => {
    const now = new Date().toISOString()
    const item = addToHistory("https://example.com/1", "Video 1", "Channel 1", 120, now, now, 120)
    expect(item.url).toBe("https://example.com/1")
    expect(item.title).toBe("Video 1")
    expect(item.channel).toBe("Channel 1")
    expect(item.duration).toBe(120)
    expect(item.startedAt).toBe(now)
    expect(item.finishedAt).toBe(now)
    expect(item.watchedDuration).toBe(120)
  })

  it("should remove items from history", () => {
    addToHistory("https://example.com/1", "Video 1")
    const result = removeFromHistory(0)
    expect(result).toBe(true)
    expect(getHistoryItems().length).toBe(0)
  })

  it("should remove by URL", () => {
    addToHistory("https://example.com/1", "Video 1")
    addToHistory("https://example.com/1", "Video 1 Again")
    const count = removeByUrl("https://example.com/1")
    expect(count).toBe(2)
  })

  it("should clear history", () => {
    addToHistory("https://example.com/1", "Video 1")
    addToHistory("https://example.com/2", "Video 2")
    const count = clearHistory()
    expect(count).toBe(2)
    expect(getHistoryItems().length).toBe(0)
  })

  it("should clear history older than days", () => {
    addToHistory("https://example.com/1", "Video 1")
    const count = clearHistory(30)
    expect(count).toBe(0)
  })

  it("should get history items with limit and offset", () => {
    for (let i = 0; i < 10; i++) {
      addToHistory(`https://example.com/${i}`, `Video ${i}`)
    }
    const items = getHistoryItems(5, 0)
    expect(items.length).toBe(5)
  })

  it("should search history", () => {
    addToHistory("https://example.com/1", "Video 1")
    addToHistory("https://example.com/2", "Video 2")
    const results = searchHistory("Video 1")
    expect(results.length).toBe(1)
    expect(results[0].title).toBe("Video 1")
  })

  it("should filter history by field", () => {
    addToHistory("https://example.com/1", "Video 1", "Channel 1")
    addToHistory("https://example.com/2", "Video 2", "Channel 2")
    const results = filterHistory("Channel 1", "channel")
    expect(results.length).toBe(1)
    expect(results[0].channel).toBe("Channel 1")
  })

  it("should sort history", () => {
    addToHistory("https://example.com/2", "Video 2")
    addToHistory("https://example.com/1", "Video 1")
    const items = sortHistory("title")
    expect(items[0].title).toBe("Video 1")
    expect(items[1].title).toBe("Video 2")
  })

  it("should get history stats", () => {
    addToHistory("https://example.com/1", "Video 1", "Channel 1")
    addToHistory("https://example.com/1", "Video 1 Again", "Channel 1")
    const stats = getHistoryStats()
    expect(stats.total).toBe(2)
    expect(stats.uniqueUrls).toBe(1)
    expect(stats.channels).toContain("Channel 1")
  })

  it("should get recent items", () => {
    for (let i = 0; i < 10; i++) {
      addToHistory(`https://example.com/${i}`, `Video ${i}`)
    }
    const items = getRecentItems(5)
    expect(items.length).toBe(5)
  })

  it("should get top items", () => {
    addToHistory("https://example.com/1", "Video 1")
    addToHistory("https://example.com/1", "Video 1 Again")
    addToHistory("https://example.com/2", "Video 2")
    const items = getTopItems(2)
    expect(items.length).toBe(2)
    expect(items[0].url).toBe("https://example.com/1")
  })

  it("should get unique items", () => {
    addToHistory("https://example.com/1", "Video 1")
    addToHistory("https://example.com/1", "Video 1 Again")
    addToHistory("https://example.com/2", "Video 2")
    const items = getUniqueItems()
    expect(items.length).toBe(2)
  })

  it("should deduplicate history", () => {
    addToHistory("https://example.com/1", "Video 1")
    addToHistory("https://example.com/1", "Video 1 Again")
    addToHistory("https://example.com/2", "Video 2")
    const removed = deduplicateHistory()
    expect(removed).toBe(1)
    expect(getHistoryItems().length).toBe(2)
  })

  it("should export history", () => {
    addToHistory("https://example.com/1", "Video 1")
    addToHistory("https://example.com/2", "Video 2")
    const items = exportHistory()
    expect(items.length).toBe(2)
  })

  it("should import history", () => {
    const items = [
      { url: "https://example.com/1", title: "Video 1", channel: null, duration: null, startedAt: null, finishedAt: null, watchedDuration: null, playedAt: new Date().toISOString() },
      { url: "https://example.com/2", title: "Video 2", channel: null, duration: null, startedAt: null, finishedAt: null, watchedDuration: null, playedAt: new Date().toISOString() },
    ]
    const count = importHistory(items)
    expect(count).toBe(2)
    expect(getHistoryItems().length).toBe(2)
  })

  it("should import history with merge", () => {
    addToHistory("https://example.com/1", "Video 1")
    const items = [
      { url: "https://example.com/2", title: "Video 2", channel: null, duration: null, startedAt: null, finishedAt: null, watchedDuration: null, playedAt: new Date().toISOString() },
    ]
    const count = importHistory(items, true)
    expect(count).toBe(1)
    expect(getHistoryItems().length).toBe(2)
  })
})
