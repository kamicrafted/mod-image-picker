export type Option = {
  path: string
  // PNG thumbnail for the terminal's Image element (bytes, so tmux passes it).
  png?: string
  // JPEG for the enlarged view on desktop surfaces: one Svg, drawn alone.
  jpg?: string
  // Small JPEG for the desktop grid, sized so all options share DESKTOP_TREE_BUDGET.
  thumb?: string
  width: number
  height: number
}

export type Pick = {
  id: string
  prompt: string
  options: Option[]
  // 1-based option number, 0 for "none, regenerate"; absent while open.
  picked?: number
  // 1-based option shown enlarged, 0 or absent for the grid.
  zoom?: number
}

declare module 'claude-code' {
  interface PluginState {
    'image-picker': { picks: Shaped<Record<string, Pick>> }
  }
}
