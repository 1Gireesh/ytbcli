import { getConfig, setConfig } from "./config"

export type RepeatMode = "off" | "one" | "all"

const REPEAT_KEY = "playback.repeat"
const SHUFFLE_KEY = "playback.shuffle"

export function getRepeatMode(): RepeatMode {
  const mode = getConfig(REPEAT_KEY)
  if (mode === "one" || mode === "all" || mode === "off") {
    return mode
  }
  return "off"
}

export function setRepeatMode(mode: RepeatMode): void {
  setConfig(REPEAT_KEY, mode)
}

export function isShuffleEnabled(): boolean {
  return getConfig(SHUFFLE_KEY) === "true"
}

export function setShuffleEnabled(enabled: boolean): void {
  setConfig(SHUFFLE_KEY, enabled ? "true" : "false")
}

