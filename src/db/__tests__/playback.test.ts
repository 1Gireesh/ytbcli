import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import "./setup"
import { resetConfig } from "../config"
import { getRepeatMode, isShuffleEnabled, setRepeatMode, setShuffleEnabled } from "../playback"

describe("Playback Settings", () => {
  beforeEach(() => {
    resetConfig()
  })

  afterEach(() => {
    resetConfig()
  })

  it("should default repeat mode to off", () => {
    expect(getRepeatMode()).toBe("off")
  })

  it("should set and get repeat mode", () => {
    setRepeatMode("all")
    expect(getRepeatMode()).toBe("all")
    setRepeatMode("one")
    expect(getRepeatMode()).toBe("one")
  })

  it("should default shuffle to off", () => {
    expect(isShuffleEnabled()).toBe(false)
  })

  it("should set and get shuffle state", () => {
    setShuffleEnabled(true)
    expect(isShuffleEnabled()).toBe(true)
    setShuffleEnabled(false)
    expect(isShuffleEnabled()).toBe(false)
  })
})

