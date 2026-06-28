import type { CommandModule } from "yargs"
import { search } from "../ytdlp"
import { writeFileSync } from "fs"

const SEARCH_CACHE = "/tmp/ytcli-search.json"

export function getSearchCachePath(): string {
  return SEARCH_CACHE
}

const command: CommandModule = {
  command: "search",
  describe: "Search YouTube videos",
  builder: (yargs) =>
    yargs
      .option("count", {
        description: "Number of results",
        type: "number",
        default: 5,
        alias: "n",
      })
      .option("json", {
        description: "Output raw JSON",
        type: "boolean",
        default: false,
      })
      .middleware((argv) => {
        const query = argv._.slice(1).join(" ")
        if (!query) {
          throw new Error("Please provide a search query")
        }
        argv.query = query
      }),
  handler: async (argv) => {
    try {
      const results = await search(argv.query as string, argv.count as number)

      if (results.length === 0) {
        console.log("No results found")
        return
      }

      writeFileSync(SEARCH_CACHE, JSON.stringify(results, null, 2))

      if (argv.json) {
        console.log(JSON.stringify(results, null, 2))
        return
      }

      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        console.log(`${i + 1}. ${r.title}`)
        console.log(`   ${r.channel} | ${r.duration}`)
        console.log(`   ${r.url}`)
        console.log()
      }

      console.log(`Play any result: ytcli play <number>`)
    } catch (err) {
      console.error(`Search failed: ${err instanceof Error ? err.message : err}`)
      process.exit(1)
    }
  },
}

export default command
