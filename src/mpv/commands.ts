import type { MpvClient } from "./client"

export const play = (client: MpvClient, url: string) => client.command("loadfile", url, "replace")
export const append = (client: MpvClient, url: string) => client.command("loadfile", url, "append")
export const pause = (client: MpvClient) => client.setProperty("pause", true)
export const unpause = (client: MpvClient) => client.setProperty("pause", false)
export const togglePause = (client: MpvClient) => client.command("cycle", "pause")
export const stop = (client: MpvClient) => client.command("stop")
export const seek = (client: MpvClient, seconds: number, mode?: "relative" | "absolute") =>
  client.command("seek", seconds, mode || "relative")
export const setVolume = (client: MpvClient, volume: number) =>
  client.setProperty("volume", Math.max(0, Math.min(100, volume)))
export const setSpeed = (client: MpvClient, speed: number) =>
  client.setProperty("speed", Math.max(0.1, Math.min(10, speed)))
