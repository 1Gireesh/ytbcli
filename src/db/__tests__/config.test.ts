import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import "./setup"
import { getConfig, setConfig, listConfig, resetConfig, getConfigPath } from "../config"

describe("Config Controller", () => {
  beforeEach(() => {
    resetConfig()
  })

  afterEach(() => {
    resetConfig()
  })

  it("should set and get config", () => {
    setConfig("theme", "dark")
    const value = getConfig("theme")
    expect(value).toBe("dark")
  })

  it("should update existing config", () => {
    setConfig("theme", "dark")
    setConfig("theme", "light")
    const value = getConfig("theme")
    expect(value).toBe("light")
  })

  it("should list config", () => {
    setConfig("theme", "dark")
    setConfig("language", "en")
    const items = listConfig()
    expect(items.length).toBe(2)
  })

  it("should reset config by key", () => {
    setConfig("theme", "dark")
    setConfig("language", "en")
    const result = resetConfig("theme")
    expect(result).toBe(true)
    expect(getConfig("theme")).toBeUndefined()
    expect(getConfig("language")).toBe("en")
  })

  it("should reset all config", () => {
    setConfig("theme", "dark")
    setConfig("language", "en")
    const result = resetConfig()
    expect(result).toBe(true)
    expect(listConfig().length).toBe(0)
  })

  it("should get config path", () => {
    const path = getConfigPath()
    expect(path).toContain("ytcli.db")
  })
})
