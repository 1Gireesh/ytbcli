#! /usr/bin/env bun
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

// Commands
import searchCommand from "./commands/search"
import playCommand from "./commands/play"
import playlistCommand from "./commands/playlist"
import queueCommand from "./commands/queue"
import historyCommand from "./commands/history"
import configCommand from "./commands/config"
import { exportAllCmd, importAllCmd } from "./commands/data"

// Playback commands
import { statusCmd, currentCmd, nextCmd, prevCmd, pauseCmd, stopCmd } from "./commands/playback"

yargs(hideBin(process.argv))
  .scriptName("ytcli")
  // Search & Play
  .command(searchCommand)
  .command(playCommand)
  // Data management
  .command(playlistCommand)
  .command(queueCommand)
  .command(historyCommand)
  // Config
  .command(configCommand)
  // Data import/export
  .command(exportAllCmd)
  .command(importAllCmd)
  // Playback control
  .command(statusCmd)
  .command(currentCmd)
  .command(nextCmd)
  .command(prevCmd)
  .command(pauseCmd)
  .command(stopCmd)
  // Meta
  .demandCommand(1, "You must specify a command")
  .help()
  .parse()
