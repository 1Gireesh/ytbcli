# ytbcli

YouTube CLI player built with Bun, yargs, Drizzle ORM (SQLite), and mpv IPC.

## Build & Run

```bash
bun install                    # install deps
bun run src/index.ts           # dev run
bun build --compile --outfile ytcli src/index.ts  # compile binary
./ytcli <command>              # run compiled binary
```

## Tests

```bash
bun test src/db/__tests__/     # run all db tests
bun test src/db/__tests__/playlists.test.ts  # single file
```

Tests require tables to exist. `src/db/__tests__/setup.ts` creates them via `beforeAll`.

## Architecture

```
src/
  index.ts          # yargs entrypoint, shebang #!/usr/bin/env bun
  commands/         # yargs CommandModule definitions
    playlist/       # nested subcommands (manage.ts, items.ts, io.ts, play.ts, index.ts)
    queue/          # nested subcommands (items.ts, index.ts)
    history/        # nested subcommands (items.ts, io.ts, index.ts)
    config/         # nested subcommands (config.ts, index.ts)
    playback.ts     # status, current, next, prev, pause, stop (uses mpv)
    play.ts         # play <url> (uses mpv)
    search.ts       # search <query> (stub)
    data.ts         # export/import all data
  db/               # Drizzle ORM controllers
    schema.ts       # table definitions
    index.ts        # db connection (~/.local/share/ytcli/ytcli.db)
    playlists.ts    # playlist CRUD
    queue.ts        # queue CRUD
    history.ts      # history CRUD
    config.ts       # config CRUD
    export.ts       # export/import all data
  mpv/              # mpv IPC client
    client.ts       # MpvClient class (Unix socket, request/response with timeouts)
    commands.ts     # thin wrappers: play, pause, stop, next, prev, seek, setVolume, setSpeed
    types.ts        # MpvCommand, MpvResponse, MpvEvent
```

## Key Conventions

- **Short-lived processes**: CLI starts, runs one command, exits. No daemon.
- **mpv IPC**: Connects to Unix socket (`/tmp/mpvsocket` or `MPV_SOCKET` env var). Start mpv with `mpv --idle --input-ipc-server=/tmp/mpvsocket`.
- **DB location**: `~/.local/share/ytcli/ytcli.db` (auto-created)
- **Command pattern**: `src/commands/<name>/index.ts` wires subcommands, files in same dir are the handlers.
- **withClient helper**: `src/commands/playback.ts` exports `withClient(fn)` for mpv commands. Use it instead of manual connect/disconnect.
- **No comments in code** unless user asks.
- **Playground is /tmp/opencode** for external work.

## mpv Commands

```bash
./ytcli play <url> [--audio-only]
./ytcli pause        # toggles pause
./ytcli stop
./ytcli next / prev
./ytcli status       # JSON: title, paused, volume, position, duration
./ytcli current      # JSON: title, filename
```

mpv must be running: `mpv --idle --input-ipc-server=/tmp/mpvsocket &`

## Database Commands

```bash
./ytcli playlist create <name>
./ytcli playlist add <name> <url> [title]
./ytcli playlist list <name> / names / search / sort / ...
./ytcli queue add <url> [title]
./ytcli queue list / size / peek / pop / shuffle / ...
./ytcli history list / search / stats / top / ...
./ytcli config set <key> <value> / get / list / path
./ytcli export [file] / import <file>
```

All data commands print JSON to stdout.
