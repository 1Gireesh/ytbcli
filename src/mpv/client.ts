import net from "node:net"
import { EventEmitter } from "node:events"
import type { MpvCommand, MpvResponse, MpvEvent, MpvClientOptions } from "./types"

export class MpvClient extends EventEmitter {
  private socket: net.Socket | null = null
  private socketPath: string
  private buffer: string = ""
  private requestId: number = 0
  private pendingRequests: Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }> = new Map()

  constructor(options: MpvClientOptions = {}) {
    super()
    this.socketPath = options.socketPath || process.env.MPV_SOCKET || "/tmp/mpvsocket"
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.socketPath)

      this.socket.on("connect", () => resolve())

      this.socket.on("data", (data) => {
        this.buffer += data.toString()
        const lines = this.buffer.split("\n")
        this.buffer = lines.pop() || ""
        for (const line of lines) {
          if (line.trim()) {
            try {
              const msg = JSON.parse(line)
              if ("request_id" in msg && msg.request_id !== undefined) {
                const pending = this.pendingRequests.get(msg.request_id)
                if (pending) {
                  clearTimeout(pending.timer)
                  this.pendingRequests.delete(msg.request_id)
                  msg.error === "success" ? pending.resolve(msg.data) : pending.reject(new Error(msg.error))
                }
              }
              if ("event" in msg) this.emit("event", msg as MpvEvent)
            } catch (err) {
              this.emit("error", err)
            }
          }
        }
      })

      this.socket.on("error", (err) => {
        if (this.pendingRequests.size > 0) {
          for (const pending of this.pendingRequests.values()) {
            clearTimeout(pending.timer)
            pending.reject(err)
          }
          this.pendingRequests.clear()
        }
        reject(err)
      })

      this.socket.on("close", () => {
        for (const pending of this.pendingRequests.values()) {
          clearTimeout(pending.timer)
          pending.reject(new Error("Connection closed"))
        }
        this.pendingRequests.clear()
        this.emit("close")
      })
    })
  }

  disconnect(): void {
    this.socket?.destroy()
    this.socket = null
  }

  command(...args: (string | number | boolean)[]): Promise<unknown> {
    return this.send({ command: args })
  }

  getProperty<T = unknown>(property: string): Promise<T> {
    return this.command("get_property", property) as Promise<T>
  }

  setProperty(property: string, value: unknown): Promise<void> {
    return this.command("set_property", property, value) as Promise<void>
  }

  observeProperty(id: number, property: string): Promise<void> {
    return this.command("observe_property", id, property) as Promise<void>
  }

  private send(msg: Omit<MpvCommand, "request_id">, timeout: number = 5000): Promise<unknown> {
    if (!this.socket) throw new Error("Not connected to mpv")
    const requestId = ++this.requestId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error("Request timed out"))
      }, timeout)
      this.pendingRequests.set(requestId, { resolve, reject, timer })
      this.socket!.write(JSON.stringify({ ...msg, request_id: requestId }) + "\n")
    })
  }
}
