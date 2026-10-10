import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import "./setup"
import { db } from "../index"
import { ratings } from "../schema"
import { setRating, getRating, removeRating, listRatings, getRatingsMap } from "../ratings"

describe("Ratings Controller", () => {
  beforeEach(() => {
    db.delete(ratings).run()
  })

  afterEach(() => {
    db.delete(ratings).run()
  })

  it("should add and retrieve a rating", () => {
    const item = setRating("https://example.com/1", 8, "Test Title", "Test Channel", 180)
    expect(item.url).toBe("https://example.com/1")
    expect(item.rating).toBe(8)
    expect(item.title).toBe("Test Title")
    expect(item.channel).toBe("Test Channel")
    expect(item.duration).toBe(180)

    const fetched = getRating("https://example.com/1")
    expect(fetched).not.toBeNull()
    expect(fetched?.rating).toBe(8)
  })

  it("should update an existing rating", () => {
    setRating("https://example.com/1", 5, "Test Title", "Test Channel", 180)
    const updated = setRating("https://example.com/1", 9)
    expect(updated.rating).toBe(9)
    expect(updated.title).toBe("Test Title")
    expect(getRating("https://example.com/1")?.rating).toBe(9)
  })

  it("should throw error for out of range ratings", () => {
    expect(() => setRating("https://example.com/1", 0)).toThrow()
    expect(() => setRating("https://example.com/1", 11)).toThrow()
  })

  it("should remove ratings", () => {
    setRating("https://example.com/1", 7)
    const removed = removeRating("https://example.com/1")
    expect(removed).toBe(true)
    expect(getRating("https://example.com/1")).toBeNull()
  })

  it("should list ratings with sorting and min-rating filtering", () => {
    setRating("https://example.com/low", 2, "Low Rating")
    setRating("https://example.com/mid", 6, "Mid Rating")
    setRating("https://example.com/high", 9, "High Rating")

    const highOnly = listRatings({ minRating: 6 })
    expect(highOnly.length).toBe(2)
    expect(highOnly[0].rating).toBe(9)
    expect(highOnly[1].rating).toBe(6)

    const all = listRatings()
    expect(all.length).toBe(3)
    expect(all[0].rating).toBe(9)
  })

  it("should return ratings map", () => {
    setRating("https://example.com/1", 4)
    setRating("https://example.com/2", 10)

    const map = getRatingsMap()
    expect(map.get("https://example.com/1")).toBe(4)
    expect(map.get("https://example.com/2")).toBe(10)
    expect(map.has("https://example.com/3")).toBe(false)
  })
})
