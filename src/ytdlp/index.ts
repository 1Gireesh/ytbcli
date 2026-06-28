import { spawn } from "child_process"

export interface SearchResult {
  id: string
  title: string
  channel: string
  duration: string
  url: string
}

interface InnerTubeResponse {
  contents?: {
    twoColumnSearchResultsRenderer?: {
      primaryContents?: {
        sectionListRenderer?: {
          contents?: Array<{
            itemSectionRenderer?: {
              contents?: Array<{
                videoRenderer?: {
                  videoId: string
                  title: { runs: Array<{ text: string }> }
                  ownerText: { runs: Array<{ text: string }> }
                  lengthText?: { simpleText: string }
                }
              }>
            }
          }>
        }
      }
    }
  }
}

const CLIENT = {
  hl: "en",
  gl: "US",
  clientName: "WEB",
  clientVersion: "2.20260626.01.00",
}

async function innertubeSearch(query: string, count = 5): Promise<SearchResult[]> {
  const body = {
    context: { client: CLIENT },
    query,
  }

  const res = await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-YouTube-Client-Name": "1",
      "X-YouTube-Client-Version": CLIENT.clientVersion,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)

  const data: InnerTubeResponse = await res.json()
  const items = data.contents?.twoColumnSearchResultsRenderer?.primaryContents
    ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || []

  const results: SearchResult[] = []
  for (const item of items) {
    const v = item.videoRenderer
    if (!v) continue
    results.push({
      id: v.videoId,
      title: v.title.runs[0]?.text || "Unknown",
      channel: v.ownerText.runs[0]?.text || "Unknown",
      duration: v.lengthText?.simpleText || "0:00",
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
    })
    if (results.length >= count) break
  }

  return results
}

function runYtdlp(args: string[], timeout = 60000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", args, {
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    proc.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error("yt-dlp timed out"))
    }, timeout)

    proc.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`))
      }
    })

    proc.on("error", (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

async function ytdlpSearch(query: string, count = 5): Promise<SearchResult[]> {
  const output = await runYtdlp([
    `ytsearch${count}:${query}`,
    "--dump-json",
    "--no-download",
    "--no-warnings",
    "--extractor-args", "youtube:player_client=android",
  ])

  const lines = output.trim().split("\n").filter(Boolean)
  const results: SearchResult[] = []

  for (const line of lines) {
    try {
      const data = JSON.parse(line)
      const mins = Math.floor((data.duration || 0) / 60)
      const secs = (data.duration || 0) % 60
      results.push({
        id: data.id,
        title: data.title,
        channel: data.channel || data.uploader || "Unknown",
        duration: `${mins}:${secs.toString().padStart(2, "0")}`,
        url: data.webpage_url || `https://www.youtube.com/watch?v=${data.id}`,
      })
    } catch {
      continue
    }
  }

  return results
}

export async function search(query: string, count = 5): Promise<SearchResult[]> {
  try {
    return await innertubeSearch(query, count)
  } catch {
    return ytdlpSearch(query, count)
  }
}

export async function getVideoInfo(url: string): Promise<{ id: string; title: string; channel: string; duration: string } | null> {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  const videoId = match?.[1]
  if (!videoId) return null

  try {
    const results = await innertubeSearch(videoId, 1)
    return results[0] || null
  } catch {
    return null
  }
}
