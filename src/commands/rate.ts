import type { CommandModule } from "yargs"
import { setRating, getRating, removeRating, listRatings, type RatingItem } from "../db/ratings"
import { withClient } from "./playback"
import { current, list as listQueue } from "../db/queue"
import { loadSearchCache, isVideoID } from "./play"
import { getVideoInfo } from "../ytdlp"

function parseRatingValue(val: string | number): number {
  if (typeof val === "number") return Math.round(val)
  const clean = val.replace(/\/10$/, "").trim()
  const parsed = Number.parseInt(clean, 10)
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 10) {
    throw new Error(`Rating must be between 1 and 10. Received: ${val}`)
  }
  return parsed
}

async function resolveTargetSong(target?: string): Promise<{ url: string; title?: string; channel?: string; duration?: number } | null> {
  if (target) {
    if (/^\d+$/.test(target)) {
      const idx = Number.parseInt(target, 10) - 1
      const cache = loadSearchCache()
      if (cache && cache.results[idx]) {
        const item = cache.results[idx]
        return { url: item.url, title: item.title, channel: item.channel }
      }
      const queueItems = listQueue()
      if (queueItems[idx]) {
        const item = queueItems[idx]
        return { url: item.url, title: item.title || undefined, channel: item.channel || undefined, duration: item.duration || undefined }
      }
    }

    const url = isVideoID(target) ? `https://youtu.be/${target}` : target
    let title: string | undefined
    let channel: string | undefined
    let duration: number | undefined
    try {
      const info = await getVideoInfo(url)
      if (info) {
        title = info.title
        channel = info.channel
      }
    } catch {}
    return { url, title, channel, duration }
  }

  // Detect currently playing from mpv
  try {
    const mpvSong = await withClient(async (client) => {
      const [path, mediaTitle] = await Promise.allSettled([
        client.getProperty<string>("path"),
        client.getProperty<string>("media-title"),
      ])
      const currentPath = path.status === "fulfilled" ? path.value : null
      const title = mediaTitle.status === "fulfilled" ? mediaTitle.value : undefined
      if (currentPath) {
        return { url: currentPath, title }
      }
      return null
    })
    if (mpvSong) {
      const queueItems = listQueue()
      const matched = queueItems.find(i => i.url === mpvSong.url || mpvSong.url.includes(i.url.replace("https://www.youtube.com/watch?v=", "")))
      return {
        url: matched?.url || mpvSong.url,
        title: matched?.title || mpvSong.title,
        channel: matched?.channel || undefined,
        duration: matched?.duration || undefined,
      }
    }
  } catch {}

  const cur = current()
  if (cur) {
    return { url: cur.url, title: cur.title || undefined, channel: cur.channel || undefined, duration: cur.duration || undefined }
  }

  return null
}

export const listRateCmd: CommandModule = {
  command: "list",
  describe: "List all rated songs",
  builder: (yargs) =>
    yargs
      .option("min", {
        description: "Minimum rating (1-10)",
        type: "number",
        default: 1,
      })
      .option("sort", {
        description: "Sort by: rating, date, title",
        type: "string",
        choices: ["rating", "date", "title"],
        default: "rating",
      })
      .option("limit", {
        description: "Number of ratings to list",
        type: "number",
        default: 50,
      }),
  handler: (argv) => {
    const items = listRatings({
      minRating: argv.min as number,
      sortBy: argv.sort as "rating" | "date" | "title",
      limit: argv.limit as number,
    })
    const formatted = items.map(i => ({
      ...i,
      ratingFormatted: `${i.rating}/10`,
    }))
    console.log(JSON.stringify(formatted, null, 2))
  },
}

export const getRateCmd: CommandModule = {
  command: "get [target]",
  describe: "Get rating for current song or given URL",
  builder: (yargs) =>
    yargs.positional("target", {
      description: "Target URL or leave empty for currently playing",
      type: "string",
    }),
  handler: async (argv) => {
    const song = await resolveTargetSong(argv.target as string | undefined)
    if (!song) {
      console.log("No song currently playing")
      return
    }
    const r = getRating(song.url)
    if (!r) {
      console.log(JSON.stringify({ url: song.url, title: song.title, rating: null, message: "Unrated" }, null, 2))
      return
    }
    console.log(JSON.stringify({ ...r, ratingFormatted: `${r.rating}/10` }, null, 2))
  },
}

export const removeRateCmd: CommandModule = {
  command: "remove [target]",
  describe: "Remove rating for current song or given URL",
  builder: (yargs) =>
    yargs.positional("target", {
      description: "Target URL or leave empty for currently playing",
      type: "string",
    }),
  handler: async (argv) => {
    const song = await resolveTargetSong(argv.target as string | undefined)
    if (!song) {
      console.log("No target song found")
      return
    }
    const removed = removeRating(song.url)
    console.log(removed ? `Removed rating for: ${song.title || song.url}` : "No rating found")
  },
}

const rateCommand: CommandModule = {
  command: "rate [value] [target]",
  describe: "Rate the currently playing song (1-10) or manage ratings",
  builder: (yargs) =>
    yargs
      .command(listRateCmd)
      .command(getRateCmd)
      .command(removeRateCmd)
      .positional("value", {
        description: "Rating score from 1 to 10 (e.g. 3 or 3/10)",
        type: "string",
      })
      .positional("target", {
        description: "Song URL, ID, or search number (optional, defaults to current song)",
        type: "string",
      }),
  handler: async (argv) => {
    if (!argv.value) {
      const items = listRatings()
      console.log(JSON.stringify(items.map(i => ({ ...i, ratingFormatted: `${i.rating}/10` })), null, 2))
      return
    }

    if (argv.value === "list" || argv.value === "get" || argv.value === "remove") {
      return
    }

    let score: number
    try {
      score = parseRatingValue(argv.value as string)
    } catch (err) {
      console.error(err instanceof Error ? err.message : err)
      process.exit(1)
    }

    const song = await resolveTargetSong(argv.target as string | undefined)
    if (!song) {
      console.error("No song is currently playing. Specify a song URL: ytcli rate <1-10> <url>")
      process.exit(1)
    }

    const saved = setRating(song.url, score, song.title, song.channel, song.duration)
    console.log(JSON.stringify({
      score: saved.rating,
      rating: `${saved.rating}/10`,
      title: saved.title || song.title,
      channel: saved.channel || song.channel,
      url: saved.url,
      updatedAt: saved.updatedAt,
    }, null, 2))
  },
}

export default rateCommand
