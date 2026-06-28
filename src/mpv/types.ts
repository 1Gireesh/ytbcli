export interface MpvCommand {
  command: (string | number | boolean)[]
  request_id?: number
}

export interface MpvResponse {
  error: string
  data: unknown
  request_id?: number
}

export interface MpvEvent {
  event: string
  id?: number
  name?: string
  data?: unknown
}

export interface MpvClientOptions {
  socketPath?: string
}
