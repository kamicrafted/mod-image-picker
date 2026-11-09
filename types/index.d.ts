export type Option = {
  path: string
  // PNG thumbnail for the terminal's Image element (bytes, so tmux passes it).
  png?: string
  // JPEG thumbnail small enough to inline in an Svg on desktop surfaces.
  jpg?: string
  width: number
  height: number
}

export type Pick = {
  id: string
  prompt: string
  options: Option[]
  // 1-based option number, 0 for "none, regenerate"; absent while open.
  picked?: number
}

declare module 'claude-code' {
  interface PluginState {
    'image-picker': { picks: Shaped<Record<string, Pick>> }
  }
}
