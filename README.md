# image-picker

A Claude Code mod for choosing between generated images without leaving the session. When an image tool gives you several options, Claude shows them as a grid right in the transcript. Click **Pick N** or press its number, and your choice goes back to Claude as your next message. No Preview window, no switching apps.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install image-picker --marketplace kamicrafted/mod-image-picker
```

Answer `y` to add the marketplace, then press Enter to install at the user scope.

From a shell:

```
claude plugin install image-picker --marketplace kamicrafted/mod-image-picker
```

In the Claude desktop app, where `/plugin` doesn't run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `kamicrafted/mod-image-picker`, then **Add plugin**.

## How it works

The mod gives Claude a `pick_image` tool that takes 2 to 9 image paths. Claude calls it whenever a generation gives several options. You can also ask for it directly, for example "show me these four and let me pick". The grid shows 2 across for up to 4 options and 3 across for more. Under it are a **None of these** button and a hint that you can also type the number.

Each image is shrunk to a thumbnail first, and your originals are left as they are. The mod uses the first resizer it finds: ImageMagick (`magick`), libvips (`vipsthumbnail`), `sips` (built into every Mac) or `ffmpeg`.

If Claude tries to open two or more images at once in a viewer (`open`, `xdg-open`, `imv` and the like), the mod blocks it and points Claude to the picker. Opening a single image still works.

## Where it shows images

| Where | What you see |
| --- | --- |
| Ghostty or kitty, on Linux or macOS | Real images |
| Inside tmux 3.3 or later | Real images, once `allow-passthrough` and `focus-events` are both on (see below) |
| iTerm2 3.5 or later | Real images in Claude Code's fullscreen mode |
| Claude desktop app, VS Code | Thumbnails drawn in the app's own panel |
| Other terminals | Numbered file names, with the same Pick buttons |

For tmux, add these lines to `~/.tmux.conf`:

```
set -g allow-passthrough on
set -g focus-events on
```

## License

MIT
