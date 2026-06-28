import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import "./setup"
import { add, remove, move, clear, list, current, setCurrent, next, prev, peek, getPosition, setPosition } from "../queue"

describe("Queue Controller", () => {
  beforeEach(() => {
    clear()
  })

  afterEach(() => {
    clear()
  })

  it("should add items to queue", () => {
    const item = add("https://example.com/1", "Video 1", "Channel 1", 120)
    expect(item.url).toBe("https://example.com/1")
    expect(item.title).toBe("Video 1")
    expect(item.channel).toBe("Channel 1")
    expect(item.duration).toBe(120)
    expect(list().length).toBe(1)
  })

  it("should remove items from queue", () => {
    add("https://example.com/1", "Video 1")
    const result = remove(0)
    expect(result).toBe(true)
    expect(list().length).toBe(0)
  })

  it("should move items in queue", () => {
    add("https://example.com/1", "Video 1")
    add("https://example.com/2", "Video 2")
    const result = move(0, 1)
    expect(result).toBe(true)
    const items = list()
    expect(items[0].url).toBe("https://example.com/2")
    expect(items[1].url).toBe("https://example.com/1")
  })

  it("should clear queue", () => {
    add("https://example.com/1", "Video 1")
    add("https://example.com/2", "Video 2")
    const count = clear()
    expect(count).toBe(2)
    expect(list().length).toBe(0)
  })

  it("should get current item", () => {
    const item = add("https://example.com/1", "Video 1")
    setCurrent(item.id)
    const currentItem = current()
    expect(currentItem?.url).toBe("https://example.com/1")
  })

  it("should get next item", () => {
    const item1 = add("https://example.com/1", "Video 1")
    const item2 = add("https://example.com/2", "Video 2")
    setCurrent(item1.id)
    const nextItem = next()
    expect(nextItem?.url).toBe("https://example.com/2")
  })

  it("should get prev item", () => {
    const item1 = add("https://example.com/1", "Video 1")
    const item2 = add("https://example.com/2", "Video 2")
    setCurrent(item2.id)
    const prevItem = prev()
    expect(prevItem?.url).toBe("https://example.com/1")
  })

  it("should peek at next item", () => {
    const item1 = add("https://example.com/1", "Video 1")
    const item2 = add("https://example.com/2", "Video 2")
    setCurrent(item1.id)
    const peekItem = peek()
    expect(peekItem?.url).toBe("https://example.com/2")
    expect(list().length).toBe(2)
  })

  it("should get and set position", () => {
    setPosition(120.5)
    const position = getPosition()
    expect(position).toBe(120.5)
  })

  it("should return null for next at end of queue", () => {
    const item = add("https://example.com/1", "Video 1")
    setCurrent(item.id)
    const nextItem = next()
    expect(nextItem).toBeNull()
  })

  it("should return null for prev at start of queue", () => {
    const item = add("https://example.com/1", "Video 1")
    setCurrent(item.id)
    const prevItem = prev()
    expect(prevItem).toBeNull()
  })
})
